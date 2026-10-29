<script setup>
import AiBadge from './AiBadge.vue'
import NoteBlockShell from './NoteBlockShell.vue'

defineProps({ block: { type: Object, required: true } })
</script>

<template>
  <NoteBlockShell kind="pojęcie" class="definition">
    <p class="term"><mark>{{ block.term }}</mark><AiBadge v-if="!block.from_notes" /></p>
    <p class="meaning">{{ block.meaning }}</p>
    <p v-if="block.example" class="example">np. {{ block.example }}</p>
  </NoteBlockShell>
</template>

<style scoped>
.definition { border-left: 6px solid var(--green); }
.term { font-family: var(--heading); font-size: 22px; font-weight: 800; letter-spacing: -.6px; line-height: 1.3; }
.term mark { color: inherit; background: linear-gradient(transparent 58%, var(--lime) 58%); padding: 0 2px; }
.meaning { margin-top: 8px; }
.example { margin-top: 8px; font-size: 14px; font-style: italic; color: var(--text-soft); }
@media print { .term mark { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
