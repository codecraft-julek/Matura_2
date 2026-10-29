-- AI tutor: chats with the student, optionally about one task group of an exam.
-- Messages are written ONLY by the `tutor-chat` Edge Function (service role), which checks the
-- login and the daily limit. Students can read and delete their own chats.

create table public.tutor_chats (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  exam_id     text references public.exams (id) on delete set null, -- null = general chat
  group_no    int,                                                   -- task group ("Zadanie 3") in that exam
  title       text not null check (char_length(title) between 1 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index tutor_chats_user_recent on public.tutor_chats (user_id, updated_at desc);

create table public.tutor_messages (
  id          bigint generated always as identity primary key,
  chat_id     uuid not null references public.tutor_chats (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null check (char_length(content) between 1 and 12000),
  usage       jsonb, -- tokens of the AI reply (assistant messages only), for cost tracking
  created_at  timestamptz not null default now()
);
create index tutor_messages_chat on public.tutor_messages (chat_id, id);

alter table public.tutor_chats enable row level security;
alter table public.tutor_messages enable row level security;

create policy "tutor_chats: read own" on public.tutor_chats
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "tutor_chats: delete own" on public.tutor_chats
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "tutor_messages: read own" on public.tutor_messages
  for select to authenticated using ((select auth.uid()) = user_id);
-- No insert/update policies: only the Edge Function writes (service role bypasses RLS).
