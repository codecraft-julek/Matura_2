-- Payments (Stripe) and AI limits per plan.
--
-- Flow: the website calls the Edge Function `billing-checkout`, which creates a Stripe Checkout
-- page; the student pays on Stripe's own page (BLIK, card, Przelewy24); Stripe tells the Edge
-- Function `billing-webhook` what happened, and only that function writes billing_accounts.
-- Nothing on the website can switch Premium on by itself.
--
-- Two ways to have Premium:
--   subscription_until  monthly subscription: end of the paid period (renewed by Stripe)
--   pass_until          "Pakiet do matury": one payment, valid until a fixed date
-- Premium = whichever of the two is later is still in the future.

-- ─────────────────────────────────────────────────────────────
-- 1. Who paid for what (written ONLY by the billing Edge Functions, service role)
-- ─────────────────────────────────────────────────────────────
create table public.billing_accounts (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id      text unique,
  stripe_subscription_id  text,
  subscription_status     text,            -- Stripe's status: active, past_due, canceled, ...
  subscription_until      timestamptz,
  cancel_at_period_end    boolean not null default false,
  pass_until              timestamptz,
  updated_at              timestamptz not null default now()
);
alter table public.billing_accounts enable row level security;

create policy "billing: read own" on public.billing_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
-- No insert/update policies: only the Edge Functions write (service role bypasses RLS).

-- Stripe webhook events already handled (Stripe may send the same event more than once).
create table public.stripe_events (
  id          text primary key,
  type        text not null,
  created_at  timestamptz not null default now()
);
alter table public.stripe_events enable row level security; -- no policies: service role only

-- ─────────────────────────────────────────────────────────────
-- 2. AI limits per plan. Change them here (Table Editor → plan_limits), no deploy needed.
--    Keep the texts in src/config/plans.ts (pricing page) in sync.
--    period 'week' = Monday to Sunday, Polish time.
-- ─────────────────────────────────────────────────────────────
create table public.plan_limits (
  plan      text not null check (plan in ('free', 'premium')),
  feature   text not null check (feature in ('essay_feedback', 'tutor', 'open_grading', 'notes', 'flashcards')),
  max_uses  int  not null check (max_uses >= 0),
  period    text not null check (period in ('day', 'week')),
  primary key (plan, feature)
);
alter table public.plan_limits enable row level security;
create policy "plan_limits: public read" on public.plan_limits for select to anon, authenticated using (true);

insert into public.plan_limits (plan, feature, max_uses, period) values
  ('free',    'essay_feedback', 2,  'week'),
  ('free',    'open_grading',   2,  'week'),
  ('free',    'tutor',          10, 'day'),
  ('free',    'notes',          3,  'week'),
  ('free',    'flashcards',     3,  'week'),
  ('premium', 'essay_feedback', 2,  'day'),
  ('premium', 'open_grading',   10, 'day'),
  ('premium', 'tutor',          50, 'day'),
  ('premium', 'notes',          5,  'day'),
  ('premium', 'flashcards',     10, 'day');

-- ─────────────────────────────────────────────────────────────
-- 3. Plan lookup and the quota check the AI Edge Functions use
-- ─────────────────────────────────────────────────────────────
create or replace function public.user_plan(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when coalesce((select greatest(subscription_until, pass_until) > now()
                   from public.billing_accounts where user_id = p_user), false)
    then 'premium' else 'free' end
$$;

-- First day of the current limit window ('day' = today, 'week' = this Monday), Polish time.
create or replace function public.quota_since(p_period text) returns date
language sql stable set search_path = '' as $$
  select case p_period when 'week' then date_trunc('week', public.warsaw_today())::date else public.warsaw_today() end
$$;

-- Like consume_ai_quota(), but the student's limit comes from their plan (plan_limits).
-- Returns { allowed, reason ('user' | 'global'), plan, limit, period } so the function can say why.
-- The global cap per day (protects the AI bill) stays a parameter.
create or replace function public.consume_plan_quota(p_user uuid, p_feature text, p_global_limit int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.warsaw_today();
  v_plan text := public.user_plan(p_user);
  lim public.plan_limits;
  used_global int;
  used_user int;
  info jsonb;
begin
  select * into lim from public.plan_limits where plan = v_plan and feature = p_feature;
  if not found then
    raise exception 'no plan limit for % / %', v_plan, p_feature;
  end if;
  info := jsonb_build_object('plan', v_plan, 'limit', lim.max_uses, 'period', lim.period);

  -- Serialise quota checks for this feature+day, so parallel requests can't overshoot.
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || p_feature || ':' || today::text));

  select coalesce(sum(count), 0) into used_global from public.ai_usage where day = today and feature = p_feature;
  if used_global >= p_global_limit then
    return info || jsonb_build_object('allowed', false, 'reason', 'global');
  end if;

  select coalesce(sum(count), 0) into used_user
    from public.ai_usage
    where user_id = p_user and feature = p_feature and day >= public.quota_since(lim.period);
  if used_user >= lim.max_uses then
    return info || jsonb_build_object('allowed', false, 'reason', 'user');
  end if;

  insert into public.ai_usage (user_id, day, feature, count)
  values (p_user, today, p_feature, 1)
  on conflict (user_id, day, feature) do update set count = public.ai_usage.count + 1;
  return info || jsonb_build_object('allowed', true);
end;
$$;

-- What the logged-in student has left, per feature (for "W tym tygodniu zostało: 2").
create or replace function public.my_ai_allowance()
returns table (feature text, plan text, max_uses int, period text, used int)
language sql stable security definer set search_path = '' as $$
  select l.feature, l.plan, l.max_uses, l.period,
         coalesce((select sum(u.count) from public.ai_usage u
                   where u.user_id = (select auth.uid()) and u.feature = l.feature
                     and u.day >= public.quota_since(l.period)), 0)::int
  from public.plan_limits l
  where l.plan = public.user_plan((select auth.uid()))
$$;

revoke all on function public.user_plan(uuid) from public, anon, authenticated;
revoke all on function public.consume_plan_quota(uuid, text, int) from public, anon, authenticated;
revoke all on function public.my_ai_allowance() from public, anon;
grant execute on function public.user_plan(uuid) to service_role;
grant execute on function public.consume_plan_quota(uuid, text, int) to service_role;
grant execute on function public.my_ai_allowance() to authenticated;

-- Handy queries (SQL Editor):
--   select u.email, b.* from billing_accounts b join auth.users u on u.id = b.user_id order by b.updated_at desc;
--   -- give someone Premium by hand (e.g. a friend, a contest prize), until a date:
--   insert into billing_accounts (user_id, pass_until) values ('…', '2027-05-31 23:59+02')
--     on conflict (user_id) do update set pass_until = excluded.pass_until, updated_at = now();
