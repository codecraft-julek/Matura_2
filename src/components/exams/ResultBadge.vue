<script setup>
// What the database said about one answer (practice "Sprawdź to zadanie"). Port of the old ResultBadge.
import { computed } from 'vue'
import { Check, CircleHelp, Minus, X } from '@lucide/vue'

const props = defineProps({ result: { type: Object, required: true } })
const s = computed(() => props.result.status)
</script>

<template>
  <span v-if="s === 'self_partial' || s === 'partial'" class="result-badge is-warn">
    <Minus :size="14" aria-hidden="true" /> {{ result.points }}/{{ result.max }} pkt
    <span v-if="s === 'partial'" class="result-key">· poprawnie: {{ result.answer }}</span>
  </span>
  <span v-else-if="s === 'correct' || s === 'self_correct'" class="result-badge is-ok"><Check :size="14" aria-hidden="true" /> dobrze</span>
  <span v-else-if="s === 'unchecked'" class="result-block is-warn">
    <CircleHelp :size="16" aria-hidden="true" />
    <span><strong>Do porównania.</strong> Klucz: <em>{{ result.answer }}</em><template v-if="result.note"> ({{ result.note }})</template></span>
  </span>
  <span v-else class="result-badge is-error">
    <X :size="14" aria-hidden="true" /> {{ s === 'empty' ? 'brak' : 'źle' }} <span class="result-key">· poprawnie: {{ result.answer }}</span>
  </span>
</template>

<style scoped>
.result-badge { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 5px; padding: 5px 11px; border-radius: 999px; border: 1px solid; font-size: 13px; font-weight: 700; line-height: 1.4; }
.result-key { font-weight: 450; }
.result-block { display: flex; align-items: flex-start; gap: 8px; flex-basis: 100%; width: 100%; padding: 10px 13px; border-radius: var(--radius-sm); border: 1px solid; font-size: 14px; line-height: 1.55; }
.result-block svg { margin-top: 2px; }
.is-ok { background: var(--ok-bg); border-color: var(--ok-line); color: var(--ok); }
.is-warn { background: var(--warn-bg); border-color: var(--warn-line); color: var(--warn); }
.is-error { background: var(--error-bg); border-color: var(--error-line); color: var(--error); }
</style>
