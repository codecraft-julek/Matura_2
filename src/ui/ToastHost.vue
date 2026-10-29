<script setup>
import { CircleAlert, CircleCheck, Info, X } from '@lucide/vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const icons = { ok: CircleCheck, error: CircleAlert, info: Info }
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="`toast-${t.tone}`">
      <component :is="icons[t.tone] ?? Info" :size="18" />
      <span>{{ t.message }}</span>
      <button type="button" aria-label="Zamknij powiadomienie" @click="ui.dismiss(t.id)"><X :size="16" /></button>
    </div>
  </div>
</template>
