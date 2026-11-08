-- Tutor chats belong to a subject, so the chat list shows only the active subject's chats.
-- Set by the tutor-chat function on new chats: the exam's subject for a task chat, the student's
-- active subject for a general one. Older general chats stay null and are shown everywhere.
alter table public.tutor_chats
  add column subject text check (subject in ('polish', 'english', 'biology'));

update public.tutor_chats c
set subject = e.subject
from public.exams e
where c.exam_id = e.id and c.subject is null;
