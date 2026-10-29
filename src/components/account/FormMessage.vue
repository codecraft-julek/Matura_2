<script setup>
// Message under a form (error / success / info). The live region is always in the DOM, so screen
// readers announce the text when it appears.
import { computed } from 'vue'
import { CircleAlert, CircleCheck, Info } from '@lucide/vue'

const props = defineProps({
  message: { type: String, default: '' },
  /** 'error' | 'ok' | 'info' */
  tone: { type: String, default: 'error' },
})
const icon = computed(() => ({ ok: CircleCheck, info: Info })[props.tone] ?? CircleAlert)
</script>

<template>
  <div class="form-message" aria-live="polite" aria-atomic="true">
    <p v-if="message || $slots.default" class="alert" :class="`alert-${tone}`">
      <component :is="icon" :size="18" aria-hidden="true" />
      <span>{{ message }}<slot /></span>
    </p>
  </div>
</template>

<style scoped>
/* Empty region stays in the accessibility tree (so it can announce) but takes no room in the form. */
.form-message:empty { position: absolute; }
</style>
