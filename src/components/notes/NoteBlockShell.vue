<script setup>
// Common frame of a note block: a small label ("oś czasu"), an optional heading and the
// "dodane przez AI" badge. `tone` tints the card: '' (white) | 'lime' | 'sand' | 'purple'.
import AiBadge from './AiBadge.vue'

defineProps({
  kind: { type: String, required: true },
  heading: { type: String, default: '' },
  fromNotes: { type: Boolean, default: true },
  tone: { type: String, default: '' },
})
</script>

<template>
  <section class="note-block" :class="tone && `is-${tone}`">
    <p class="block-kind">{{ kind }}<AiBadge v-if="!heading && !fromNotes" /></p>
    <h2 v-if="heading" class="block-heading">{{ heading }}<AiBadge v-if="!fromNotes" /></h2>
    <div class="block-body"><slot /></div>
  </section>
</template>

<style scoped>
.note-block { break-inside: avoid; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 22px; box-shadow: var(--shadow-sm); }
.is-lime { background: #f2fbd9; border-color: #dcef9f; }
.is-sand { background: #f5f0e5; border-color: #ede5d6; }
.is-purple { background: #efebf5; border-color: #e7e1ef; }
.block-kind { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 0; font-size: 11px; font-weight: 750; letter-spacing: 1.4px; text-transform: uppercase; color: var(--accent); }
.block-heading { margin-top: 6px; font-size: clamp(18px, 2.4vw, 21px); line-height: 1.35; letter-spacing: -.5px; font-weight: 750; text-wrap: balance; }
.block-body { margin-top: 14px; font-size: 15.5px; line-height: 1.65; }
@media (max-width: 560px) { .note-block { padding: 18px; } }
@media print { .note-block { box-shadow: none; padding: 14px 16px; print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
