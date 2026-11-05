-- Affiliate program: a creator has a code, students type it at checkout, and the creator sees their
-- numbers on /creators. You manage creators and record hand-made payouts on /admin.
--
-- Flow: `affiliate-admin` (the /admin panel) adds a creator with a login and e-mails them a link to
-- set a password; `billing-checkout` checks the code and puts affiliate_id in the Stripe metadata;
-- `billing-webhook` adds a row to affiliate_sales for every paid Pakiet or monthly invoice, and lowers
-- the commission when Stripe reports a refund.
--
-- A month's commission is paid on the 15th of the next month, when the 14 days to withdraw from
-- every purchase of that month have passed. A refund after a payout lowers the next one.

-- ─────────────────────────────────────────────────────────────
-- 1. Tables (written by the Edge Functions, read only through the functions below)
-- ─────────────────────────────────────────────────────────────
-- Who can open /admin. Add someone after they made an account:
--   insert into app_admins (user_id) select id from auth.users where email = '…';
create table public.app_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.affiliates (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid unique references auth.users (id) on delete set null, -- who can open the panel
  email               text not null check (char_length(email) between 3 and 254), -- that login's address
  name                text not null check (char_length(name) between 1 and 80),
  code                text not null unique check (code ~ '^[A-Z0-9_-]{3,20}$'),
  commission_percent  int  not null default 10 check (commission_percent between 0 and 100),
  discount_percent    int  not null default 10 check (discount_percent between 0 and 90), -- first payment only
  commission_months   int  check (commission_months between 1 and 120), -- paid months of a subscription that count; null = all
  active              boolean not null default true,      -- false: the code stops working, renewals still count
  -- About the partnership, for you only (never shown in the creator's panel):
  platform            text check (char_length(platform) <= 40),
  profile_url         text check (char_length(profile_url) <= 300),
  contact             text check (char_length(contact) <= 200),
  payout_details      text check (char_length(payout_details) <= 300), -- where to send the money
  ad_fee              int  not null default 0 check (ad_fee >= 0),     -- grosze paid for the ad itself
  starts_on           date,
  ends_on             date check (ends_on >= starts_on),
  notes               text check (char_length(notes) <= 2000),
  created_at          timestamptz not null default now()
);

-- One row per payment. No student's name or e-mail here: the panel must not be able to show them.
create table public.affiliate_sales (
  id                      uuid primary key default gen_random_uuid(),
  affiliate_id            uuid not null references public.affiliates (id) on delete restrict,
  stripe_ref              text not null unique, -- invoice or Checkout session id: a retried event adds nothing
  stripe_customer_id      text not null,        -- counts people, not payments
  stripe_subscription_id  text,
  stripe_payment_intent   text,                 -- finds this row when Stripe reports a refund
  plan                    text not null check (plan in ('monthly', 'matura')),
  amount_paid             int  not null check (amount_paid > 0),            -- grosze
  refunded_amount         int  not null default 0 check (refunded_amount >= 0), -- grosze
  commission_percent      int  not null check (commission_percent between 0 and 100), -- as it was on the day of the sale
  commission              int  generated always as (round(greatest(amount_paid - refunded_amount, 0) * commission_percent / 100.0)::int) stored,
  paid_at                 timestamptz not null
);
create index affiliate_sales_affiliate_idx on public.affiliate_sales (affiliate_id, paid_at desc);
create index affiliate_sales_payment_intent_idx on public.affiliate_sales (stripe_payment_intent);

create table public.affiliate_payouts (
  id            uuid primary key default gen_random_uuid(),
  affiliate_id  uuid not null references public.affiliates (id) on delete restrict,
  amount        int  not null check (amount > 0), -- grosze
  paid_at       timestamptz not null default now(),
  note          text check (char_length(note) <= 200) -- for you, not shown in the creator's panel
);
create index affiliate_payouts_affiliate_idx on public.affiliate_payouts (affiliate_id, paid_at desc);

alter table public.app_admins enable row level security;        -- no policies: service role only
alter table public.affiliates enable row level security;        -- no policies: service role only
alter table public.affiliate_sales enable row level security;   -- no policies: service role only
alter table public.affiliate_payouts enable row level security; -- no policies: service role only

-- ─────────────────────────────────────────────────────────────
-- 2. Numbers. Amounts in grosze.
-- ─────────────────────────────────────────────────────────────
-- One creator's numbers, as their panel shows them. Internal: the wrappers below decide who may see it.
create or replace function public.affiliate_panel(p_affiliate uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (
    select * from public.affiliates where id = p_affiliate
  ), sales as (
    select s.*,
           date_trunc('month', s.paid_at at time zone 'Europe/Warsaw')::date as month,
           (date_trunc('month', s.paid_at at time zone 'Europe/Warsaw') + interval '1 month 14 days')::date as payout_on
    from public.affiliate_sales s join me on s.affiliate_id = me.id
  ), balance as (
    select coalesce((select sum(commission) from sales where payout_on <= public.warsaw_today()), 0) as ready,
           coalesce((select sum(commission) from sales where payout_on > public.warsaw_today()), 0) as waiting,
           coalesce((select sum(p.amount) from public.affiliate_payouts p join me on p.affiliate_id = me.id), 0) as paid_out
  )
  select jsonb_build_object(
    'name', me.name,
    'code', me.code,
    'active', me.active,
    'commissionPercent', me.commission_percent,
    'discountPercent', me.discount_percent,
    'commissionMonths', me.commission_months,
    'buyers', (select count(distinct stripe_customer_id) from sales where refunded_amount < amount_paid),
    'payments', (select count(*) from sales where refunded_amount < amount_paid),
    'revenue', (select coalesce(sum(greatest(amount_paid - refunded_amount, 0)), 0) from sales),
    'earned', b.ready + b.waiting,
    'paidOut', b.paid_out,
    'due', greatest(b.ready - b.paid_out, 0),
    -- More paid out than earned so far (a refund after a payout): it comes off the next payout.
    'waiting', greatest(b.waiting + least(b.ready - b.paid_out, 0), 0),
    'months', coalesce((
      select jsonb_agg(m order by m.month desc) from (
        select month, payout_on as "payoutOn",
               count(*) filter (where refunded_amount < amount_paid) as payments,
               count(distinct stripe_customer_id) filter (where refunded_amount < amount_paid) as buyers,
               sum(commission) as commission
        from sales group by month, payout_on
      ) m), '[]'::jsonb),
    'sales', coalesce((
      select jsonb_agg(r order by r."paidAt" desc) from (
        select paid_at as "paidAt", plan, amount_paid as "amountPaid", refunded_amount as "refundedAmount", commission
        from sales order by paid_at desc limit 50
      ) r), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(r order by r."paidAt" desc) from (
        select p.paid_at as "paidAt", p.amount
        from public.affiliate_payouts p join me on p.affiliate_id = me.id
      ) r), '[]'::jsonb)
  )
  from me, balance b
$$;

-- /creators: the logged-in creator's own numbers, null for everyone else.
create or replace function public.my_affiliate_panel() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.affiliate_panel(a.id) from public.affiliates a where a.user_id = (select auth.uid())
$$;

-- Checkout: does this code work for me? Your own code doesn't. → { code, discountPercent } or null
create or replace function public.check_affiliate_code(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('code', a.code, 'discountPercent', a.discount_percent)
  from public.affiliates a
  where a.code = upper(trim(p_code)) and a.active and a.user_id is distinct from (select auth.uid())
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. /admin (reads; writes go through the Edge Function `affiliate-admin`)
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins where user_id = (select auth.uid()))
$$;

-- Partnership details only you see, and whether the creator has set a password yet.
create or replace function public.affiliate_admin_fields(a public.affiliates) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', a.id, 'email', a.email, 'platform', a.platform, 'profileUrl', a.profile_url, 'contact', a.contact,
    'payoutDetails', a.payout_details, 'adFee', a.ad_fee, 'startsOn', a.starts_on, 'endsOn', a.ends_on,
    'notes', a.notes, 'createdAt', a.created_at,
    'hasPassword', coalesce((select u.encrypted_password <> '' from auth.users u where u.id = a.user_id), false),
    'lastSignInAt', (select u.last_sign_in_at from auth.users u where u.id = a.user_id)
  )
$$;

-- Every creator with their totals (no month or payment lists).
create or replace function public.admin_affiliates() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(public.affiliate_panel(a.id) - 'months' - 'sales' - 'payouts' || public.affiliate_admin_fields(a)
                     order by a.active desc, a.created_at desc)
    from public.affiliates a
  ), '[]'::jsonb);
end;
$$;

-- One creator: their panel, the details only you see, and payouts you can correct.
create or replace function public.admin_affiliate(p_affiliate uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return (
    select public.affiliate_panel(a.id) || public.affiliate_admin_fields(a) || jsonb_build_object('payouts', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'paidAt', p.paid_at, 'amount', p.amount, 'note', p.note) order by p.paid_at desc)
      from public.affiliate_payouts p where p.affiliate_id = a.id), '[]'::jsonb))
    from public.affiliates a where a.id = p_affiliate
  );
end;
$$;

-- For `affiliate-admin`: the login behind an e-mail, if there is one.
create or replace function public.auth_user_by_email(p_email text)
returns table (id uuid, has_password boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, coalesce(u.encrypted_password <> '', false) from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1
$$;

revoke all on function public.affiliate_panel(uuid) from public, anon, authenticated;
revoke all on function public.affiliate_admin_fields(public.affiliates) from public, anon, authenticated;
revoke all on function public.auth_user_by_email(text) from public, anon, authenticated;
revoke all on function public.my_affiliate_panel() from public, anon;
revoke all on function public.check_affiliate_code(text) from public, anon;
revoke all on function public.is_app_admin() from public, anon;
revoke all on function public.admin_affiliates() from public, anon;
revoke all on function public.admin_affiliate(uuid) from public, anon;
grant execute on function public.auth_user_by_email(text) to service_role;
grant execute on function public.my_affiliate_panel() to authenticated;
grant execute on function public.check_affiliate_code(text) to authenticated;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.admin_affiliates() to authenticated;
grant execute on function public.admin_affiliate(uuid) to authenticated;
