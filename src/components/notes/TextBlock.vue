<script setup>
import { computed } from 'vue'
import NoteBlockShell from './NoteBlockShell.vue'

const props = defineProps({ block: { type: Object, required: true } })
// The AI starts a correction of a mistake in the student's notes with „Uwaga:”.
const warning = computed(() => props.block.body.startsWith('Uwaga'))
</script>

<template>
  <NoteBlockShell :kind="warning ? 'uwaga' : 'krótko'" :heading="block.heading" :from-notes="block.from_notes" :tone="warning ? 'sand' : ''">
    <p>{{ block.body }}</p>
  </NoteBlockShell>
</template>
