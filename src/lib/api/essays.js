// Essays and their AI feedback (RLS: only the student's own rows). New feedback is created by the
// `essay-feedback` Edge Function (streamEssayFeedback in @/lib/ai); here are only reads.

import { z } from 'zod'
import { supabase } from '@/lib/supabase'

/** Latest 50 essays, newest first (feedback included for the score). */
export async function listMyEssays() {
  const { data, error } = await supabase
    .from('essays')
    .select('id, kind, level, topic, word_count, status, feedback, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

/** One essay (all columns), or null when it doesn't exist (or isn't yours). */
export async function getEssay(id) {
  if (!z.uuid().safeParse(id).success) return null
  const { data, error } = await supabase.from('essays').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/** Just the status/feedback of one essay (polling while it is "pending"). */
export async function getEssayStatus(id) {
  const { data, error } = await supabase.from('essays').select('id, status, feedback').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/**
 * Essays already created from one exam attempt (the result page links to existing feedback),
 * newest first: [{ id, task_number, status, feedback, created_at }].
 */
export async function essaysForAttempt(attemptId) {
  const { data, error } = await supabase
    .from('essays')
    .select('id, task_number, status, feedback, created_at')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
