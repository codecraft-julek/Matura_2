// Pure helpers for solving exams and showing results (no Vue, no Supabase), so they are easy to test.
// Ported from the old AnswerSheet.tsx / result page; the rules stay the same.

import { REVIEW_STATUSES } from '@/lib/exams/labels'

/** Route prop ('practice' | 'timed') → the mode stored with the attempt ('practice' | 'exam'). */
export const attemptMode = mode => (mode === 'timed' ? 'exam' : 'practice')

// ---------- Task blocks ----------

/** Consecutive tasks with the same group number + label form one block ("Zadanie 5." can have two parts). */
export function groupTasks(tasks) {
  const groups = []
  for (const t of tasks) {
    const last = groups.at(-1)
    if (last && last.no === t.group_no && last.label === t.group_label) last.tasks.push(t)
    else groups.push({ key: `${t.group_no}-${t.number}`, no: t.group_no, label: t.group_label, section: t.section, meta: t.meta ?? {}, tasks: [t] })
  }
  return groups
}

/** "11.1" is worth a label inside the task card; a lone "1" just repeats the card's heading. */
export const isSubtask = task => task.number.includes('.')

/** Multi-part closed task: one character per row, "_" = row not answered yet. → ['P', '', …] */
export function rowParts(rows, value = '') {
  return rows.map((_, i) => (value[i] && value[i] !== '_' ? value[i] : ''))
}
export function setRowPart(rows, value, index, letter) {
  const parts = rowParts(rows, value)
  return rows.map((_, j) => (j === index ? letter : parts[j] || '_')).join('')
}

/** A task counts as answered when every part of it has an answer. */
export function isAnswered(task, value) {
  const v = value ?? ''
  if (task.kind === 'choice' && task.meta?.rows) return rowParts(task.meta.rows, v).every(Boolean)
  return v.trim().length > 0
}

export const groupPoints = group => group.tasks.reduce((s, t) => s + t.points, 0)

/** Answers of one block only, as sent to grade_exam_answers / the tutor. */
export const groupAnswers = (group, answers) => Object.fromEntries(group.tasks.map(t => [t.number, answers[t.number] ?? '']))

/** Which PDF (1 | 2) and page a block starts on, or null when we don't know the page. */
export function groupLocation(group) {
  const page = Number(group.meta?.page)
  if (!page) return null
  return { sheet: group.meta.sheet === 2 ? 2 : 1, page }
}

// ---------- Results ----------

/** How one graded answer looks: 'ok' | 'partial' | 'review' | 'wrong'. */
export function resultTone(r) {
  if (!r) return 'wrong'
  const s = r.status
  const ai = s === 'ai_graded'
  if (s === 'correct' || s === 'self_correct' || (ai && r.points === r.max)) return 'ok'
  if (s === 'self_partial' || s === 'partial' || (ai && r.points > 0 && r.points < r.max)) return 'partial'
  if (s === 'unchecked') return 'review'
  return 'wrong'
}

/** Summary of a checked block in practice mode → { got, max, tone: 'ok' | 'warn' | 'error' }. */
export function groupCheck(group, checked) {
  const results = group.tasks.map(t => checked[t.number])
  if (results.some(r => !r)) return null
  const got = results.reduce((s, r) => s + (r.points ?? 0), 0)
  const max = results.reduce((s, r) => s + (r.max ?? 0), 0)
  const review = results.some(r => r.status === 'unchecked')
  const tone = !review && got === max ? 'ok' : got > 0 || review ? 'warn' : 'error'
  return { got, max, tone, review }
}

/** Points per section, e.g. { listening: { got, max } } (writing is graded separately). */
export function sectionTotals(tasks, results = {}) {
  const sections = new Map()
  for (const t of tasks) {
    if (t.kind === 'writing') continue
    const s = sections.get(t.section) ?? { got: 0, max: 0 }
    s.got += results[t.number]?.points ?? 0
    s.max += t.points
    sections.set(t.section, s)
  }
  return sections
}

/** Points and task count per section for the overview (writing included). */
export function sectionPoints(tasks) {
  const sections = new Map()
  for (const t of tasks) {
    const s = sections.get(t.section) ?? { points: 0, groups: new Set() }
    s.points += t.points
    s.groups.add(t.group_no)
    sections.set(t.section, s)
  }
  return [...sections].map(([section, s]) => ({ section, points: s.points, groups: s.groups.size }))
}

/** Polish open answers (Arkusz 1) that AI can grade against our scoring descriptions. */
export function aiGradableCount(exam, tasks, answers, results) {
  if (exam.subject !== 'polish') return 0
  return tasks.filter(t => t.kind === 'open' && t.section === 'test' && answers[t.number]?.trim() && REVIEW_STATUSES.includes(results[t.number]?.status)).length
}

/** Same as the database after self_check_answer / self_grade_answer: new status + points, score = sum. */
export function applySelfGrade(attempt, number, points) {
  const item = attempt.results?.[number]
  if (!item) return attempt
  const status = points === item.max ? 'self_correct' : points === 0 ? 'self_incorrect' : 'self_partial'
  const results = { ...attempt.results, [number]: { ...item, status, points } }
  const score = Object.values(results).reduce((s, r) => s + (Number(r?.points) || 0), 0)
  return { ...attempt, results, score }
}

/** "300–400 wyrazów" rule for writing. max 0 = no upper limit (the Polish essay only has a minimum). */
export function wordsRule(words) {
  const [min = 0, max = 0] = words ?? []
  return { min, max, label: max === 0 ? `min. ${min}` : `wymagane ${min}–${max}`, inRange: n => n >= min && (max === 0 || n <= max) }
}

// ---------- Saved progress (localStorage) ----------

/** Same key as the old app, so a half-solved sheet survives the switch. */
export const storageKey = (examId, mode) => `om:sheet:${attemptMode(mode)}:${examId}`

const MAX_ANSWER = 5000

/** Reads a saved sheet. Anything broken or missing → null (start fresh). */
export function parseSaved(raw) {
  try {
    const saved = JSON.parse(raw ?? 'null')
    if (!saved || typeof saved !== 'object') return null
    const answers = {}
    for (const [k, v] of Object.entries(saved.answers ?? {})) if (typeof v === 'string' && k.length <= 10) answers[k] = v.slice(0, MAX_ANSWER)
    const startedAt = typeof saved.startedAt === 'string' && !Number.isNaN(Date.parse(saved.startedAt)) ? new Date(saved.startedAt).toISOString() : null
    const flags = Array.isArray(saved.flags) ? saved.flags.filter(f => typeof f === 'string') : []
    const checked = saved.checked && typeof saved.checked === 'object' ? saved.checked : {}
    const active = typeof saved.active === 'string' ? saved.active : null
    return { answers, startedAt, flags, checked, active }
  } catch {
    return null
  }
}

export function loadSaved(key) {
  try { return parseSaved(window.localStorage.getItem(key)) } catch { return null }
}
export function storeSaved(key, value) {
  try {
    if (value) window.localStorage.setItem(key, JSON.stringify(value))
    else window.localStorage.removeItem(key)
    return true
  } catch {
    return false // storage unavailable: answers still live in memory until submit
  }
}

// ---------- Timer ----------

/** Seconds left of a timed exam (never negative). */
export const secondsLeft = (startedAt, minutes, now = Date.now()) => Math.max(0, Math.round((new Date(startedAt).getTime() + minutes * 60_000 - now) / 1000))

/** 5025 → "1:23:45" */
export function formatClock(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ---------- PDF ----------

/** CKE file code from the sheet URL: "…/MPOP-P1-100-A-2505-arkusz.pdf" → { series: 'MPOP-P1-100', session: '2505' }. */
export function sheetCode(url) {
  const m = /([A-Z]{4}-[A-Z][0-9]-\d{3})(?:-[A-Z])?-(\d{4})/.exec(url ?? '')
  return m ? { series: m[1], session: m[2] } : null
}

/** Does the text of the first pages (or the file name) look like this CKE sheet? Unknown code → yes. */
export function looksLikeSheet(code, coverText, filename = '') {
  if (!code) return true
  const text = (coverText ?? '').replace(/\s+/g, '')
  if (text.includes(code.series) && text.includes(code.session)) return true
  return filename.toUpperCase().includes(code.series) && filename.includes(code.session)
}

/** URL that opens the official PDF on a given page (browsers' built-in viewers understand #page=). */
export const pageUrl = (url, page) => (page ? `${url}#page=${page}` : url)

/** How long an attempt took: "1 godz. 23 min", "23 min", "< 1 min". */
export function durationLabel(startedAt, submittedAt) {
  const min = Math.round((new Date(submittedAt).getTime() - new Date(startedAt).getTime()) / 60_000)
  if (!Number.isFinite(min) || min < 0) return ''
  if (min < 1) return '< 1 min'
  const h = Math.floor(min / 60)
  return h ? `${h} godz. ${min % 60} min` : `${min} min`
}
