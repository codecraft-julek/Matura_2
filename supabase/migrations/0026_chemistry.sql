-- Chemistry as the fourth subject: exams (extended level, from content/exams), profiles, notes
-- and flashcard decks. Like biology, a chemistry exam is one sheet of tasks (section 'tasks').
--
-- Calculation tasks (exam_tasks.meta.calc = true) are solved on paper: the student may leave the
-- answer field empty and still compare their work with the worked solution and grade it, so an
-- empty calculation counts as 'unchecked' (self-grading), not 'empty'.

alter table public.exams drop constraint exams_subject_check;
alter table public.exams add constraint exams_subject_check check (subject in ('polish', 'english', 'biology', 'chemistry'));

alter table public.profiles drop constraint profiles_subjects_check;
alter table public.profiles add constraint profiles_subjects_check check (subjects <@ array['polish', 'english', 'biology', 'chemistry']);

alter table public.waitlist_signups drop constraint waitlist_signups_subjects_check;
alter table public.waitlist_signups add constraint waitlist_signups_subjects_check
  check (cardinality(subjects) >= 1 and subjects <@ array['polish', 'english', 'biology', 'chemistry']);

alter table public.notes drop constraint notes_subject_check;
alter table public.notes add constraint notes_subject_check check (subject in ('polish', 'english', 'biology', 'chemistry', 'other'));

alter table public.flashcard_decks drop constraint flashcard_decks_subject_check;
alter table public.flashcard_decks add constraint flashcard_decks_subject_check check (subject in ('polish', 'english', 'biology', 'chemistry', 'other'));

create or replace function public.grade_exam_answers(p_exam_id text, p_answers jsonb, p_group int default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r record;
  given text;
  result jsonb := '{}';
  status text;
  pts int;
  wrong int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.exams where id = p_exam_id and published) then
    raise exception 'exam not found';
  end if;

  for r in
    select t.number, t.kind, t.points, coalesce((t.meta ->> 'calc')::boolean, false) as calc, k.correct, k.accepted, k.display, k.note
    from public.exam_tasks t
    left join public.exam_task_keys k on k.task_id = t.id
    where t.exam_id = p_exam_id and (p_group is null or t.group_no = p_group)
    order by t.sort
  loop
    given := nullif(btrim(coalesce(p_answers ->> r.number, '')), '');
    pts := 0;

    if r.kind = 'writing' then
      status := case when given is null then 'empty' else 'writing' end;
    elsif r.kind = 'open' and r.calc and given is null then
      status := 'unchecked'; -- worked on paper: compare with the solution and self-grade
    elsif given is null or given ~ '^_+$' then
      status := 'empty';
    elsif r.kind = 'choice' and char_length(r.correct) > 1 then
      -- one character per row; '_' (or a missing character) counts as a wrong row
      select count(*) into wrong
      from generate_series(1, char_length(r.correct)) as i
      where upper(substr(given, i, 1)) is distinct from substr(r.correct, i, 1);
      pts := greatest(r.points - wrong, 0);
      status := case when wrong = 0 then 'correct' when pts > 0 then 'partial' else 'incorrect' end;
    elsif r.kind = 'choice' then
      status := case when upper(given) = r.correct then 'correct' else 'incorrect' end;
      if status = 'correct' then pts := r.points; end if;
    else -- open
      status := case when public.normalize_answer(given) = any (r.accepted) then 'correct' else 'unchecked' end;
      if status = 'correct' then pts := r.points; end if;
    end if;

    result := result || jsonb_build_object(r.number, jsonb_build_object(
      'status', status,
      'points', pts,
      'max', r.points,
      'answer', r.display,
      'note', r.note
    ));
  end loop;

  return result;
end;
$$;
