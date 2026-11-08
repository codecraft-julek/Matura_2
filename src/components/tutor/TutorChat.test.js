import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { streamTutorReply } from '@/lib/ai'
import TutorChat from './TutorChat.vue'
import { button, flush, mount, textOf } from '../../../tests/vue-host'

const billing = vi.hoisted(() => ({ refreshAllowances: vi.fn(), loadAllowances: vi.fn(), allowanceFor: vi.fn() }))
vi.mock('vue-router', () => ({ RouterLink: { render() { return this.$slots.default?.() } } }))
vi.mock('@/lib/ai', () => ({ streamTutorReply: vi.fn(), streamFlashcards: vi.fn() }))
vi.mock('@/stores/billing', () => ({ useBillingStore: () => billing }))
vi.mock('@/stores/ui', () => ({ useUiStore: () => ({ toast: vi.fn() }) }))
vi.mock('@/stores/subject', () => ({ useSubjectStore: () => ({ active: 'polish' }) }))
vi.mock('@/ui/AiRating.vue', () => ({ default: { render: () => null } }))

// The proposal as tutor-chat really saved it for "zrób mi talie fiszek z romantyzmu".
const proposal = { count: 20, subject: 'polish', topic: 'Romantyzm — cechy epoki, twórcy i lektury maturalne' }
const reply = 'Możesz utworzyć talię o romantyzmie przyciskiem pod odpowiedzią.'
let app
function render(props = {}) { const mounted = mount(TutorChat, { variant: 'panel', ...props }); app = mounted.app; return mounted.root }
beforeEach(() => {
  vi.resetAllMocks()
  billing.loadAllowances.mockResolvedValue()
})
afterEach(() => { app?.unmount(); app = null })

describe('deck offer in the tutor chat', () => {
  it('shows the button under a saved reply with a proposal, as after a reload', async () => {
    const root = render({ chatId: 'c1', messages: [{ id: 43, role: 'user', content: 'zrób mi talie fiszek z romantyzmu' }, { id: 44, role: 'assistant', content: reply, deck_proposal: proposal, deck_id: null }] })
    await flush()
    expect(button(root, 'Utwórz talię')).toBeDefined()
    expect(textOf(root)).toContain('około 20 fiszek')
  })
  it('shows the button right after the reply streams in', async () => {
    streamTutorReply.mockResolvedValue({ ok: true, type: 'done', chatId: 'c1', messageId: 44, reply, deckProposal: proposal })
    const root = render({ chatId: 'c1', suggestions: ['zrób mi talie fiszek z romantyzmu'] })
    await flush()
    button(root, 'zrób mi talie').props.onClick()
    await flush()
    expect(streamTutorReply).toHaveBeenCalledOnce()
    expect(streamTutorReply.mock.calls[0][0]).toMatchObject({ chatId: 'c1', subject: 'polish' })
    expect(button(root, 'Utwórz talię')).toBeDefined()
  })
  it('shows no button under a reply without a proposal', async () => {
    const root = render({ chatId: 'c1', messages: [{ id: 44, role: 'assistant', content: reply, deck_proposal: null, deck_id: null }] })
    await flush()
    expect(button(root, 'Utwórz talię')).toBeUndefined()
  })
})
