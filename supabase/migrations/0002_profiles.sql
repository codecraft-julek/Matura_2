-- User profiles + account deletion.
-- Supabase Auth keeps logins in auth.users (we never touch passwords).
-- Everything about the student that the app needs lives in public.profiles, 1:1 with auth.users.

-- ─────────────────────────────────────────────────────────────
-- 1. Profiles
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text check (char_length(display_name) between 1 and 40),
  matura_year      text check (matura_year in ('2027', '2028', 'other')),
  subjects         text[] not null default '{}'
                   check (subjects <@ array['polish', 'english']),
  onboarded_at     timestamptz,             -- null until they finish the "witaj" step
  terms_version    text not null,           -- which terms/privacy text they accepted at signup
  age_confirmed    boolean not null check (age_confirmed),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Each student can read and update ONLY their own row.
-- (select auth.uid()) instead of auth.uid() lets Postgres evaluate it once per query (faster).
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert/delete policies: rows are created by the trigger below and removed with the user.
-- Column-level grants: users may only change these fields, never id/terms/created_at.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, matura_year, subjects, onboarded_at) on public.profiles to authenticated;

-- Keep updated_at fresh automatically.
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 2. Create a profile automatically when someone signs up
-- ─────────────────────────────────────────────────────────────
-- The signup form sends terms_version + age_confirmed as user metadata.
-- If they are missing, the insert fails and so does the signup: no account without consent.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, terms_version, age_confirmed)
  values (
    new.id,
    new.raw_user_meta_data ->> 'terms_version',
    coalesce((new.raw_user_meta_data ->> 'age_confirmed')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 3. "Delete my account" (GDPR right to erasure)
-- ─────────────────────────────────────────────────────────────
-- Runs with elevated rights (security definer) but can only ever delete the CALLER,
-- because it uses auth.uid() from their own login token. Profile rows go with it (on delete cascade).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Trigger helpers are not meant to be called directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
