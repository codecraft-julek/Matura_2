import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

// A reactive stand-in for the auth store: the subject store must follow profile and user changes.
const auth = vi.hoisted(() => ({ state: null }))
vi.mock('@/stores/auth', async () => {
  const { reactive } = await import('vue')
  auth.state = reactive({ user: null, profile: null })
  return { useAuthStore: () => auth.state }
})

import { SUBJECT_STORAGE_PREFIX, useSubjectStore } from './subject'

let storage
beforeEach(() => {
  setActivePinia(createPinia())
  storage = new Map()
  vi.stubGlobal('window', { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } })
  auth.state.user = { id: 'student-a' }
  auth.state.profile = { subjects: ['polish', 'biology'] }
})

describe('active subject', () => {
  it('starts with the first of the student’s subjects, in config order', () => {
    auth.state.profile = { subjects: ['biology', 'polish'] }
    const s = useSubjectStore()
    expect(s.available.map(x => x.id)).toEqual(['polish', 'biology'])
    expect(s.active).toBe('polish')
    expect(s.current.label).toBe('Język polski')
    expect(s.canSwitch).toBe(true)
  })

  it('remembers the choice per student and ignores subjects they do not have', () => {
    const s = useSubjectStore()
    s.set('biology')
    expect(s.active).toBe('biology')
    expect(storage.get(`${SUBJECT_STORAGE_PREFIX}student-a:active`)).toBe('biology')
    s.set('english') // not in the profile
    expect(s.active).toBe('polish')
    s.set('maths')
    expect(s.active).toBe('polish')
  })

  it('reads the remembered subject on a fresh load', () => {
    storage.set(`${SUBJECT_STORAGE_PREFIX}student-a:active`, 'biology')
    expect(useSubjectStore().active).toBe('biology')
  })

  it('hides the switcher for one subject and falls back to it', () => {
    storage.set(`${SUBJECT_STORAGE_PREFIX}student-a:active`, 'biology')
    auth.state.profile = { subjects: ['english'] }
    const s = useSubjectStore()
    expect(s.canSwitch).toBe(false)
    expect(s.active).toBe('english')
  })

  it('offers every subject while the profile is not loaded yet', () => {
    auth.state.profile = null
    const s = useSubjectStore()
    expect(s.available.map(x => x.id)).toEqual(['polish', 'english', 'biology'])
  })

  it('follows the profile when it changes and starts over for another student', async () => {
    const s = useSubjectStore()
    s.set('biology')
    auth.state.profile = { subjects: ['polish'] }
    await nextTick()
    expect(s.active).toBe('polish')
    storage.set(`${SUBJECT_STORAGE_PREFIX}student-b:active`, 'english')
    auth.state.user = { id: 'student-b' }
    auth.state.profile = { subjects: ['polish', 'english'] }
    await nextTick()
    expect(s.active).toBe('english')
  })
})
