<script setup>
// Checkout: pick a plan, tick the consents, then "Przejdź do płatności" sends the student to
// Stripe's own page (BLIK, card, Przelewy24). No payment details are ever typed here. Premium is
// switched on by the Stripe webhook after the payment, not by this page.
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, CircleAlert, CreditCard, Landmark, LoaderCircle, Lock, Smartphone } from '@lucide/vue'
import { PAID_PLANS, planById } from '@/config/plans'
import { ROUTES } from '@/config/routes'
import { TERMS_VERSION } from '@/config/site'
import { startCheckout } from '@/lib/ai'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'
import PageSkeleton from '@/ui/PageSkeleton.vue'
import ErrorState from '@/ui/ErrorState.vue'
import BillingStatus from '@/components/premium/BillingStatus.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const billingStore = useBillingStore()
const { data: billing, loading, error: loadError, reload } = useAsync(() => billingStore.loadBilling(true))

// What Stripe offers for each plan. A subscription renews by itself, so BLIK and Przelewy24
// (which need the student each time) aren't available for it.
const METHODS = {
  monthly: [{ name: 'Karta, Apple Pay, Google Pay', icon: CreditCard }],
  matura: [
    { name: 'BLIK', icon: Smartphone },
    { name: 'Karta, Apple Pay, Google Pay', icon: CreditCard },
    { name: 'Przelewy24', icon: Landmark },
  ],
}

const planId = ref((planById(String(route.query.plan ?? '')) ?? planById('monthly')).id)
// Keep ?plan= in the address in sync, so a refresh or the back button keeps the choice.
watch(planId, id => router.replace({ query: { ...route.query, plan: id, anulowano: undefined } }))

const plan = computed(() => PAID_PLANS.find(p => p.id === planId.value) ?? PAID_PLANS[0])
const monthly = computed(() => plan.value.id === 'monthly')
const terms = ref(false)
const age = ref(false)
const withdrawal = ref(false)
const allConsents = computed(() => terms.value && age.value && withdrawal.value)
const paying = ref(false)
const cancelled = computed(() => route.query.anulowano === '1')
const payError = ref('')

async function pay() {
  if (!allConsents.value || paying.value) return
  paying.value = true
  payError.value = ''
  const res = await startCheckout(monthly.value ? 'monthly' : 'matura', TERMS_VERSION)
  if (res.ok) {
    window.location.assign(res.url) // Stripe's page; the button stays busy until it opens
    return
  }
  payError.value = res.error
  paying.value = false
}
</script>

<template>
  <PageSkeleton v-if="loading && !billing" />
  <ErrorState v-else-if="loadError" @retry="reload" />
  <div v-else-if="billing">
    <nav class="breadcrumbs" aria-label="Ścieżka"><RouterLink :to="ROUTES.premium"><ArrowLeft :size="14" /> Plany</RouterLink></nav>
    <header class="page-header"><div><span class="page-kicker">Premium</span><h1>Płatność<span class="accent-dot">.</span></h1></div></header>

    <!-- Already Premium: nothing to buy (billing-checkout refuses it too). -->
    <div v-if="billing.premium" class="narrow"><BillingStatus :billing="billing" /></div>

    <div v-else class="checkout">
      <div class="stack" style="--gap: 18px">
        <p v-if="cancelled" class="alert alert-warn" role="status"><CircleAlert :size="18" /> Płatność przerwana, nic nie zostało pobrane. Możesz spróbować jeszcze raz.</p>

        <fieldset class="card step">
          <legend class="step-title">1. Plan</legend>
          <div class="plan-options">
            <label v-for="p in PAID_PLANS" :key="p.id" class="plan-option" :class="{ 'is-selected': planId === p.id }">
              <input v-model="planId" type="radio" name="plan" :value="p.id" class="sr-only" />
              <span class="po-top"><strong>{{ p.name }}</strong><strong class="tabular">{{ p.price }}</strong></span>
              <span class="po-period">{{ p.period }}</span>
              <span v-if="p.badge" class="badge" :class="p.id === 'monthly' ? 'badge-lime' : ''">{{ p.badge }}</span>
            </label>
          </div>
        </fieldset>

        <fieldset class="card step">
          <legend class="step-title">2. Zgody</legend>
          <div class="stack" style="--gap: 14px">
            <label class="check-row">
              <input v-model="terms" type="checkbox" />
              <span>Akceptuję <RouterLink :to="ROUTES.terms" target="_blank" class="link">regulamin</RouterLink>{{ monthly ? ' i rozumiem, że Premium odnawia się co miesiąc, dopóki go nie anuluję.' : ' i rozumiem, że Pakiet działa do 31 maja 2027 i się nie odnawia.' }}</span>
            </label>
            <label class="check-row">
              <input v-model="age" type="checkbox" />
              <span>Mam ukończone 18 lat albo zgodę rodzica lub opiekuna na ten zakup.</span>
            </label>
            <!-- Polish consumer law: digital content that starts right away needs this consent,
                 otherwise the student could use Premium for 14 days and then withdraw. -->
            <label class="check-row">
              <input v-model="withdrawal" type="checkbox" />
              <span>Chcę, żeby Premium zaczęło działać od razu po płatności, i przyjmuję do wiadomości, że wtedy tracę prawo do odstąpienia od umowy w ciągu 14 dni.</span>
            </label>
          </div>
        </fieldset>

        <section class="card step" aria-labelledby="methods-heading">
          <h2 id="methods-heading" class="step-title">3. Płatność</h2>
          <ul class="methods">
            <li v-for="m in METHODS[monthly ? 'monthly' : 'matura']" :key="m.name"><component :is="m.icon" :size="16" /> {{ m.name }}</li>
          </ul>
          <p class="secure-note"><Lock :size="15" /> <span>Metodę wybierzesz na bezpiecznej stronie Stripe, naszego operatora płatności. Nie widzimy ani nie zapisujemy danych Twojej karty.{{ monthly ? ' Subskrypcję odnawianą co miesiąc da się opłacić tylko kartą (BLIK jest przy Pakiecie).' : '' }}</span></p>
        </section>
      </div>

      <!-- Summary: sticky next to the form on desktop, at the end on phones. -->
      <aside class="card summary" aria-labelledby="summary-heading">
        <h2 id="summary-heading" class="step-title">Podsumowanie</h2>
        <dl class="summary-list">
          <div><dt>Plan</dt><dd>{{ plan.name }}</dd></div>
          <div><dt>Okres</dt><dd>{{ monthly ? '1 miesiąc, odnawia się' : 'do 31 maja 2027' }}</dd></div>
          <div><dt>Konto</dt><dd class="email">{{ auth.email }}</dd></div>
        </dl>
        <div class="total"><span>Do zapłaty</span><strong class="tabular">{{ plan.price }}</strong></div>
        <p class="total-note">{{ monthly ? 'co miesiąc' : 'jednorazowo' }}</p>
        <button type="button" class="button button-lime button-large full-width" :disabled="!allConsents || paying" :aria-busy="paying" @click="pay">
          <LoaderCircle v-if="paying" :size="19" class="spin" /><Lock v-else :size="19" />
          {{ paying ? 'Otwieram płatność…' : 'Przejdź do płatności' }}
        </button>
        <p v-if="!allConsents" class="hint">Zaznacz wszystkie zgody, żeby przejść dalej.</p>
        <p v-if="payError" class="alert alert-error" role="alert" aria-live="assertive"><CircleAlert :size="18" /> {{ payError }}</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.breadcrumbs a { display: inline-flex; align-items: center; gap: 6px; }
.narrow { max-width: 560px; }
.checkout { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 22px; align-items: start; }
fieldset.step { margin: 0; min-width: 0; }
.step-title { font-family: var(--heading); font-size: 18px; font-weight: 750; letter-spacing: -.4px; padding: 0; margin-bottom: 14px; }
fieldset .step-title { float: left; width: 100%; }
fieldset .step-title + * { clear: both; }
.plan-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.plan-option { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 16px; border-radius: var(--radius); border: 1px solid var(--line-strong); background: var(--surface); cursor: pointer; transition: border-color .15s, background .15s, box-shadow .15s; }
.plan-option:hover { border-color: #b7c4b2; }
.plan-option.is-selected { border-color: var(--green); background: var(--surface-3); box-shadow: 0 0 0 3px #d7f78188; }
.plan-option:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 3px; }
.po-top { display: flex; justify-content: space-between; gap: 10px; width: 100%; font-family: var(--heading); font-size: 16px; }
.po-period { font-size: 13px; color: var(--text-soft); line-height: 1.45; }
.plan-option .badge { margin-top: 6px; }
.methods { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.methods li { display: inline-flex; align-items: center; gap: 8px; padding: 8px 13px; border-radius: 999px; border: 1px solid var(--line-strong); font-size: 14px; font-weight: 600; }
.secure-note { display: flex; gap: 8px; align-items: flex-start; margin-top: 14px; font-size: 13px; line-height: 1.55; color: var(--text-soft); }
.secure-note svg { margin-top: 2px; }
.summary { position: sticky; top: 94px; box-shadow: var(--shadow); }
.summary-list { margin: 0; display: flex; flex-direction: column; gap: 10px; font-size: 14px; }
.summary-list div { display: flex; justify-content: space-between; gap: 12px; }
.summary-list dt { color: var(--text-soft); }
.summary-list dd { margin: 0; font-weight: 650; text-align: right; min-width: 0; }
.summary-list .email { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.total { display: flex; justify-content: space-between; align-items: baseline; margin-top: 18px; padding-top: 16px; border-top: 1px dashed var(--line-strong); }
.total span { font-family: var(--heading); font-weight: 700; }
.total strong { font-family: var(--heading); font-size: 30px; letter-spacing: -1px; }
.total-note { text-align: right; font-size: 12px; color: var(--text-soft); margin-bottom: 18px; }
.summary .button { gap: 10px; }
.hint { margin-top: 10px; text-align: center; font-size: 12.5px; color: var(--text-soft); }
.summary .alert { margin-top: 12px; }
@media (max-width: 900px) {
  .checkout { grid-template-columns: 1fr; }
  .summary { position: static; }
}
@media (max-width: 520px) { .plan-options { grid-template-columns: 1fr; } }
</style>
