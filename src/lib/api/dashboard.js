// Data for the dashboard (/panel): the student's latest exam attempts, flashcards due today and
// their newest note. Everything is limited to the student's own rows by RLS. Reads throw on error
// (useAsync shows the error state); AI limits come from the billing store, not from here.

import { supabase } from '@/lib/supabase'

/** The last `limit` submitted attempts, newest first, with the exam's name. */
export async function recentAttempts(limit = 3) {
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('id, exam_id, mode, submitted_at, score, checkable_points, exams(title, subject, level, year)')
    .order('submitted_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(a => ({
    ...a,
    exam: Array.isArray(a.exams) ? a.exams[0] ?? null : a.exams ?? null,
    percent: a.checkable_points ? Math.round((a.score / a.checkable_points) * 100) : null,
  }))
}

/**
 * Flashcards to review today (due_at ≤ now) grouped by deck.
 * → { decks: number, due: number, byDeck: [{ id, title, due }] } (decks with most due cards first)
 */
export async function dueFlashcards(now = new Date()) {
  const [{ data: decks, error, count }, { data: due, error: dueError }] = await Promise.all([
    supabase.from('flashcard_decks').select('id, title', { count: 'exact' }).order('updated_at', { ascending: false }).limit(300),
    supabase.from('flashcards').select('deck_id').lte('due_at', now.toISOString()).limit(1000),
  ])
  if (error) throw error
  if (dueError) throw dueError
  const dueBy = new Map()
  for (const c of due ?? []) dueBy.set(c.deck_id, (dueBy.get(c.deck_id) ?? 0) + 1)
  const byDeck = (decks ?? [])
    .map(d => ({ id: d.id, title: d.title, due: dueBy.get(d.id) ?? 0 }))
    .filter(d => d.due > 0)
    .sort((a, b) => b.due - a.due)
  return { decks: count ?? decks?.length ?? 0, due: (due ?? []).length, byDeck }
}

/** The newest note (or null). A note "pending" for over 5 minutes was interrupted. */
export async function latestNote() {
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, subject, source_kind, status, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { ...data, interrupted: data.status === 'pending' && Date.now() - new Date(data.created_at).getTime() > 5 * 60_000 }
}

/** Everything the dashboard shows, in one round trip. */
export async function loadDashboard() {
  const [attempts, flashcards, note] = await Promise.all([recentAttempts(3), dueFlashcards(), latestNote()])
  return { attempts, flashcards, note }
}
