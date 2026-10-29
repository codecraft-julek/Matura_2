-- Past exams ("arkusze"): structure, hidden answer keys, attempts and grading.
--
-- Copyright note: we do NOT store exam texts. Students read the official CKE PDF
-- (linked from cke.gov.pl) and fill in an interactive answer sheet here.
-- Content (exams, tasks, keys) is loaded from content/exams/*.json by `npm run content:sync`.

-- ─────────────────────────────────────────────────────────────
-- 1. Exams and tasks (readable by logged-in students)
-- ─────────────────────────────────────────────────────────────
create table public.exams (
  id                text primary key,                 -- slug, e.g. 2025-maj-angielski-pp
  subject           text not null check (subject in ('polish', 'english')),
  level             text not null check (level in ('basic', 'extended')),
  year              int  not null check (year between 2023 and 2100),
  session           text not null check (session in ('main', 'june', 'august', 'sample')),
  title             text not null,
  duration_minutes  int  not null check (duration_minutes > 0),
  max_points        int  not null check (max_points > 0),
  sheet_url         text not null,                    -- official CKE PDF
  key_url           text,                             -- official CKE "zasady oceniania"
  audio_url         text,                             -- listening recordings (English)
  transcript_url    text,
  published         boolean not null default false,
  sort              int not null default 0,
  created_at        timestamptz not null default now()
);

create table public.exam_tasks (
  id          text primary key,                       -- "<exam id>:<number>", e.g. 2025-maj-angielski-pp:1.1
  exam_id     text not null references public.exams (id) on delete cascade,
  group_no    int  not null,                          -- "Zadanie 1."
  number      text not null,                          -- "1.1"
  section     text not null check (section in ('listening', 'reading', 'language', 'writing', 'test')),
  kind        text not null check (kind in ('choice', 'open', 'writing')),
  options     text[] not null default '{}',           -- for choice: letters, e.g. {A,B,C,D}
  points      int  not null check (points > 0),
  sort        int  not null,
  group_label text not null,                          -- our own short description of the task type
  meta        jsonb not null default '{}',            -- e.g. writing criteria, word limits
  unique (exam_id, number)
);
create index exam_tasks_exam_idx on public.exam_tasks (exam_id, sort);

alter table public.exams enable row level security;
alter table public.exam_tasks enable row level security;

create policy "exams: logged-in read published" on public.exams
  for select to authenticated using (published);

create policy "exam_tasks: logged-in read published" on public.exam_tasks
  for select to authenticated
  using (exists (select 1 from public.exams e where e.id = exam_id and e.published));

-- ─────────────────────────────────────────────────────────────
-- 2. Answer keys: NO policies = nobody can read them through the API.
--    Only the security-definer grading functions below can see them.
-- ─────────────────────────────────────────────────────────────
create table public.exam_task_keys (
  task_id   text primary key references public.exam_tasks (id) on delete cascade,
  correct   text,                                     -- choice: the right letter
  accepted  text[] not null default '{}',             -- open: normalised accepted answers
  display   text not null,                            -- what we show as "the answer" after grading
  note      text                                      -- short hint on what the key requires
);
alter table public.exam_task_keys enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 3. Attempts (each student sees only their own)
-- ─────────────────────────────────────────────────────────────
create table public.exam_attempts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  exam_id           text not null references public.exams (id) on delete cascade,
  mode              text not null check (mode in ('practice', 'exam')),
  started_at        timestamptz not null,
  submitted_at      timestamptz not null default now(),
  answers           jsonb not null,                   -- { "1.1": "B", "3.1": "three weeks", "12": "essay..." }
  results           jsonb not null,                   -- per task: status, points, answer shown
  score             int not null,                     -- points from auto-check + self-check
  checkable_points  int not null                      -- max points we could check (excludes writing)
);
create index exam_attempts_user_idx on public.exam_attempts (user_id, submitted_at desc);

alter table public.exam_attempts enable row level security;
create policy "attempts: read own" on public.exam_attempts
  for select to authenticated using ((select auth.uid()) = user_id);
-- No insert/update policies: writes only happen through the functions below.

-- ─────────────────────────────────────────────────────────────
-- 4. Grading
-- ─────────────────────────────────────────────────────────────
-- Normalise open answers so "  Three  Weeks." matches "three weeks".
-- Curly quotes become straight ones; case, extra spaces and a final period are ignored.
-- (CKE accepts capital/lowercase differences, see the official key.)
create or replace function public.normalize_answer(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
           regexp_replace(
             lower(btrim(translate(coalesce(t, ''), '’‘`´', ''''''''''))),
             '\s+', ' ', 'g'),
           '[.!]+$', '')
$$;

-- Grades answers for one exam (optionally only one task group, for "check this task" in practice).
-- Returns { "<number>": { status, points, max, answer, note } } and never reveals keys for
-- tasks outside the requested group.
-- status: correct | incorrect | empty | unchecked (open answer not in our list: student self-checks)
--         | writing (graded later by AI)
create or replace function public.grade_exam_answers(p_exam_id text, p_answers jsonb, p_group int default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r record;
  given text;
  result jsonb := '{}';
  status text;
  pts int;
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
    elsif given is null then
      status := 'empty';
    elsif r.kind = 'choice' then
      status := case when upper(given) = r.correct then 'correct' else 'incorrect' end;
    else -- open
      status := case when public.normalize_answer(given) = any (r.accepted) then 'correct' else 'unchecked' end;
    end if;

    if status = 'correct' then pts := r.points; end if;

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

-- Saves a finished attempt for the logged-in student and returns its id.
create or replace function public.submit_exam_attempt(
  p_exam_id text,
  p_mode text,
  p_answers jsonb,
  p_started_at timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  graded jsonb;
  total int;
  checkable int;
  new_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_mode not in ('practice', 'exam') then
    raise exception 'bad mode';
  end if;
  if octet_length(p_answers::text) > 60000 then
    raise exception 'answers too large';
  end if;

  graded := public.grade_exam_answers(p_exam_id, p_answers, null);

  select coalesce(sum((v ->> 'points')::int), 0) into total from jsonb_each(graded) as e(k, v);
  select coalesce(sum(points), 0) into checkable
    from public.exam_tasks where exam_id = p_exam_id and kind <> 'writing';

  insert into public.exam_attempts (user_id, exam_id, mode, started_at, answers, results, score, checkable_points)
  values (
    uid, p_exam_id, p_mode,
    -- never trust the client's clock blindly: clamp to [now - 1 day, now]
    least(now(), greatest(coalesce(p_started_at, now()), now() - interval '1 day')),
    p_answers, graded, total, checkable
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- Lets a student accept/reject their own open answer that our list didn't recognise
-- (CKE accepts every answer that is correct in meaning, not only the ones listed in the key).
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
  if item is null or item ->> 'status' not in ('unchecked', 'self_correct', 'self_incorrect') then
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

revoke all on function public.grade_exam_answers(text, jsonb, int) from public, anon;
revoke all on function public.submit_exam_attempt(text, text, jsonb, timestamptz) from public, anon;
revoke all on function public.self_check_answer(uuid, text, boolean) from public, anon;
grant execute on function public.grade_exam_answers(text, jsonb, int) to authenticated;
grant execute on function public.submit_exam_attempt(text, text, jsonb, timestamptz) to authenticated;
grant execute on function public.self_check_answer(uuid, text, boolean) to authenticated;
