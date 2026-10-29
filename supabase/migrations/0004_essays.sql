-- AI essay feedback: essays + feedback, and daily AI usage limits.
--
-- Writes happen ONLY in the Edge Function `essay-feedback` (service role), after it has checked
-- the student's login and daily limit. Students can read and delete their own essays.

-- ─────────────────────────────────────────────────────────────
-- 1. Essays and their feedback
-- ─────────────────────────────────────────────────────────────
create table public.essays (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('polish_essay', 'english_writing')),
  level         text not null check (level in ('basic', 'extended')),
  attempt_id    uuid references public.exam_attempts (id) on delete set null, -- set when it comes from an exam
  task_number   text,
  topic         text not null default '' check (char_length(topic) <= 3000),   -- essay topic or task instructions
  content       text not null check (char_length(content) between 1 and 20000),
  word_count    int  not null check (word_count >= 0),
  status        text not null default 'pending' check (status in ('pending', 'done', 'error')),
  feedback      jsonb,                                                       -- see supabase/functions/_shared/essay.ts
  model         text,
  error         text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index essays_user_idx on public.essays (user_id, created_at desc);
create index essays_attempt_idx on public.essays (attempt_id, task_number);

alter table public.essays enable row level security;

create policy "essays: read own" on public.essays
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "essays: delete own" on public.essays
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Daily AI usage (per student, per feature), counted in Polish time
-- ─────────────────────────────────────────────────────────────
create table public.ai_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  feature  text not null check (feature in ('essay_feedback', 'tutor')),
  count    int  not null default 0 check (count >= 0),
  primary key (user_id, day, feature)
);
alter table public.ai_usage enable row level security;

-- Students may see their own usage (to show "zostały Ci 2 sprawdzenia dzisiaj").
create policy "ai_usage: read own" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.warsaw_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Warsaw')::date
$$;

-- Takes one unit of quota. Returns true if allowed.
-- Two limits: per student per day, and a GLOBAL cap per day (protects your AI bill
-- even if many accounts are created). Locks the day's rows so parallel requests can't overshoot.
create or replace function public.consume_ai_quota(
  p_user uuid,
  p_feature text,
  p_user_limit int,
  p_global_limit int
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.warsaw_today();
  used_global int;
  used_user int;
begin
  -- Serialise quota checks for this feature+day (cheap: one advisory lock per request).
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || p_feature || ':' || today::text));

  select coalesce(sum(count), 0) into used_global
    from public.ai_usage where day = today and feature = p_feature;
  if used_global >= p_global_limit then
    return false;
  end if;

  select coalesce(count, 0) into used_user
    from public.ai_usage where user_id = p_user and day = today and feature = p_feature;
  if coalesce(used_user, 0) >= p_user_limit then
    return false;
  end if;

  insert into public.ai_usage (user_id, day, feature, count)
  values (p_user, today, p_feature, 1)
  on conflict (user_id, day, feature) do update set count = public.ai_usage.count + 1;
  return true;
end;
$$;

-- Gives the unit back when the AI call failed, so students don't lose a try because of us.
create or replace function public.refund_ai_quota(p_user uuid, p_feature text) returns void
language sql security definer set search_path = '' as $$
  update public.ai_usage set count = greatest(count - 1, 0)
  where user_id = p_user and day = public.warsaw_today() and feature = p_feature;
$$;

-- Only the Edge Function (service role) may change quota.
revoke all on function public.consume_ai_quota(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, int, int) to service_role;
grant execute on function public.refund_ai_quota(uuid, text) to service_role;
