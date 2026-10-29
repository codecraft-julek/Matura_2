-- Waitlist + rate limiting.
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- ─────────────────────────────────────────────────────────────
-- 1. Waitlist signups
-- ─────────────────────────────────────────────────────────────
create table if not exists public.waitlist_signups (
  id               uuid primary key default gen_random_uuid(),
  email            text not null check (char_length(email) <= 254),
  subjects         text[] not null
                   check (cardinality(subjects) >= 1 and subjects <@ array['polish', 'english']),
  matura_year      text not null check (matura_year in ('2027', '2028', 'other')),
  consent_privacy  boolean not null check (consent_privacy),   -- must be true
  age_confirmed    boolean not null check (age_confirmed),     -- must be true
  consent_version  text not null,                              -- which consent wording they saw
  utm_source       text check (char_length(utm_source) <= 100),
  utm_medium       text check (char_length(utm_medium) <= 100),
  utm_campaign     text check (char_length(utm_campaign) <= 100),
  ref              text check (char_length(ref) <= 100),
  created_at       timestamptz not null default now()
);

-- One signup per email, case-insensitive (Ala@x.pl = ala@x.pl).
create unique index if not exists waitlist_signups_email_key
  on public.waitlist_signups (lower(email));

-- RLS on with NO policies = the public (anon/publishable) key can't read or write anything.
-- Only our server, using the secret key, can access this table.
alter table public.waitlist_signups enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 2. Rate limiting (fixed window counter)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.rate_limits (
  key           text not null,          -- sha256 hash, never a raw IP
  window_start  timestamptz not null,
  hits          int not null default 1,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;

-- Counts one hit and returns true if the caller is still under the limit.
-- "insert ... on conflict do update" is atomic, so two requests at once can't both sneak through.
create or replace function public.hit_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into rate_limits (key, window_start)
  values (p_key, v_window)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into v_hits;

  -- Housekeeping: drop windows older than a day so the table stays tiny.
  delete from rate_limits where window_start < now() - interval '1 day';

  return v_hits <= p_limit;
end;
$$;

-- Only the server (service_role / secret key) may call it.
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

-- ─────────────────────────────────────────────────────────────
-- Handy queries (run manually in the SQL Editor):
--
-- Signups per source:
--   select coalesce(utm_source, '(direct)') as source, ref, count(*)
--   from waitlist_signups group by 1, 2 order by 3 desc;
--
-- Delete someone on request (GDPR):
--   delete from waitlist_signups where lower(email) = lower('someone@example.com');
-- ─────────────────────────────────────────────────────────────
