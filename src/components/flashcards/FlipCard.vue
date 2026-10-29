<script setup>
// One flashcard that flips in 3D: sand front (question), green-tinted back (answer), the look of the
// landing demo (.large-flashcard). Click / tap flips it; parents add keyboard shortcuts.
//   <FlipCard v-model:flipped="flipped" :front="card.front" :back="card.back" size="large" />
// Both faces share one grid cell, so the card grows with long answers instead of cutting them.
// With reduced motion the global rule in app.css makes the flip instant.
import { ref } from 'vue'
import { CircleCheck, Lightbulb, RotateCw } from '@lucide/vue'

const flipped = defineModel('flipped', { type: Boolean, default: false })
defineProps({
  front: { type: String, required: true },
  back: { type: String, required: true },
  /** 'large' (study session) | 'medium' (note flashcards) */
  size: { type: String, default: 'large' },
  /** Small line under the question, e.g. a shortcut hint. */
  hint: { type: String, default: '' },
  /** Show the question again (small) above the answer on the back. */
  repeatFront: { type: Boolean, default: true },
})
const button = ref(null)
defineExpose({ focus: () => button.value?.focus() })
</script>

<template>
  <button ref="button" type="button" class="flip-card" :class="[`is-${size}`, { flipped }]" :aria-pressed="flipped" @click="flipped = !flipped">
    <span class="sr-only">{{ flipped ? 'Odpowiedź (kliknij, żeby wrócić do pytania):' : 'Pytanie (kliknij, żeby odwrócić):' }}</span>
    <span class="flip-inner">
      <span class="face face-front" :aria-hidden="flipped ? 'true' : undefined">
        <span class="symbol" aria-hidden="true"><Lightbulb :size="size === 'large' ? 26 : 22" /></span>
        <strong class="face-text">{{ front }}</strong>
        <span v-if="hint" class="face-hint">{{ hint }}</span>
        <span class="flip-instruction" aria-hidden="true"><RotateCw :size="14" /> Kliknij, żeby odwrócić</span>
      </span>
      <span class="face face-back" :aria-hidden="flipped ? undefined : 'true'">
        <span class="symbol" aria-hidden="true"><CircleCheck :size="size === 'large' ? 26 : 22" /></span>
        <span v-if="repeatFront" class="face-question">{{ front }}</span>
        <strong class="face-text">{{ back }}</strong>
        <span class="flip-instruction" aria-hidden="true"><RotateCw :size="14" /> Kliknij, żeby wrócić do pytania</span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.flip-card { display: block; width: 100%; padding: 0; background: none; perspective: 1400px; border-radius: var(--radius-lg); text-align: center; }
.flip-card:focus-visible { outline: 3px solid var(--focus); outline-offset: 5px; }
.flip-inner { display: grid; transition: transform .55s cubic-bezier(.3, .7, .3, 1); transform-style: preserve-3d; }
.flipped .flip-inner { transform: rotateY(180deg); }
.face {
  grid-area: 1 / 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
  min-height: 300px; padding: 28px; border-radius: var(--radius-lg); border: 1px solid #e2d9c4;
  background: #f5f0e4; color: var(--text);
  backface-visibility: hidden; -webkit-backface-visibility: hidden;
  box-shadow: var(--shadow-sm);
  transition: box-shadow .2s;
}
.flip-card:hover .face { box-shadow: var(--shadow); }
.face-back { transform: rotateY(180deg); background: #eaf1dd; border-color: #ceddbb; }
.symbol { width: 50px; height: 50px; display: grid; place-items: center; border-radius: 50%; background: #eae2cc; color: #a79765; }
.face-back .symbol { background: #dbe8c6; color: #829d5d; }
.face-text { font-family: var(--heading); font-size: clamp(22px, 3.4vw, 27px); line-height: 1.35; letter-spacing: -.7px; text-wrap: balance; overflow-wrap: anywhere; }
.face-back .face-text { font-size: clamp(18px, 2.6vw, 21px); line-height: 1.55; letter-spacing: -.2px; }
.face-question { font-size: 14px; font-weight: 650; color: var(--text-soft); max-width: 46ch; overflow-wrap: anywhere; }
.face-hint { font-size: 13px; color: #8e846d; }
.flip-instruction { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #8e846d; }
.face-back .flip-instruction { color: var(--accent); }

.is-medium .face { min-height: 220px; padding: 22px; gap: 12px; }
.is-medium .symbol { width: 42px; height: 42px; }
.is-medium .face-text { font-size: clamp(19px, 2.8vw, 22px); }
.is-medium .face-back .face-text { font-size: 17px; }

@media (max-width: 560px) {
  .face { min-height: 260px; padding: 22px 18px; }
  .is-medium .face { min-height: 200px; }
}
</style>
