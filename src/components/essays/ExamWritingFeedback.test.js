import { reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExamWritingFeedback from './ExamWritingFeedback.vue'
import { flush, mount, textOf } from '../../../tests/vue-host'

const billing = vi.hoisted(() => ({ loadAllowances: vi.fn(), allowanceFor: vi.fn() }))
const analysis = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock('vue-router', () => ({ RouterLink: { render() { return this.$slots.default?.() } } }))
vi.mock('@/stores/billing', () => ({ useBillingStore: () => billing }))
vi.mock('@/ui/AllowanceNote.vue', () => ({ default: { render: () => null } }))
vi.mock('./AnalyzingPanel.vue', () => ({ default: { render: () => null } }))
vi.mock('./useEssayAnalysis', () => ({ useEssayAnalysis: () => ({ state: reactive({ error: '' }), run: analysis.run, busy: ref(false) }) }))

let app
const props = extra => ({ attemptId: 'attempt-1', taskNumber: '1', level: 'extended', subject: 'polish', ...extra })
function render(options) { const mounted = mount(ExamWritingFeedback, options); app = mounted.app; return mounted.root }
beforeEach(() => {
  vi.resetAllMocks()
  billing.loadAllowances.mockResolvedValue({})
  billing.allowanceFor.mockReturnValue({ left: 2 })
})
afterEach(() => { app?.unmount(); app = null })

describe('essay check after handing in a sheet', () => {
  it('starts without a click, with the topic, and keeps the student on the results page', async () => {
    render(props({ autoStart: true, initialPrompt: 'Temat z arkusza' }))
    await flush()
    expect(analysis.run).toHaveBeenCalledExactlyOnceWith(
      { mode: 'exam', attemptId: 'attempt-1', taskNumber: '1', prompt: 'Temat z arkusza' },
      expect.any(Function),
      { stay: true },
    )
  })
  it('then shows the link to the feedback and tells the page', async () => {
    const onChecked = vi.fn()
    analysis.run.mockImplementation((body, onSuccess) => onSuccess('essay-1'))
    const root = render(props({ autoStart: true, onChecked }))
    await flush()
    expect(onChecked).toHaveBeenCalledWith('essay-1')
    expect(textOf(root)).toContain('Zobacz feedback AI')
  })
  it('waits for a click on a reopened result', async () => {
    const root = render(props())
    await flush()
    expect(analysis.run).not.toHaveBeenCalled()
    expect(textOf(root)).toContain('Sprawdź z AI')
  })
  it('does not start at zero limit or when the essay is already checked', async () => {
    billing.allowanceFor.mockReturnValue({ left: 0 })
    const limited = render(props({ autoStart: true }))
    await flush()
    expect(analysis.run).not.toHaveBeenCalled()
    expect(textOf(limited)).toContain('Limit wykorzystany')
    app.unmount()

    billing.allowanceFor.mockReturnValue({ left: 2 })
    render(props({ autoStart: true, existingEssayId: 'essay-1' }))
    await flush()
    expect(analysis.run).not.toHaveBeenCalled()
  })
})
