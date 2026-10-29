// Who is logged in, plus their profile row. The router guard waits for `ready()` before deciding
// anything, so a refresh on a protected page never flashes the login screen.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref(null)
  const profile = ref(null)
  const user = computed(() => session.value?.user ?? null)
  const email = computed(() => user.value?.email ?? '')
  const isLoggedIn = computed(() => Boolean(user.value))
  const onboarded = computed(() => Boolean(profile.value?.onboarded_at))
  let readyPromise = null
  let profilePromise = null

  /** Resolves once Supabase has restored the session from storage (INITIAL_SESSION). */
  function ready() {
    readyPromise ??= new Promise(resolve => {
      supabase.auth.onAuthStateChange((event, next) => {
        const changedUser = next?.user?.id !== session.value?.user?.id
        session.value = next
        if (!next || changedUser) { profile.value = null; profilePromise = null }
        if (event === 'INITIAL_SESSION') resolve()
      })
    })
    return readyPromise
  }

  /** The student's profile (cached). Returns null when logged out or the row is missing. */
  async function ensureProfile(force = false) {
    await ready()
    if (!user.value) return null
    if (profile.value && !force) return profile.value
    profilePromise = force || !profilePromise ? fetchProfile() : profilePromise
    return profilePromise
  }

  async function fetchProfile() {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.value.id).maybeSingle()
    if (error) { profilePromise = null; throw error }
    profile.value = data
    return data
  }

  /** Optimistic local update after a successful profiles.update(). */
  function patchProfile(values) {
    if (profile.value) profile.value = { ...profile.value, ...values }
  }

  async function signOut(scope = 'global') {
    await supabase.auth.signOut({ scope })
    session.value = null
    profile.value = null
    profilePromise = null
  }

  return { session, profile, user, email, isLoggedIn, onboarded, ready, ensureProfile, patchProfile, signOut }
})
