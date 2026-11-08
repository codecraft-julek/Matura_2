import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

// A reactive stand-in for the auth store: the subject store must follow profile and user changes.
const auth = vi.hoisted(() => ({ state: null }))
vi.mock('@/stores/auth', async () => {
  const { reactive } = await import('vue')
  auth.state = reactive({ user: null, profile: null })
  auth.state.patchProfile = values => { auth.state.profile = { ...auth.state.profile, ...values } }
  return { useAuthStore: () => auth.state }
})
const saveProfileMock = vi.hoisted(() => vi.fn(async (_userId, values) => ({ ok: true, row: { display_name: values.displayName, subjects: values.subjects, matura_year: values.maturaYear } })))
vi.mock('@/lib/api/account', () => ({ saveProfile: saveProfileMock }))

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
    expect(s.available.map(x => x.id)).toEqual(['polish', 'english', 'biology', 'chemistry'])
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

describe('adding a subject', () => {
  it('lists the subjects the student could add and saves one to the profile', async () => {
    const s = useSubjectStore()
    expect(s.others.map(x => x.id)).toEqual(['english', 'chemistry'])
    auth.state.profile = { display_name: 'Ala', subjects: ['polish'], matura_year: 2027 }
    expect(s.others.map(x => x.id)).toEqual(['english', 'biology', 'chemistry'])
    const result = await s.add('biology')
    expect(result.ok).toBe(true)
    expect(saveProfileMock).toHaveBeenCalledWith('student-a', { displayName: 'Ala', subjects: ['polish', 'biology'], maturaYear: 2027 })
    expect(auth.state.profile.subjects).toEqual(['polish', 'biology'])
    expect(s.active).toBe('biology')
  })

  it('refuses a subject the student already has and passes the save error on', async () => {
    const s = useSubjectStore()
    expect((await s.add('polish')).ok).toBe(false)
    saveProfileMock.mockResolvedValueOnce({ ok: false, error: 'Brak połączenia.' })
    expect(await s.add('english')).toEqual({ ok: false, error: 'Brak połączenia.' })
    expect(s.active).toBe('polish')
  })
})
