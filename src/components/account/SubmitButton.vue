<script setup>
// Submit button with a spinner and "Zapisuję…" text while the request runs.
import { LoaderCircle } from '@lucide/vue'

defineProps({
  pending: { type: Boolean, default: false },
  pendingText: { type: String, default: 'Chwilka…' },
  /** 'dark' | 'outline' | 'danger' | 'lime' */
  variant: { type: String, default: 'dark' },
  block: { type: Boolean, default: false },
  small: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  /** id of the <form> when the button sits outside it (dialog actions). */
  form: { type: String, default: undefined },
})
</script>

<template>
  <button type="submit" class="button submit" :class="[`button-${variant}`, { 'button-sm': small, 'is-block': block }]" :form="form" :disabled="pending || disabled" :aria-busy="pending ? 'true' : undefined">
    <template v-if="pending"><LoaderCircle class="spin" :size="17" aria-hidden="true" />{{ pendingText }}</template>
    <slot v-else />
  </button>
</template>

<style scoped>
.submit { gap: 10px; font-size: 14px; }
.submit.button-sm { font-size: 13px; }
.submit:disabled { opacity: .75; }
.is-block { width: 100%; }
</style>
