<script setup>
// Public list of all exams (for Google and for visitors without an account). The data is the
// sanitized structure built from content/exams/*.json at build time: no answers ever ship here.
import { RouterLink } from 'vue-router'
import { ArrowUpRight, Clock, FileText, Trophy } from '@lucide/vue'
import publicExams from 'virtual:public-exams'
import { ROUTES, publicExamRoute } from '@/config/routes'
import { SITE } from '@/config/site'
import { SESSION_LABEL, SUBJECT_LABEL } from '@/lib/exams/labels'
import { LEVEL_SHORT, tasksLabel } from '@/lib/exams/public'
import { useAuthStore } from '@/stores/auth'
import { PAGE_SEO } from './seo'
import { examListJsonLd } from './seo-exams'
import { useSeo } from './useSeo'

useSeo(() => ({ ...PAGE_SEO.publicExams, jsonLd: examListJsonLd(publicExams, SITE.url) }))

const auth = useAuthStore()
const years = [...new Set(publicExams.map(e => e.year))]
const byYear = year => publicExams.filter(e => e.year === year)
</script>

<template>
  <div class="public-page is-wide public-exams">
    <header class="page-header">
      <div>
        <span class="page-kicker">Formuła 2023</span>
        <h1>Arkusze maturalne CKE z odpowiedziami<span class="accent-dot">.</span></h1>
        <p>Prawdziwe arkusze z polskiego i angielskiego. Czytasz oficjalny PDF z CKE, a odpowiedzi wpisujesz u nas: zadania zamknięte sprawdzamy od razu według klucza, a wypracowanie i odpowiedzi otwarte ocenia AI.</p>
      </div>
    </header>

    <section v-for="year in years" :key="year" class="year-block" :aria-labelledby="`rok-${year}`">
      <h2 :id="`rok-${year}`" class="section-title">Matura {{ year }}</h2>
      <ul class="exam-grid">
        <li v-for="e in byYear(year)" :key="e.id">
          <RouterLink :to="publicExamRoute(e.id)" class="card card-link exam-card" :class="e.subject === 'polish' ? 'card-tinted' : ''">
            <span class="exam-session">{{ SESSION_LABEL[e.session] }} {{ e.year }}</span>
            <span class="card-title">{{ SUBJECT_LABEL[e.subject] }}, poziom {{ LEVEL_SHORT[e.level] }}</span>
            <span class="exam-facts">
              <span><Trophy :size="14" /> {{ e.maxPoints }} pkt</span>
              <span><Clock :size="14" /> {{ e.durationMinutes }} min</span>
              <span><FileText :size="14" /> {{ tasksLabel(e.taskCount) }}</span>
            </span>
            <ArrowUpRight :size="18" class="exam-arrow" aria-hidden="true" />
          </RouterLink>
        </li>
      </ul>
    </section>

    <aside class="cta-box">
      <div>
        <h2>Rozwiązuj z automatycznym sprawdzaniem</h2>
        <p>Arkusze i sprawdzanie zadań zamkniętych są darmowe, bez limitu.</p>
      </div>
      <RouterLink v-if="auth.isLoggedIn" :to="ROUTES.exams" class="button button-dark">Przejdź do arkuszy <ArrowUpRight :size="17" /></RouterLink>
      <RouterLink v-else :to="ROUTES.signup" class="button button-dark">Załóż darmowe konto <ArrowUpRight :size="17" /></RouterLink>
    </aside>

    <p class="legal-note">Arkusze i zasady oceniania są własnością Centralnej Komisji Egzaminacyjnej i otwieramy je bezpośrednio z cke.gov.pl. Nie jesteśmy powiązani z CKE.</p>
  </div>
</template>

<style scoped>
.year-block { margin-top: 34px; }
.exam-grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.exam-grid li { min-width: 0; }
.exam-card { position: relative; display: flex; flex-direction: column; gap: 6px; height: 100%; padding: 20px 44px 20px 20px; }
.exam-session { font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--accent); }
.exam-facts { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 6px; font-size: 13px; color: var(--text-soft); }
.exam-facts span { display: inline-flex; align-items: center; gap: 5px; }
.exam-arrow { position: absolute; top: 18px; right: 16px; color: var(--text-soft); transition: transform .2s; }
.exam-card:hover .exam-arrow { transform: translate(2px, -2px); color: var(--green); }
.cta-box { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-top: 48px; padding: 26px 28px; border-radius: var(--radius-lg); background: var(--lime); color: var(--green); }
.cta-box h2 { font-size: 22px; letter-spacing: -.6px; }
.cta-box p { margin-top: 6px; color: #4d6427; font-size: 15px; }
.legal-note { margin-top: 28px; font-size: 12.5px; line-height: 1.6; color: var(--text-soft); max-width: 75ch; }
@media (max-width: 560px) { .cta-box { padding: 22px 20px; } .cta-box .button { width: 100%; } }
</style>
