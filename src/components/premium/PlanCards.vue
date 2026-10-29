<script setup>
// The three plans (Darmowy / Premium / Pakiet do matury), shared by the homepage and /premium.
//   variant "landing": free plan → signup, paid plans → checkout (logged-out visitors log in first
//                      and come back thanks to ?next=).
//   variant "app":     free plan is "Twój obecny plan"; a student who already has Premium sees no
//                      buy buttons.
// Prices and names come from src/config/plans.ts (the charged amounts are checked against them).
import { RouterLink } from 'vue-router'
import { ArrowUpRight, Check, Zap } from '@lucide/vue'
import { PLANS } from '@/config/plans'
import { ROUTES, checkoutRoute } from '@/config/routes'
import { PLAN_DETAILS as DETAILS } from './planDetails'

defineProps({
  variant: { type: String, default: 'landing' },
  premium: { type: Boolean, default: false },
  /** Heading level of the plan names (h3 on the landing under an h2, h2 on /premium). */
  headingTag: { type: String, default: 'h3' },
})

const amount = price => price.replace(/\s*zł$/, '')
</script>

<template>
  <div class="pricing-grid plan-cards" :class="`is-${variant}`">
    <article v-for="plan in PLANS" :key="plan.id" class="pricing-card" :class="{ featured: plan.id === 'monthly' }">
      <div v-if="plan.badge" class="recommended-label" :class="{ 'is-soft': plan.id !== 'monthly' }"><Zap v-if="plan.id === 'monthly'" :size="13" fill="currentColor" /> {{ plan.badge.toUpperCase() }}</div>
      <span class="plan-label">{{ DETAILS[plan.id].label }}</span>
      <component :is="headingTag" class="plan-name">{{ plan.name }}</component>
      <p class="plan-description">{{ plan.note ?? DETAILS[plan.id].description }}</p>
      <div class="plan-price">{{ amount(plan.price) }}<span>zł</span><small>{{ plan.period }}</small></div>
      <div class="pricing-divider"></div>
      <ul class="plan-features"><li v-for="f in DETAILS[plan.id].features" :key="f"><Check :size="16" />{{ f }}</li></ul>

      <span v-if="variant === 'app' && (plan.id === 'free' || premium)" class="button full-width plan-current">
        {{ plan.id === 'free' ? (premium ? 'Plan podstawowy' : plan.cta) : 'Masz już Premium' }}
      </span>
      <RouterLink v-else-if="plan.id === 'free'" :to="ROUTES.signup" class="button button-outline full-width">Załóż darmowe konto <ArrowUpRight :size="18" /></RouterLink>
      <RouterLink v-else :to="checkoutRoute(plan.id)" class="button full-width" :class="plan.id === 'monthly' ? 'button-lime' : 'button-dark'">{{ plan.cta }} <ArrowUpRight :size="18" /></RouterLink>
      <p class="plan-note">{{ DETAILS[plan.id].footnote }}</p>
    </article>
  </div>
</template>

<style scoped>
.plan-name { font-size: 21px; font-weight: 700; letter-spacing: -.5px; margin-top: 11px; }
.plan-description { font-size: 13px; min-height: 42px; }
.recommended-label.is-soft { background: #eef3e5; color: var(--accent); }
.is-app .recommended-label { border-color: var(--paper); }
.is-app { margin-top: 0; }
.plan-current { border-color: var(--line-strong); color: var(--text-soft); cursor: default; }
.plan-current:hover { transform: none; }
.featured .plan-current { border-color: #416047; color: #c4d2bd; }
/* Phones: Premium first (the free plan is what they already have). */
@media (max-width: 680px) {
  .pricing-card.featured { order: -1; }
  .plan-description { min-height: 0; }
}
@media (max-width: 850px) and (min-width: 681px) { .plan-name { font-size: 17px; } }
</style>
