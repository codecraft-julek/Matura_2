// "Wyloguj się": leave the page FIRST, then end the session. A page may refuse to be left
// (a timed exam asks "Wychodzisz z egzaminu?"); if the student stays, they must stay logged in.
//   const signOut = useSignOut(); await signOut() → true when logged out

import { useRouter } from 'vue-router'
import { ROUTES } from '@/config/routes'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'

export function useSignOut() {
  const auth = useAuthStore()
  const billing = useBillingStore()
  const router = useRouter()

  return async function signOut() {
    auth.leaving = true
    let failure
    try { failure = await router.push(ROUTES.home) } finally { auth.leaving = false }
    if (failure) return false
    try { await auth.signOut() } catch { /* the local session is cleared anyway */ }
    billing.reset()
    return true
  }
}
