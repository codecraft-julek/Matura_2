// Account data: profile updates, links from Supabase e-mails, data export (GDPR right of access)
// and account deletion (right to erasure). Ported from the old Server Actions (src/lib/auth/actions.ts)
// and route handlers (/auth/potwierdz, /konto/eksport). Everything runs with the student's own
// session, so RLS decides what can be read or changed.

import { ROUTES } from '@/config/routes'
import { supabase } from '@/lib/supabase'
import { profileSchema, toFieldErrors } from '@/lib/validation/auth'

export const NETWORK_ERROR = 'Brak połączenia. Sprawdź internet i spróbuj ponownie.'

// ---------- Links in e-mails ----------

/** Where a link from a Supabase e-mail should land: /auth/potwierdz?next=<our page>. */
export const confirmLink = next => `${window.location.origin}${ROUTES.authConfirm}?next=${encodeURIComponent(next)}`

const OTP_TYPES = ['recovery', 'signup', 'email', 'email_change']

/**
 * Logs the student in from an e-mail link. Two link styles (same as the old route handler):
 *   ?code=…                       Supabase's default templates (PKCE, same browser only)
 *   ?token_hash=…&type=recovery   our templates in supabase/templates (works on any device)
 * → true when a session was created.
 */
export async function confirmEmailLink({ code, tokenHash, type }) {
  try {
    if (code) return !(await supabase.auth.exchangeCodeForSession(code)).error
    if (tokenHash && OTP_TYPES.includes(type)) return !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error
  } catch (e) {
    console.error('Auth link failed:', e)
  }
  return false
}

// ---------- Profile ----------

/** Form values → validated profile, or field errors to show under the inputs. */
export function parseProfile(values) {
  const parsed = profileSchema.safeParse(values)
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, fieldErrors: toFieldErrors(parsed.error) }
}

/**
 * Saves the profile (onboarding and the account page). `onboard` also sets onboarded_at.
 * → { ok: true, row } with the changed columns (for authStore.patchProfile) or { ok: false, error, fieldErrors? }
 */
export async function saveProfile(userId, values, { onboard = false } = {}) {
  const parsed = parseProfile(values)
  if (!parsed.ok) return { ok: false, error: 'Popraw zaznaczone pola.', fieldErrors: parsed.fieldErrors }

  const row = {
    display_name: parsed.data.displayName,
    subjects: parsed.data.subjects,
    matura_year: parsed.data.maturaYear,
    ...(onboard ? { onboarded_at: new Date().toISOString() } : {}),
  }
  try {
    const { error } = await supabase.from('profiles').update(row).eq('id', userId)
    if (error) {
      console.error('Profile update failed:', error.code, error.message)
      return { ok: false, error: 'Nie udało się zapisać. Spróbuj ponownie.' }
    }
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
  return { ok: true, row }
}

// ---------- Data export ----------

export const EXPORT_FILENAME = 'ogarnij-mature-moje-dane.json'

// The API returns at most 1000 rows per request (max_rows), so every list is read page by page.
// The last order column is the primary key, so pages never skip or repeat a row.
const EXPORT_PAGE = 1000
async function selectAll(table, columns, order) {
  const rows = []
  for (let from = 0; ; from += EXPORT_PAGE) {
    let query = supabase.from(table).select(columns)
    for (const column of [...order, 'id']) query = query.order(column)
    const { data, error } = await query.range(from, from + EXPORT_PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < EXPORT_PAGE) return rows
  }
}

// Up to 300 decks × 1000 cards: group once instead of filtering all cards for every deck.
const groups = new WeakMap()
function groupBy(rows, key) {
  if (!groups.has(rows)) {
    const map = new Map()
    for (const row of rows) {
      if (!map.has(row[key])) map.set(row[key], [])
      map.get(row[key]).push(row)
    }
    groups.set(rows, map)
  }
  return groups.get(rows)
}

/**
 * Everything we store about the student, in one object (the same tables as the old
 * /konto/eksport route, plus the payment status). When new tables with user data are added,
 * add them here too. Throws when any query fails, so the student never gets an incomplete file.
 */
export async function buildDataExport() {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw authError ?? new Error('Not logged in')
  const user = auth.user

  const [single, billing, ...lists] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('billing_accounts').select('subscription_status, subscription_until, cancel_at_period_end, pass_until, updated_at').maybeSingle(),
    selectAll('exam_attempts', '*', ['submitted_at']),
    selectAll('essays', '*', ['created_at']),
    selectAll('tutor_chats', '*', ['created_at']),
    selectAll('tutor_messages', 'chat_id, role, content, created_at', []),
    selectAll('notes', 'id, subject, source_kind, source_text, title, status, note, created_at', ['created_at']),
    selectAll('flashcard_decks', '*', ['created_at']),
    selectAll('flashcards', 'deck_id, front, back, due_at, interval_days, ease, reps, lapses, last_reviewed_at, created_at', ['deck_id', 'position']),
    selectAll('ai_ratings', 'target_kind, target_id, rating, comment, created_at, updated_at', ['created_at']),
  ])
  if (single.error) throw single.error
  if (billing.error) throw billing.error
  const profile = single.data
  const [examAttempts, essays, chats, messages, notes, decks, cards, ratings] = lists

  return {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at },
    profile,
    billing: billing.data ?? null,
    exam_attempts: examAttempts ?? [],
    essays: essays ?? [],
    tutor_chats: chats.map(c => ({ ...c, messages: groupBy(messages, 'chat_id').get(c.id) ?? [] })),
    notes: notes ?? [],
    flashcard_decks: decks.map(d => ({ ...d, cards: groupBy(cards, 'deck_id').get(d.id) ?? [] })),
    ai_ratings: ratings ?? [],
  }
}

/** Builds the export and saves it as a .json file in the browser. → { ok } or { ok: false, error } */
export async function downloadDataExport() {
  let payload
  try {
    payload = await buildDataExport()
  } catch (e) {
    console.error('Data export failed:', e)
    return { ok: false, error: 'Nie udało się przygotować pliku. Sprawdź internet i spróbuj ponownie.' }
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = EXPORT_FILENAME
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { ok: true }
}

// ---------- Account deletion ----------

export const DELETE_WORD = 'USUŃ'
export const isDeleteConfirmed = text => String(text ?? '').trim().toUpperCase() === DELETE_WORD

/**
 * A subscription that still renews would keep charging the card after the account is gone.
 * `billing` = useBillingStore().billing (toMyBilling keeps the raw status for this check).
 */
export const subscriptionStillRenews = billing =>
  ['active', 'trialing', 'past_due'].includes(billing?.subscriptionStatus ?? '') && !billing?.rawCancelAtPeriodEnd

export const RENEWING_SUBSCRIPTION_ERROR =
  'Najpierw anuluj subskrypcję Premium (przycisk „Zarządzaj subskrypcją” wyżej), potem usuń konto.'

/** Permanently deletes the account and all its data (rpc delete_my_account). → { ok } or { ok: false, error } */
export async function deleteMyAccount() {
  try {
    const { error } = await supabase.rpc('delete_my_account')
    if (error?.message?.includes('subscription still renews')) return { ok: false, error: RENEWING_SUBSCRIPTION_ERROR }
    if (error) {
      console.error('Account deletion failed:', error.code, error.message)
      return { ok: false, error: 'Nie udało się usunąć konta. Napisz do nas, a zrobimy to ręcznie.' }
    }
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
  return { ok: true }
}
