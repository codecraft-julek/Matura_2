<script setup>
// One public page per exam, e.g. /arkusze-maturalne/2025-maj-angielski-pp ("matura z angielskiego
// 2025 arkusz" on Google). Shows only the structure and the official CKE links, never exam texts
// or answers; solving happens in the app after logging in. Unknown id → 404 in place.
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowLeft, ArrowUpRight, Check, ExternalLink } from '@lucide/vue'
import publicExams from 'virtual:public-exams'
import { ROUTES, examRoutes, publicExamRoute } from '@/config/routes'
import { SITE } from '@/config/site'
import { SECTION_LABEL, SESSION_LABEL, SUBJECT_LABEL } from '@/lib/exams/labels'
import { LEVEL_SHORT, SUBJECT_FROM, examHeadline, tasksLabel } from '@/lib/exams/public'
import { useAuthStore } from '@/stores/auth'
import NotFound from '@/pages/NotFound.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { examJsonLd, examSeo } from './seo-exams'
import { useSeo } from './useSeo'

const route = useRoute()
const auth = useAuthStore()
const exam = computed(() => publicExams.find(e => e.id === route.params.examId) ?? null)

useSeo(() => exam.value && { ...examSeo(exam.value), jsonLd: examJsonLd(exam.value, SITE.url) })
usePageTitle(() => (exam.value ? null : 'Nie ma takiej strony'))

const KIND_LABEL = { choice: 'zamknięte', open: 'otwarte', writing: 'wypowiedź pisemna' }

const others = computed(() => publicExams.filter(e => e.id !== exam.value?.id && e.subject === exam.value?.subject).slice(0, 6))
const closedPoints = computed(() => exam.value?.groups.filter(g => g.kind === 'choice').reduce((s, g) => s + g.points, 0) ?? 0)
const hasOpen = computed(() => exam.value?.groups.some(g => g.kind === 'open'))
const hasWriting = computed(() => exam.value?.groups.some(g => g.kind === 'writing'))
// Points per section, e.g. "Rozumienie ze słuchu: 15 pkt".
const sections = computed(() => {
  const map = new Map()
  for (const g of exam.value?.groups ?? []) map.set(g.section, (map.get(g.section) ?? 0) + g.points)
  return [...map]
})
const stats = computed(() => exam.value && [
  ['punktów', exam.value.maxPoints],
  ['minut', exam.value.durationMinutes],
  [tasksLabel(exam.value.taskCount).replace(/^\d+ /, ''), exam.value.taskCount],
])
const materials = computed(() => {
  const s = exam.value?.sources ?? {}
  return [
    [exam.value?.subject === 'polish' && s.sheet2 ? 'Arkusz 1 (PDF)' : 'Arkusz (PDF)', s.sheet],
    ['Arkusz 2 – wypracowanie (PDF)', s.sheet2],
    ['Zasady oceniania (PDF)', s.key],
    ['Nagrania do rozumienia ze słuchu', s.audio],
  ].filter(([, href]) => href)
})
const words = g => (g.words ? ` · ${g.words[1] ? `${g.words[0]}–${g.words[1]}` : `min. ${g.words[0]}`} wyrazów` : '')
</script>

<template>
  <NotFound v-if="!exam" />
  <article v-else class="public-page public-exam">
    <nav class="breadcrumbs" aria-label="Ścieżka"><RouterLink :to="ROUTES.publicExams"><ArrowLeft :size="14" /> Arkusze maturalne</RouterLink><span aria-hidden="true">/</span><span>{{ exam.year }}</span></nav>

    <header class="exam-head">
      <span class="page-kicker">{{ SESSION_LABEL[exam.session] }} {{ exam.year }} · formuła 2023</span>
      <h1>{{ examHeadline(exam) }}<span class="accent-dot">.</span></h1>
      <p>Arkusz CKE z sesji: {{ SESSION_LABEL[exam.session] }} {{ exam.year }}, formuła 2023. {{ SUBJECT_LABEL[exam.subject] }}, poziom {{ LEVEL_SHORT[exam.level] }}.</p>
    </header>

    <dl class="stats">
      <div v-for="[label, n] in stats" :key="label" class="stat"><dt>{{ label }}</dt><dd class="tabular">{{ n }}</dd></div>
    </dl>

    <section class="solve-card" aria-labelledby="solve-heading">
      <h2 id="solve-heading">Rozwiąż ten arkusz online</h2>
      <ul>
        <li v-if="closedPoints > 0"><Check :size="17" /> zadania zamknięte ({{ closedPoints }} pkt) sprawdzamy od razu według klucza CKE</li>
        <li v-if="hasOpen"><Check :size="17" /> odpowiedzi otwarte porównasz z opisem punktacji{{ exam.subject === 'polish' ? ', a AI zaproponuje punkty' : '' }}</li>
        <li v-if="hasWriting"><Check :size="17" /> wypracowanie oceni AI według kryteriów CKE, z uwagami do poprawy</li>
        <li><Check :size="17" /> tryb egzaminu z zegarem albo spokojne ćwiczenia z podpowiedziami tutora AI</li>
      </ul>
      <div class="row solve-actions">
        <RouterLink v-if="auth.isLoggedIn" :to="examRoutes.overview(exam.id)" class="button button-lime">Otwórz arkusz <ArrowUpRight :size="17" /></RouterLink>
        <template v-else>
          <RouterLink :to="ROUTES.signup" class="button button-lime">Rozwiąż za darmo <ArrowUpRight :size="17" /></RouterLink>
          <RouterLink :to="examRoutes.overview(exam.id)" class="solve-login">Mam konto, otwórz arkusz</RouterLink>
        </template>
      </div>
    </section>

    <section class="section-gap" aria-labelledby="content-heading">
      <h2 id="content-heading" class="section-title">Co jest w arkuszu</h2>
      <ul class="sections">
        <li v-for="[section, points] in sections" :key="section" class="badge">{{ SECTION_LABEL[section] ?? section }}: <strong>{{ points }} pkt</strong></li>
      </ul>
      <!-- A task can come in two parts (e.g. closed + open), so g.no isn't unique. -->
      <ol class="list tasks">
        <li v-for="(g, i) in exam.groups" :key="i" class="list-row">
          <span class="task-main"><strong>Zadanie {{ g.no }}.</strong> {{ g.label }}<span class="card-meta">{{ KIND_LABEL[g.kind] }}{{ g.items > 1 ? ` · ${g.items} części` : '' }}{{ words(g) }}</span></span>
          <span class="task-points tabular">{{ g.points }} pkt</span>
        </li>
      </ol>
    </section>

    <section class="section-gap" aria-labelledby="materials-heading">
      <h2 id="materials-heading" class="section-title">Oficjalne materiały CKE</h2>
      <p class="muted">Treść zadań czytasz w oryginalnym arkuszu. Linki prowadzą prosto na cke.gov.pl.</p>
      <ul class="materials">
        <li v-for="[label, href] in materials" :key="href"><a :href="href" target="_blank" rel="noopener noreferrer" class="link">{{ label }} <ExternalLink :size="14" /><span class="sr-only"> (otwiera się w nowej karcie)</span></a></li>
      </ul>
    </section>

    <section v-if="others.length" class="section-gap" aria-labelledby="others-heading">
      <h2 id="others-heading" class="section-title">Inne arkusze {{ SUBJECT_FROM[exam.subject] }}</h2>
      <ul class="others">
        <li v-for="e in others" :key="e.id"><RouterLink :to="publicExamRoute(e.id)" class="list-row">{{ e.year }}, poziom {{ LEVEL_SHORT[e.level] }} <ArrowUpRight :size="16" /></RouterLink></li>
      </ul>
      <RouterLink :to="ROUTES.publicExams" class="link all-link">Wszystkie arkusze</RouterLink>
    </section>

    <p class="legal-note">Arkusze i zasady oceniania są własnością Centralnej Komisji Egzaminacyjnej. Nie jesteśmy powiązani z CKE; opisy zadań na tej stronie są nasze.</p>
  </article>
</template>

<style scoped>
.breadcrumbs a { display: inline-flex; align-items: center; gap: 6px; }
.exam-head h1 { font-size: clamp(30px, 5vw, 46px); line-height: 1.12; letter-spacing: -1.6px; font-weight: 750; }
.exam-head p { margin-top: 12px; color: var(--text-soft); font-size: 16px; line-height: 1.6; }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 26px 0 0; }
.stat { display: flex; flex-direction: column-reverse; align-items: center; padding: 14px 8px; border-radius: var(--radius-lg); background: var(--surface); border: 1px solid var(--line); text-align: center; }
.stat dt { font-size: 13px; color: var(--text-soft); }
.stat dd { margin: 0; font-family: var(--heading); font-size: 30px; font-weight: 750; letter-spacing: -1px; }
.solve-card { margin-top: 26px; padding: 26px; border-radius: var(--radius-lg); background: var(--green); color: white; }
.solve-card h2 { font-size: 23px; letter-spacing: -.6px; }
.solve-card ul { list-style: none; padding: 0; margin: 14px 0 0; display: flex; flex-direction: column; gap: 9px; color: #d3dfcf; font-size: 15px; line-height: 1.5; }
.solve-card li { display: flex; gap: 9px; align-items: flex-start; }
.solve-card li svg { color: var(--lime); margin-top: 2px; }
.solve-actions { margin-top: 22px; gap: 18px; }
.solve-login { color: white; font-weight: 650; text-decoration: underline; text-underline-offset: 3px; font-size: 14px; }
.solve-login:hover { color: var(--lime); }
.sections { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-wrap: wrap; gap: 8px; }
.sections .badge { font-size: 13px; font-weight: 550; padding: 6px 12px; }
.tasks { padding: 0; }
.task-main { min-width: 0; line-height: 1.5; }
.task-main .card-meta { display: block; margin-top: 2px; }
.task-points { font-weight: 750; white-space: nowrap; }
.materials { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-direction: column; gap: 10px; }
.materials a { display: inline-flex; align-items: center; gap: 6px; }
.others { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.others .list-row { font-weight: 650; }
.all-link { display: inline-block; margin-top: 16px; }
.legal-note { margin-top: 44px; font-size: 12.5px; line-height: 1.6; color: var(--text-soft); }
@media (max-width: 560px) {
  .others { grid-template-columns: 1fr; }
  .solve-card { padding: 22px 20px; }
  .stat dd { font-size: 25px; }
}
</style>
