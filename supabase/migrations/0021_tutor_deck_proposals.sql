-- A deck from a tutor chat. tutor-chat only saves a validated proposal on its reply. The deck is made
-- by flashcards-generate after the student clicks, and claim_tutor_deck makes that happen only once:
-- one row update decides, so a double click or a second tab can't start (and pay for) a second deck.

alter table public.tutor_messages
  add column deck_proposal   jsonb,       -- { topic, count, subject }, see deckProposalSchema
  add column deck_id         uuid references public.flashcard_decks (id) on delete set null,
  add column deck_claimed_at timestamptz; -- a click is being handled; expires if the function dies

alter table public.flashcard_decks drop constraint flashcard_decks_source_kind_check;
alter table public.flashcard_decks add constraint flashcard_decks_source_kind_check
  check (source_kind in ('manual', 'import', 'note', 'text', 'photo', 'pdf', 'docx', 'pptx', 'url', 'youtube', 'tutor'));

-- → { status: 'claimed' } | { status: 'done', deck_id } | { status: 'busy' } | { status: 'missing' }
create or replace function public.claim_tutor_deck(p_message bigint, p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_deck uuid;
  v_found boolean;
begin
  update public.tutor_messages
     set deck_claimed_at = now()
   where id = p_message
     and user_id = p_user
     and role = 'assistant'
     and deck_proposal is not null
     and deck_id is null
     and (deck_claimed_at is null or deck_claimed_at < now() - interval '10 minutes');
  if found then
    return jsonb_build_object('status', 'claimed');
  end if;

  select true, deck_id into v_found, v_deck
    from public.tutor_messages
   where id = p_message and user_id = p_user and role = 'assistant' and deck_proposal is not null;
  if v_found is null then
    return jsonb_build_object('status', 'missing');
  end if;
  if v_deck is not null then
    return jsonb_build_object('status', 'done', 'deck_id', v_deck);
  end if;
  return jsonb_build_object('status', 'busy');
end;
$$;
revoke all on function public.claim_tutor_deck(bigint, uuid) from public, anon, authenticated;
grant execute on function public.claim_tutor_deck(bigint, uuid) to service_role;
