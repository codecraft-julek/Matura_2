// Data for the dashboard (/panel): the student's latest exam attempts, flashcards due today and
// their newest note, all for one subject (the active one, see stores/subject). Everything is
// limited to the student's own rows by RLS. Reads throw on error (useAsync shows the error state);
// AI limits come from the billing store, not from here.

import { supabase } from '@/lib/supabase'

/** The last `limit` submitted attempts at sheets of `subject`, newest first, with the exam's name. */
export async function recentAttempts(subject, limit = 3) {
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('id, exam_id, mode, submitted_at, score, checkable_points, exams!inner(title, subject, level, year)')
    .eq('exams.subject', subject)
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
 * Flashcards of `subject` to review today (due_at ≤ now) grouped by deck.
 * → { decks: number, due: number, byDeck: [{ id, title, due }] } (decks with most due cards first)
 */
export async function dueFlashcards(subject, now = new Date()) {
  // Counted by the database (downloading due cards to count them stops at 1000 rows).
  const { data: decks, error, count } = await supabase
    .from('flashcard_decks')
    .select('id, title, due:flashcards(count)', { count: 'exact' })
    .eq('subject', subject)
    .lte('due.due_at', now.toISOString())
    .order('updated_at', { ascending: false })
    .limit(300)
  if (error) throw error
  const byDeck = (decks ?? [])
    .map(d => ({ id: d.id, title: d.title, due: d.due?.[0]?.count ?? 0 }))
    .filter(d => d.due > 0)
    .sort((a, b) => b.due - a.due)
  return { decks: count ?? decks?.length ?? 0, due: byDeck.reduce((sum, d) => sum + d.due, 0), byDeck }
}

/** The newest note of `subject` (or null). A note "pending" for over 5 minutes was interrupted. */
export async function latestNote(subject) {
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, subject, source_kind, status, created_at')
    .eq('subject', subject)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { ...data, interrupted: data.status === 'pending' && Date.now() - new Date(data.created_at).getTime() > 5 * 60_000 }
}

/** Everything the dashboard shows for one subject, in one round trip. */
export async function loadDashboard(subject) {
  const [attempts, flashcards, note] = await Promise.all([recentAttempts(subject), dueFlashcards(subject), latestNote(subject)])
  return { attempts, flashcards, note }
}
