-- Multi-part closed tasks (Polish "PF", "PPP", matching tables "A1, B4"): the answer is one
-- character per row. CKE scores them as "max points minus one per wrong row" (e.g. 2026 task 1:
-- 3 statements, 2 pts for all correct, 1 pt for two correct). For 1-point tasks that simply
-- means: any mistake = 0. New status 'partial' = some points, not all.
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
    select t.number, t.kind, t.points, k.correct, k.accepted, k.display, k.note
    from public.exam_tasks t
    left join public.exam_task_keys k on k.task_id = t.id
    where t.exam_id = p_exam_id and (p_group is null or t.group_no = p_group)
    order by t.sort
  loop
    given := nullif(btrim(coalesce(p_answers ->> r.number, '')), '');
    pts := 0;

    if r.kind = 'writing' then
      status := case when given is null then 'empty' else 'writing' end;
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
