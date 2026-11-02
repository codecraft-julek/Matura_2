import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gradeOpenAnswers } from '@/lib/ai'
import AiGradeOpenAnswers from './AiGradeOpenAnswers.vue'
import { button, flush, mount, textOf } from '../../../tests/vue-host'

const billing = vi.hoisted(() => ({ loadAllowances: vi.fn(), refreshAllowances: vi.fn(), allowanceFor: vi.fn() }))
vi.mock('@/lib/ai', () => ({ gradeOpenAnswers: vi.fn() }))
vi.mock('@/stores/billing', () => ({ useBillingStore: () => billing }))
vi.mock('@/ui/AiRating.vue', () => ({ default: { render: () => null } }))
vi.mock('@/ui/AllowanceNote.vue', () => ({ default: { render: () => null } }))

let app
const props = extra => ({ attemptId: 'attempt-1', count: 2, pendingCount: 2, ...extra })
function render(options) { const mounted = mount(AiGradeOpenAnswers, options); app = mounted.app; return mounted.root }
beforeEach(() => {
  vi.resetAllMocks()
  billing.loadAllowances.mockResolvedValue({})
  billing.refreshAllowances.mockResolvedValue({})
  billing.allowanceFor.mockReturnValue({ left: 2 })
  gradeOpenAnswers.mockResolvedValue({ ok: true, graded: 2 })
})
afterEach(() => { app?.unmount(); app = null; vi.useRealTimers() })

describe('automatic open-answer grading', () => {
  it('starts without a click and tells the result page to reload saved points', async () => {
    const onGraded = vi.fn()
    const onBusy = vi.fn()
    render(props({ onGraded, onBusy }))
    await flush()
    expect(gradeOpenAnswers).toHaveBeenCalledExactlyOnceWith({ attemptId: 'attempt-1' })
    expect(onGraded).toHaveBeenCalledWith('attempt-1')
    expect(onBusy.mock.calls).toEqual([[true], [false]])
  })
  it('does not regrade completed attempts when opened again', async () => {
    const root = render(props({ pendingCount: 0, gradedAt: '2026-10-30' }))
    await flush()
    expect(gradeOpenAnswers).not.toHaveBeenCalled()
    expect(textOf(root)).toContain('Nie musisz ich samodzielnie zaliczać')
    expect(button(root, 'Spróbuj ponownie')).toBeUndefined()
  })
  it('does not restart after reactive result refreshes', async () => {
    const options = reactive(props())
    render(options)
    await flush()
    options.pendingCount = 0
    options.gradedAt = '2026-10-30'
    await flush()
    expect(gradeOpenAnswers).toHaveBeenCalledTimes(1)
  })
  it('shows a failure and allows an explicit retry without a retry loop', async () => {
    gradeOpenAnswers.mockResolvedValueOnce({ ok: false, error: 'Brak połączenia.' })
    const root = render(props())
    await flush()
    expect(textOf(root)).toContain('Brak połączenia.')
    expect(gradeOpenAnswers).toHaveBeenCalledTimes(1)
    await button(root, 'Spróbuj ponownie').props.onClick()
    expect(gradeOpenAnswers).toHaveBeenCalledTimes(2)
  })
  it('checks server cache even when another tab used the last quota', async () => {
    billing.allowanceFor.mockReturnValue({ left: 0 })
    render(props())
    await flush()
    expect(gradeOpenAnswers).toHaveBeenCalledTimes(1)
  })
  it('handles a quota failure without claiming the answers were marked wrong', async () => {
    billing.allowanceFor.mockReturnValue({ left: 0 })
    gradeOpenAnswers.mockResolvedValue({ ok: false, error: 'Limit wykorzystany.' })
    const root = render(props())
    await flush()
    expect(textOf(root)).toContain('Limit wykorzystany.')
    expect(textOf(root)).toContain('czekają na ocenę AI')
    expect(button(root, 'Spróbuj ponownie').props.disabled).toBe(true)
  })
  it('waits for a request started in another tab, then reloads the results', async () => {
    vi.useFakeTimers()
    const onGraded = vi.fn()
    gradeOpenAnswers.mockResolvedValueOnce({ ok: true, pending: true, graded: 0 })
    render(props({ onGraded }))
    await flush()
    expect(onGraded).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2500)
    expect(onGraded).toHaveBeenCalledWith('attempt-1')
  })
  it('ignores late responses after navigation and stops polling', async () => {
    let finish
    gradeOpenAnswers.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const onGraded = vi.fn()
    render(props({ onGraded }))
    await flush()
    app.unmount(); app = null
    finish({ ok: true, graded: 2 })
    await flush()
    expect(onGraded).not.toHaveBeenCalled()
  })
  it('recovers from unexpected thrown errors', async () => {
    gradeOpenAnswers.mockRejectedValueOnce(new Error('unexpected'))
    const root = render(props())
    await flush()
    expect(textOf(root)).toContain('Twoje odpowiedzi są zapisane')
    expect(button(root, 'Spróbuj ponownie')).toBeDefined()
  })
})
