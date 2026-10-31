// One function per AI Edge Function, so pages never deal with URLs, tokens or SSE parsing.
// All of them resolve to { ok: true, ... } or { ok: false, error } (Polish, ready to show).

import { callEdge, streamEdge } from '@/lib/edge'

/** essay-feedback (SSE: start {id, words} → delta {text}… → done {id}). onText gets ALL text so far. */
export function streamEssayFeedback(body, { onStart, onText } = {}) {
  let text = ''
  return streamEdge('essay-feedback', body, {
    interrupted: 'Połączenie zostało przerwane. Twój tekst jest zapisany, spróbuj ponownie.',
    onEvent(e) {
      if (e.type === 'start') onStart?.({ id: e.id, words: e.words })
      else if (e.type === 'delta') onText?.((text += e.text))
    },
  })
}

/** tutor-chat (SSE: start {chatId} → delta {text}… → done {chatId, messageId}). */
export function streamTutorReply(body, { onStart, onText } = {}) {
  let text = ''
  return streamEdge('tutor-chat', body, {
    interrupted: 'Połączenie zostało przerwane. Spróbuj wysłać jeszcze raz.',
    onEvent(e) {
      if (e.type === 'start') onStart?.(e.chatId)
      else if (e.type === 'delta') onText?.((text += e.text))
    },
  })
}

/** notes-generate (SSE: start → progress {chars}… → done {id}). */
export function streamNote(body, { onProgress } = {}) {
  return streamEdge('notes-generate', body, {
    interrupted: 'Połączenie zostało przerwane. Jeśli notatka się zrobiła, znajdziesz ją na liście notatek.',
    onEvent(e) { if (e.type === 'progress') onProgress?.(e.chars) },
  })
}

/** flashcards-generate (SSE: start → progress {chars}… → done {id}). */
export function streamFlashcards(body, { onProgress } = {}) {
  return streamEdge('flashcards-generate', body, {
    interrupted: 'Połączenie zostało przerwane. Jeśli talia się zrobiła, znajdziesz ją na liście fiszek.',
    onEvent(e) { if (e.type === 'progress') onProgress?.(e.chars) },
  })
}

/** grade-open-answers → { ok: true, graded } */
export const gradeOpenAnswers = body => callEdge('grade-open-answers', body)

/**
 * billing-checkout → { ok: true, url } (Stripe's own page to go to), or with { embedded: true }
 * → { ok: true, clientSecret, sessionId } (Stripe's form shown inside our payment page).
 * billing-portal → { ok: true, url }.
 */
export const startCheckout = (plan, termsVersion, consents, { embedded = false } = {}) =>
  // Keep the old wire field during rollout; it now carries the early-start request, not a waiver.
  // Explicit values come from the form, rather than silently manufacturing every consent.
  callEdge('billing-checkout', {
    plan, termsVersion, consents: { ...consents, withdrawal: consents?.earlyStart === true },
    ...(embedded ? { ui: 'embedded' } : {}),
  })
export const openBillingPortal = () => callEdge('billing-portal')
