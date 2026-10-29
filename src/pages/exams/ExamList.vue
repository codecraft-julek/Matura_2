<script setup>
// /arkusze — all exams by subject (the student's subjects first, the rest still shown),
// latest result per exam, filters by year and level (kept in the URL: ?rok=2025&poziom=basic).
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowUpRight, Clock3, FileText, Star } from '@lucide/vue'
import { examRoutes } from '@/config/routes'
import { useAsync } from '@/composables/useAsync'
import { listExams, listMyAttempts } from '@/lib/api/exams'
import { LEVEL_LABEL, SESSION_LABEL, SUBJECT_LABEL } from '@/lib/exams/labels'
import { useAuthStore } from '@/stores/auth'
import EmptyState from '@/ui/EmptyState.vue'
import ErrorState from '@/ui/ErrorState.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { data, loading, error, reload } = useAsync(async () => {
  const [exams, attempts] = await Promise.all([listExams(), listMyAttempts()])
  // Latest attempt per exam, to show "Ostatnio: 38/48 pkt".
  const latest = {}
  for (const a of attempts) latest[a.exam_id] ??= a
  return { exams, latest }
})

const mySubjects = computed(() => auth.profile?.subjects ?? [])
// Show the student's subjects first, but don't hide the rest.
const subjects = computed(() => ['polish', 'english'].sort((a, b) => Number(mySubjects.value.includes(b)) - Number(mySubjects.value.includes(a))))

const years = computed(() => [...new Set((data.value?.exams ?? []).map(e => e.year))].sort((a, b) => b - a))
const year = computed(() => (route.query.rok ? Number(route.query.rok) : null))
const level = computed(() => (['basic', 'extended'].includes(route.query.poziom) ? route.query.poziom : null))
const filtered = computed(() => (data.value?.exams ?? []).filter(e => (!year.value || e.year === year.value) && (!level.value || e.level === level.value)))
const hasFilters = computed(() => Boolean(year.value || level.value))

function setFilter(key, value) {
  const query = { ...route.query }
  if (value === null || value === undefined) delete query[key]
  else query[key] = String(value)
  router.replace({ query })
}
const clearFilters = () => router.replace({ query: {} })

function lastLabel(a) {
  return a.checkable_points ? `${a.score}/${a.checkable_points} pkt` : 'wypracowanie oddane'
}
const percent = a => (a.checkable_points ? Math.round((a.score / a.checkable_points) * 100) : 0)
</script>

<template>
  <PageSkeleton v-if="loading && !data" :rows="4" />
  <ErrorState v-else-if="error" @retry="reload" />
  <template v-else-if="data">
    <header class="page-header">
      <div>
        <span class="page-kicker"><span class="status-dot"></span> Arkusze CKE</span>
        <h1>Arkusze maturalne<span class="accent-dot">.</span></h1>
        <p>Prawdziwe arkusze CKE w formule 2023. Otwierasz oficjalny arkusz (PDF), a odpowiedzi zaznaczasz tutaj. Sprawdzimy je według klucza CKE.</p>
      </div>
    </header>

    <div class="filters" aria-label="Filtry arkuszy" role="region">
      <div class="filter">
        <span class="filter-label" id="f-year">Rok</span>
        <div class="chip-group" role="group" aria-labelledby="f-year">
          <button type="button" class="chip" :aria-pressed="!year" @click="setFilter('rok', null)">Wszystkie</button>
          <button v-for="y in years" :key="y" type="button" class="chip" :aria-pressed="year === y" @click="setFilter('rok', y)">{{ y }}</button>
        </div>
      </div>
      <div class="filter">
        <span class="filter-label" id="f-level">Poziom</span>
        <div class="chip-group" role="group" aria-labelledby="f-level">
          <button type="button" class="chip" :aria-pressed="!level" @click="setFilter('poziom', null)">Oba</button>
          <button v-for="l in ['basic', 'extended']" :key="l" type="button" class="chip" :aria-pressed="level === l" @click="setFilter('poziom', l)">{{ LEVEL_LABEL[l] }}</button>
        </div>
      </div>
    </div>

    <EmptyState v-if="hasFilters && !filtered.length" :icon="FileText" title="Brak arkuszy dla tych filtrów" text="Zmień rok albo poziom, żeby zobaczyć więcej arkuszy.">
      <button type="button" class="button button-dark" @click="clearFilters">Pokaż wszystkie</button>
    </EmptyState>

    <template v-else>
      <section v-for="subject in subjects" :key="subject" class="subject" :aria-labelledby="`s-${subject}`">
        <div class="subject-head">
          <h2 :id="`s-${subject}`" class="section-title">{{ SUBJECT_LABEL[subject] }}</h2>
          <span v-if="mySubjects.includes(subject)" class="badge badge-lime"><Star :size="12" fill="currentColor" /> Twój przedmiot</span>
        </div>
        <p v-if="!filtered.some(e => e.subject === subject)" class="subject-empty">
          {{ hasFilters ? 'Brak arkuszy z tego przedmiotu dla wybranych filtrów.' : 'Arkusze z tego przedmiotu dodajemy w najbliższym czasie.' }}
        </p>
        <ul v-else class="exam-grid">
          <li v-for="exam in filtered.filter(e => e.subject === subject)" :key="exam.id">
            <RouterLink :to="examRoutes.overview(exam.id)" class="card card-link exam-card" :class="{ 'is-mine': mySubjects.includes(subject) }">
              <div class="exam-tags">
                <span class="badge badge-dark tabular">{{ exam.year }}</span>
                <span class="badge">poziom {{ LEVEL_LABEL[exam.level] }}</span>
                <span class="muted small">{{ SESSION_LABEL[exam.session] }}</span>
              </div>
              <p class="card-title exam-title">{{ exam.title }}</p>
              <p class="card-meta"><Clock3 :size="13" /> {{ exam.duration_minutes }} min · {{ exam.max_points }} pkt</p>
              <div v-if="data.latest[exam.id]" class="exam-last">
                <div class="row-between small">
                  <span class="muted">Ostatnio</span>
                  <strong class="tabular">{{ lastLabel(data.latest[exam.id]) }}</strong>
                </div>
                <div v-if="data.latest[exam.id].checkable_points" class="progress is-lime" role="progressbar" :aria-valuenow="percent(data.latest[exam.id])" aria-valuemin="0" aria-valuemax="100" :aria-label="`Ostatni wynik: ${percent(data.latest[exam.id])}%`"><span :style="{ width: `${percent(data.latest[exam.id])}%` }"></span></div>
              </div>
              <span class="exam-go">{{ data.latest[exam.id] ? 'Rozwiąż ponownie' : 'Zacznij' }} <ArrowUpRight :size="15" /></span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </template>
</template>

<style scoped>
.filters { display: flex; flex-wrap: wrap; gap: 14px 28px; padding: 16px 18px; margin-bottom: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); }
.filter { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.filter-label { font-size: 12px; font-weight: 700; letter-spacing: .4px; color: var(--text-soft); }
.filter .chip { min-height: 38px; padding: 7px 14px; font-size: 13px; }
.subject { margin-top: 36px; }
.subject-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.subject-head .section-title { margin: 0; }
.subject-empty { padding: 18px 20px; border: 1px dashed var(--line-strong); border-radius: var(--radius-lg); color: var(--text-soft); font-size: 15px; }
.exam-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; padding: 0; margin: 0; list-style: none; }
.exam-grid > li { display: flex; }
.exam-card { display: flex; flex-direction: column; width: 100%; gap: 4px; }
.exam-card.is-mine { border-color: #d5e2c3; }
.exam-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; }
.exam-title { text-wrap: balance; }
.card-meta { display: flex; align-items: center; gap: 5px; }
.exam-last { display: flex; flex-direction: column; gap: 7px; margin-top: 14px; padding: 11px 12px; border-radius: var(--radius-sm); background: var(--surface-3); }
.exam-last strong { color: var(--green); }
.exam-go { display: inline-flex; align-items: center; gap: 5px; margin-top: auto; padding-top: 16px; font-size: 13px; font-weight: 700; color: var(--accent); }
.exam-card:hover .exam-go { color: var(--green); }
</style>
