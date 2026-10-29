<script setup>
// Marks a block with from_notes=false: something the AI added on its own, worth double-checking.
import { Sparkles } from '@lucide/vue'
</script>

<template>
  <span class="ai-badge"><Sparkles :size="12" aria-hidden="true" />dodane przez AI · sprawdź</span>
</template>

<style scoped>
.ai-badge { display: inline-flex; align-items: center; gap: 5px; margin-left: 8px; padding: 3px 9px; border-radius: 999px; border: 1px dashed var(--info-line); background: var(--info-bg); color: var(--info); font-family: 'DM Sans Variable', sans-serif; font-size: 11.5px; font-weight: 650; letter-spacing: 0; vertical-align: middle; white-space: nowrap; }
@media print { .ai-badge { border-color: currentColor; } }
</style>
