import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { streamFlashcards } from '@/lib/ai'
import TutorDeckOffer from './TutorDeckOffer.vue'
import { button, flush, mount, textOf } from '../../../tests/vue-host'

const billing = vi.hoisted(() => ({ refreshAllowances: vi.fn() }))
vi.mock('vue-router', () => ({ RouterLink: { render() { return this.$slots.default?.() } } }))
vi.mock('@/lib/ai', () => ({ streamFlashcards: vi.fn() }))
vi.mock('@/stores/billing', () => ({ useBillingStore: () => billing }))

const proposal = { topic: 'Romantyzm', count: 20, subject: 'polish' }
let app
function render(props) { const mounted = mount(TutorDeckOffer, { messageId: 7, proposal, ...props }); app = mounted.app; return mounted.root }
beforeEach(() => { vi.resetAllMocks() })
afterEach(() => { app?.unmount(); app = null })

describe('deck offer under a tutor reply', () => {
  it('shows the topic and count but creates nothing without a click, so a reload is safe', async () => {
    const root = render()
    await flush()
    expect(textOf(root)).toContain('Romantyzm')
    expect(textOf(root)).toContain('około 20 fiszek')
    expect(streamFlashcards).not.toHaveBeenCalled()
  })
  it('sends one request for a double click, then links to the deck', async () => {
    let finish
    streamFlashcards.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const root = render()
    const click = button(root, 'Utwórz talię').props.onClick
    click()
    click()
    await flush()
    expect(streamFlashcards).toHaveBeenCalledExactlyOnceWith({ tutorMessageId: 7 })
    expect(textOf(root)).toContain('Tworzę talię')

    finish({ ok: true, id: 'deck-1' })
    await flush()
    expect(textOf(root)).toContain('Otwórz talię')
    expect(button(root, 'Utwórz talię')).toBeUndefined()
    expect(billing.refreshAllowances).toHaveBeenCalledOnce()
  })
  it('after a reload shows the saved deck instead of the button', async () => {
    const root = render({ deckId: 'deck-1' })
    await flush()
    expect(textOf(root)).toContain('Otwórz talię')
    expect(button(root, 'Utwórz talię')).toBeUndefined()
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
