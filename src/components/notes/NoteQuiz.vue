<script setup>
// A short single-choice quiz from the note. Answers are checked right away, with an explanation.
import { computed, ref } from 'vue'
import { Check, RotateCw, X } from '@lucide/vue'

const props = defineProps({ questions: { type: Array, required: true } })
const picked = ref(props.questions.map(() => null))
const answered = computed(() => picked.value.filter(p => p !== null).length)
const score = computed(() => picked.value.filter((p, i) => p === props.questions[i].correct).length)
const letters = ['A', 'B', 'C', 'D']

function pick(i, j) {
  if (picked.value[i] !== null) return
  picked.value = picked.value.map((v, k) => (k === i ? j : v))
}
function state(i, j) {
  const choice = picked.value[i]
  if (choice === null) return ''
  if (j === props.questions[i].correct) return 'is-right'
  return j === choice ? 'is-wrong' : 'is-dim'
}
const reset = () => { picked.value = props.questions.map(() => null) }
</script>

<template>
  <section v-if="questions.length" class="no-print" aria-labelledby="quiz-title">
    <div class="row-between">
      <h2 id="quiz-title" class="section-title" style="margin: 0">Sprawdź się</h2>
      <span class="badge" :class="answered === questions.length ? 'badge-lime' : ''" aria-live="polite">
        {{ answered === questions.length ? `Wynik: ${score}/${questions.length}` : `${answered}/${questions.length}` }}
      </span>
    </div>
    <ol class="quiz">
      <li v-for="(q, i) in questions" :key="i" class="card">
        <p class="question"><span class="q-num">{{ i + 1 }}.</span> {{ q.question }}</p>
        <div class="options" role="group" :aria-label="`Odpowiedzi do pytania ${i + 1}`">
          <button
            v-for="(o, j) in q.options" :key="j" type="button" class="option" :class="state(i, j)"
            :disabled="picked[i] !== null" :aria-pressed="picked[i] === j" @click="pick(i, j)"
          >
            <span class="letter" aria-hidden="true">
              <Check v-if="state(i, j) === 'is-right'" :size="14" /><X v-else-if="state(i, j) === 'is-wrong'" :size="14" /><template v-else>{{ letters[j] }}</template>
            </span>
            <span>{{ o }}</span>
          </button>
        </div>
        <p v-if="picked[i] !== null" class="explain" role="status">
          <strong :class="picked[i] === q.correct ? 'ok' : 'bad'">{{ picked[i] === q.correct ? 'Dobrze! ' : 'Nie tym razem. ' }}</strong>{{ q.explanation }}
        </p>
      </li>
    </ol>
    <button v-if="answered === questions.length" type="button" class="button button-outline button-sm" style="margin-top: 14px" @click="reset"><RotateCw :size="15" /> Jeszcze raz</button>
  </section>
</template>

<style scoped>
.quiz { display: flex; flex-direction: column; gap: 14px; margin: 14px 0 0; padding: 0; list-style: none; }
.question { font-weight: 650; font-size: 15.5px; line-height: 1.5; }
.q-num { font-family: var(--heading); font-weight: 800; color: var(--accent); }
.options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.option { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 11px; border: 1px solid var(--line-strong); background: var(--surface); text-align: left; font-size: 14.5px; line-height: 1.45; transition: border-color .15s, background .15s; }
.option:hover:not(:disabled) { border-color: var(--green); background: var(--surface-3); }
.option:disabled { opacity: 1; cursor: default; }
.letter { display: grid; place-items: center; flex-shrink: 0; width: 24px; height: 24px; border-radius: 7px; background: var(--surface-2); font-family: var(--heading); font-weight: 800; font-size: 12px; color: var(--accent); }
.is-right { border-color: var(--ok-line); background: var(--ok-bg); color: #3c5f2a; font-weight: 650; }
.is-right .letter { background: var(--ok); color: white; }
.is-wrong { border-color: var(--error-line); background: var(--error-bg); color: #7d3f2c; text-decoration: line-through; }
.is-wrong .letter { background: var(--error); color: white; }
.is-dim { color: var(--text-soft); }
.explain { margin-top: 10px; font-size: 14px; line-height: 1.55; }
.ok { color: var(--ok); }
.bad { color: var(--error); }
@media (max-width: 560px) { .options { grid-template-columns: 1fr; } }
</style>
