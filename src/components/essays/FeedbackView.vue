<script setup>
// Saved AI feedback: score, CKE notes, criteria with bars, the top tip and the essay with
// highlighted fragments (green = good, red = to fix). Rendered as elements, never as HTML.
import { computed } from 'vue'
import { Check, Lightbulb, TriangleAlert } from '@lucide/vue'
import { segments } from './segments'
import { criterionStatus, feedbackForDisplay, priorityImprovements } from '@shared/essay'

const props = defineProps({
  /** StoredFeedback from @shared/essay */
  feedback: { type: Object, required: true },
  content: { type: String, required: true },
  wordCount: { type: Number, default: undefined },
})

const feedback = computed(() => feedbackForDisplay(props.feedback, props.wordCount))
const priorities = computed(() => priorityImprovements(feedback.value))
const notes = computed(() => (feedback.value.notes ?? []).filter(n => !feedback.value.wordLimit || (n !== feedback.value.wordLimit.message && !n.startsWith(`Tekst ma ${feedback.value.wordLimit.words} wyrazów`))))
const parts = computed(() => segments(props.content, feedback.value.highlights ?? []))
const VERDICT = { good: { cls: 'is-good' }, ok: { cls: 'is-ok' }, fix: { cls: 'is-fix' }, not_assessed: { cls: 'is-unassessed' } }
const verdict = v => VERDICT[v] ?? VERDICT.fix
const pct = c => (c.max ? Math.round((c.points / c.max) * 100) : 0)
</script>

<template>
  <div class="feedback stack" style="--gap: 32px">
    <section class="score card card-purple" aria-labelledby="score-label">
      <p id="score-label" class="score-kicker">Orientacyjny wynik</p>
      <p class="score-value tabular">{{ feedback.total }}<span>/{{ feedback.max }} pkt</span></p>
      <p v-if="feedback.summary" class="score-summary">{{ feedback.summary }}</p>
    </section>

    <section v-if="priorities.length" class="top-tip card" :class="feedback.wordLimit ? 'word-limit-priority' : 'card-purple'" aria-labelledby="improvements-title">
      <h2 id="improvements-title" class="top-tip-title"><TriangleAlert v-if="feedback.wordLimit" :size="20" /><Lightbulb v-else :size="18" /> Najważniejsze do poprawy</h2>
      <p v-if="feedback.wordLimit" class="word-count tabular">{{ feedback.wordLimit.words }} / {{ feedback.wordLimit.minimum }} wyrazów</p>
      <ol class="priority-list"><li v-for="(item, i) in priorities" :key="i" :class="{ 'word-limit-warning': feedback.wordLimit && i === 0 }">{{ item }}</li></ol>
    </section>

    <ul v-if="notes.length" class="stack notes" style="--gap: 8px">
      <li v-for="n in notes" :key="n" class="alert alert-warn"><TriangleAlert :size="17" /><span>{{ n }}</span></li>
    </ul>

    <section>
      <h2 class="section-title">Kryterium po kryterium</h2>
      <ul class="criteria card">
        <li v-for="c in feedback.criteria" :key="c.id" class="criterion">
          <span class="verdict-dot" :class="verdict(c.verdict).cls" aria-hidden="true">
            <Check v-if="c.verdict === 'good'" :size="14" /><template v-else>{{ c.verdict === 'not_assessed' ? '–' : c.verdict === 'ok' ? '~' : '!' }}</template>
          </span>
          <div class="criterion-body">
            <div class="criterion-head">
              <p class="criterion-label">{{ c.label }}</p>
              <span class="criterion-points tabular">{{ c.assessed ? `${c.points}/${c.max}` : '–' }}<span v-if="!c.assessed" class="sr-only"> nie oceniono</span></span>
            </div>
            <p class="criterion-status" :class="verdict(c.verdict).cls">{{ criterionStatus(c) }}</p>
            <p v-if="c.scoreExplanation" class="criterion-reason">{{ c.scoreExplanation }}</p>
            <p v-if="c.comment" class="criterion-comment"><strong v-if="c.scoreReason">{{ c.scoreReason === 'word_limit' ? 'Informacyjnie — gdyby tekst spełniał limit: ' : 'Uwaga informacyjna (nie zmienia punktacji): ' }}</strong>{{ c.comment }}</p>
            <ul v-if="feedback.errors?.some(e => e.criterion === c.id)" class="criterion-errors">
              <li v-for="e in feedback.errors.filter(e => e.criterion === c.id)" :key="e.id"><q>{{ e.quote }}</q> — {{ e.comment }}<span v-if="e.correction"> Poprawnie: <q>{{ e.correction }}</q>.</span></li>
            </ul>
            <div v-if="c.assessed && !c.scoreReason" class="progress criterion-bar" :class="verdict(c.verdict).cls" aria-hidden="true"><span :style="{ width: `${pct(c)}%` }"></span></div>
          </div>
        </li>
      </ul>
    </section>

    <section>
      <h2 class="section-title">Twój tekst z uwagami</h2>
      <div class="essay-text card">
        <template v-for="(s, i) in parts" :key="i">
          <mark v-if="s.h" class="hl" :class="s.h.type === 'good' ? 'is-good' : 'is-issue'">{{ s.text }}<sup>{{ s.n }}</sup><span class="sr-only"> ({{ s.h.type === 'good' ? 'mocna strona' : 'do poprawy' }}, uwaga {{ s.n }})</span></mark>
          <template v-else>{{ s.text }}</template>
        </template>
      </div>
      <ol v-if="feedback.highlights?.length" class="hl-list">
        <li v-for="(h, i) in feedback.highlights" :key="i">
          <span class="hl-num" :class="h.type === 'good' ? 'is-good' : 'is-issue'" aria-hidden="true">{{ i + 1 }}</span>
          <span><span class="sr-only">Uwaga {{ i + 1 }} ({{ h.type === 'good' ? 'mocna strona' : 'do poprawy' }}): </span>{{ h.comment }}</span>
        </li>
      </ol>
    </section>

    <p class="disclaimer">Ocena jest orientacyjna i przygotowana przez AI na podstawie kryteriów CKE. Nie jest oficjalną oceną egzaminatora, a AI może się mylić.</p>
  </div>
</template>

<style scoped>
.score { text-align: center; padding: 28px 22px; }
.score-kicker { font-size: 11px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: var(--info); }
.score-value { margin-top: 6px; font-family: var(--heading); font-size: 52px; font-weight: 800; letter-spacing: -2px; line-height: 1.1; color: var(--green); }
.score-value span { font-size: 22px; font-weight: 700; letter-spacing: -.5px; color: var(--text-soft); }
.score-summary { max-width: 56ch; margin: 12px auto 0; color: var(--text-soft); line-height: 1.6; }
.notes { list-style: none; margin: 0; padding: 0; }

.criteria { list-style: none; margin: 0; padding: 0; overflow: hidden; }
.criterion { display: flex; gap: 12px; padding: 15px 18px; }
.criterion + .criterion { border-top: 1px solid var(--line); }
.verdict-dot { display: inline-grid; place-items: center; flex-shrink: 0; width: 24px; height: 24px; margin-top: 1px; border-radius: 50%; font-size: 13px; font-weight: 800; }
.verdict-dot.is-good { background: var(--ok-bg); color: var(--ok); }
.verdict-dot.is-ok { background: var(--warn-bg); color: var(--warn); }
.verdict-dot.is-fix { background: var(--error-bg); color: var(--error); }
.verdict-dot.is-unassessed { background: var(--surface-2); color: var(--text-soft); }
.criterion-status { margin-top: 5px; font-size: 12px; font-weight: 700; }
.criterion-status.is-unassessed { color: var(--text-soft); }
.criterion-reason { margin-top: 8px; padding: 10px 12px; border-left: 3px solid var(--warn); background: var(--warn-bg); font-size: 14px; line-height: 1.5; }
.criterion-errors { margin: 10px 0 0; padding-left: 20px; font-size: 14px; line-height: 1.6; }
.criterion-errors li + li { margin-top: 8px; }
.criterion-body { flex: 1; min-width: 0; }
.criterion-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.criterion-label { font-weight: 650; line-height: 1.35; }
.criterion-points { flex-shrink: 0; font-family: var(--heading); font-weight: 800; }
.criterion-comment { margin-top: 4px; font-size: 14px; color: var(--text-soft); line-height: 1.55; }
.criterion-bar { height: 6px; margin-top: 9px; }
.criterion-bar.is-good > span { background: var(--ok); }
.criterion-bar.is-ok > span { background: var(--warn); }
.criterion-bar.is-fix > span { background: var(--error); }

.top-tip { border-style: dashed; border-color: var(--info); }
.top-tip-title { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 750; color: var(--info); }
.top-tip p { margin-top: 6px; color: var(--text); line-height: 1.6; }
.priority-list { margin: 12px 0 0; padding-left: 22px; line-height: 1.65; }
.priority-list li + li { margin-top: 12px; }
.word-limit-priority { background: var(--warn-bg); border: 2px solid var(--warn-line); border-left: 5px solid var(--warn); }
.word-limit-priority .top-tip-title { color: var(--warn); }
.word-limit-warning { font-weight: 650; }
.word-count { font-size: 20px; font-weight: 750; }

.essay-text { white-space: pre-wrap; line-height: 1.8; font-size: 16px; overflow-wrap: anywhere; }
.hl { border-radius: 4px; padding: 1px 2px; color: var(--text); }
.hl.is-good { background: var(--ok-bg); box-shadow: inset 0 -2px 0 var(--ok-line); }
.hl.is-issue { background: var(--error-bg); text-decoration: underline wavy var(--error); text-underline-offset: 4px; text-decoration-thickness: 1px; }
.hl sup { margin-left: 2px; font-size: 11px; font-weight: 800; }
.hl.is-good sup { color: var(--ok); }
.hl.is-issue sup { color: var(--error); }
.hl-list { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 9px; font-size: 14px; line-height: 1.55; }
.hl-list li { display: flex; gap: 11px; }
.hl-num { display: inline-grid; place-items: center; flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; font-size: 12px; font-weight: 800; }
.hl-num.is-good { background: var(--ok-bg); color: var(--ok); }
.hl-num.is-issue { background: var(--error-bg); color: var(--error); }
.disclaimer { font-size: 12.5px; color: var(--text-soft); line-height: 1.55; }
@media (max-width: 560px) { .score-value { font-size: 44px; } .criterion { padding: 13px 14px; } }
</style>
