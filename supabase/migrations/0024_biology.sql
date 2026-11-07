-- Biology as the third subject: exams (extended level, from content/exams), profiles, notes and
-- flashcard decks. Biology exams have one sheet of tasks, so their tasks use a new section 'tasks'.

alter table public.exams drop constraint exams_subject_check;
alter table public.exams add constraint exams_subject_check check (subject in ('polish', 'english', 'biology'));

alter table public.exam_tasks drop constraint exam_tasks_section_check;
alter table public.exam_tasks add constraint exam_tasks_section_check
  check (section in ('listening', 'reading', 'language', 'writing', 'test', 'tasks'));

alter table public.profiles drop constraint profiles_subjects_check;
alter table public.profiles add constraint profiles_subjects_check check (subjects <@ array['polish', 'english', 'biology']);

alter table public.waitlist_signups drop constraint waitlist_signups_subjects_check;
alter table public.waitlist_signups add constraint waitlist_signups_subjects_check
  check (cardinality(subjects) >= 1 and subjects <@ array['polish', 'english', 'biology']);

alter table public.notes drop constraint notes_subject_check;
alter table public.notes add constraint notes_subject_check check (subject in ('polish', 'english', 'biology', 'other'));

alter table public.flashcard_decks drop constraint flashcard_decks_subject_check;
alter table public.flashcard_decks add constraint flashcard_decks_subject_check check (subject in ('polish', 'english', 'biology', 'other'));
