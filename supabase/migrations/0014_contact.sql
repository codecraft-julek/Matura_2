-- Messages from the contact form (/kontakt). Written ONLY by the Edge Function `contact-submit`
-- (service role), after validation, the honeypot, the rate limit and (when set up) the CAPTCHA.
-- No RLS policies: nobody reads or writes this table from the website. You read messages in
-- Supabase Dashboard → Table Editor → contact_messages (and by e-mail once Resend is set up).

create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null default '' check (char_length(name) <= 80),
  email       text not null check (char_length(email) between 3 and 254),
  topic       text not null check (topic in ('question', 'bug', 'idea', 'cooperation', 'other')),
  message     text not null check (char_length(message) between 10 and 4000),
  user_id     uuid references auth.users (id) on delete set null, -- set when sent while logged in
  status      text not null default 'new' check (status in ('new', 'answered'))
);
create index contact_messages_new_idx on public.contact_messages (status, created_at desc);

alter table public.contact_messages enable row level security;

-- Handy queries (SQL Editor):
--   select created_at, topic, email, message from contact_messages where status = 'new' order by created_at desc;
--   update contact_messages set status = 'answered' where id = '…';
--   delete from contact_messages where lower(email) = lower('someone@example.com');  -- GDPR request
