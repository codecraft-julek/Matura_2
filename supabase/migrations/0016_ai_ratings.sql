-- 👍/👎 on AI answers: essay feedback, notes, AI flashcard decks, tutor replies and AI grading of
-- open answers. One rating per student per thing (they can change it), plus an optional short
-- comment on 👎 ("what was wrong?"). This tells you where the prompts need work.
--
-- Students write their own ratings directly (RLS), but only for AI output they own: the check
-- function runs with THEIR rights, so the lookups below only see their own essays, notes, ...

create table public.ai_ratings (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_kind  text not null check (target_kind in ('essay', 'note', 'deck', 'tutor_message', 'open_grading')),
  target_id    text not null check (char_length(target_id) between 1 and 64), -- uuid, or the tutor message number
  rating       smallint not null check (rating in (-1, 1)),
  comment      text not null default '' check (char_length(comment) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, target_kind, target_id)
);
create index ai_ratings_recent_idx on public.ai_ratings (target_kind, created_at desc);

/** True when the logged-in student owns this AI output (and it's finished). */
create or replace function public.can_rate_ai(p_kind text, p_id text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select case p_kind
    when 'essay' then exists (select 1 from public.essays where id::text = p_id and status = 'done')
    when 'note' then exists (select 1 from public.notes where id::text = p_id and status = 'done')
    when 'deck' then exists (
      select 1 from public.flashcard_decks where id::text = p_id and source_kind not in ('manual', 'import')
    )
    when 'tutor_message' then exists (
      select 1 from public.tutor_messages where id::text = p_id and role = 'assistant'
    )
    when 'open_grading' then exists (
      select 1 from public.exam_attempts where id::text = p_id and ai_graded_at is not null
    )
    else false
  end
$$;

alter table public.ai_ratings enable row level security;

create policy "ai_ratings: read own" on public.ai_ratings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_ratings: insert own" on public.ai_ratings
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_rate_ai(target_kind, target_id));
create policy "ai_ratings: update own" on public.ai_ratings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.can_rate_ai(target_kind, target_id));
create policy "ai_ratings: delete own" on public.ai_ratings
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Handy queries (SQL Editor):
--   -- share of 👍 per feature, last 30 days
--   select target_kind, count(*) as ratings, round(100.0 * avg((rating = 1)::int)) as pct_up
--     from ai_ratings where created_at > now() - interval '30 days' group by 1;
--   -- recent 👎 with comments
--   select created_at, target_kind, target_id, comment from ai_ratings
--     where rating = -1 order by created_at desc limit 50;
