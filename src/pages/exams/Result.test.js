import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAttempt, getExam } from '@/lib/api/exams'
import { gradeOpenAnswers } from '@/lib/ai'
import Result from './Result.vue'
import { button, flush, mount, nodes, textOf } from '../../../tests/vue-host'

const billing = vi.hoisted(() => ({ loadAllowances: vi.fn(), refreshAllowances: vi.fn(), allowanceFor: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { examId: 'exam', attemptId: 'attempt' } }), RouterLink: { render: () => null } }))
vi.mock('@/composables/usePageTitle', () => ({ usePageTitle: () => {} }))
vi.mock('@/stores/billing', () => ({ useBillingStore: () => billing }))
vi.mock('@/stores/ui', () => ({ useUiStore: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/api/exams', () => ({ getAttempt: vi.fn(), getExam: vi.fn(), essaysForAttempt: async () => [], selfCheckAnswer: vi.fn(), selfGradeAnswer: vi.fn() }))
vi.mock('@/lib/api/ratings', () => ({ myRating: async () => null }))
vi.mock('@/lib/ai', () => ({ gradeOpenAnswers: vi.fn() }))
vi.mock('@/components/tutor/AskTutor.vue', () => ({ default: { render: () => null } }))
vi.mock('@/components/essays/ExamWritingFeedback.vue', () => ({ default: { render: () => null } }))
vi.mock('@/ui/AiRating.vue', () => ({ default: { render: () => null } }))
vi.mock('@/ui/AllowanceNote.vue', () => ({ default: { render: () => null } }))

let app, saved, finish
const resultText = root => textOf(nodes(root).find(n => n.props.class === 'score-value tabular')).replace(/\s+/g, ' ')
beforeEach(() => {
  vi.resetAllMocks()
  billing.loadAllowances.mockResolvedValue({})
  billing.refreshAllowances.mockResolvedValue({})
  billing.allowanceFor.mockReturnValue({ left: 2 })
  saved = {
    id: 'attempt', exam_id: 'exam', mode: 'exam', score: 1, checkable_points: 3,
    started_at: '2026-10-30T10:00:00Z', submitted_at: '2026-10-30T10:10:00Z',
    answers: { 1: 'Poprawny argument.', 2: 'A' },
    results: { 1: { status: 'unchecked', points: 0, max: 2, answer: 'Dwa argumenty.' }, 2: { status: 'correct', points: 1, max: 1 } },
  }
  getAttempt.mockImplementation(async () => structuredClone(saved))
  getExam.mockResolvedValue({
    exam: { id: 'exam', title: 'Polski 2025', subject: 'polish', level: 'basic' },
    tasks: [
      { number: '1', kind: 'open', section: 'test', group_no: 1, points: 2 },
      { number: '2', kind: 'choice', section: 'test', group_no: 2, points: 1 },
    ],
  })
  gradeOpenAnswers.mockImplementation(() => new Promise(resolve => { finish = resolve }))
})
afterEach(() => { app?.unmount(); app = null })
async function render() {
  const mounted = mount(Result)
  app = mounted.app
  for (let n = 0; n < 4; n++) await flush()
  return mounted.root
}

describe('exam results with automatic grading', () => {
  it('labels the score as partial and does not count pending answers as wrong', async () => {
    const root = await render()
    expect(gradeOpenAnswers).toHaveBeenCalledExactlyOnceWith({ attemptId: 'attempt' })
    expect(textOf(root)).toContain('Wynik częściowy')
    expect(textOf(root)).toContain('AI sprawdza odpowiedzi otwarte')
    expect(button(root, 'Do poprawy').props.disabled).toBe(true)
    expect(nodes(root).some(n => n.type === 'details')).toBe(false)
    expect(textOf(root)).not.toContain('na Twoje porównanie')
  })
  it('refreshes totals and partial-credit explanations after AI, keeping corrections collapsed', async () => {
    const root = await render()
    saved.score = 2
    saved.ai_graded_at = '2026-10-30T10:10:10Z'
    saved.results[1] = { ...saved.results[1], status: 'ai_graded', points: 1, ai_points: 1, ai_reason: 'Jeden argument jest poprawny.', ai_uncertain: false }
    finish({ ok: true, graded: 1 })
    for (let n = 0; n < 4; n++) await flush()
    expect(resultText(root)).toContain('2 /3 pkt')
    expect(textOf(root)).toContain('Jeden argument jest poprawny.')
    expect(textOf(root)).not.toContain('Wynik częściowy')
    expect(textOf(root)).toContain('Nie musisz ich samodzielnie zaliczać')
    const correction = nodes(root).find(n => n.type === 'details')
    expect(correction).toBeDefined()
    expect(correction.props.open).toBeUndefined()
    expect(textOf(correction)).toContain('opcjonalnie')
    expect(gradeOpenAnswers).toHaveBeenCalledTimes(1)
  })
  it('does not call AI for a fully checked exam on a repeat visit', async () => {
    saved.results[1].status = 'ai_graded'
    saved.results[1].points = 2
    saved.score = 3
    saved.ai_graded_at = '2026-10-30T10:10:10Z'
    const root = await render()
    expect(gradeOpenAnswers).not.toHaveBeenCalled()
    expect(resultText(root)).toContain('3 /3 pkt')
  })
  it('marks uncertain AI scores as estimates rather than incorrect answers', async () => {
    saved.results[1] = { ...saved.results[1], status: 'ai_graded', ai_uncertain: true, ai_reason: 'Nieczytelny fragment arkusza.', ai_points: 0 }
    saved.ai_graded_at = '2026-10-30T10:10:10Z'
    const root = await render()
    expect(gradeOpenAnswers).not.toHaveBeenCalled()
    expect(button(root, 'Do poprawy').props.disabled).toBe(true)
    expect(textOf(root)).toContain('niepewnych ocen AI')
    expect(nodes(root).some(n => n.props['aria-label'] === 'niepewna ocena AI — punkty szacunkowe')).toBe(true)
  })
});
