-- Flashcards: decks of cards with spaced repetition (the app shows each card again when it's
-- about to be forgotten). Decks come from AI (PDF, Word, PowerPoint, photos, a website, a YouTube
-- transcript, text), from an AI note, from a Quizlet/CSV import, or are typed by hand.
--
-- Unlike notes, students write their own decks and cards directly (editing, adding, reviewing),
-- so RLS allows insert/update/delete of their own rows. AI-made decks are written by the Edge
-- Function `flashcards-generate` (service role) after the login and daily limit checks.

create table public.flashcard_decks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 120),
  subject       text not null default 'other' check (subject in ('polish', 'english', 'other')),
  source_kind   text not null default 'manual'
                check (source_kind in ('manual', 'import', 'note', 'text', 'photo', 'pdf', 'docx', 'pptx', 'url', 'youtube')),
  source_label  text not null default '' check (char_length(source_label) <= 300), -- file name, page title, URL
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index flashcard_decks_user_idx on public.flashcard_decks (user_id, updated_at desc);

create table public.flashcards (
  id                uuid primary key default gen_random_uuid(),
  deck_id           uuid not null references public.flashcard_decks (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  front             text not null check (char_length(front) between 1 and 500),
  back              text not null check (char_length(back) between 1 and 1000),
  position          int  not null default 0,
  -- Spaced repetition (see src/lib/flashcards/srs.ts). New cards are due right away.
  due_at            timestamptz not null default now(),
  interval_days     numeric(8, 2) not null default 0 check (interval_days >= 0),
  ease              numeric(4, 2) not null default 2.5 check (ease between 1.3 and 3.5),
  reps              int not null default 0 check (reps >= 0),
  lapses            int not null default 0 check (lapses >= 0),
  last_reviewed_at  timestamptz,
  created_at        timestamptz not null default now()
);
create index flashcards_deck_idx on public.flashcards (deck_id, position);
create index flashcards_due_idx on public.flashcards (user_id, due_at);

alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;

create policy "decks: read own" on public.flashcard_decks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "decks: insert own" on public.flashcard_decks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "decks: update own" on public.flashcard_decks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "decks: delete own" on public.flashcard_decks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Cards: your own, and only in your own deck.
create policy "cards: read own" on public.flashcards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "cards: insert own" on public.flashcards
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.user_id = (select auth.uid()))
  );
create policy "cards: update own" on public.flashcards
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.user_id = (select auth.uid()))
  );
create policy "cards: delete own" on public.flashcards
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Limits, so one account can't fill the database: 300 decks per student, 1000 cards per deck.
create or replace function public.flashcards_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'flashcard_decks' then
    if (select count(*) from public.flashcard_decks where user_id = new.user_id) >= 300 then
      raise exception 'deck limit reached' using errcode = 'P0001';
    end if;
  else
    if (select count(*) from public.flashcards where deck_id = new.deck_id) >= 1000 then
      raise exception 'card limit reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger flashcard_decks_limit before insert on public.flashcard_decks
  for each row execute function public.flashcards_limits();
create trigger flashcards_limit before insert on public.flashcards
  for each row execute function public.flashcards_limits();

-- New AI feature for the daily quota.
alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in ('essay_feedback', 'tutor', 'open_grading', 'notes', 'flashcards'));
