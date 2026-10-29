-- Notes can now also be made from a PDF, Word or PowerPoint file (text read in the browser).
alter table public.notes drop constraint notes_source_kind_check;
alter table public.notes add constraint notes_source_kind_check
  check (source_kind in ('text', 'photo', 'mixed', 'pdf', 'docx', 'pptx'));
