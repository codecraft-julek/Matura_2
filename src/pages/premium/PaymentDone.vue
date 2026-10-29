<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowRight, Check, CircleAlert, Hourglass, RefreshCw } from '@lucide/vue'
import { ROUTES } from '@/config/routes'
import { formatDate } from '@/lib/format'
import { createPaymentConfirmation } from '@/lib/billing/confirmation'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'

const route = useRoute()
const auth = useAuthStore()
const billingStore = useBillingStore()
const state = ref('checking')
const billing = ref(null)
const heading = ref(null)
const name = computed(() => auth.profile?.display_name?.trim() || '')
const planName = computed(() => billing.value?.kind === 'pass' ? 'Pakiet do matury' : 'Premium')
const confirmation = createPaymentConfirmation({
  hasSession: typeof route.query.session_id === 'string' && route.query.session_id.startsWith('cs_'),
  loadBilling: () => billingStore.loadBilling(true),
  onChange: async (next, result) => {
    state.value = next
    if (result) billing.value = result
    await nextTick()
    heading.value?.focus()
  },
  onActive: () => billingStore.refreshAllowances(),
})
onMounted(confirmation.start)
onBeforeUnmount(confirmation.stop)
</script>

<template>
  <section class="payment-done card" aria-labelledby="payment-heading">
    <div role="status" aria-live="polite" aria-atomic="true">
      <template v-if="state === 'done'">
        <span class="pd-icon is-ok" aria-hidden="true"><Check :size="32" :stroke-width="2.6" /></span>
        <span class="page-kicker">Dzięki{{ name ? `, ${name}` : '' }}!</span>
        <h1 id="payment-heading" ref="heading" tabindex="-1">{{ planName }} {{ billing.kind === 'pass' ? 'jest aktywny' : 'jest aktywne' }}<span class="accent-dot">.</span></h1>
        <p>Możesz już korzystać z większych limitów AI. Czas na Twój kolejny mały krok do matury.</p>
        <dl class="access-details">
          <div><dt>Konto</dt><dd>{{ auth.email }}</dd></div>
          <div v-if="billing.until"><dt>Opłacony dostęp do</dt><dd>{{ formatDate(billing.until) }}</dd></div>
        </dl>
      </template>
      <template v-else-if="state === 'error'">
        <span class="pd-icon" aria-hidden="true"><CircleAlert :size="28" /></span>
        <h1 id="payment-heading" ref="heading" tabindex="-1">Nie możemy sprawdzić dostępu</h1>
        <p>Sprawdź połączenie z internetem i spróbuj ponownie. Ten komunikat nie oznacza, że płatność się nie udała.</p>
        <p class="reassurance">Jeśli bank potwierdził płatność, nie płać drugi raz.</p>
      </template>
      <template v-else-if="state === 'slow' || state === 'inactive'">
        <span class="pd-icon" aria-hidden="true"><Hourglass :size="28" /></span>
        <h1 id="payment-heading" ref="heading" tabindex="-1">{{ state === 'slow' ? 'Czekamy na potwierdzenie' : 'Premium nie jest jeszcze aktywne' }}</h1>
        <p>Jeśli potwierdziłeś płatność w banku, nie płać drugi raz. Dostęp włączy się automatycznie, gdy otrzymamy potwierdzenie.</p>
        <p class="reassurance">Sprawdź ponownie za chwilę. Jeśli dostęp nadal się nie pojawi, napisz do nas z adresu {{ auth.email }}.</p>
      </template>
      <template v-else>
        <span class="pd-spinner" aria-hidden="true"></span>
        <h1 id="payment-heading" ref="heading" tabindex="-1">Sprawdzamy Twój dostęp…</h1>
        <p>To zwykle trwa kilka sekund. Premium włączy się automatycznie po potwierdzeniu płatności, także gdy zamkniesz tę stronę.</p>
      </template>
    </div>
    <div v-if="state === 'done'" class="pd-actions">
      <RouterLink :to="ROUTES.dashboard" class="button button-lime">Zaczynam naukę <ArrowRight :size="17" /></RouterLink>
      <RouterLink :to="ROUTES.account" class="link">Mój plan i płatności</RouterLink>
    </div>
    <div v-else-if="state !== 'checking'" class="pd-actions">
      <button type="button" class="button button-dark" @click="confirmation.start"><RefreshCw :size="16" /> Sprawdź ponownie</button>
      <RouterLink :to="ROUTES.contact" class="link">Potrzebuję pomocy</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.payment-done { max-width: 560px; margin: 32px auto; padding: 40px; text-align: center; box-shadow: var(--shadow); }
.pd-icon { display: grid; place-items: center; width: 68px; height: 68px; border-radius: 50%; background: var(--surface-3); color: var(--accent); margin: 0 auto 24px; }
.pd-icon.is-ok { background: var(--lime); color: var(--green); }
.pd-spinner { display: block; width: 44px; height: 44px; border-radius: 50%; border: 4px solid var(--line); border-top-color: var(--green); animation: spin 1s linear infinite; margin: 0 auto 24px; }
@media (prefers-reduced-motion: reduce) { .pd-spinner { animation: none; } }
h1 { font: 750 clamp(26px, 4vw, 36px)/1.2 var(--heading); letter-spacing: -1.2px; outline: none; }
p { margin-top: 16px; color: var(--text-soft); font-size: 15px; line-height: 1.65; }
.reassurance { font-size: 13px; }
.access-details { text-align: left; margin-top: 24px; padding: 18px; background: var(--surface-3); border-radius: var(--radius); display: grid; gap: 12px; font-size: 13px; }
.access-details div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 16px; }
.access-details dt { color: var(--text-soft); }
.access-details dd { margin: 0; font-weight: 650; overflow-wrap: anywhere; }
.pd-actions { display: flex; flex-direction: column; align-items: center; gap: 20px; margin-top: 28px; font-size: 13px; }
@media (max-width: 600px) { .payment-done { padding: 30px 22px; margin-block: 16px; } }
</style>
