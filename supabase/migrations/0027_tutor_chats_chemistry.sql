-- Tutor chats may be about chemistry too (0026 added the subject everywhere else; this
-- constraint from 0025 was missed, so saving a chemistry chat failed with a check violation).
alter table public.tutor_chats drop constraint tutor_chats_subject_check;
alter table public.tutor_chats add constraint tutor_chats_subject_check
  check (subject in ('polish', 'english', 'biology', 'chemistry'));
