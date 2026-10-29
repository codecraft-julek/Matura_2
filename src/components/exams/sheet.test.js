import { describe, expect, it } from 'vitest'
import {
  aiGradableCount, applySelfGrade, attemptMode, durationLabel, formatClock, groupCheck, groupLocation, groupTasks, isAnswered,
  looksLikeSheet, parseSaved, resultTone, rowParts, secondsLeft, sectionPoints, sectionTotals, setRowPart, sheetCode, storageKey, wordsRule,
} from './sheet'

const task = (number, extra = {}) => ({ number, group_no: Number(number.split('.')[0]), group_label: 'Dobierz', section: 'reading', kind: 'choice', options: ['A', 'B'], points: 1, meta: {}, ...extra })

describe('groupTasks', () => {
  it('joins consecutive tasks with the same number and label', () => {
    const groups = groupTasks([task('1.1'), task('1.2'), task('2.1'), task('2.2', { group_label: 'Inne' })])
    expect(groups.map(g => g.tasks.map(t => t.number))).toEqual([['1.1', '1.2'], ['2.1'], ['2.2']])
    expect(groups[0].key).toBe('1-1.1')
  })
})

describe('answers', () => {
  it('multi-row answers use "_" for empty rows', () => {
    expect(rowParts(['1.', '2.'], 'P_')).toEqual(['P', ''])
    expect(setRowPart(['1.', '2.'], '', 1, 'F')).toBe('_F')
    expect(setRowPart(['1.', '2.'], '_F', 0, 'P')).toBe('PF')
  })
  it('a task is answered only when every row is filled', () => {
    const multi = task('4', { meta: { rows: ['1.', '2.'] } })
    expect(isAnswered(multi, 'P_')).toBe(false)
    expect(isAnswered(multi, 'PF')).toBe(true)
    expect(isAnswered(task('1.1', { kind: 'open' }), '  ')).toBe(false)
    expect(isAnswered(task('1.1', { kind: 'open' }), 'went')).toBe(true)
  })
  it('knows where a block is in the PDF', () => {
    expect(groupLocation({ meta: { page: 5, sheet: 2 } })).toEqual({ sheet: 2, page: 5 })
    expect(groupLocation({ meta: { page: 3 } })).toEqual({ sheet: 1, page: 3 })
    expect(groupLocation({ meta: {} })).toBeNull()
  })
})

describe('results', () => {
  it('maps statuses to tones', () => {
    expect(resultTone({ status: 'correct', points: 1, max: 1 })).toBe('ok')
    expect(resultTone({ status: 'ai_graded', points: 2, max: 2 })).toBe('ok')
    expect(resultTone({ status: 'ai_graded', points: 1, max: 2 })).toBe('partial')
    expect(resultTone({ status: 'self_partial', points: 1, max: 2 })).toBe('partial')
    expect(resultTone({ status: 'unchecked', points: 0, max: 1 })).toBe('review')
    expect(resultTone({ status: 'self_incorrect', points: 0, max: 1 })).toBe('wrong')
    expect(resultTone({ status: 'empty', points: 0, max: 1 })).toBe('wrong')
  })
  it('summarises a checked block', () => {
    const g = groupTasks([task('1.1'), task('1.2')])[0]
    expect(groupCheck(g, { '1.1': { status: 'correct', points: 1, max: 1 } })).toBeNull()
    expect(groupCheck(g, { '1.1': { status: 'correct', points: 1, max: 1 }, '1.2': { status: 'correct', points: 1, max: 1 } })).toMatchObject({ got: 2, max: 2, tone: 'ok' })
    expect(groupCheck(g, { '1.1': { status: 'correct', points: 1, max: 1 }, '1.2': { status: 'incorrect', points: 0, max: 1 } }).tone).toBe('warn')
    expect(groupCheck(g, { '1.1': { status: 'empty', points: 0, max: 1 }, '1.2': { status: 'incorrect', points: 0, max: 1 } }).tone).toBe('error')
  })
  it('self-grading updates status and score like the database', () => {
    const attempt = { score: 3, results: { 1: { status: 'unchecked', points: 0, max: 2 }, 2: { status: 'correct', points: 3, max: 3 } } }
    expect(applySelfGrade(attempt, '1', 1)).toMatchObject({ score: 4, results: { 1: { status: 'self_partial', points: 1 } } })
    expect(applySelfGrade(attempt, '1', 2).results[1].status).toBe('self_correct')
    expect(applySelfGrade(attempt, '1', 0).results[1].status).toBe('self_incorrect')
  })
  it('totals per section and AI-gradable answers', () => {
    const tasks = [task('1', { section: 'test', kind: 'open', points: 2 }), task('2', { section: 'test' }), task('3', { section: 'writing', kind: 'writing', points: 35 })]
    const results = { 1: { status: 'unchecked', points: 0, max: 2 }, 2: { status: 'correct', points: 1, max: 1 } }
    expect([...sectionTotals(tasks, results)]).toEqual([['test', { got: 1, max: 3 }]])
    expect(sectionPoints(tasks)).toEqual([{ section: 'test', points: 3, groups: 2 }, { section: 'writing', points: 35, groups: 1 }])
    expect(aiGradableCount({ subject: 'polish' }, tasks, { 1: 'Odpowiedź' }, results)).toBe(1)
    expect(aiGradableCount({ subject: 'english' }, tasks, { 1: 'x' }, results)).toBe(0)
  })
  it('word ranges', () => {
    expect(wordsRule([300, 0]).label).toBe('min. 300')
    expect(wordsRule([100, 150]).inRange(160)).toBe(false)
    expect(wordsRule([300, 0]).inRange(1000)).toBe(true)
  })
})

describe('saved progress', () => {
  it('keeps the old storage key', () => {
    expect(storageKey('2025-maj-angielski-pp', 'timed')).toBe('om:sheet:exam:2025-maj-angielski-pp')
    expect(storageKey('x', 'practice')).toBe('om:sheet:practice:x')
    expect(attemptMode('timed')).toBe('exam')
  })
  it('reads old and new saved formats, drops junk', () => {
    expect(parseSaved('{"answers":{"1.1":"A","x":5},"startedAt":"2026-05-04T09:00:00.000Z"}')).toEqual({ answers: { '1.1': 'A' }, startedAt: '2026-05-04T09:00:00.000Z', flags: [], checked: {}, active: null })
    expect(parseSaved('nope')).toBeNull()
    expect(parseSaved(null)).toBeNull()
    expect(parseSaved('{"answers":{},"startedAt":"bad"}').startedAt).toBeNull()
  })
})

describe('timer and PDF', () => {
  it('counts down', () => {
    const start = '2026-05-04T09:00:00.000Z'
    expect(secondsLeft(start, 120, Date.parse(start) + 60_000)).toBe(119 * 60)
    expect(secondsLeft(start, 1, Date.parse(start) + 120_000)).toBe(0)
    expect(formatClock(5025)).toBe('1:23:45')
    expect(durationLabel(start, '2026-05-04T10:23:10.000Z')).toBe('1 godz. 23 min')
    expect(durationLabel(start, '2026-05-04T09:00:20.000Z')).toBe('< 1 min')
  })
  it('reads CKE codes from sheet URLs', () => {
    expect(sheetCode('https://cke.gov.pl/a/MPOP-P1-100-A-2505-arkusz.pdf')).toEqual({ series: 'MPOP-P1-100', session: '2505' })
    expect(sheetCode('https://cke.gov.pl/a/MJAP-P0-100-2305.pdf')).toEqual({ series: 'MJAP-P0-100', session: '2305' })
    expect(sheetCode('https://example.com/x.pdf')).toBeNull()
  })
  it('recognises the right PDF by its cover or file name', () => {
    const code = { series: 'MPOP-P1-100', session: '2505' }
    expect(looksLikeSheet(code, 'MPOP-P1-100-A-2505 EGZAMIN')).toBe(true)
    expect(looksLikeSheet(code, 'MPOP- P1-100-A- 2505')).toBe(true)
    expect(looksLikeSheet(code, 'MJAP-P0-100', 'mpop-p1-100-a-2505-arkusz.pdf')).toBe(true)
    expect(looksLikeSheet(code, 'MJAP-P0-100-2505', 'arkusz.pdf')).toBe(false)
    expect(looksLikeSheet(null, '')).toBe(true)
  })
})
