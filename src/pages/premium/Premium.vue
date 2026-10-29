<script setup>
// Pricing inside the app. Paid plans open /premium/platnosc (Stripe). Students who already have
// Premium see their plan on top and no "buy" buttons.
import { ref } from 'vue'
import { Plus } from '@lucide/vue'
import { FEATURES } from '@/config/plans'
import { useAsync } from '@/composables/useAsync'
import { useBillingStore } from '@/stores/billing'
import PageSkeleton from '@/ui/PageSkeleton.vue'
import ErrorState from '@/ui/ErrorState.vue'
import PlanCards from '@/components/premium/PlanCards.vue'
import BillingStatus from '@/components/premium/BillingStatus.vue'

const billingStore = useBillingStore()
const { data: billing, loading, error, reload } = useAsync(() => billingStore.loadBilling())

const FAQ = [
  ['Jak mogę zapłacić?', 'Pakiet do matury: BLIK-iem, kartą albo Przelewy24. Premium co miesiąc: kartą (także Apple Pay i Google Pay), bo odnawia się samo. Płatności obsługuje Stripe, my nie widzimy danych Twojej karty.'],
  ['Czy mogę zrezygnować?', 'Tak. Premium miesięczne anulujesz w ustawieniach konta („Zarządzaj subskrypcją”) i działa do końca opłaconego miesiąca. Pakiet do matury to jedna opłata, bez odnawiania.'],
  ['Mam mniej niż 18 lat. Mogę kupić?', 'Poproś rodzica albo opiekuna o zgodę albo o to, żeby zapłacił za Ciebie.'],
  ['Co zostaje za darmo?', 'Arkusze CKE z ćwiczeniami i egzaminem na czas oraz nauka fiszek zostają bez limitu. Premium daje więcej narzędzi AI.'],
]
const openFaq = ref(null)
</script>

<template>
  <PageSkeleton v-if="loading && !billing" />
  <ErrorState v-else-if="error" @retry="reload" />
  <div v-else-if="billing" class="premium-page">
    <div v-if="billing.premium" class="status-wrap"><BillingStatus :billing="billing" /></div>

    <header class="premium-hero">
      <span class="page-kicker">Więcej AI, mniej stresu</span>
      <h1>Ogarnij maturę z Premium<span class="accent-dot">.</span></h1>
      <p>Arkusze i fiszki zostają darmowe. Premium daje więcej sprawdzeń wypracowań, notatek i rozmów z tutorem, kiedy zaczyna się prawdziwa nauka.</p>
    </header>

    <PlanCards variant="app" :premium="billing.premium" heading-tag="h2" />

    <section class="section-gap" aria-labelledby="features-heading">
      <h2 id="features-heading" class="section-title centered">Co dokładnie dostajesz</h2>
      <div class="table-wrap">
        <table class="feature-table">
          <thead><tr><th scope="col">Funkcja</th><th scope="col">Darmowy</th><th scope="col">Premium i Pakiet</th></tr></thead>
          <tbody>
            <tr v-for="[label, free, paid] in FEATURES" :key="label">
              <th scope="row">{{ label }}</th>
              <td>{{ free }}</td>
              <td class="paid">{{ paid }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="section-gap faq-wrap" aria-labelledby="pay-faq-heading">
      <h2 id="pay-faq-heading" class="section-title centered">Pytania o płatności</h2>
      <div class="faq-list">
        <article v-for="([q, a], i) in FAQ" :key="q" class="faq-item" :class="{ open: openFaq === i }">
          <h3><button type="button" :aria-expanded="openFaq === i" :aria-controls="`pay-faq-${i}`" @click="openFaq = openFaq === i ? null : i"><span>{{ q }}</span><Plus :size="21" /></button></h3>
          <div v-show="openFaq === i" :id="`pay-faq-${i}`" class="faq-answer"><p>{{ a }}</p></div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.status-wrap { max-width: 560px; margin: 0 auto 32px; }
.premium-hero { text-align: center; margin-bottom: 44px; }
.premium-hero h1 { font-size: clamp(32px, 5vw, 48px); letter-spacing: -1.8px; line-height: 1.12; font-weight: 750; }
.premium-hero p { margin: 14px auto 0; max-width: 58ch; color: var(--text-soft); font-size: 16px; line-height: 1.65; }
.centered { text-align: center; }
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); }
.feature-table { width: 100%; min-width: 520px; border-collapse: collapse; font-size: 14px; }
.feature-table th, .feature-table td { padding: 13px 16px; text-align: left; vertical-align: top; line-height: 1.5; }
.feature-table thead th { background: var(--green); color: white; font-family: var(--heading); font-weight: 700; font-size: 14px; }
.feature-table tbody tr { border-top: 1px solid var(--line); }
.feature-table tbody tr:nth-child(odd) { background: #fbfcf9; }
.feature-table tbody th { font-weight: 650; }
.feature-table td { color: var(--text-soft); }
.feature-table td.paid { color: var(--text); font-weight: 650; }
.faq-wrap { max-width: 720px; margin-inline: auto; }
.faq-item h3 > button { font-size: 15px; }
.faq-answer { font-size: 14px; }
</style>
