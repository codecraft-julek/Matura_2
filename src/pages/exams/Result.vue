<script setup>
// /arkusze/:examId/wynik/:attemptId — score, section tiles, answers with the key, self-check
// (Tak/Nie or 0..max, updated locally), "Oceń z AI" for Polish open answers, tutor per task,
// writing task with "Sprawdź z AI".
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowRight, Check, ChevronRight, CircleHelp, Clock3, Minus, PenLine, RotateCcw, Sparkles, Trophy, X } from '@lucide/vue'
import { examRoutes, ROUTES } from '@/config/routes'
import { useAsync } from '@/composables/useAsync'
import { usePageTitle } from '@/composables/usePageTitle'
import { essaysForAttempt, getAttempt, getExam } from '@/lib/api/exams'
import { myRating } from '@/lib/api/ratings'
import { REVIEW_STATUSES, SECTION_LABEL, countWords } from '@/lib/exams/labels'
import { formatDateTime } from '@/lib/format'
import { useBillingStore } from '@/stores/billing'
import { useUiStore } from '@/stores/ui'
import { aiGradableCount, applySelfGrade, durationLabel, groupTasks, resultTone, sectionTotals, wordsRule } from '@/components/exams/sheet'
import AiGradeOpenAnswers from '@/components/exams/AiGradeOpenAnswers.vue'
import SelfCheck from '@/components/exams/SelfCheck.vue'
import ExamWritingFeedback from '@/components/essays/ExamWritingFeedback.vue'
import AskTutor from '@/components/tutor/AskTutor.vue'
import NotFound from '@/pages/NotFound.vue'
import ErrorState from '@/ui/ErrorState.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'
import StatTile from '@/ui/StatTile.vue'

const route = useRoute()
const billing = useBillingStore()
const ui = useUiStore()
const ids = computed(() => ({ examId: String(route.params.examId), attemptId: String(route.params.attemptId) }))
const { data, loading, error, reload } = useAsync(async () => {
  const { examId, attemptId } = ids.value
  const [found, attempt, essays, rating] = await Promise.all([getExam(examId), getAttempt(attemptId), essaysForAttempt(attemptId), myRating('open_grading', attemptId)])
  if (!found || !attempt || attempt.exam_id !== found.exam.id) return { missing: true }
  return { ...found, attempt, essays, rating }
}, { watch: () => `${route.params.examId}/${route.params.attemptId}` })
onMounted(() => billing.loadAllowances().catch(() => {}))

const exam = computed(() => data.value?.exam)
const attempt = computed(() => data.value?.attempt)
usePageTitle(() => exam.value && `Wynik · ${exam.value.title}`)

const results = computed(() => attempt.value?.results ?? {})
const answers = computed(() => attempt.value?.answers ?? {})
const tasks = computed(() => data.value?.tasks ?? [])
const percent = computed(() => (attempt.value?.checkable_points ? Math.round((attempt.value.score / attempt.value.checkable_points) * 100) : 0))
const toReview = computed(() => Object.values(results.value).filter(r => r.status === 'unchecked').length)
const writingTasks = computed(() => tasks.value.filter(t => t.kind === 'writing'))
const answerTasks = computed(() => tasks.value.filter(t => t.kind !== 'writing'))
const writingPoints = computed(() => writingTasks.value.reduce((s, t) => s + t.points, 0))
// Polish extended is one essay and nothing we can check automatically: the AI essay score is the result.
const writingOnly = computed(() => answerTasks.value.length === 0)
const essayFeedback = computed(() => data.value?.essays.find(e => e.status === 'done' && e.feedback)?.feedback ?? null)
const aiGradable = computed(() => (exam.value ? aiGradableCount(exam.value, tasks.value, answers.value, results.value) : 0))
const sections = computed(() => [...sectionTotals(tasks.value, results.value)])

// Answers grouped by task block, with a filter.
const filter = ref('all')
const toneOf = t => resultTone(results.value[t.number])
const isReview = t => REVIEW_STATUSES.includes(results.value[t.number]?.status)
const counts = computed(() => ({
  all: answerTasks.value.length,
  wrong: answerTasks.value.filter(t => toneOf(t) !== 'ok').length,
  review: answerTasks.value.filter(isReview).length,
}))
const visibleGroups = computed(() => groupTasks(answerTasks.value)
  .map(g => ({ ...g, shown: g.tasks.filter(t => filter.value === 'all' || (filter.value === 'wrong' ? toneOf(t) !== 'ok' : isReview(t))) }))
  .filter(g => g.shown.length))
const groupAnswers = g => Object.fromEntries(g.tasks.map(t => [t.number, answers.value[t.number] ?? '']))
const groupNeedsHelp = g => g.tasks.some(t => toneOf(t) !== 'ok')

const TONE = {
  ok: { icon: Check, label: 'dobrze' },
  partial: { icon: Minus, label: 'częściowo' },
  review: { icon: CircleHelp, label: 'do porównania' },
  wrong: { icon: X, label: 'źle' },
}

// Self-check: the database saved it, now update the page locally (no reload).
function onGraded(number, points) {
  data.value = { ...data.value, attempt: applySelfGrade(data.value.attempt, number, points) }
}

// After AI grading: fetch the attempt (new points and reasons) and the rating again.
const refreshing = ref(false)
async function onAiGraded() {
  refreshing.value = true
  try {
    const [fresh, rating] = await Promise.all([getAttempt(attempt.value.id), myRating('open_grading', attempt.value.id)])
    if (fresh) data.value = { ...data.value, attempt: fresh, rating }
    ui.toast('Gotowe. AI zaproponowało punkty przy odpowiedziach otwartych.')
  } catch {
    ui.toast('Oceny są zapisane, ale nie udało się ich wczytać. Odśwież stronę.', 'error')
  } finally {
    refreshing.value = false
  }
}

const essayFor = t => data.value?.essays.find(e => e.task_number === t.number && e.status === 'done')?.id
</script>

<template>
  <PageSkeleton v-if="loading && !data" :rows="5" />
  <ErrorState v-else-if="error" @retry="reload" />
  <NotFound v-else-if="data?.missing" />
  <template v-else-if="exam && attempt">
    <nav class="breadcrumbs" aria-label="Okruszki">
      <RouterLink :to="ROUTES.exams">Arkusze</RouterLink><ChevronRight :size="13" />
      <RouterLink :to="examRoutes.overview(exam.id)">{{ exam.title }}</RouterLink><ChevronRight :size="13" />
      <span aria-current="page">Wynik</span>
    </nav>
    <header class="page-header">
      <div>
        <span class="page-kicker"><span class="status-dot"></span> {{ attempt.mode === 'exam' ? 'Egzamin na czas' : 'Tryb ćwiczeń' }}</span>
        <h1>{{ writingOnly ? 'Twoje wypracowanie' : 'Twój wynik' }}<span class="accent-dot">.</span></h1>
        <p>{{ exam.title }}</p>
      </div>
    </header>

    <!-- Score -->
    <section class="card card-dark score-card" aria-label="Wynik">
      <span class="score-icon" aria-hidden="true"><component :is="writingOnly ? PenLine : Trophy" :size="24" /></span>
      <div class="score-main">
        <template v-if="writingOnly">
          <template v-if="essayFeedback">
            <p class="score-value tabular">{{ essayFeedback.total }}<small>/{{ essayFeedback.max }} pkt</small></p>
            <p class="score-sub">według feedbacku AI (orientacyjnie)</p>
          </template>
          <p v-else class="score-sub is-lead">Do zdobycia {{ writingPoints }} pkt. Sprawdź wypracowanie z AI poniżej.</p>
        </template>
        <template v-else>
          <p class="score-value tabular">{{ attempt.score }}<small>/{{ attempt.checkable_points }} pkt</small></p>
          <p class="score-sub">{{ percent }}% zadań, które sprawdzamy automatycznie</p>
          <div class="progress is-lime score-bar" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100" aria-label="Wynik procentowy"><span :style="{ width: `${percent}%` }"></span></div>
          <p v-if="writingTasks.length" class="score-note">+ wypowiedź pisemna ({{ writingPoints }} pkt), którą sprawdzisz z AI poniżej.</p>
        </template>
        <p class="score-meta"><Clock3 :size="13" /> {{ formatDateTime(attempt.submitted_at) }}<template v-if="durationLabel(attempt.started_at, attempt.submitted_at)"> · czas: {{ durationLabel(attempt.started_at, attempt.submitted_at) }}</template></p>
      </div>
    </section>
    <p v-if="toReview > 0" class="alert alert-warn review-note" role="status" aria-live="polite">
      <CircleHelp :size="18" />
      <span>{{ toReview }} {{ toReview === 1 ? 'odpowiedź czeka' : 'odpowiedzi czekają' }} na Twoje porównanie z kluczem. Wynik może jeszcze wzrosnąć.</span>
    </p>

    <div v-if="sections.length" class="stat-grid section-tiles">
      <StatTile v-for="[section, s] in sections" :key="section" :label="SECTION_LABEL[section] ?? section" :value="`${s.got}/${s.max}`" :sub="s.max ? `${Math.round((s.got / s.max) * 100)}%` : ''" />
    </div>

    <div v-if="aiGradable > 0" class="ai-wrap">
      <AiGradeOpenAnswers :attempt-id="attempt.id" :count="aiGradable" :graded-at="attempt.ai_graded_at" :rating="data.rating" :refreshing="refreshing" @graded="onAiGraded" />
    </div>

    <!-- Answers with the key -->
    <section v-if="answerTasks.length" class="section-gap" aria-labelledby="answers-h">
      <div class="answers-head">
        <h2 id="answers-h" class="section-title">Odpowiedzi</h2>
        <div class="chip-group" role="group" aria-label="Pokaż odpowiedzi">
          <button type="button" class="chip" :aria-pressed="filter === 'all'" @click="filter = 'all'">Wszystkie · {{ counts.all }}</button>
          <button type="button" class="chip" :aria-pressed="filter === 'wrong'" :disabled="!counts.wrong" @click="filter = 'wrong'">Do poprawy · {{ counts.wrong }}</button>
          <button v-if="counts.review" type="button" class="chip" :aria-pressed="filter === 'review'" @click="filter = 'review'">Samoocena · {{ counts.review }}</button>
        </div>
      </div>
      <p v-if="!visibleGroups.length" class="muted">Nic tu nie ma. Wszystko dobrze!</p>
      <div class="answer-groups">
        <article v-for="g in visibleGroups" :key="g.key" class="card answer-group" :aria-label="`Zadanie ${g.no}. ${g.label}`">
          <header class="group-head">
            <h3>Zadanie {{ g.no }}. <span class="muted">{{ g.label }}</span></h3>
            <span class="badge">{{ SECTION_LABEL[g.section] ?? g.section }}</span>
          </header>
          <ul class="answer-list">
            <li v-for="t in g.shown" :key="t.number" class="answer" :class="`is-${toneOf(t)}`">
              <span class="answer-no">{{ t.number }}</span>
              <div class="answer-body">
                <p><span class="muted">Twoja: </span><span class="given" :class="{ 'is-empty': !answers[t.number]?.trim() }">{{ answers[t.number]?.trim() || 'brak odpowiedzi' }}</span></p>
                <p v-if="toneOf(t) !== 'ok' && results[t.number]"><span class="muted">Klucz: </span><strong>{{ results[t.number].answer }}</strong><span v-if="results[t.number].note" class="muted"> ({{ results[t.number].note }})</span></p>
                <p v-if="results[t.number]?.ai_reason !== undefined" class="ai-box">
                  <Sparkles :size="14" aria-hidden="true" />
                  <span>
                    <strong>AI: {{ results[t.number].ai_points }}/{{ results[t.number].max }} pkt</strong>
                    <span v-if="results[t.number].ai_uncertain" class="badge badge-warn uncertain">niepewne</span>
                    <span v-if="results[t.number].ai_reason" class="muted"> · {{ results[t.number].ai_reason }}</span>
                  </span>
                </p>
                <SelfCheck
                  v-if="isReview(t)" :attempt-id="attempt.id" :number="t.number" :current="results[t.number].status"
                  :max="results[t.number].max" :points="results[t.number].points" @graded="onGraded(t.number, $event)"
                />
              </div>
              <span v-if="results[t.number]" class="verdict tabular" :aria-label="TONE[toneOf(t)].label" :title="TONE[toneOf(t)].label">
                <component :is="TONE[toneOf(t)].icon" :size="14" aria-hidden="true" />
                <span aria-hidden="true">{{ toneOf(t) === 'review' ? '?' : `${results[t.number].points}/${results[t.number].max}` }}</span>
              </span>
            </li>
          </ul>
          <!-- One tutor button per task group, when something in it wasn't fully right -->
          <div v-if="groupNeedsHelp(g)" class="group-foot">
            <AskTutor small :exam-id="exam.id" :group-no="g.no" :label="`Zadanie ${g.no}. ${g.label}`" :answers="groupAnswers(g)" />
          </div>
        </article>
      </div>
    </section>

    <!-- Writing -->
    <section v-for="t in writingTasks" :key="t.number" class="section-gap" :aria-labelledby="`w-${t.number}`">
      <h2 :id="`w-${t.number}`" class="section-title">{{ exam.subject === 'polish' ? 'Wypracowanie' : 'Wypowiedź pisemna' }}</h2>
      <div v-if="answers[t.number]?.trim()" class="card writing-card">
        <p class="muted small">{{ countWords(answers[t.number]) }} wyrazów ({{ wordsRule(t.meta?.words).label }})</p>
        <p class="writing-text">{{ answers[t.number] }}</p>
      </div>
      <p v-else class="muted">Nie napisano wypowiedzi.</p>
      <ul v-if="t.meta?.rules?.length" class="writing-rules">
        <li v-for="r in t.meta.rules" :key="r">{{ r }}</li>
      </ul>
      <ul v-if="t.meta?.criteria?.length" class="criteria-list">
        <li v-for="c in t.meta.criteria" :key="c.name"><span>{{ c.name }}</span><span class="badge tabular">{{ c.points }} pkt</span></li>
      </ul>
      <div v-if="answers[t.number]?.trim()" class="writing-feedback">
        <ExamWritingFeedback :attempt-id="attempt.id" :task-number="t.number" :level="exam.level" :subject="exam.subject" :existing-essay-id="essayFor(t)" />
      </div>
    </section>

    <div class="result-actions">
      <RouterLink :to="examRoutes.practice(exam.id)" class="button button-outline"><RotateCcw :size="16" /> Spróbuj jeszcze raz</RouterLink>
      <RouterLink :to="examRoutes.overview(exam.id)" class="button button-dark">Wróć do arkusza <ArrowRight :size="16" /></RouterLink>
    </div>
    <p class="disclaimer">Wynik jest orientacyjny i nie jest oficjalną oceną CKE.</p>
  </template>
</template>

<style scoped>
.score-card { display: flex; gap: 18px; align-items: flex-start; padding: 28px; }
.score-icon { display: grid; place-items: center; width: 52px; height: 52px; flex-shrink: 0; border-radius: 14px; background: var(--lime); color: var(--green); }
.score-main { flex: 1; min-width: 0; }
.score-value { font-family: var(--heading); font-size: clamp(44px, 7vw, 60px); font-weight: 800; letter-spacing: -2px; line-height: 1; }
.score-value small { font-size: .42em; font-weight: 650; letter-spacing: -.3px; color: #c9d8c4; margin-left: 4px; }
.score-sub { margin-top: 8px; color: #c9d8c4; font-size: 15px; }
.score-sub.is-lead { margin-top: 4px; font-size: 18px; color: white; line-height: 1.5; }
.score-bar { margin-top: 14px; max-width: 420px; background: #ffffff22; }
.score-note { margin-top: 12px; font-size: 14px; color: #c9d8c4; }
.score-meta { display: flex; align-items: center; gap: 6px; margin-top: 14px; font-size: 13px; color: #a9bca6; }
.review-note { margin-top: 12px; }
.section-tiles { margin-top: 16px; }
.ai-wrap { margin-top: 20px; }
.answers-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 16px; margin-bottom: 14px; }
.answers-head .section-title { margin: 0; }
.answers-head .chip { min-height: 36px; padding: 6px 13px; font-size: 13px; }
.answer-groups { display: flex; flex-direction: column; gap: 12px; }
.answer-group { padding: 0; overflow: hidden; }
.group-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 18px; background: var(--surface-3); border-bottom: 1px solid var(--line); }
.group-head h3 { font-size: 16px; font-weight: 750; }
.group-head h3 .muted { font-weight: 550; }
.answer-list { list-style: none; margin: 0; padding: 0; }
.answer { display: flex; align-items: flex-start; gap: 12px; padding: 13px 18px; border-bottom: 1px solid var(--line); border-left: 3px solid transparent; }
.answer:last-child { border-bottom: 0; }
.answer.is-ok { border-left-color: var(--ok-line); }
.answer.is-partial, .answer.is-review { border-left-color: var(--warn-line); }
.answer.is-wrong { border-left-color: var(--error-line); }
.answer-no { width: 42px; flex-shrink: 0; font-family: var(--heading); font-weight: 750; padding-top: 1px; }
.answer-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; font-size: 14px; line-height: 1.55; overflow-wrap: anywhere; }
.given { font-weight: 650; white-space: pre-wrap; }
.is-ok .given { color: var(--ok); }
.is-wrong .given { color: var(--error); }
.is-partial .given, .is-review .given { color: var(--warn); }
.given.is-empty { color: var(--text-soft); font-weight: 450; }
.ai-box { display: flex; gap: 8px; align-items: flex-start; margin-top: 6px; padding: 9px 11px; border-radius: var(--radius-sm); background: var(--info-bg); border: 1px solid var(--info-line); }
.ai-box > svg { margin-top: 3px; color: var(--info); }
.uncertain { margin-left: 6px; }
.verdict { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; padding: 4px 9px; border-radius: 999px; border: 1px solid; font-size: 13px; font-weight: 750; }
.is-ok .verdict { background: var(--ok-bg); border-color: var(--ok-line); color: var(--ok); }
.is-partial .verdict, .is-review .verdict { background: var(--warn-bg); border-color: var(--warn-line); color: var(--warn); }
.is-wrong .verdict { background: var(--error-bg); border-color: var(--error-line); color: var(--error); }
.group-foot { padding: 12px 18px; border-top: 1px solid var(--line); background: #fcfdf9; }
.writing-card { margin-top: 4px; }
.writing-text { margin-top: 10px; white-space: pre-wrap; line-height: 1.75; font-size: 15px; overflow-wrap: anywhere; }
.writing-rules { margin: 14px 0 0; padding-left: 20px; font-size: 14px; line-height: 1.6; }
.criteria-list { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-width: 520px; }
.criteria-list li { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; color: var(--text-soft); }
.writing-feedback { margin-top: 18px; }
.result-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 40px; }
.disclaimer { margin-top: 20px; font-size: 12px; color: var(--text-soft); }
@media (max-width: 560px) {
  .score-card { flex-direction: column; gap: 14px; padding: 22px 20px; }
  .result-actions { grid-template-columns: 1fr; }
  .answer { padding-inline: 14px; gap: 10px; }
  .answer-no { width: 34px; }
  .group-head { padding-inline: 14px; }
}
</style>
