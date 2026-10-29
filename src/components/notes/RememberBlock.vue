<script setup>
import { Star } from '@lucide/vue'
import NoteBlockShell from './NoteBlockShell.vue'

defineProps({ block: { type: Object, required: true } })
</script>

<template>
  <NoteBlockShell kind="zapamiętaj na maturę" :from-notes="block.from_notes" tone="lime">
    <ul class="remember-list">
      <li v-for="(item, i) in block.items" :key="i"><Star :size="15" fill="currentColor" aria-hidden="true" />{{ item }}</li>
    </ul>
  </NoteBlockShell>
</template>

<style scoped>
.remember-list { display: flex; flex-direction: column; gap: 9px; margin: 0; padding: 0; list-style: none; }
.remember-list li { display: flex; gap: 10px; align-items: flex-start; font-weight: 550; }
.remember-list svg { margin-top: .3em; color: var(--ok); }
</style>
