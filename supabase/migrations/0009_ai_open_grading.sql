-- AI grading of open answers (Polish exams, Arkusz 1).
--
-- The Edge Function `grade-open-answers` (service role) reads the student's open answers and our
-- own-words scoring descriptions (exam_task_keys, never sent to the browser by this flow), asks
-- OpenAI for 0…max points per task, and saves them here. New status 'ai_graded' = points proposed
-- by AI. The student can still override every one of them with self_check / self_grade.
-- Each result item may also carry ai_points, ai_reason and ai_uncertain (what the AI said).

-- 1. New AI feature for the daily quota.
alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in ('essay_feedback', 'tutor', 'open_grading'));

-- 2. When the attempt was last graded by AI (shown on the results page).
alter table public.exam_attempts add column ai_graded_at timestamptz;

-- 3. Saves AI grades: p_grades = [{ "number": "2", "points": 1, "reason": "...", "uncertain": false }].
--    Only open tasks the student still had to compare with the key can be graded. Points are
--    clamped to 0…max. If the student already graded a task themselves, their choice stays and
--    the AI's opinion is only stored next to it.
create or replace function public.save_ai_grades(p_attempt_id uuid, p_user uuid, p_grades jsonb)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  a public.exam_attempts;
  g jsonb;
  num text;
  item jsonb;
  max_pts int;
  p int;
  res jsonb;
  saved int := 0;
begin
  select * into a from public.exam_attempts where id = p_attempt_id and user_id = p_user for update;
  if not found then
    raise exception 'attempt not found';
  end if;
  if jsonb_typeof(p_grades) <> 'array' then
    raise exception 'grades must be an array';
  end if;

  res := a.results;
  for g in select * from jsonb_array_elements(p_grades)
  loop
    num := g ->> 'number';
    item := res -> num;
    if num is null or item is null
       or item ->> 'status' not in ('unchecked', 'self_correct', 'self_incorrect', 'self_partial', 'ai_graded')
       or not exists (
         select 1 from public.exam_tasks t
         where t.exam_id = a.exam_id and t.number = num and t.kind = 'open'
       ) then
      continue;
    end if;

    max_pts := (item ->> 'max')::int;
    p := least(max_pts, greatest(0, coalesce((g ->> 'points')::int, 0)));
    item := item || jsonb_build_object(
      'ai_points', p,
      'ai_reason', left(coalesce(g ->> 'reason', ''), 400),
      'ai_uncertain', coalesce((g ->> 'uncertain')::boolean, false)
    );
    if item ->> 'status' in ('unchecked', 'ai_graded') then
      item := item || jsonb_build_object('status', 'ai_graded', 'points', p);
    end if;
    res := jsonb_set(res, array[num], item);
    saved := saved + 1;
  end loop;

  update public.exam_attempts
  set results = res,
      score = (select coalesce(sum((v ->> 'points')::int), 0) from jsonb_each(res) as e(k, v)),
      ai_graded_at = case when saved > 0 then now() else ai_graded_at end
  where id = p_attempt_id;

  return saved;
end;
$$;

revoke all on function public.save_ai_grades(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_ai_grades(uuid, uuid, jsonb) to service_role;

-- 4. Self-checking must also work on answers the AI graded (the student has the last word).
create or replace function public.self_check_answer(p_attempt_id uuid, p_number text, p_accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.exam_attempts;
  item jsonb;
  new_status text;
begin
  select * into a from public.exam_attempts where id = p_attempt_id and user_id = auth.uid();
  if not found then
    raise exception 'attempt not found';
  end if;

  item := a.results -> p_number;
  if item is null or item ->> 'status' not in ('unchecked', 'self_correct', 'self_incorrect', 'ai_graded') then
    raise exception 'this answer cannot be self-checked';
  end if;

  new_status := case when p_accept then 'self_correct' else 'self_incorrect' end;
  item := item || jsonb_build_object(
    'status', new_status,
    'points', case when p_accept then (item ->> 'max')::int else 0 end
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
  if item is null or item ->> 'status' not in ('unchecked', 'self_correct', 'self_incorrect', 'self_partial', 'ai_graded') then
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
