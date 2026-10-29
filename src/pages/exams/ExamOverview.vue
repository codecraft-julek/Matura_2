<script setup>
// /arkusze/:examId — two modes (ćwiczenia / egzamin na czas), CKE materials, sections with points,
// the student's attempts.
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowRight, ChevronRight, Clock3, ExternalLink, FileText, Headphones, History, KeyRound, ListChecks, ScrollText, Timer } from '@lucide/vue'
import { examRoutes, ROUTES } from '@/config/routes'
import { useAsync } from '@/composables/useAsync'
import { usePageTitle } from '@/composables/usePageTitle'
import { getExam, listMyAttempts } from '@/lib/api/exams'
import { LEVEL_LABEL, SECTION_LABEL, SUBJECT_LABEL } from '@/lib/exams/labels'
import { count, formatDateTime } from '@/lib/format'
import { formatClock, isAnswered, loadSaved, secondsLeft, sectionPoints, storageKey } from '@/components/exams/sheet'
import NotFound from '@/pages/NotFound.vue'
import ErrorState from '@/ui/ErrorState.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'

const route = useRoute()
const examId = computed(() => String(route.params.examId))
const { data, loading, error, reload } = useAsync(async () => {
  const [found, attempts] = await Promise.all([getExam(examId.value), listMyAttempts(examId.value)])
  return found ? { ...found, attempts } : { missing: true }
}, { watch: examId })

const exam = computed(() => data.value?.exam)
usePageTitle(() => exam.value?.title)
const sections = computed(() => (data.value?.tasks ? sectionPoints(data.value.tasks) : []))

// Unfinished work on this device ("Kontynuuj"), read once per load.
const saved = computed(() => {
  if (!data.value?.tasks) return {}
  const answered = s => (s ? data.value.tasks.filter(t => isAnswered(t, s.answers[t.number])).length : 0)
  const practice = loadSaved(storageKey(examId.value, 'practice'))
  const timed = loadSaved(storageKey(examId.value, 'timed'))
  return {
    practice: answered(practice),
    timedLeft: timed?.startedAt ? secondsLeft(timed.startedAt, exam.value.duration_minutes) : null,
    timedAnswered: answered(timed),
  }
})

const materials = computed(() => {
  const e = exam.value
  if (!e) return []
  return [
    { href: e.sheet_url, label: e.sheet2_url ? 'Arkusz 1 (PDF)' : 'Arkusz (PDF)', icon: FileText },
    e.sheet2_url && { href: e.sheet2_url, label: 'Arkusz 2 (PDF)', icon: FileText },
    e.audio_url && { href: e.audio_url, label: 'Nagrania (MP3)', icon: Headphones },
    e.transcript_url && { href: e.transcript_url, label: 'Transkrypcja', icon: ScrollText },
    e.key_url && { href: e.key_url, label: 'Zasady oceniania', icon: KeyRound },
  ].filter(Boolean)
})
</script>

<template>
  <PageSkeleton v-if="loading && !data" />
  <ErrorState v-else-if="error" @retry="reload" />
  <NotFound v-else-if="data?.missing" />
  <template v-else-if="exam">
    <nav class="breadcrumbs" aria-label="Okruszki"><RouterLink :to="ROUTES.exams">Arkusze</RouterLink><ChevronRight :size="13" /><span aria-current="page">{{ exam.title }}</span></nav>
    <header class="page-header">
      <div>
        <span class="page-kicker"><span class="status-dot"></span> {{ SUBJECT_LABEL[exam.subject] }}</span>
        <h1 class="balance">{{ exam.title }}<span class="accent-dot">.</span></h1>
        <p>Poziom {{ LEVEL_LABEL[exam.level] }} · {{ exam.duration_minutes }} minut · {{ exam.max_points }} pkt</p>
      </div>
    </header>

    <div class="modes">
      <RouterLink :to="examRoutes.practice(exam.id)" class="card card-tinted card-link mode">
        <span class="mode-icon" aria-hidden="true"><ListChecks :size="22" /></span>
        <p class="mode-title">Tryb ćwiczeń</p>
        <p class="mode-text">Bez limitu czasu. Każde zadanie możesz sprawdzić od razu i zapytać tutora.</p>
        <p v-if="saved.practice" class="mode-saved">Masz zapisane odpowiedzi: {{ saved.practice }}</p>
        <span class="mode-go">{{ saved.practice ? 'Kontynuuj' : 'Zacznij ćwiczyć' }} <ArrowRight :size="16" /></span>
      </RouterLink>
      <RouterLink :to="examRoutes.timed(exam.id)" class="card card-dark card-link mode">
        <span class="mode-icon is-lime" aria-hidden="true"><Timer :size="22" /></span>
        <p class="mode-title">Egzamin na czas</p>
        <p class="mode-text">{{ exam.duration_minutes }} minut, wynik dopiero na końcu. Jak na prawdziwej maturze.</p>
        <p v-if="saved.timedLeft" class="mode-saved is-dark"><Clock3 :size="14" /> Egzamin trwa · zostało {{ formatClock(saved.timedLeft) }}</p>
        <p v-else-if="saved.timedLeft === 0 && saved.timedAnswered" class="mode-saved is-dark">Czas minął — otwórz, żeby oddać odpowiedzi.</p>
        <span class="mode-go">{{ saved.timedLeft ? 'Wróć do egzaminu' : 'Zacznij egzamin' }} <ArrowRight :size="16" /></span>
      </RouterLink>
    </div>

    <div class="overview-grid section-gap">
      <section aria-labelledby="sec-structure">
        <h2 id="sec-structure" class="section-title">Z czego składa się arkusz</h2>
        <ul class="list">
          <li v-for="s in sections" :key="s.section" class="list-row">
            <span><strong class="sec-name">{{ SECTION_LABEL[s.section] ?? s.section }}</strong><span class="muted small"> · {{ count(s.groups, ['zadanie', 'zadania', 'zadań']) }}</span></span>
            <span class="badge tabular">{{ s.points }} pkt</span>
          </li>
        </ul>
      </section>

      <section class="card card-tinted materials" aria-labelledby="sec-materials">
        <h2 id="sec-materials" class="card-title">Materiały CKE</h2>
        <p class="card-meta">W trakcie rozwiązywania wczytasz pobrany arkusz obok odpowiedzi. Możesz też otworzyć go w drugiej karcie albo wydrukować.</p>
        <ul class="material-list">
          <li v-for="m in materials" :key="m.href">
            <a :href="m.href" target="_blank" rel="noopener noreferrer" class="material"><component :is="m.icon" :size="16" /> {{ m.label }} <ExternalLink :size="13" class="material-ext" /><span class="sr-only">(otwiera się w nowej karcie)</span></a>
          </li>
        </ul>
      </section>
    </div>

    <section v-if="data.attempts.length" class="section-gap" aria-labelledby="sec-attempts">
      <h2 id="sec-attempts" class="section-title"><History :size="18" /> Twoje podejścia</h2>
      <ul class="list">
        <li v-for="a in data.attempts" :key="a.id">
          <RouterLink :to="examRoutes.result(exam.id, a.id)" class="list-row attempt">
            <span class="attempt-meta">
              <span class="badge" :class="a.mode === 'exam' ? 'badge-dark' : ''">{{ a.mode === 'exam' ? 'egzamin' : 'ćwiczenia' }}</span>
              <span class="muted small">{{ formatDateTime(a.submitted_at) }}</span>
            </span>
            <span class="attempt-score tabular">{{ a.checkable_points ? `${a.score}/${a.checkable_points} pkt` : 'wypracowanie' }} <ChevronRight :size="16" /></span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <p class="disclaimer">Arkusze i zasady oceniania pochodzą ze strony Centralnej Komisji Egzaminacyjnej (cke.gov.pl). Nie jesteśmy z CKE powiązani, a nasz wynik jest orientacyjny.</p>
  </template>
</template>

<style scoped>
.balance { text-wrap: balance; }
.modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.mode { display: flex; flex-direction: column; gap: 6px; padding: 24px; }
.mode-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--surface); color: var(--green); margin-bottom: 8px; }
.mode-icon.is-lime { background: var(--lime); }
.mode-title { font-family: var(--heading); font-size: 21px; font-weight: 750; letter-spacing: -.5px; }
.mode-text { font-size: 15px; line-height: 1.6; color: var(--text-soft); }
.card-dark .mode-text { color: #c9d8c4; }
.mode-saved { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; margin-top: 6px; padding: 5px 10px; border-radius: 999px; background: var(--surface); font-size: 13px; font-weight: 650; color: var(--green); }
.mode-saved.is-dark { background: #ffffff1a; color: var(--lime); }
.mode-go { display: inline-flex; align-items: center; gap: 6px; margin-top: auto; padding-top: 14px; font-weight: 700; font-size: 14px; }
.card-dark .mode-go { color: var(--lime); }
.overview-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 24px; align-items: start; }
.sec-name { font-weight: 650; }
.materials { display: flex; flex-direction: column; }
.material-list { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; margin: 14px 0 0; list-style: none; }
.material { display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 14px; font-weight: 650; transition: background .15s, border-color .15s; }
.material:hover { border-color: var(--green); background: var(--surface-2); }
.material-ext { color: var(--text-soft); }
.section-title { display: flex; align-items: center; gap: 8px; }
.attempt-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.attempt-score { display: inline-flex; align-items: center; gap: 6px; font-weight: 750; font-family: var(--heading); }
.disclaimer { margin-top: 40px; font-size: 12px; line-height: 1.6; color: var(--text-soft); }
@media (max-width: 760px) {
  .modes, .overview-grid { grid-template-columns: 1fr; }
}
</style>
