<script setup>
import { ArrowDown, ArrowRight } from '@lucide/vue'
import NoteBlockShell from './NoteBlockShell.vue'

defineProps({ block: { type: Object, required: true } })
</script>

<template>
  <NoteBlockShell kind="przyczyny i skutki" :heading="block.heading" :from-notes="block.from_notes">
    <div class="ce-grid">
      <div v-if="block.causes.length" class="ce-col">
        <p class="ce-title">Przyczyny</p>
        <ul><li v-for="(it, i) in block.causes" :key="i" class="ce-item is-cause">{{ it }}</li></ul>
      </div>
      <span v-else></span>
      <span v-if="block.causes.length" class="ce-arrow" aria-hidden="true"><ArrowDown class="down" :size="22" /><ArrowRight class="right" :size="22" /></span>
      <span v-else></span>
      <p class="ce-event">{{ block.event }}</p>
      <span v-if="block.effects.length" class="ce-arrow" aria-hidden="true"><ArrowDown class="down" :size="22" /><ArrowRight class="right" :size="22" /></span>
      <span v-else></span>
      <div v-if="block.effects.length" class="ce-col">
        <p class="ce-title">Skutki</p>
        <ul><li v-for="(it, i) in block.effects" :key="i" class="ce-item is-effect">{{ it }}</li></ul>
      </div>
      <span v-else></span>
    </div>
  </NoteBlockShell>
</template>

<style scoped>
.ce-grid { display: grid; gap: 12px; }
.ce-title { margin-bottom: 7px; font-size: 11px; font-weight: 750; letter-spacing: 1.2px; text-transform: uppercase; color: var(--text-soft); }
.ce-col ul { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.ce-item { padding: 9px 12px; border-radius: 10px; border: 1px solid; font-size: 14px; line-height: 1.45; }
.is-cause { background: var(--surface-2); border-color: var(--line-strong); }
.is-effect { background: #f2fbd9; border-color: #dcef9f; }
.ce-event { padding: 14px; border-radius: 12px; background: var(--green); color: white; text-align: center; font-family: var(--heading); font-weight: 800; line-height: 1.35; text-wrap: balance; }
.ce-arrow { display: grid; place-items: center; color: var(--accent); }
.ce-arrow .right { display: none; }
@media (min-width: 768px) {
  .ce-grid { grid-template-columns: 1fr auto minmax(0, .9fr) auto 1fr; align-items: center; }
  .ce-arrow .down { display: none; }
  .ce-arrow .right { display: block; }
}
@media print {
  .ce-grid { grid-template-columns: 1fr auto minmax(0, .9fr) auto 1fr; align-items: center; }
  .ce-arrow .down { display: none; } .ce-arrow .right { display: block; }
  .ce-item, .ce-event { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
</style>
