-- "Delete my account" refuses while a monthly subscription still renews. Until now only the
-- website checked this, so calling the RPC directly (or a second tab) could delete the student
-- while Stripe kept charging their card. Cancelling in the Stripe portal sets
-- cancel_at_period_end, after which deleting is allowed (nothing more will be charged).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if exists (
    select 1 from public.billing_accounts b
    where b.user_id = uid
      and b.subscription_status in ('active', 'trialing', 'past_due')
      and not b.cancel_at_period_end
  ) then
    raise exception 'subscription still renews' using errcode = 'P0001';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
