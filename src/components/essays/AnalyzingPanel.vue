<script setup>
// The "AI is analysing" screen. Two halves of the wait feel different:
//   thinking (~5 s, nothing arrives): checklist + "Czy wiesz, że…" facts + progress bar
//   writing  (~15 s, text streams in): every CKE criterion fills in live with points and a comment
// so the student watches their feedback appear instead of staring at a spinner.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, LoaderCircle, Sparkles } from '@lucide/vue'
import { RUBRICS, parsePartialFeedback } from '@shared/essay'
import { LOADER_TIPS } from '@/lib/essays/tips'

const props = defineProps({
  /** From useEssayAnalysis(): { phase, text, words, startedAt } */
  state: { type: Object, required: true },
  rubric: { type: String, required: true },
})

const THINKING_STEPS = ['Liczę wyrazy', 'Czytam cały tekst', 'Porównuję z kryteriami CKE', 'Szukam mocnych stron i błędów']

const def = computed(() => RUBRICS[props.rubric])
const tips = computed(() => LOADER_TIPS[props.rubric])
const partial = computed(() => parsePartialFeedback(props.state.text))

// Clock for elapsed time, rotating tips and the thinking checklist.
const now = ref(Date.now())
let timer = null
const heading = ref(null)
onMounted(() => {
  timer = setInterval(() => { now.value = Date.now() }, 500)
  heading.value?.focus({ preventScroll: true }) // the form that had focus is gone
})
onBeforeUnmount(() => clearInterval(timer))

const elapsed = computed(() => Math.max(0, (now.value - props.state.startedAt) / 1000))
const tip = computed(() => tips.value[Math.floor(elapsed.value / 6) % tips.value.length])
const stepsDone = computed(() => Math.min(THINKING_STEPS.length - 1, Math.floor(elapsed.value / 1.6)))
const doneCriteria = computed(() => partial.value.criteria.length)
const total = computed(() => def.value.criteria.length)
const writing = computed(() => props.state.phase === 'writing' || props.state.phase === 'done')

// Progress: thinking creeps up to ~25%, then each finished criterion fills the rest.
const progress = computed(() => {
  const { phase } = props.state
  if (phase === 'done') return 100
  if (phase === 'writing') {
    const p = partial.value
    return 25 + (doneCriteria.value / total.value) * 60 + (p.highlightsCount > 0 ? 8 : 0) + (p.topTipStarted ? 5 : 0)
  }
  return Math.min(25, 4 + elapsed.value * 3)
})

const status = computed(() => {
  const { phase } = props.state
  const p = partial.value
  if (phase === 'sending') return 'Wysyłam tekst…'
  if (phase === 'thinking') return `${THINKING_STEPS[stepsDone.value]}…`
  if (phase === 'done') return 'Gotowe! Otwieram feedback…'
  if (p.topTipStarted) return 'Piszę najważniejszą wskazówkę…'
  if (p.highlightsCount > 0) return `Zaznaczam fragmenty w tekście (${p.highlightsCount})…`
  if (doneCriteria.value < total.value) return `Oceniam: ${def.value.criteria[doneCriteria.value].label}…`
  return 'Zaznaczam fragmenty w tekście…'
})

const rows = computed(() => def.value.criteria.map((c, i) => {
  const got = partial.value.criteria.find(x => x.id === c.id)
  return { ...c, got, active: !got && i === doneCriteria.value, points: got ? Math.min(c.max, Math.max(0, got.points)) : 0 }
}))
</script>

<template>
  <div class="analyzing card card-purple">
    <!-- Sticky on phones: progress and status stay visible while criteria fill in below -->
    <div class="analyzing-top">
      <div class="row-between">
        <h2 ref="heading" tabindex="-1" class="analyzing-title"><Sparkles :size="18" /> AI czyta Twój tekst</h2>
        <span class="muted small tabular" aria-hidden="true">{{ Math.floor(elapsed) }} s</span>
      </div>
      <div class="progress analyzing-progress" role="progressbar" aria-label="Postęp analizy" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(progress)">
        <span :style="{ width: `${progress}%` }"></span>
      </div>
      <p class="analyzing-status" role="status" aria-live="polite"><LoaderCircle :size="15" class="spin" aria-hidden="true" />{{ status }}</p>
    </div>

    <template v-if="writing">
      <Transition name="fade"><p v-if="partial.summary" class="analyzing-summary">{{ partial.summary }}</p></Transition>
      <ul class="criteria">
        <li v-for="c in rows" :key="c.id" class="criterion" :class="{ 'is-done': c.got, 'is-active': c.active }">
          <div class="row-between criterion-head">
            <span class="criterion-label">{{ c.label }}</span>
            <span v-if="c.got" class="criterion-points tabular" :class="c.got.verdict === 'fix' ? 'is-fix' : 'is-ok'">{{ c.points }}/{{ c.max }}</span>
            <span v-else class="muted small">{{ c.active ? 'oceniam…' : `maks. ${c.max}` }}</span>
          </div>
          <Transition name="fade"><p v-if="c.got?.comment" class="criterion-comment">{{ c.got.comment }}</p></Transition>
        </li>
      </ul>
    </template>
    <template v-else>
      <ul class="steps">
        <li v-for="(step, i) in THINKING_STEPS" :key="step" :class="{ 'is-reached': i <= stepsDone }">
          <span class="step-dot" :class="i < stepsDone ? 'is-done' : i === stepsDone ? 'is-now' : ''" aria-hidden="true">
            <Check v-if="i < stepsDone" :size="13" /><template v-else>{{ i + 1 }}</template>
          </span>
          {{ step }}
          <span v-if="i === 0 && state.words > 0" class="muted">({{ state.words }})</span>
        </li>
      </ul>
      <Transition name="fade" mode="out-in">
        <div :key="tip" class="tip">
          <p class="tip-title">Czy wiesz, że…</p>
          <p class="tip-text">{{ tip }}</p>
        </div>
      </Transition>
    </template>

    <p class="analyzing-foot">Zwykle trwa to ok. 20–30 sekund. Nie zamykaj tej karty.</p>
  </div>
</template>

<style scoped>
.analyzing { padding: 0 22px 22px; }
.analyzing-top { position: sticky; top: 70px; z-index: 5; margin: 0 -22px; padding: 22px 22px 12px; background: inherit; border-radius: var(--radius-lg) var(--radius-lg) 0 0; }
@media (max-width: 760px) { .analyzing { padding: 0 18px 18px; } .analyzing-top { margin: 0 -18px; padding: 18px 18px 12px; } }
.analyzing-title { display: inline-flex; align-items: center; gap: 8px; font-size: 19px; font-weight: 750; letter-spacing: -.4px; color: var(--info); outline: none; }
.analyzing-progress { margin-top: 14px; background: var(--info-line); }
.analyzing-progress > span { background: var(--info); transition: width .7s ease-out; }
.analyzing-status { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 14px; font-weight: 650; }
.analyzing-status svg { color: var(--info); }
.analyzing-summary { margin-top: 14px; padding: 12px 14px; border-radius: var(--radius); background: var(--surface); color: var(--text-soft); line-height: 1.6; }

.criteria { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.criterion { padding: 10px 13px; border-radius: var(--radius); border: 1px dashed var(--info-line); transition: background .2s, border-color .2s; }
.criterion.is-done { background: var(--surface); border-style: solid; border-color: var(--line); }
.criterion.is-active { background: var(--info-bg); border-style: solid; border-color: var(--info); }
.criterion-head { flex-wrap: nowrap; font-size: 14px; }
.criterion-label { font-weight: 650; color: var(--text-soft); }
.is-done .criterion-label { color: var(--text); }
.criterion-points { font-family: var(--heading); font-weight: 800; white-space: nowrap; }
.criterion-points.is-ok { color: var(--ok); }
.criterion-points.is-fix { color: var(--error); }
.criterion-comment { margin-top: 4px; font-size: 13.5px; color: var(--text-soft); line-height: 1.5; }

.steps { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: var(--text-soft); }
.steps li { display: flex; align-items: center; gap: 9px; opacity: .6; }
.steps li.is-reached { color: var(--text); opacity: 1; }
.step-dot { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; font-size: 12px; font-weight: 700; background: var(--surface); border: 1px solid var(--info-line); }
.step-dot.is-done { background: var(--ok-bg); border-color: var(--ok-line); color: var(--ok); }
.step-dot.is-now { background: var(--info); border-color: var(--info); color: white; }
.tip { margin-top: 18px; padding: 13px 15px; border-radius: var(--radius); border: 1px dashed var(--info); background: var(--surface); font-size: 14px; }
.tip-title { font-weight: 750; }
.tip-text { margin-top: 3px; color: var(--text-soft); line-height: 1.55; }
.analyzing-foot { margin-top: 16px; font-size: 12.5px; color: var(--text-soft); }

.fade-enter-active, .fade-leave-active { transition: opacity .4s ease-out; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
