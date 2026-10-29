<script setup>
import NoteBlockShell from './NoteBlockShell.vue'

defineProps({ block: { type: Object, required: true } })
</script>

<template>
  <NoteBlockShell kind="oś czasu" :heading="block.heading" :from-notes="block.from_notes">
    <ol class="timeline">
      <li v-for="(e, i) in block.events" :key="i">
        <span class="dot" aria-hidden="true"></span>
        <p class="date">{{ e.date }}</p>
        <p class="label">{{ e.label }}</p>
      </li>
    </ol>
  </NoteBlockShell>
</template>

<style scoped>
.timeline { position: relative; margin: 0 0 0 7px; padding: 0; list-style: none; border-left: 2px solid var(--line-strong); }
.timeline li { position: relative; padding: 0 0 18px 24px; }
.timeline li:last-child { padding-bottom: 0; }
.dot { position: absolute; left: -8px; top: 5px; width: 14px; height: 14px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 4px var(--lime); }
.date { font-family: var(--heading); font-size: 17px; font-weight: 800; letter-spacing: -.3px; color: var(--accent); line-height: 1.3; }
.label { margin-top: 2px; line-height: 1.5; }
@media print { .dot { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
