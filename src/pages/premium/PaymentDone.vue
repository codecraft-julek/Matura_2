<script setup>
// Stripe sends the student here after paying. Premium is switched on by the webhook (not by this
// page), so until it arrives we show "Potwierdzamy płatność…" and check billing_accounts every
// 2 seconds for up to 30 seconds. When Premium is there: success screen + fresh AI limits.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, Check, Hourglass } from '@lucide/vue'
import { ROUTES } from '@/config/routes'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'

const POLL_MS = 2000
const MAX_MS = 30_000

const auth = useAuthStore()
const billingStore = useBillingStore()
const state = ref('checking') // 'checking' | 'done' | 'slow'
const billing = ref(null)
const heading = ref(null)
const name = computed(() => auth.profile?.display_name?.trim() || '')
const planName = computed(() => (billing.value?.kind === 'pass' ? 'Pakiet do matury' : 'Premium'))
let timer = null
let started = 0
let stopped = false

async function check() {
  try {
    billing.value = await billingStore.loadBilling(true)
  } catch {
    // Offline for a moment: just try again on the next tick.
  }
  if (stopped) return
  if (billing.value?.premium) {
    state.value = 'done'
    billingStore.refreshAllowances() // new limits everywhere in the app
    await nextTick()
    heading.value?.focus()
  } else if (Date.now() - started >= MAX_MS) {
    state.value = 'slow'
    await nextTick()
    heading.value?.focus()
  } else {
    timer = setTimeout(check, POLL_MS)
  }
}

onMounted(() => { started = Date.now(); check() })
onBeforeUnmount(() => { stopped = true; clearTimeout(timer) })

function tryAgain() {
  state.value = 'checking'
  started = Date.now()
  check()
}
</script>

<template>
  <div class="payment-done" role="status" aria-live="polite">
    <template v-if="state === 'done'">
      <span class="pd-icon is-ok"><Check :size="32" :stroke-width="2.6" /></span>
      <span class="page-kicker">Dzięki{{ name ? `, ${name}` : '' }}!</span>
      <h1 ref="heading" tabindex="-1">{{ planName }} jest Twój<span class="accent-dot">.</span></h1>
      <p>Masz teraz więcej sprawdzeń wypracowań, notatek, fiszek z AI i rozmów z tutorem. Potwierdzenie płatności dostaniesz e-mailem od Stripe.</p>
      <div class="row pd-actions">
        <RouterLink :to="ROUTES.dashboard" class="button button-dark">Wracam do nauki <ArrowRight :size="17" /></RouterLink>
        <RouterLink :to="ROUTES.account" class="button button-outline">Mój plan</RouterLink>
      </div>
    </template>

    <template v-else-if="state === 'slow'">
      <span class="pd-icon"><Hourglass :size="28" /></span>
      <h1 ref="heading" tabindex="-1">Płatność jeszcze się przetwarza</h1>
      <p>Czasem bank potrzebuje chwili dłużej. Premium włączy się samo, gdy tylko dostaniemy potwierdzenie. Sprawdź ponownie za kilka minut. Jeśli po godzinie nadal go nie ma, napisz do nas przez stronę kontaktu.</p>
      <div class="row pd-actions">
        <button type="button" class="button button-dark" @click="tryAgain">Sprawdź ponownie</button>
        <RouterLink :to="ROUTES.contact" class="button button-outline">Kontakt</RouterLink>
      </div>
    </template>

    <template v-else>
      <span class="pd-spinner" aria-hidden="true"></span>
      <h1>Potwierdzamy płatność…</h1>
      <p>To zwykle trwa kilka sekund. Nie zamykaj tej strony.</p>
    </template>
  </div>
</template>

<style scoped>
.payment-done { max-width: 540px; margin: 40px auto 0; text-align: center; display: flex; flex-direction: column; align-items: center; }
.pd-icon { display: grid; place-items: center; width: 68px; height: 68px; border-radius: 50%; background: var(--surface-3); color: var(--accent); margin-bottom: 22px; }
.pd-icon.is-ok { background: var(--lime); color: var(--green); box-shadow: 0 10px 30px #6f952030; }
.pd-spinner { width: 44px; height: 44px; border-radius: 50%; border: 4px solid #dfe8d3; border-top-color: var(--green); animation: spin 1s linear infinite; margin-bottom: 22px; }
h1 { font-size: clamp(28px, 4vw, 38px); letter-spacing: -1.3px; line-height: 1.2; font-weight: 750; outline: none; }
p { margin-top: 12px; color: var(--text-soft); font-size: 15px; line-height: 1.65; }
.pd-actions { justify-content: center; margin-top: 26px; }
</style>
