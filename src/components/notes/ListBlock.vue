<script setup>
import NoteBlockShell from './NoteBlockShell.vue'

defineProps({ block: { type: Object, required: true } })
</script>

<template>
  <NoteBlockShell :kind="block.numbered ? 'krok po kroku' : 'w punktach'" :heading="block.heading" :from-notes="block.from_notes">
    <component :is="block.numbered ? 'ol' : 'ul'" class="note-list" :class="{ numbered: block.numbered }">
      <li v-for="(item, i) in block.items" :key="i">{{ item }}</li>
    </component>
  </NoteBlockShell>
</template>

<style scoped>
.note-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; counter-reset: step; }
.note-list li { position: relative; padding-left: 22px; }
.note-list li::before { content: ''; position: absolute; left: 4px; top: .62em; width: 7px; height: 7px; border-radius: 50%; background: #8da574; }
.numbered li { padding-left: 36px; counter-increment: step; }
.numbered li::before { content: counter(step); left: 0; top: .1em; width: 25px; height: 25px; display: grid; place-items: center; border-radius: 8px; background: var(--lime); color: var(--green); font-family: var(--heading); font-size: 13px; font-weight: 800; }
@media print { .numbered li::before { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
