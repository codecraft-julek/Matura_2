<script setup>
// /auth/potwierdz: where links from Supabase e-mails land (password reset, e-mail confirmation).
// Replaces the old route handler: the Supabase client has detectSessionInUrl: false, so the
// ?code= / ?token_hash= is handled only here. Success → ?next= (our own pages only),
// failure → /logowanie?blad=link.
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LoaderCircle } from '@lucide/vue'
import { ROUTES, safeNextPath } from '@/config/routes'
import { confirmEmailLink } from '@/lib/api/account'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const billing = useBillingStore()

const param = name => (typeof route.query[name] === 'string' ? route.query[name] : null)

onMounted(async () => {
  const ok = await confirmEmailLink({ code: param('code'), tokenHash: param('token_hash'), type: param('type') })
  if (!ok) {
    router.replace({ path: ROUTES.login, query: { blad: 'link' } })
    return
  }
  billing.reset()
  try { await auth.ensureProfile(true) } catch { /* the guard on the next page tries again */ }
  // replace(): the one-time token must not stay in the browser history.
  router.replace(safeNextPath(param('next')))
})
</script>

<template>
  <div class="confirm" role="status" aria-live="polite">
    <LoaderCircle class="spin" :size="32" aria-hidden="true" />
    <h1>Potwierdzam…</h1>
    <p class="auth-lead">Chwilka, sprawdzamy link z maila.</p>
  </div>
</template>

<style scoped>
.confirm { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 12px 0; }
.confirm svg { color: var(--accent); margin-bottom: 16px; }
</style>
