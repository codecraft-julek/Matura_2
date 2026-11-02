import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { streamFlashcards } from '@/lib/ai'
import TutorDeckOffer from './TutorDeckOffer.vue'
import { button, flush, mount, nodes, textOf } from '../../../tests/vue-host'

const billing = vi.hoisted(() => ({ refreshAllowances: vi.fn() }))
const ui = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('vue-router', () => ({ RouterLink: { render() { return this.$slots.default?.() } } }))
vi.mock('@/lib/ai', () => ({ streamFlashcards: vi.fn() }))
vi.mock('@/stores/billing', () => ({ useBillingStore: () => billing }))
vi.mock('@/stores/ui', () => ({ useUiStore: () => ui }))

const proposal = { topic: 'Romantyzm', count: 20, subject: 'polish' }
let app
function render(props) { const mounted = mount(TutorDeckOffer, { messageId: 7, proposal, ...props }); app = mounted.app; return mounted.root }
beforeEach(() => { vi.resetAllMocks() })
afterEach(() => { app?.unmount(); app = null; vi.useRealTimers() })

describe('deck offer under a tutor reply', () => {
  it('shows the topic and count but creates nothing without a click, so a reload is safe', async () => {
    const root = render()
    await flush()
    expect(textOf(root)).toContain('Romantyzm')
    expect(textOf(root)).toContain('około 20 fiszek')
    expect(streamFlashcards).not.toHaveBeenCalled()
  })
  it('sends one request for a double click, then links to the deck and tells the student', async () => {
    let finish
    streamFlashcards.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const root = render()
    const click = button(root, 'Utwórz talię').props.onClick
    click()
    click()
    await flush()
    expect(streamFlashcards).toHaveBeenCalledOnce()
    expect(streamFlashcards.mock.calls[0][0]).toEqual({ tutorMessageId: 7 })
    expect(textOf(root)).toContain('Tworzę talię')
    expect(ui.toast).not.toHaveBeenCalled()

    finish({ ok: true, id: 'deck-1' })
    await flush()
    expect(textOf(root)).toContain('Talia gotowa')
    expect(textOf(root)).toContain('Otwórz talię')
    expect(button(root, 'Utwórz talię')).toBeUndefined()
    expect(billing.refreshAllowances).toHaveBeenCalledOnce()
    expect(ui.toast).toHaveBeenCalledOnce()
  })
  it('shows real progress while the deck is being made', async () => {
    vi.useFakeTimers()
    let finish
    streamFlashcards.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const root = render()
    button(root, 'Utwórz talię').props.onClick()
    await flush()
    expect(textOf(root)).toContain('Czytam rozmowę')
    expect(textOf(root)).toContain('0 s')

    vi.advanceTimersByTime(3000)
    await flush()
    expect(textOf(root)).toContain('3 s')

    streamFlashcards.mock.calls[0][1].onProgress(1200)
    await flush()
    expect(textOf(root)).toContain('Gotowe mniej więcej 10 z 20 fiszek')
    const bar = nodes(root).find(el => el.props.role === 'progressbar')
    expect(bar.props['aria-valuenow']).toBe(56)

    finish({ ok: true, id: 'deck-1' })
    await flush()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('after a reload shows the saved deck, without a new toast', async () => {
    const root = render({ deckId: 'deck-1' })
    await flush()
    expect(textOf(root)).toContain('Otwórz talię')
    expect(button(root, 'Utwórz talię')).toBeUndefined()
    expect(ui.toast).not.toHaveBeenCalled()
  })
  it('shows the error and lets the student try again', async () => {
    streamFlashcards.mockResolvedValueOnce({ ok: false, error: 'Wykorzystano limit' }).mockResolvedValueOnce({ ok: true, id: 'deck-1' })
    const root = render()
    button(root, 'Utwórz talię').props.onClick()
    await flush()
    expect(textOf(root)).toContain('Wykorzystano limit')
    button(root, 'Utwórz talię').props.onClick()
    await flush()
    expect(streamFlashcards).toHaveBeenCalledTimes(2)
    expect(textOf(root)).toContain('Otwórz talię')
  })
  it('shows nothing for a proposal that fails validation', async () => {
    const root = render({ proposal: { topic: 'x', count: 999, subject: 'hack' } })
    await flush()
    expect(button(root, 'Utwórz talię')).toBeUndefined()
    expect(textOf(root)).not.toContain('fiszek')
  })
})
