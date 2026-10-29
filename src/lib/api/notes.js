// AI notes of the logged-in student (RLS: only their own rows). Notes are written by the Edge
// Function `notes-generate` (see streamNote in @/lib/ai); here we only read and delete them.
// Reads throw on errors; writes return { ok, error }.

import { supabase } from '@/lib/supabase'

const UUID = /^[0-9a-f-]{36}$/i
/** A note still "pending" after this long was interrupted (e.g. the function was stopped). */
export const INTERRUPTED_AFTER_MS = 5 * 60_000

export const NOTE_SUBJECT = { polish: 'polski', english: 'angielski', other: 'inne' }
export const NOTE_SUBJECT_LONG = { polish: 'Język polski', english: 'Język angielski', other: 'Notatka' }
export const NOTE_SOURCE = {
  text: 'z tekstu',
  photo: 'ze zdjęć',
  mixed: 'ze zdjęć i tekstu',
  pdf: 'z PDF',
  docx: 'z Worda',
  pptx: 'z prezentacji',
}

export const isInterrupted = (n, now = Date.now()) => n.status === 'pending' && now - new Date(n.created_at).getTime() > INTERRUPTED_AFTER_MS
/** Still being made right now (worth polling). */
export const isInProgress = (n, now = Date.now()) => n.status === 'pending' && !isInterrupted(n, now)

export async function listNotes() {
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, subject, source_kind, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  const now = Date.now()
  return data.map(n => ({ ...n, interrupted: isInterrupted(n, now) }))
}

/** One note, or null when it doesn't exist / isn't the student's (→ 404 view). */
export async function getNote(id) {
  if (!UUID.test(String(id))) return null
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, subject, source_kind, source_text, status, note, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Deletes one of the student's notes (RLS allows deleting only your own). */
export async function deleteNote(id) {
  if (!UUID.test(String(id))) return { ok: false, error: 'Nie udało się usunąć notatki.' }
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) {
    console.error('deleteNote failed:', error.message)
    return { ok: false, error: 'Nie udało się usunąć notatki. Spróbuj ponownie.' }
  }
  return { ok: true }
}
