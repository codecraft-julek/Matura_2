import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SubjectSwitcher from './SubjectSwitcher.vue'
import { button, flush, mount, textOf } from '../../../tests/vue-host'

// The subject store as the switcher sees it: the student's subjects, the ones to add, set() and add().
const store = vi.hoisted(() => ({ state: null }))
vi.mock('@/stores/subject', async () => {
  const { reactive } = await import('vue')
  store.state = reactive({ active: 'polish', current: null, available: [], others: [], set: vi.fn(), add: vi.fn() })
  return { useSubjectStore: () => store.state }
})
vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {} })
// <Transition> wants a DOM classList; the in-memory host just renders the menu.
vi.mock('vue', async importOriginal => ({ ...(await importOriginal()), Transition: { render() { return this.$slots.default?.() } } }))

import { SUBJECTS } from '@/config/subjects'
const [polish, english, biology] = SUBJECTS

let app
function render() { const mounted = mount(SubjectSwitcher); app = mounted.app; return mounted.root }
beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(store.state, { active: 'polish', current: polish, available: [polish, english], others: [biology] })
  store.state.set.mockImplementation(id => { store.state.active = id })
  store.state.add.mockResolvedValue({ ok: true })
})
afterEach(() => { app?.unmount(); app = null })

describe('subject switcher', () => {
  it('offers the student’s subjects and, below them, the ones to add', async () => {
    const root = render()
    button(root, 'Polski').props.onClick()
    await flush()
    const text = textOf(root)
    expect(text).toContain('Twoje przedmioty')
    expect(text).toContain('Język angielski')
    expect(text).toContain('Dodaj przedmiot')
    expect(text).toContain('Biologia')
    expect(text).toContain('Dopiszemy go do Twoich przedmiotów')
  })

  it('switches to a subject the student has', async () => {
    const root = render()
    button(root, 'Polski').props.onClick()
    await flush()
    button(root, 'Język angielski').props.onClick()
    await flush()
    expect(store.state.set).toHaveBeenCalledWith('english')
    expect(store.state.add).not.toHaveBeenCalled()
  })

  it('adds a missing subject with one click and closes the menu', async () => {
    const root = render()
    button(root, 'Polski').props.onClick()
    await flush()
    button(root, 'Biologia').props.onClick()
    await flush()
    expect(store.state.add).toHaveBeenCalledWith('biology')
    expect(textOf(root)).not.toContain('Dodaj przedmiot')
  })

  it('shows the save error and keeps the menu open', async () => {
    store.state.add.mockResolvedValue({ ok: false, error: 'Brak połączenia.' })
    const root = render()
    button(root, 'Polski').props.onClick()
    await flush()
    button(root, 'Biologia').props.onClick()
    await flush()
    expect(textOf(root)).toContain('Brak połączenia.')
    expect(textOf(root)).toContain('Dodaj przedmiot')
  })

  it('shows no "Dodaj przedmiot" section when the student has every subject', async () => {
    Object.assign(store.state, { available: SUBJECTS, others: [] })
    const root = render()
    button(root, 'Polski').props.onClick()
    await flush()
    expect(textOf(root)).not.toContain('Dodaj przedmiot')
  })
})
