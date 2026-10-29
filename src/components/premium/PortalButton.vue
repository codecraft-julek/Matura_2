<script setup>
// Opens Stripe's customer portal: cancel the subscription, change the card, download receipts.
import { ref } from 'vue'
import { ExternalLink, LoaderCircle } from '@lucide/vue'
import { openBillingPortal } from '@/lib/ai'

defineProps({ label: { type: String, default: 'Zarządzaj płatnościami' } })
const busy = ref(false)
const error = ref('')

async function open() {
  busy.value = true
  error.value = ''
  const res = await openBillingPortal()
  if (res.ok) {
    window.location.assign(res.url) // Stripe's page; the button stays busy until it opens
    return
  }
  error.value = res.error
  busy.value = false
}
</script>

<template>
  <div class="portal-button">
    <button type="button" class="button button-outline button-sm" :disabled="busy" :aria-busy="busy" @click="open">
      <LoaderCircle v-if="busy" :size="16" class="spin" /><ExternalLink v-else :size="16" />
      {{ busy ? 'Otwieram…' : label }}
    </button>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.portal-button { display: flex; flex-direction: column; gap: 8px; }
</style>
