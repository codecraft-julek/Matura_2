import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const calls = vi.hoisted(() => ({ order: [], push: null }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: (...a) => calls.push(...a) }) }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {
  onAuthStateChange: () => {},
  signOut: async () => { calls.order.push('signOut'); return { error: null } },
} } }))

const { useSignOut } = await import('../src/composables/useSignOut')
const { useAuthStore } = await import('../src/stores/auth')

beforeEach(() => { setActivePinia(createPinia()); calls.order = [] })

it('leaves the page before ending the session', async () => {
  calls.push = async () => { calls.order.push('push'); expect(useAuthStore().leaving).toBe(true) }
  expect(await useSignOut()()).toBe(true)
  expect(calls.order).toEqual(['push', 'signOut'])
  expect(useAuthStore().leaving).toBe(false)
})

it('stays logged in when the page refuses to be left (timed exam → "Zostaję")', async () => {
  calls.push = async () => { calls.order.push('push'); return { type: 4 } } // NavigationFailure (aborted)
  expect(await useSignOut()()).toBe(false)
  expect(calls.order).toEqual(['push'])
  expect(useAuthStore().leaving).toBe(false)
})
