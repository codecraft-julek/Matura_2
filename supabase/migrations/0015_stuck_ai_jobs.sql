-- Clean up AI jobs that got stuck on "pending".
--
-- essay-feedback and notes-generate save a "pending" row first and finish it when the AI answers.
-- On failure they mark it themselves (and give the daily try back). But if Supabase stops the
-- function mid-way (time limit, deploy, crash), nobody finishes the row: it stays "pending"
-- forever and the student loses one of their daily tries.
--
-- Every 5 minutes (pg_cron) this finds rows still pending after 10 minutes (Edge Functions are
-- stopped long before that) and does what the function would have done on an error:
--   essays → status 'error' (the student's text stays saved), try given back
--   notes  → deleted (nothing useful to keep), try given back
-- The try goes back on the day it was used (Polish time), not today.

create or replace function public.fail_stuck_ai_jobs(p_older_than interval default interval '10 minutes')
returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  fixed int := 0;
begin
  for r in
    update public.essays
    set status = 'error', error = 'interrupted: still pending, closed by fail_stuck_ai_jobs()'
    where status = 'pending' and created_at < now() - p_older_than
    returning user_id, created_at
  loop
    update public.ai_usage set count = greatest(count - 1, 0)
    where user_id = r.user_id and feature = 'essay_feedback'
      and day = (r.created_at at time zone 'Europe/Warsaw')::date;
    fixed := fixed + 1;
  end loop;

  for r in
    delete from public.notes
    where status = 'pending' and created_at < now() - p_older_than
    returning user_id, created_at
  loop
    update public.ai_usage set count = greatest(count - 1, 0)
    where user_id = r.user_id and feature = 'notes'
      and day = (r.created_at at time zone 'Europe/Warsaw')::date;
    fixed := fixed + 1;
  end loop;

  return fixed;
end;
$$;

revoke all on function public.fail_stuck_ai_jobs(interval) from public, anon, authenticated;
grant execute on function public.fail_stuck_ai_jobs(interval) to service_role;

-- Fast lookup of pending rows (tiny partial indexes: almost every row is 'done').
create index if not exists essays_pending_idx on public.essays (created_at) where status = 'pending';
create index if not exists notes_pending_idx on public.notes (created_at) where status = 'pending';

-- Schedule it. pg_cron jobs are visible in Supabase Dashboard → Integrations → Cron.
create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid) from cron.job where jobname = 'fail-stuck-ai-jobs';
select cron.schedule('fail-stuck-ai-jobs', '*/5 * * * *', $$select public.fail_stuck_ai_jobs()$$);

-- Handy (SQL Editor):
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'fail-stuck-ai-jobs')
--     order by start_time desc limit 20;
