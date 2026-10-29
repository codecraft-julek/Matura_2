<script setup>
// One answer field of the answer sheet ("karta odpowiedzi"), port of the old TaskInput.
// The exam text itself is in the official CKE PDF; here students only mark/type answers.
//   choice            → letters (A–H, T/F, P/F, digits) as round radio buttons
//   choice + meta.rows → one row of letters per part, answer = one character per row, "_" = empty
//   open, section test → Polish open answer, textarea (3000)
//   open              → English short answer, input (200)
//   writing           → textarea with word counter (meta.words), rules and criteria
import { computed, useId } from 'vue'
import { countWords } from '@/lib/exams/labels'
import { isSubtask, rowParts, setRowPart, wordsRule } from './sheet'
import ResultBadge from './ResultBadge.vue'

const props = defineProps({
  task: { type: Object, required: true },
  modelValue: { type: String, default: '' },
  result: { type: Object, default: null },
  subject: { type: String, default: 'english' },
})
const emit = defineEmits(['update:modelValue'])
const uid = useId()
const fieldId = computed(() => `${uid}-t-${props.task.number}`)
const set = value => emit('update:modelValue', value)

// Screen readers: say what T/F and P/F mean.
function letterLabel(letter) {
  const opts = props.task.options.join('')
  if (opts === 'TF') return letter === 'T' ? 'T — True' : 'F — False'
  if (opts === 'PF') return letter === 'P' ? 'P — prawda' : 'F — fałsz'
  return letter
}

const rows = computed(() => props.task.meta?.rows ?? null)
const parts = computed(() => (rows.value ? rowParts(rows.value, props.modelValue) : []))
const setPart = (i, letter) => set(setRowPart(rows.value, props.modelValue, i, letter))

const words = computed(() => (props.task.kind === 'writing' ? countWords(props.modelValue) : 0))
const rule = computed(() => wordsRule(props.task.meta?.words))
const wordsTone = computed(() => (words.value === 0 ? '' : rule.value.inRange(words.value) ? 'is-ok' : 'is-error'))
const criteriaText = computed(() => (props.task.meta?.criteria ?? []).map(c => `${c.name.toLowerCase()} (${c.points})`).join(', '))
</script>

<template>
  <!-- Writing: essay / English writing task -->
  <div v-if="task.kind === 'writing'" class="task-input">
    <label :for="fieldId" class="sr-only">Twoja wypowiedź pisemna</label>
    <textarea
      :id="fieldId" class="textarea writing-area" :value="modelValue" rows="12" spellcheck="false" autocapitalize="sentences"
      :aria-describedby="`${fieldId}-words`"
      :placeholder="subject === 'polish' ? 'Napisz tutaj swoje wypracowanie…' : 'Napisz tutaj swoją wypowiedź po angielsku…'"
      @input="set($event.target.value)"
    ></textarea>
    <p :id="`${fieldId}-words`" class="words" :class="wordsTone" aria-live="polite">{{ words }} wyrazów ({{ rule.label }})</p>
    <ul v-if="task.meta?.rules?.length" class="rules">
      <li v-for="r in task.meta.rules" :key="r">{{ r }}</li>
    </ul>
    <p v-if="criteriaText" class="criteria">Kryteria: {{ criteriaText }}. Po zakończeniu sprawdzisz tekst z AI według tych kryteriów.</p>
  </div>

  <!-- Multi-part closed task (e.g. Polish "PF": two statements, one point for both) -->
  <div v-else-if="task.kind === 'choice' && rows" class="task-input">
    <span v-if="isSubtask(task)" class="task-no">{{ task.number }}</span>
    <div class="multi-rows">
      <div v-for="(row, i) in rows" :key="row" role="radiogroup" :aria-label="`Zadanie ${task.number}, ${row}`" class="multi-row">
        <span class="row-label">{{ row }}</span>
        <label v-for="letter in task.options" :key="letter" class="letter" :class="{ 'is-on': parts[i] === letter }">
          <input type="radio" :name="`${fieldId}-${i}`" :value="letter" :checked="parts[i] === letter" :aria-label="letterLabel(letter)" @change="setPart(i, letter)" />
          {{ letter }}
        </label>
      </div>
    </div>
    <div v-if="result" class="result-line"><ResultBadge :result="result" /></div>
  </div>

  <!-- Polish open tasks need sentences, not a few words -->
  <div v-else-if="task.kind === 'open' && task.section === 'test'" class="task-input">
    <label :for="fieldId" :class="isSubtask(task) ? 'task-no' : 'sr-only'">{{ isSubtask(task) ? task.number : `Odpowiedź do zadania ${task.number}` }}</label>
    <textarea :id="fieldId" class="textarea open-area" :value="modelValue" :rows="task.points >= 3 ? 7 : 3" maxlength="3000" placeholder="Twoja odpowiedź…" @input="set($event.target.value)"></textarea>
    <div v-if="result" class="result-line"><ResultBadge :result="result" /></div>
  </div>

  <!-- Single choice (letters) or a short English answer -->
  <div v-else class="task-input inline">
    <span class="task-no" aria-hidden="true">{{ task.number }}</span>
    <div v-if="task.kind === 'choice'" role="radiogroup" :aria-label="`Zadanie ${task.number}`" class="letters">
      <label v-for="letter in task.options" :key="letter" class="letter" :class="{ 'is-on': modelValue === letter }">
        <input type="radio" :name="fieldId" :value="letter" :checked="modelValue === letter" :aria-label="letterLabel(letter)" @change="set(letter)" />
        {{ letter }}
      </label>
    </div>
    <input
      v-else class="input short-input" :value="modelValue" :aria-label="`Odpowiedź do zadania ${task.number}`" autocapitalize="none" autocorrect="off"
      spellcheck="false" maxlength="200" @input="set($event.target.value)"
    />
    <ResultBadge v-if="result" :result="result" />
  </div>
</template>

<style scoped>
.task-input { display: flex; flex-direction: column; gap: 8px; }
.task-input.inline { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.task-no { width: 44px; flex-shrink: 0; font-family: var(--heading); font-weight: 750; font-size: 15px; color: var(--text); }
.letters { display: flex; flex-wrap: wrap; gap: 6px; }
.letter { position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line-strong); background: var(--surface); font-family: var(--heading); font-weight: 750; font-size: 15px; color: var(--text); cursor: pointer; user-select: none; transition: background .15s, border-color .15s, color .15s; }
.letter:hover:not(.is-on) { border-color: var(--green); background: var(--surface-2); }
.letter input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.letter.is-on { background: var(--green); border-color: var(--green); color: white; }
.letter:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 3px; }
.multi-rows { display: flex; flex-direction: column; gap: 8px; }
.multi-row { display: flex; align-items: center; gap: 6px; }
.row-label { width: 44px; flex-shrink: 0; font-size: 14px; font-weight: 650; color: var(--text-soft); }
.multi-row .letter { width: 40px; height: 40px; }
.short-input { flex: 1; min-width: 160px; width: auto; padding-block: 10px; }
.result-line { display: flex; }
.open-area { min-height: 0; }
.writing-area { min-height: 280px; line-height: 1.7; }
.words { font-size: 14px; color: var(--text-soft); font-variant-numeric: tabular-nums; }
.words.is-ok { color: var(--ok); font-weight: 650; }
.words.is-error { color: var(--error); font-weight: 650; }
.rules { margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; }
.criteria { font-size: 13px; color: var(--text-soft); line-height: 1.55; }
@media (max-width: 520px) {
  .task-input.inline { gap: 8px; }
  .task-input.inline .task-no { width: 100%; }
  .short-input { min-width: 0; width: 100%; flex-basis: 100%; }
}
</style>
