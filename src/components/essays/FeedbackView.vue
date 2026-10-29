<script setup>
// Saved AI feedback: score, CKE notes, criteria with bars, the top tip and the essay with
// highlighted fragments (green = good, red = to fix). Rendered as elements, never as HTML.
import { computed } from 'vue'
import { Check, Lightbulb, TriangleAlert } from '@lucide/vue'
import { segments } from './segments'

const props = defineProps({
  /** StoredFeedback from @shared/essay */
  feedback: { type: Object, required: true },
  content: { type: String, required: true },
})

const parts = computed(() => segments(props.content, props.feedback.highlights ?? []))
const VERDICT = { good: { label: 'dobrze', cls: 'is-good' }, ok: { label: 'w porządku', cls: 'is-ok' }, fix: { label: 'do poprawy', cls: 'is-fix' } }
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

    <ul v-if="feedback.notes?.length" class="stack notes" style="--gap: 8px">
      <li v-for="n in feedback.notes" :key="n" class="alert alert-warn"><TriangleAlert :size="17" /><span>{{ n }}</span></li>
    </ul>

    <section>
      <h2 class="section-title">Kryterium po kryterium</h2>
      <ul class="criteria card">
        <li v-for="c in feedback.criteria" :key="c.id" class="criterion">
          <span class="verdict-dot" :class="verdict(c.verdict).cls" aria-hidden="true">
            <Check v-if="c.verdict === 'good'" :size="14" /><template v-else>{{ c.verdict === 'ok' ? '~' : '!' }}</template>
          </span>
          <div class="criterion-body">
            <div class="criterion-head">
              <p class="criterion-label">{{ c.label }} <span class="sr-only">({{ verdict(c.verdict).label }})</span></p>
              <span class="criterion-points tabular">{{ c.assessed ? `${c.points}/${c.max}` : '–' }}<span v-if="!c.assessed" class="sr-only"> nie oceniono</span></span>
            </div>
            <p v-if="c.comment" class="criterion-comment">{{ c.comment }}</p>
            <div v-if="c.assessed" class="progress criterion-bar" :class="verdict(c.verdict).cls" aria-hidden="true"><span :style="{ width: `${pct(c)}%` }"></span></div>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="feedback.topTip" class="top-tip card card-purple">
      <h2 class="top-tip-title"><Lightbulb :size="18" /> Najważniejsze do poprawy</h2>
      <p>{{ feedback.topTip }}</p>
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
