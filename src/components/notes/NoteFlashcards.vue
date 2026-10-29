<script setup>
// Flashcards from the note: tap to flip, arrows to move (also ← → keys while the card has focus).
// In print: a plain two-column list.
import { computed, nextTick, ref } from 'vue'
import { ArrowLeft, ArrowRight } from '@lucide/vue'
import FlipCard from '@/components/flashcards/FlipCard.vue'

const props = defineProps({ cards: { type: Array, required: true } })
const index = ref(0)
const flipped = ref(false)
const card = computed(() => props.cards[index.value])
const flipCard = ref(null)

function go(d) {
  flipped.value = false
  index.value = (index.value + d + props.cards.length) % props.cards.length
}
// The card is re-created for every index (so it never flips back showing the next answer);
// keep the keyboard focus on it.
function onKey(e) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  go(e.key === 'ArrowLeft' ? -1 : 1)
  nextTick(() => flipCard.value?.focus())
}
</script>

<template>
  <section v-if="cards.length" class="note-cards" aria-labelledby="note-cards-title">
    <div class="row-between">
      <h2 id="note-cards-title" class="section-title" style="margin: 0">Fiszki</h2>
      <span class="muted small tabular no-print" aria-live="polite">{{ index + 1 }} / {{ cards.length }}</span>
    </div>

    <div class="no-print screen-cards">
      <FlipCard ref="flipCard" :key="index" v-model:flipped="flipped" :front="card.front" :back="card.back" size="medium" @keydown="onKey" />
      <div class="card-nav">
        <button type="button" class="button button-outline button-sm" @click="go(-1)"><ArrowLeft :size="16" /> Poprzednia</button>
        <div class="dots" aria-hidden="true"><i v-for="(_, i) in cards" :key="i" :class="{ active: i === index }"></i></div>
        <button type="button" class="button button-dark button-sm" @click="go(1)">Następna <ArrowRight :size="16" /></button>
      </div>
    </div>

    <dl class="print-cards">
      <div v-for="(c, i) in cards" :key="i"><dt>{{ c.front }}</dt><dd>{{ c.back }}</dd></div>
    </dl>
  </section>
</template>

<style scoped>
.screen-cards { margin-top: 14px; }
.card-nav { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 16px; }
.dots { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; min-width: 0; }
.dots i { width: 6px; height: 6px; border-radius: 50%; background: #dce4d1; }
.dots i.active { background: #8ea575; }
.print-cards { display: none; }
@media (max-width: 420px) { .dots { display: none; } }
@media print {
  .print-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 10px 0 0; }
  .print-cards div { break-inside: avoid; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
  .print-cards dt { font-weight: 700; }
  .print-cards dd { margin: 2px 0 0; }
}
</style>
