<script setup>
// For open answers our list didn't recognise: the student compares with the key and decides.
// Also overrides a grade proposed by AI (status "ai_graded"): the student has the last word.
// Emits `graded(points)` after the database saved it, so the page updates locally (no reload).
import { computed, ref } from 'vue'
import { Check, X } from '@lucide/vue'
import { selfCheckAnswer, selfGradeAnswer } from '@/lib/api/exams'

const props = defineProps({
  attemptId: { type: String, required: true },
  number: { type: String, required: true },
  current: { type: String, required: true },
  max: { type: Number, default: 1 },
  points: { type: Number, default: 0 },
})
const emit = defineEmits(['graded'])
const pending = ref(false)
const failed = ref(false)
const byAi = computed(() => props.current === 'ai_graded')
const graded = computed(() => props.current !== 'unchecked')

async function run(call, points) {
  pending.value = true
  failed.value = false
  const res = await call()
  pending.value = false
  failed.value = !res.ok
  if (res.ok) emit('graded', points)
}
const decide = accept => run(() => selfCheckAnswer(props.attemptId, props.number, accept), accept ? props.max : 0)
const grade = p => run(() => selfGradeAnswer(props.attemptId, props.number, p), p)
</script>

<template>
  <!-- Tasks worth 2+ points: pick 0…max, comparing with what the key requires -->
  <div v-if="max > 1" class="self-check" role="group" :aria-label="`Samoocena zadania ${number}`" :aria-busy="pending">
    <span class="self-q">{{ byAi ? 'Zmień, jeśli się nie zgadzasz:' : 'Ile punktów według klucza?' }}</span>
    <div class="self-buttons">
      <button v-for="p in max + 1" :key="p" type="button" class="pt-btn" :class="{ 'is-on': graded && points === p - 1 }" :aria-pressed="graded && points === p - 1" :disabled="pending" :aria-label="`${p - 1} pkt`" @click="grade(p - 1)">{{ p - 1 }}</button>
    </div>
    <span v-if="failed" class="self-error" role="alert">Nie udało się zapisać.</span>
  </div>

  <div v-else class="self-check" role="group" :aria-label="`Samoocena zadania ${number}`" :aria-busy="pending">
    <span class="self-q">{{ byAi ? 'Zaliczasz? (możesz zmienić ocenę AI)' : 'Znaczy to samo co klucz?' }}</span>
    <div class="self-buttons">
      <button type="button" class="yn-btn is-yes" :class="{ 'is-on': current === 'self_correct' || (byAi && points === max) }" :aria-pressed="current === 'self_correct' || (byAi && points === max)" :disabled="pending" @click="decide(true)"><Check :size="14" /> Tak, zaliczam</button>
      <button type="button" class="yn-btn is-no" :class="{ 'is-on': current === 'self_incorrect' || (byAi && points === 0) }" :aria-pressed="current === 'self_incorrect' || (byAi && points === 0)" :disabled="pending" @click="decide(false)"><X :size="14" /> Nie</button>
    </div>
    <span v-if="failed" class="self-error" role="alert">Nie udało się zapisać.</span>
  </div>
</template>

<style scoped>
.self-check { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin-top: 10px; }
.self-q { font-size: 14px; color: var(--text-soft); }
.self-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
.pt-btn, .yn-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 38px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 14px; font-weight: 700; transition: background .15s, border-color .15s, color .15s; }
.pt-btn { min-width: 40px; padding: 0 12px; font-variant-numeric: tabular-nums; }
.pt-btn:hover:not(:disabled) { border-color: var(--green); }
.pt-btn.is-on { background: var(--green); border-color: var(--green); color: white; }
.yn-btn { padding: 0 14px; }
.yn-btn.is-yes { border-color: var(--ok-line); color: var(--ok); }
.yn-btn.is-yes:hover:not(:disabled) { background: var(--ok-bg); }
.yn-btn.is-yes.is-on { background: var(--ok); border-color: var(--ok); color: white; }
.yn-btn.is-no { border-color: var(--error-line); color: var(--error); }
.yn-btn.is-no:hover:not(:disabled) { background: var(--error-bg); }
.yn-btn.is-no.is-on { background: var(--error); border-color: var(--error); color: white; }
.self-error { font-size: 13px; color: var(--error); font-weight: 650; }
</style>
