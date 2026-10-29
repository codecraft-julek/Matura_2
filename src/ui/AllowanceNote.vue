<script setup>
// "W tym tygodniu zostało: 2" next to an AI button, or the "limit used up" note.
// Free students also see a small link to Premium. `allowance` = billing store's allowanceFor(feature).
import { RouterLink } from 'vue-router'
import { ROUTES } from '@/config/routes'
import { leftLabel, limitReachedText } from '@/lib/billing/allowance'

defineProps({ allowance: { type: Object, default: null } })
</script>

<template>
  <span v-if="allowance" class="allowance-note">
    <template v-if="allowance.left > 0">{{ leftLabel(allowance) }} <strong>{{ allowance.left }}</strong></template>
    <template v-else>{{ limitReachedText(allowance) }}</template>
    <template v-if="allowance.plan === 'free'">{{ ' ' }}<RouterLink :to="ROUTES.premium" class="link nowrap">Więcej z Premium</RouterLink></template>
  </span>
</template>

<style scoped>
.allowance-note { font-size: 14px; color: var(--text-soft); }
strong { color: var(--text); }
</style>
