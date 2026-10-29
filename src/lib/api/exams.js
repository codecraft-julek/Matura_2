// Exam data for the logged-in student (old src/lib/exams/queries.ts + actions.ts).
// RLS applies: students see published exams and only their own attempts; answer keys are never
// readable. All grading happens inside the database (grade_exam_answers / submit_exam_attempt).
// Reads throw on errors; writes return { ok, ... } with a Polish error ready to show.

import { z } from 'zod'
import { supabase } from '@/lib/supabase'

const answersSchema = z.record(z.string().max(10), z.string().max(5000))
const examIdSchema = z.string().regex(/^[a-z0-9-]{5,60}$/)
// Shape check only (a malformed id would make Postgres throw instead of "not found").
const looksLikeUuid = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))

export async function listExams() {
  const { data, error } = await supabase.from('exams').select('*').order('year', { ascending: false }).order('sort')
  if (error) throw error
  return data
}

/** { exam, tasks } or null when the exam doesn't exist (or isn't published). */
export async function getExam(id) {
  const [examRes, tasksRes] = await Promise.all([
    supabase.from('exams').select('*').eq('id', id).maybeSingle(),
    supabase.from('exam_tasks').select('*').eq('exam_id', id).order('sort'),
  ])
  if (examRes.error) throw examRes.error
  if (tasksRes.error) throw tasksRes.error
  if (!examRes.data) return null
  return { exam: examRes.data, tasks: tasksRes.data ?? [] }
}

/** The student's own attempts, newest first. */
export async function listMyAttempts(examId) {
  let query = supabase
    .from('exam_attempts')
    .select('id, exam_id, mode, started_at, submitted_at, score, checkable_points')
    .order('submitted_at', { ascending: false })
    .limit(50)
  if (examId) query = query.eq('exam_id', examId)
  const { data, error } = await query
  if (error) throw error
  return data
}

/** One attempt with answers and results, or null. */
export async function getAttempt(id) {
  if (!looksLikeUuid(id)) return null
  const { data, error } = await supabase.from('exam_attempts').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/** AI feedback for the writing task(s) of an attempt (table essays), newest first. */
export async function essaysForAttempt(attemptId) {
  if (!looksLikeUuid(attemptId)) return []
  const { data, error } = await supabase
    .from('essays')
    .select('id, task_number, status, feedback, created_at')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Practice mode: check one task group without saving anything. → { ok, results } */
export async function checkTaskGroup(examId, groupNo, answers) {
  const parsed = z.object({ examId: examIdSchema, groupNo: z.number().int().positive(), answers: answersSchema }).safeParse({ examId, groupNo, answers })
  if (!parsed.success) return { ok: false, error: 'Nieprawidłowe dane.' }
  const { data, error } = await supabase.rpc('grade_exam_answers', {
    p_exam_id: parsed.data.examId,
    p_answers: parsed.data.answers,
    p_group: parsed.data.groupNo,
  })
  if (error) {
    console.error('checkTaskGroup failed:', error.message)
    return { ok: false, error: 'Nie udało się sprawdzić. Spróbuj ponownie.' }
  }
  return { ok: true, results: data ?? {} }
}

/** Finishes an attempt: grades everything and saves it. mode: 'practice' | 'exam'. → { ok, attemptId } */
export async function submitAttempt(examId, mode, answers, startedAt) {
  const parsed = z
    .object({ examId: examIdSchema, mode: z.enum(['practice', 'exam']), answers: answersSchema, startedAt: z.iso.datetime() })
    .safeParse({ examId, mode, answers, startedAt })
  if (!parsed.success) return { ok: false, error: 'Nieprawidłowe dane.' }
  const { data: attemptId, error } = await supabase.rpc('submit_exam_attempt', {
    p_exam_id: parsed.data.examId,
    p_mode: parsed.data.mode,
    p_answers: parsed.data.answers,
    p_started_at: parsed.data.startedAt,
  })
  if (error || !attemptId) {
    console.error('submitAttempt failed:', error?.message)
    return { ok: false, error: 'Nie udało się zapisać. Twoje odpowiedzi są bezpieczne, spróbuj ponownie.' }
  }
  return { ok: true, attemptId }
}

/** Student decides whether their open answer (not in our list) counts. → { ok } */
export async function selfCheckAnswer(attemptId, number, accept) {
  const parsed = z.object({ attemptId: z.uuid(), number: z.string().max(10), accept: z.boolean() }).safeParse({ attemptId, number, accept })
  if (!parsed.success) return { ok: false }
  const { error } = await supabase.rpc('self_check_answer', {
    p_attempt_id: parsed.data.attemptId,
    p_number: parsed.data.number,
    p_accept: parsed.data.accept,
  })
  if (error) console.error('selfCheckAnswer failed:', error.message)
  return { ok: !error }
}

/** Partial self-grading for open tasks worth more than 1 point (e.g. Polish 0–2). → { ok } */
export async function selfGradeAnswer(attemptId, number, points) {
  const parsed = z.object({ attemptId: z.uuid(), number: z.string().max(10), points: z.number().int().min(0).max(10) }).safeParse({ attemptId, number, points })
  if (!parsed.success) return { ok: false }
  const { error } = await supabase.rpc('self_grade_answer', {
    p_attempt_id: parsed.data.attemptId,
    p_number: parsed.data.number,
    p_points: parsed.data.points,
  })
  if (error) console.error('selfGradeAnswer failed:', error.message)
  return { ok: !error }
}
