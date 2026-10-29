<script setup>
// "Twój plan" box: what the student has, until when, and where to manage it.
// `billing` = useBillingStore().loadBilling() result (toMyBilling shape). Used on /premium and in the
// checkout and on the account page.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { CircleAlert, Crown, Sparkles } from '@lucide/vue'
import { planById } from '@/config/plans'
import { ROUTES } from '@/config/routes'
import { formatDate } from '@/lib/format'
import PortalButton from './PortalButton.vue'

const props = defineProps({
  billing: { type: Object, required: true },
  /** Heading level ('h2' on its own, 'h3' inside another section). */
  headingTag: { type: String, default: 'h2' },
})
const until = computed(() => (props.billing.until ? formatDate(props.billing.until) : ''))
const monthlyPrice = planById('monthly')?.price
</script>

<template>
  <section class="card billing-status" :class="{ 'is-premium': billing.premium }">
    <div class="bs-head">
      <span class="bs-icon"><Crown v-if="billing.premium" :size="20" /><Sparkles v-else :size="20" /></span>
      <component :is="headingTag" class="card-title">Twój plan</component>
      <span class="badge" :class="billing.premium ? 'badge-lime' : ''">{{ billing.kind === 'pass' ? 'Pakiet do matury' : billing.kind === 'subscription' ? 'Premium' : 'Darmowy' }}</span>
    </div>
    <p v-if="billing.kind === 'pass'" class="bs-text"><strong>Pakiet do matury</strong>: Premium działa do {{ until }}. Bez odnawiania, nic więcej nie zapłacisz.</p>
    <p v-else-if="billing.kind === 'subscription'" class="bs-text">
      <strong>Premium</strong>: {{ billing.cancelAtPeriodEnd ? `anulowane, działa jeszcze do ${until}.` : `odnawia się ${until} (${monthlyPrice}).` }}
    </p>
    <p v-else class="bs-text"><strong>Darmowy</strong>: arkusze i fiszki bez limitu, narzędzia AI z darmowym limitem.</p>

    <p v-if="billing.paymentProblem" class="alert alert-error" role="alert"><CircleAlert :size="18" /> Ostatnia płatność się nie udała. Zaktualizuj kartę, żeby nie stracić Premium.</p>

    <div v-if="!billing.premium || billing.hasCustomer" class="row bs-actions">
      <RouterLink v-if="!billing.premium" :to="ROUTES.premium" class="button button-dark button-sm">Zobacz Premium</RouterLink>
      <PortalButton v-if="billing.hasCustomer" :label="billing.kind === 'subscription' && !billing.cancelAtPeriodEnd ? 'Zarządzaj subskrypcją' : 'Płatności i paragony'" />
    </div>
  </section>
</template>

<style scoped>
.billing-status { display: flex; flex-direction: column; gap: 12px; }
.billing-status.is-premium { background: #f6fbe9; border-color: #dcef9f; }
.bs-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.bs-head .badge { margin-left: auto; }
.bs-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 11px; background: var(--surface-3); color: var(--accent); }
.is-premium .bs-icon { background: var(--green); color: var(--lime); }
.bs-text { font-size: 15px; line-height: 1.6; color: var(--text-soft); }
.bs-text strong { color: var(--text); }
.bs-actions { align-items: flex-start; }
</style>
