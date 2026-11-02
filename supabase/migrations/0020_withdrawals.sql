-- Withdrawing from a purchase within 14 days ("Odstąp od umowy tutaj" on /odstapienie).
-- Written ONLY by the Edge Function `billing-withdrawal` (service role). It's the proof of what the
-- student declared and when, so it stays when the account is deleted (user_id becomes null).

create table public.withdrawals (
  id                   uuid primary key default gen_random_uuid(),
  received_at          timestamptz not null default now(),
  user_id              uuid references auth.users (id) on delete set null,
  name                 text not null check (char_length(name) between 2 and 120),
  email                text not null check (char_length(email) between 3 and 254),
  plan                 text not null check (plan in ('monthly', 'matura')),
  stripe_customer_id   text not null,
  stripe_session_id    text not null unique, -- one withdrawal per purchase
  stripe_subscription_id text,               -- monthly only: the subscription to stop
  purchased_at         timestamptz not null,
  period_end           timestamptz not null,
  amount_paid          int not null check (amount_paid >= 0),      -- grosze
  suggested_refund     int not null check (suggested_refund >= 0), -- grosze, you decide in Stripe
  access_ended_at      timestamptz,
  ack_sent_at          timestamptz,  -- confirmation e-mail to the student
  notified_at          timestamptz,  -- e-mail to you
  refunded_at          timestamptz   -- set by billing-webhook when Stripe reports a refund
);
create index withdrawals_user_idx on public.withdrawals (user_id);
create index withdrawals_customer_idx on public.withdrawals (stripe_customer_id);

alter table public.withdrawals enable row level security; -- no policies: service role only

-- When the student last bought something, so the website knows when to show the withdrawal link.
alter table public.billing_accounts add column last_checkout_at timestamptz;

-- Handy queries (SQL Editor):
--   -- refunds still to make (you have 14 days from received_at):
--   select received_at, email, plan, amount_paid, suggested_refund from withdrawals
--   where refunded_at is null and amount_paid > 0 order by received_at;
