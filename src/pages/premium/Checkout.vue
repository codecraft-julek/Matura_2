<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, CreditCard, LoaderCircle, Lock, Mail, Sparkles } from '@lucide/vue'
import { PAID_PLANS, planById } from '@/config/plans'
import { ROUTES } from '@/config/routes'
import { TERMS_VERSION } from '@/config/site'
import { EARLY_START_LABEL } from '@shared/purchase-consents'
import { PLAN_DETAILS } from '@/components/premium/planDetails'
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
const plan = computed(() => planById(String(route.query.plan ?? '')) ?? PAID_PLANS[0])
const monthly = computed(() => plan.value.id === 'monthly')
const terms = ref(false)
const age = ref(false)
const earlyStart = ref(false)
const submitted = ref(false)
const paying = ref(false)
const payError = ref('')
const form = ref(null)
const cancelled = computed(() => route.query.anulowano === '1')
const missingConsent = computed(() => !terms.value || !age.value || !earlyStart.value)

function selectPlan(id) {
  if (!paying.value && id !== plan.value.id) router.replace({ query: { ...route.query, plan: id, anulowano: undefined } })
}

// A different billing agreement requires accepting its new terms, including browser navigation.
watch(() => plan.value.id, () => { terms.value = false; submitted.value = false; payError.value = '' })

async function pay() {
  if (paying.value) return
  submitted.value = true
  payError.value = ''
  if (missingConsent.value) {
    await nextTick()
    form.value?.querySelector('input[aria-invalid="true"]')?.focus()
    return
  }
  paying.value = true
  try {
    const res = await startCheckout(plan.value.id, TERMS_VERSION, { terms: terms.value, age: age.value, earlyStart: earlyStart.value })
    if (!res.ok) throw new Error(res.error)
    window.location.assign(res.url)
    // Stay busy until navigation, preventing duplicate checkout sessions.
  } catch (error) {
    payError.value = error?.message || 'Nie udało się otworzyć płatności. Spróbuj ponownie.'
    paying.value = false
  }
}
</script>

<template>
  <PageSkeleton v-if="loading && !billing" />
  <ErrorState v-else-if="loadError" @retry="reload" />
  <div v-else-if="billing">
    <RouterLink :to="ROUTES.premium" class="back-link"><ArrowLeft :size="15" /> Wszystkie plany</RouterLink>
    <header class="checkout-intro">
      <span class="page-kicker">TWÓJ PLAN NA MATURĘ</span>
      <h1>Włącz Premium<span class="accent-dot">.</span></h1>
      <p>Wybierz dostęp dla siebie. Płatność potwierdzisz na stronie Stripe.</p>
    </header>

    <BillingStatus v-if="billing.premium" :billing="billing" />
    <form v-else ref="form" class="checkout" novalidate @submit.prevent="pay">
      <div class="order-details">
        <div v-if="cancelled" class="alert alert-warn return-notice" role="status">
          <CircleAlert :size="20" />
          <p>Wróciłeś z płatności. Możesz dokończyć zakup poniżej. Jeśli potwierdziłeś już płatność w banku, <RouterLink :to="ROUTES.premiumDone" class="link">sprawdź status dostępu</RouterLink> przed kolejną próbą.</p>
        </div>
        <fieldset class="plan-fieldset" :disabled="paying">
          <legend>Jak chcesz korzystać?</legend>
          <p class="section-note">Te same możliwości Premium. Dwa sposoby płatności.</p>
          <div class="plan-options">
            <label v-for="p in PAID_PLANS" :key="p.id" class="plan-option" :class="{ 'is-selected': plan.id === p.id }">
              <input type="radio" name="plan" :value="p.id" :checked="plan.id === p.id" @change="selectPlan(p.id)" />
              <span class="plan-label">{{ p.id === 'monthly' ? 'Co miesiąc' : 'Do matury' }}</span>
              <span class="plan-price tabular">{{ p.price }}<small>{{ p.id === 'monthly' ? ' / miesiąc' : ' jednorazowo' }}</small></span>
              <span class="plan-description">{{ p.id === 'monthly' ? 'Odnawia się co miesiąc.' : 'Dostęp do 31 maja 2027.' }}</span>
              <span class="plan-note">{{ p.id === 'monthly' ? 'Anulujesz, kiedy chcesz.' : 'Bez automatycznego odnawiania.' }}</span>
            </label>
          </div>
        </fieldset>

        <details class="benefits">
          <summary><span class="benefit-icon" aria-hidden="true"><Sparkles :size="21" /></span><span>Co dostajesz z Premium?</span><ChevronDown :size="18" class="benefit-chevron" aria-hidden="true" /></summary>
          <div class="benefits-content">
            <ul>
              <li v-for="feature in PLAN_DETAILS.monthly.features" :key="feature"><Check :size="16" aria-hidden="true" /> {{ feature }}</li>
            </ul>
            <p>Dostęp włączy się po potwierdzeniu płatności.</p>
          </div>
        </details>

        <div class="account-note">
          <Mail :size="19" aria-hidden="true" />
          <div><span>Premium przypiszemy do konta</span><strong>{{ auth.email }}</strong></div>
        </div>
      </div>

      <section class="order-summary card" aria-labelledby="summary-heading">
        <div class="summary-top"><h2 id="summary-heading">Twoje zamówienie</h2><Lock :size="16" aria-hidden="true" /></div>
        <div class="price-summary" aria-live="polite" aria-atomic="true">
          <p class="summary-plan">{{ plan.name }}</p>
          <div class="total"><span>Do zapłaty dziś</span><strong class="tabular">{{ plan.price }}</strong></div>
          <p class="renewal-note">{{ monthly ? `${plan.price} co miesiąc. Automatyczne odnawianie wyłączysz w ustawieniach konta.` : 'Jedna płatność za dostęp do 31 maja 2027. Pakiet nie odnawia się automatycznie.' }}</p>
        </div>

        <fieldset class="consents" :disabled="paying" :aria-describedby="submitted && missingConsent ? 'consent-error' : undefined">
          <legend>Potwierdź przed przejściem dalej <span>(wymagane)</span></legend>
          <label class="check-row" :class="{ 'has-error': submitted && !terms }">
            <input v-model="terms" name="terms" type="checkbox" required :aria-invalid="submitted && !terms" :aria-describedby="submitted && !terms ? 'consent-error' : undefined" />
            <span>Akceptuję <RouterLink :to="ROUTES.terms" target="_blank" rel="noopener" class="link">regulamin</RouterLink>{{ monthly ? ' i rozumiem, że Premium odnawia się co miesiąc, dopóki go nie anuluję.' : ' i rozumiem, że Pakiet działa do 31 maja 2027 i się nie odnawia.' }}</span>
          </label>
          <label class="check-row" :class="{ 'has-error': submitted && !age }">
            <input v-model="age" name="age" type="checkbox" required :aria-invalid="submitted && !age" :aria-describedby="submitted && !age ? 'consent-error' : undefined" />
            <span>Mam ukończone 18 lat albo zgodę rodzica lub opiekuna na ten zakup.</span>
          </label>
          <label class="check-row" :class="{ 'has-error': submitted && !earlyStart }">
            <input v-model="earlyStart" name="earlyStart" type="checkbox" required :aria-invalid="submitted && !earlyStart" :aria-describedby="submitted && !earlyStart ? 'consent-error' : undefined" />
            <span>{{ EARLY_START_LABEL }}</span>
          </label>
        </fieldset>
        <p class="withdrawal-note">Masz 14 dni na odstąpienie. <RouterLink :to="`${ROUTES.terms}#odstapienie`" target="_blank" rel="noopener" class="link">Zasady i formularz</RouterLink>.</p>
        <p v-if="submitted && missingConsent" id="consent-error" class="field-error" role="alert">Zaznacz wymagane zgody. Brakujące pola są oznaczone.</p>
        <p v-if="payError" class="alert alert-error" role="alert"><CircleAlert :size="18" /> {{ payError }}</p>

        <button type="submit" class="button button-lime button-large full-width pay-button" :disabled="paying" :aria-busy="paying" aria-describedby="payment-handoff">
          <LoaderCircle v-if="paying" :size="18" class="spin" />
          <span>{{ paying ? 'Otwieram płatność…' : `Przejdź do płatności · ${plan.price}` }}</span>
          <ArrowRight v-if="!paying" :size="18" />
        </button>
        <p id="payment-handoff" class="handoff-note">Na stronie Stripe wybierzesz metodę i zatwierdzisz płatność.</p>
        <div class="payment-info">
          <p><CreditCard :size="16" aria-hidden="true" /> {{ monthly ? 'Karta · Apple Pay · Google Pay' : 'BLIK · Karta · Przelewy24' }}</p>
          <span>{{ monthly ? 'Dostępność metod zależy od urządzenia i ustawień operatora.' : 'Dostępne metody i portfele zobaczysz w Stripe.' }}</span>
        </div>
      </section>
    </form>
  </div>
</template>

<style scoped>
.back-link { display: inline-flex; align-items: center; gap: 7px; color: var(--text-soft); font-size: 13px; min-height: 32px; }
.back-link:hover { color: var(--green); }
.checkout-intro { margin: 18px 0 30px; }
.checkout-intro h1 { font: 750 clamp(30px, 4vw, 42px)/1.15 var(--heading); letter-spacing: -1.5px; margin: 6px 0 12px; }
.checkout-intro > p { color: var(--text-soft); line-height: 1.6; font-size: 15px; }
.checkout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(330px, 400px); gap: 36px; align-items: start; }
.order-details { min-width: 0; }
.return-notice { margin-bottom: 20px; align-items: flex-start; }
fieldset { padding: 0; border: 0; margin: 0; min-width: 0; }
.plan-fieldset legend { font: 750 19px/1.4 var(--heading); letter-spacing: -.5px; }
.section-note { color: var(--text-soft); font-size: 13px; line-height: 1.5; margin: 5px 0 18px; }
.plan-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.plan-option { position: relative; display: flex; flex-direction: column; padding: 20px 16px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--surface); cursor: pointer; transition: background .15s, border-color .15s; }
.plan-option:hover { border-color: var(--accent); }
.plan-option.is-selected { border: 2px solid var(--green); padding: 19px 15px; background: var(--surface-3); }
.plan-option input { position: absolute; top: 20px; right: 14px; width: 18px; height: 18px; accent-color: var(--green); }
.plan-option:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 4px; }
.plan-option:has(input:disabled) { cursor: wait; }
.plan-label { font-size: 14px; font-weight: 700; padding-right: 24px; }
.plan-price { font: 750 27px/1.2 var(--heading); letter-spacing: -1px; margin-block: 18px 14px; }
.plan-price small { display: block; font: 400 12px/1.5 'DM Sans Variable', sans-serif; color: var(--text-soft); letter-spacing: 0; margin-top: 3px; }
.plan-description, .plan-note { font-size: 12px; line-height: 1.65; }
.plan-note { color: var(--text-soft); }
.benefits { margin: 26px 0; padding: 18px 0; border-block: 1px solid var(--line); }
.benefits summary { display: flex; align-items: center; gap: 12px; list-style: none; cursor: pointer; font: 700 14px/1.4 var(--heading); }
.benefits summary::-webkit-details-marker { display: none; }
.benefit-chevron { margin-left: auto; }
.benefits[open] .benefit-chevron { transform: rotate(180deg); }
.benefits-content { padding: 4px 0 0 54px; }
.benefit-icon { display: grid; place-items: center; flex-shrink: 0; width: 42px; height: 42px; border-radius: var(--radius); background: var(--lime); color: var(--green); }
.benefits ul { list-style: none; margin: 14px 0; padding: 0; display: grid; gap: 11px; }
.benefits li { display: flex; gap: 8px; align-items: center; font-size: 13px; }
.benefits li svg { flex-shrink: 0; color: var(--ok); }
.benefits p { font-size: 12px; line-height: 1.6; color: var(--text-soft); }
.account-note { display: flex; align-items: center; gap: 12px; color: var(--text-soft); }
.account-note div { min-width: 0; }
.account-note span { display: block; font-size: 12px; }
.account-note strong { display: block; margin-top: 3px; color: var(--text); font-size: 14px; overflow-wrap: anywhere; }
.order-summary { padding: 24px; box-shadow: var(--shadow); }
.summary-top { display: flex; justify-content: space-between; align-items: center; }
.summary-top h2 { font: 750 17px/1.4 var(--heading); letter-spacing: -.4px; }
.summary-top > svg { color: var(--text-soft); }
.price-summary { margin: 20px 0; padding-bottom: 20px; border-bottom: 1px solid var(--line); }
.summary-plan { font-size: 13px; color: var(--text-soft); }
.total { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 7px 0; }
.total > span { font-size: 14px; font-weight: 650; }
.total strong { font: 750 32px/1.3 var(--heading); letter-spacing: -1px; white-space: nowrap; }
.renewal-note { font-size: 12px; line-height: 1.6; color: var(--text-soft); }
.consents legend { font-size: 12px; font-weight: 700; margin-bottom: 12px; }
.consents legend > span { font-weight: 400; color: var(--text-soft); }
.withdrawal-note { font-size: 12px; line-height: 1.6; margin-top: 12px; color: var(--text-soft); }
.check-row { font-size: 12px; line-height: 1.6; gap: 10px; padding-block: 7px; cursor: pointer; }
.check-row input { flex-shrink: 0; width: 18px; height: 18px; margin-top: 2px; accent-color: var(--green); }
.check-row.has-error { color: var(--error); }
.check-row.has-error input { outline: 1px solid var(--error); outline-offset: 2px; }
.order-summary > .alert { margin-top: 12px; }
.pay-button { margin-top: 20px; padding-inline: 12px; gap: 8px; font-size: 13px; min-height: 54px; }
.handoff-note { margin-top: 10px; font-size: 11px; line-height: 1.6; color: var(--text-soft); text-align: center; }
.payment-info { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 16px; text-align: center; }
.payment-info p { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; font-weight: 650; }
.payment-info > span { display: block; margin-top: 6px; font-size: 10px; line-height: 1.6; color: var(--text-soft); }
@media (max-width: 800px) {
  .checkout { grid-template-columns: 1fr; gap: 26px; max-width: 560px; margin-inline: auto; }
  .checkout-intro, .back-link { max-width: 560px; margin-inline: auto; }
  .benefits { margin-block: 22px; padding-block: 20px; }
  .order-summary { padding: 22px; }
  .check-row { font-size: 13px; padding-block: 9px; }
  .payment-info > span, .handoff-note { font-size: 12px; }
}
@media (max-width: 380px) {
  .plan-options { gap: 8px; }
  .plan-option { padding-inline: 12px; }
  .plan-option.is-selected { padding-inline: 11px; }
  .plan-price { font-size: 24px; }
  .plan-label { font-size: 12px; }
  .order-summary { padding: 18px; }
}
</style>
