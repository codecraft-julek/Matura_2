import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveReview } from '@/lib/api/flashcards'
import StudySession from './StudySession.vue'
import { button, flush, mount, textOf } from '../../../tests/vue-host'

vi.mock('vue-router', () => ({ RouterLink: { render() { return this.$slots.default?.() } } }))
vi.mock('@/lib/api/flashcards', () => ({ saveReview: vi.fn() }))
vi.mock('@/stores/ui', () => ({ useUiStore: () => ({ toast: vi.fn() }) }))
vi.mock('./FlipCard.vue', () => ({ default: { setup(_, { expose }) { expose({ focus() {} }); return () => null } } }))

const makeCards = n => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, front: `Pytanie ${i}`, back: `Odpowiedź ${i}`, interval_days: 0, ease: 2.5, reps: 0, lapses: 0 }))
let app
function render(cards) { const mounted = mount(StudySession, { deckId: 'd1', title: 'Talia', cards }); app = mounted.app; return mounted.root }
async function answer(root, label) {
  button(root, 'Pokaż odpowiedź').props.onClick()
  await flush()
  button(root, label).props.onClick()
  await flush()
}
const endNumbers = root => {
  const find = (node, cls) => (node.props?.class === cls ? node : node.children.map(c => find(c, cls)).find(Boolean))
  return { known: textOf(find(root, 'g-good')), notKnown: textOf(find(root, 'g-again')) }
}

beforeEach(() => {
  vi.resetAllMocks()
  saveReview.mockResolvedValue({ ok: true })
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} })
})
afterEach(() => { app?.unmount(); app = null; vi.unstubAllGlobals() })

describe('study session', () => {
  it('offers exactly two answers: Nie umiem and Umiem', async () => {
    const root = render(makeCards(1))
    button(root, 'Pokaż odpowiedź').props.onClick()
    await flush()
    expect(button(root, 'Nie umiem')).toBeDefined()
    expect(button(root, 'Umiem')).toBeDefined()
    expect(button(root, 'Trudne')).toBeUndefined()
    expect(button(root, 'Łatwe')).toBeUndefined()
  })

  it('a card that comes back is counted once, so the numbers add up to the deck', async () => {
    const root = render(makeCards(3))
    await answer(root, 'Umiem') // c0
    await answer(root, 'Nie umiem') // c1 comes back at the end
    await answer(root, 'Umiem') // c2
    await answer(root, 'Nie umiem') // c1 again
    await answer(root, 'Umiem') // c1 at last

    expect(saveReview).toHaveBeenCalledTimes(5)
    expect(textOf(root)).toContain('3 fiszki')
    expect(endNumbers(root)).toEqual({ known: '2 Umiem', notKnown: '1 Nie umiem' })
  })

  it('counts cards in a whole deck of 20 where 10 came back, not the 30 answers', async () => {
    const root = render(makeCards(20))
    for (let i = 0; i < 20; i++) await answer(root, i % 2 ? 'Nie umiem' : 'Umiem')
    for (let i = 0; i < 10; i++) await answer(root, 'Umiem')

    expect(saveReview).toHaveBeenCalledTimes(30)
    expect(endNumbers(root)).toEqual({ known: '10 Umiem', notKnown: '10 Nie umiem' })
  })

  it('the counter is about cards known now and never passes the deck size', async () => {
    const root = render(makeCards(2))
    expect(textOf(root)).toContain('Umiesz: 0 z 2')
    await answer(root, 'Nie umiem')
    expect(textOf(root)).toContain('Umiesz: 0 z 2')
    await answer(root, 'Umiem')
    expect(textOf(root)).toContain('Umiesz: 1 z 2')
  })
})
