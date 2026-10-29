-- Partial self-grading for open tasks worth more than 1 point (Polish exams: 0–2, 0–4 pts).
-- The student compares their answer with what the key requires and picks 0…max points.
-- Same safety rules as self_check_answer: own attempt only, open answers only.
create or replace function public.self_grade_answer(p_attempt_id uuid, p_number text, p_points int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.exam_attempts;
  item jsonb;
  max_pts int;
begin
  select * into a from public.exam_attempts where id = p_attempt_id and user_id = auth.uid();
  if not found then
    raise exception 'attempt not found';
  end if;

  item := a.results -> p_number;
  if item is null or item ->> 'status' not in ('unchecked', 'self_correct', 'self_incorrect', 'self_partial') then
    raise exception 'this answer cannot be self-graded';
  end if;

  max_pts := (item ->> 'max')::int;
  if p_points < 0 or p_points > max_pts then
    raise exception 'points out of range';
  end if;

  item := item || jsonb_build_object(
    'status', case when p_points = max_pts then 'self_correct' when p_points = 0 then 'self_incorrect' else 'self_partial' end,
    'points', p_points
  );

  update public.exam_attempts
  set results = jsonb_set(results, array[p_number], item),
      score = (
        select coalesce(sum((v ->> 'points')::int), 0)
        from jsonb_each(jsonb_set(results, array[p_number], item)) as e(k, v)
      )
  where id = p_attempt_id;
end;
$$;

revoke all on function public.self_grade_answer(uuid, text, int) from public, anon;
grant execute on function public.self_grade_answer(uuid, text, int) to authenticated;
