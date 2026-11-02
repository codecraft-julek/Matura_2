-- A short, fenced lease prevents automatic result-page requests from consuming quota twice.
-- Deployment order: this migration, grade-open-answers Edge Function, then the frontend.
alter table public.exam_attempts
  add column ai_grading_started_at timestamptz,
  add column ai_grading_token uuid;

create or replace function public.claim_open_grading(p_attempt_id uuid, p_user uuid, p_token uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt_id and user_id = p_user for update;
  if not found then raise exception 'attempt not found'; end if;
  if not exists (
    select 1 from public.exam_tasks t
    where t.exam_id = a.exam_id and t.kind = 'open'
      and a.results -> t.number ->> 'status' = 'unchecked'
      and length(btrim(coalesce(a.answers ->> t.number, ''))) > 0
  ) then return 'done'; end if;
  if a.ai_grading_token is not null and a.ai_grading_started_at > now() - interval '3 minutes' then
    return 'busy';
  end if;
  update public.exam_attempts set ai_grading_token = p_token, ai_grading_started_at = now() where id = p_attempt_id;
  return 'claimed';
end;
$$;

create or replace function public.finish_open_grading(p_attempt_id uuid, p_user uuid, p_token uuid, p_grades jsonb)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  a public.exam_attempts;
  saved int;
begin
  select * into a from public.exam_attempts where id = p_attempt_id and user_id = p_user for update;
  if not found or a.ai_grading_token is distinct from p_token then raise exception 'grading lease lost'; end if;
  -- The existing saver locks the same row, recalculates the total and preserves manual corrections.
  saved := public.save_ai_grades(p_attempt_id, p_user, p_grades);
  update public.exam_attempts set ai_grading_token = null, ai_grading_started_at = null where id = p_attempt_id;
  return saved;
end;
$$;

create or replace function public.release_open_grading(p_attempt_id uuid, p_user uuid, p_token uuid)
returns void
language sql security definer set search_path = '' as $$
  update public.exam_attempts set ai_grading_token = null, ai_grading_started_at = null
  where id = p_attempt_id and user_id = p_user and ai_grading_token = p_token;
$$;

revoke all on function public.claim_open_grading(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_open_grading(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.release_open_grading(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_open_grading(uuid, uuid, uuid) to service_role;
grant execute on function public.finish_open_grading(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.release_open_grading(uuid, uuid, uuid) to service_role;
