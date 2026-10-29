-- AI notes: the student pastes text or takes photos of their notes, the AI turns them into a
-- structured note (blocks: timeline, comparison table, mind map, ...) that the website draws.
--
-- Photos are NEVER stored: the browser shrinks them and sends them straight to the Edge Function,
-- which passes them to the AI and keeps only the text read from them (source_text).
-- Writes happen ONLY in the Edge Function `notes-generate` (service role). Students can read
-- and delete their own notes.

create table public.notes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  subject       text not null check (subject in ('polish', 'english', 'other')),
  source_kind   text not null check (source_kind in ('text', 'photo', 'mixed')),
  source_text   text not null default '' check (char_length(source_text) <= 30000), -- pasted text / what the AI read
  title         text not null default '' check (char_length(title) <= 200),
  status        text not null default 'pending' check (status in ('pending', 'done', 'error')),
  note          jsonb,                                                -- see supabase/functions/_shared/notes.ts
  model         text,
  usage         jsonb,
  duration_ms   int,
  error         text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index notes_user_idx on public.notes (user_id, created_at desc);

alter table public.notes enable row level security;

create policy "notes: read own" on public.notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notes: delete own" on public.notes
  for delete to authenticated using ((select auth.uid()) = user_id);
-- No insert/update policies: only the Edge Function writes (service role bypasses RLS).

-- New AI feature for the daily quota.
alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in ('essay_feedback', 'tutor', 'open_grading', 'notes'));
