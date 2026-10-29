// Flashcard decks and cards of the logged-in student (port of the old lib/flashcards/queries.ts +
// actions.ts). Students edit their own decks directly (RLS checks ownership); only AI-made decks go
// through the Edge Function `flashcards-generate` (streamFlashcards in @/lib/ai).
// Reads throw on errors (getDeck/studyCards return null for a deck that isn't there → 404 view);
// writes return { ok: true, ... } or { ok: false, error } with a Polish message.

import { z } from 'zod'
import { FLASHCARD_LIMITS, parseImport } from '@shared/flashcards'
import { supabase } from '@/lib/supabase'

const FAIL = 'Nie udało się zapisać. Spróbuj ponownie.'
const LOGGED_OUT = 'Zaloguj się ponownie.'
const UUID = /^[0-9a-f-]{36}$/i

const uuid = z.uuid()
const subject = z.enum(['polish', 'english', 'other'])
const title = z.string().trim().min(1, 'Wpisz nazwę talii.').max(120)
const front = z.string().trim().min(1, 'Uzupełnij przód fiszki.').max(FLASHCARD_LIMITS.frontChars)
const back = z.string().trim().min(1, 'Uzupełnij tył fiszki.').max(FLASHCARD_LIMITS.backChars)

const firstError = e => e.issues[0]?.message ?? 'Nieprawidłowe dane.'
const limitError = msg =>
  msg?.includes('deck limit') ? 'Masz już bardzo dużo talii. Usuń kilka starych.' : msg?.includes('card limit') ? 'Ta talia jest już pełna (1000 fiszek).' : FAIL

/** Where a deck came from (deck list and deck page). */
export const DECK_SOURCE = {
  manual: 'ręcznie',
  import: 'import',
  note: 'z notatki',
  text: 'z tekstu',
  photo: 'ze zdjęć',
  pdf: 'z PDF',
  docx: 'z Worda',
  pptx: 'z prezentacji',
  url: 'ze strony',
  youtube: 'z YouTube',
}
/** Decks made by AI get the 👍/👎 rating. */
export const isAiDeck = deck => !['manual', 'import'].includes(deck.source_kind)

/**
 * "Trudna" fiszka: forgotten at least once ("Nie wiem") or marked hard often enough that its ease
 * dropped below the starting 2.5 by more than one "Trudne".
 */
export const isHardCard = c => c.lapses > 0 || Number(c.ease) < 2.35

async function userId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/** Decks with their card count and how many cards are due now. */
export async function listDecks() {
  const nowIso = new Date().toISOString()
  const [{ data: decks, error }, { data: due }] = await Promise.all([
    supabase
      .from('flashcard_decks')
      .select('id, title, subject, source_kind, source_label, updated_at, flashcards(count)')
      .order('updated_at', { ascending: false })
      .limit(300),
    supabase.from('flashcards').select('deck_id').lte('due_at', nowIso).limit(20000),
  ])
  if (error) throw error
  const dueBy = new Map()
  for (const c of due ?? []) dueBy.set(c.deck_id, (dueBy.get(c.deck_id) ?? 0) + 1)
  return (decks ?? []).map(({ flashcards, ...d }) => ({
    ...d,
    cards: flashcards?.[0]?.count ?? 0,
    due: dueBy.get(d.id) ?? 0,
  }))
}

/** { deck, cards } or null. */
export async function getDeck(id) {
  if (!UUID.test(String(id))) return null
  const [{ data: deck, error }, { data: cards, error: cardsError }] = await Promise.all([
    supabase.from('flashcard_decks').select('id, title, subject, source_kind, source_label, created_at').eq('id', id).maybeSingle(),
    supabase
      .from('flashcards')
      .select('id, front, back, due_at, reps, lapses, ease')
      .eq('deck_id', id)
      .order('position')
      .order('created_at'),
  ])
  if (error) throw error
  if (!deck) return null
  if (cardsError) throw cardsError
  return { deck, cards: cards ?? [] }
}

/** Cards to study now: the due ones (oldest first), or all of them (shuffled) when `all`. → { title, subject, cards } or null */
export async function studyCards(deckId, all) {
  if (!UUID.test(String(deckId))) return null
  const { data: deck, error } = await supabase.from('flashcard_decks').select('title, subject').eq('id', deckId).maybeSingle()
  if (error) throw error
  if (!deck) return null
  let q = supabase
    .from('flashcards')
    .select('id, front, back, interval_days, ease, reps, lapses')
    .eq('deck_id', deckId)
    .order('due_at')
    .limit(all ? 1000 : 100)
  if (!all) q = q.lte('due_at', new Date().toISOString())
  const { data, error: cardsError } = await q
  if (cardsError) throw cardsError
  const cards = (data ?? []).map(c => ({ ...c, interval_days: Number(c.interval_days), ease: Number(c.ease) }))
  // "All": mix the order (Fisher–Yates), so it's not the same sequence every time.
  if (all) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[cards[i], cards[j]] = [cards[j], cards[i]]
    }
  }
  return { ...deck, cards }
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/** A deck from a Quizlet/Anki/CSV paste, or an empty one to fill by hand. → { ok, id } */
export async function createDeck(input) {
  const parsed = z.object({ title, subject, importText: z.string().max(200_000).optional() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const cards = parsed.data.importText ? parseImport(parsed.data.importText) : []
  if (parsed.data.importText && cards.length === 0) {
    return { ok: false, error: 'Nie rozpoznaliśmy fiszek. Każda w osobnej linii: przód, tabulator (albo „ - ”), tył.' }
  }

  const uid = await userId()
  if (!uid) return { ok: false, error: LOGGED_OUT }
  const { data: deck, error } = await supabase
    .from('flashcard_decks')
    .insert({ user_id: uid, title: parsed.data.title, subject: parsed.data.subject, source_kind: cards.length ? 'import' : 'manual' })
    .select('id')
    .single()
  if (error || !deck) return { ok: false, error: limitError(error?.message) }
  if (cards.length) {
    const { error: cardsError } = await supabase
      .from('flashcards')
      .insert(cards.map((c, i) => ({ ...c, deck_id: deck.id, user_id: uid, position: i })))
    if (cardsError) {
      await supabase.from('flashcard_decks').delete().eq('id', deck.id)
      return { ok: false, error: limitError(cardsError.message) }
    }
  }
  return { ok: true, id: deck.id }
}

/** Saves an AI note's flashcards as a new deck (no AI call, so no daily limit). → { ok, id } */
export async function deckFromNote(noteId) {
  if (!uuid.safeParse(noteId).success) return { ok: false, error: FAIL }
  const uid = await userId()
  const { data: note } = await supabase.from('notes').select('title, subject, note').eq('id', noteId).maybeSingle()
  const cards = note?.note?.flashcards ?? []
  if (!uid || !note || cards.length === 0) return { ok: false, error: 'W tej notatce nie ma fiszek.' }

  const { data: deck, error } = await supabase
    .from('flashcard_decks')
    .insert({ user_id: uid, title: (note.title || 'Fiszki z notatki').slice(0, 120), subject: note.subject, source_kind: 'note', source_label: note.title.slice(0, 300) })
    .select('id')
    .single()
  if (error || !deck) return { ok: false, error: limitError(error?.message) }
  const { error: cardsError } = await supabase.from('flashcards').insert(
    cards.map((c, i) => ({
      deck_id: deck.id,
      user_id: uid,
      front: c.front.slice(0, FLASHCARD_LIMITS.frontChars),
      back: c.back.slice(0, FLASHCARD_LIMITS.backChars),
      position: i,
    })),
  )
  if (cardsError) {
    await supabase.from('flashcard_decks').delete().eq('id', deck.id)
    return { ok: false, error: FAIL }
  }
  return { ok: true, id: deck.id }
}

/** → { ok, card } (the new row, for the deck page's local list) */
export async function addCard(deckId, input) {
  const parsed = z.object({ deckId: uuid, front, back }).safeParse({ deckId, ...input })
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const uid = await userId()
  if (!uid) return { ok: false, error: LOGGED_OUT }
  const { count } = await supabase.from('flashcards').select('id', { count: 'exact', head: true }).eq('deck_id', deckId)
  const { data: card, error } = await supabase
    .from('flashcards')
    .insert({ deck_id: deckId, user_id: uid, front: parsed.data.front, back: parsed.data.back, position: count ?? 0 })
    .select('id, front, back, due_at, reps, lapses, ease')
    .single()
  if (error) return { ok: false, error: limitError(error.message) }
  await touchDeck(deckId)
  return { ok: true, card }
}

/** → { ok, card: { front, back } } (trimmed values as saved) */
export async function updateCard(cardId, input) {
  const parsed = z.object({ cardId: uuid, front, back }).safeParse({ cardId, ...input })
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const { error } = await supabase.from('flashcards').update({ front: parsed.data.front, back: parsed.data.back }).eq('id', cardId)
  if (error) return { ok: false, error: FAIL }
  return { ok: true, card: { front: parsed.data.front, back: parsed.data.back } }
}

export async function deleteCard(cardId) {
  if (!uuid.safeParse(cardId).success) return { ok: false, error: FAIL }
  const { error } = await supabase.from('flashcards').delete().eq('id', cardId)
  if (error) return { ok: false, error: FAIL }
  return { ok: true }
}

/** → { ok, title } (trimmed) */
export async function renameDeck(deckId, newTitle) {
  const parsed = z.object({ deckId: uuid, title }).safeParse({ deckId, title: newTitle })
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const { error } = await supabase.from('flashcard_decks').update({ title: parsed.data.title }).eq('id', deckId)
  if (error) return { ok: false, error: FAIL }
  return { ok: true, title: parsed.data.title }
}

export async function deleteDeck(deckId) {
  if (!uuid.safeParse(deckId).success) return { ok: false, error: FAIL }
  const { error } = await supabase.from('flashcard_decks').delete().eq('id', deckId)
  if (error) {
    console.error('deleteDeck failed:', error.message)
    return { ok: false, error: 'Nie udało się usunąć talii. Spróbuj ponownie.' }
  }
  return { ok: true }
}

/**
 * One answer in a study session: saves the card's next review, computed in the browser with
 * nextReview() from the card's current state (srs.ts). `next` = { interval_days, ease, reps, lapses, due_at: Date }.
 */
export async function saveReview(cardId, next) {
  if (!uuid.safeParse(cardId).success) return { ok: false, error: FAIL }
  const { error } = await supabase
    .from('flashcards')
    .update({
      interval_days: next.interval_days,
      ease: next.ease,
      reps: next.reps,
      lapses: next.lapses,
      due_at: next.due_at.toISOString(),
      last_reviewed_at: new Date().toISOString(),
    })
    .eq('id', cardId)
  if (error) return { ok: false, error: FAIL }
  return { ok: true }
}

async function touchDeck(deckId) {
  await supabase.from('flashcard_decks').update({ updated_at: new Date().toISOString() }).eq('id', deckId)
}

/** Tab-separated text that imports straight into Quizlet ("Importuj") and Anki. */
export function cardsToTsv(cards) {
  return cards.map(c => `${c.front.replace(/\s+/g, ' ')}\t${c.back.replace(/\s+/g, ' ')}`).join('\n')
}
