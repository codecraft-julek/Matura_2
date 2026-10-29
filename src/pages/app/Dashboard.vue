<script setup>
// The student's home (/panel): greeting, quick actions, last exam attempts, flashcards due today,
// what is left of the AI limits and the newest note. New students get friendly empty states with
// one clear next step instead of zeros.
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, ArrowUpRight, CalendarDays, FileText, Layers, MessageCircle, NotebookPen, Sparkles, WandSparkles, Zap } from '@lucide/vue'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'
import { ROUTES, examRoutes, noteRoute, studyRoute } from '@/config/routes'
import { count, plural, timeAgo } from '@/lib/format'
import { leftLabel } from '@/lib/billing/allowance'
import { SUBJECT_LABEL } from '@/lib/exams/labels'
import { loadDashboard } from '@/lib/api/dashboard'
import PageSkeleton from '@/ui/PageSkeleton.vue'
import ErrorState from '@/ui/ErrorState.vue'

const auth = useAuthStore()
const billing = useBillingStore()
const { data, loading, error, reload } = useAsync(() => loadDashboard())

const profile = computed(() => auth.profile)
const name = computed(() => profile.value?.display_name?.trim() || '')
const year = computed(() => (/^\d{4}$/.test(profile.value?.matura_year ?? '') ? Number(profile.value.matura_year) : null))

// Matura starts in early May; "ok." because the exact date is set by CKE each year.
const daysLeft = computed(() => {
  if (!year.value) return null
  const days = Math.ceil((new Date(year.value, 4, 4).getTime() - Date.now()) / 86_400_000)
  return days > 0 ? days : null
})

const greeting = (() => {
  const h = new Date().getHours()
  return h < 5 ? 'Dobry wieczór' : h < 12 ? 'Dzień dobry' : h < 18 ? 'Cześć' : 'Dobry wieczór'
})()

// AI limits: loaded separately so a slow/failed RPC never blocks the rest of the page.
const allowancesFailed = ref(false)
onMounted(() => { billing.loadAllowances().catch(() => { allowancesFailed.value = true }) })
const AI_FEATURES = [
  { key: 'essay_feedback', label: 'Sprawdzenia wypracowań', to: ROUTES.newEssay },
  { key: 'tutor', label: 'Wiadomości do tutora', to: ROUTES.tutor },
  { key: 'open_grading', label: 'Ocena odpowiedzi otwartych', to: ROUTES.exams },
  { key: 'notes', label: 'Notatki AI', to: ROUTES.newNote },
  { key: 'flashcards', label: 'Fiszki z AI', to: ROUTES.newDeck },
]
const limits = computed(() => AI_FEATURES.map(f => ({ ...f, a: billing.allowanceFor(f.key) })).filter(f => f.a))
const isFree = computed(() => limits.value.length > 0 && limits.value.every(f => f.a.plan === 'free'))

const flash = computed(() => data.value?.flashcards ?? { decks: 0, due: 0, byDeck: [] })
const studyTo = computed(() => (flash.value.byDeck[0] ? studyRoute(flash.value.byDeck[0].id) : ROUTES.flashcards))

const actions = computed(() => [
  { to: ROUTES.newEssay, label: 'Nowe wypracowanie', text: 'Feedback AI według kryteriów CKE', icon: WandSparkles, tone: 'purple' },
  { to: ROUTES.tutor, label: 'Zapytaj tutora', text: 'Podpowiedź zamiast gotowca', icon: MessageCircle, tone: 'purple' },
  { to: studyTo.value, label: 'Powtórz fiszki', text: flash.value.due ? `${count(flash.value.due, ['fiszka czeka', 'fiszki czekają', 'fiszek czeka'])}` : 'Pięć minut też się liczy', icon: Layers, tone: 'sand' },
  { to: ROUTES.exams, label: 'Rozwiąż arkusz', text: 'Prawdziwe arkusze CKE', icon: FileText, tone: 'green' },
])

const MODE = { exam: 'egzamin', practice: 'ćwiczenia' }
const NOTE_SUBJECT = { polish: 'polski', english: 'angielski', other: 'inne' }
const examName = a => (a.exam ? `${SUBJECT_LABEL[a.exam.subject] ?? a.exam.title} ${a.exam.year}, ${a.exam.level === 'extended' ? 'rozszerzony' : 'podstawowy'}` : 'Arkusz')
</script>

<template>
  <PageSkeleton v-if="loading && !data" :rows="4" />
  <ErrorState v-else-if="error" @retry="reload" />
  <div v-else-if="data" class="dashboard">
    <header class="page-header">
      <div>
        <span class="page-kicker">{{ greeting }}{{ name ? `, ${name}` : '' }} 👋</span>
        <h1>Ogarniamy maturę{{ year ? ` ${year}` : '' }} razem<span class="accent-dot">.</span></h1>
        <p>Wybierz jeden mały krok na dziś. Arkusz, wypracowanie, notatka czy fiszki: każdy się liczy.</p>
      </div>
      <span v-if="daysLeft" class="badge badge-lime countdown"><CalendarDays :size="14" /> ok. {{ count(daysLeft, ['dzień', 'dni', 'dni']) }} do matury</span>
    </header>

    <nav class="quick-actions" aria-label="Szybkie akcje">
      <RouterLink v-for="a in actions" :key="a.label" :to="a.to" class="quick-action" :class="`tone-${a.tone}`">
        <span class="qa-icon"><component :is="a.icon" :size="20" /></span>
        <span class="qa-text"><strong>{{ a.label }}</strong><small>{{ a.text }}</small></span>
        <ArrowUpRight :size="18" class="qa-arrow" />
      </RouterLink>
    </nav>

    <div class="dash-grid">
      <!-- Last exam attempts -->
      <section class="card dash-attempts" aria-labelledby="dash-attempts">
        <div class="row-between card-head">
          <h2 id="dash-attempts" class="section-title">Ostatnie arkusze</h2>
          <RouterLink v-if="data.attempts.length" :to="ROUTES.exams" class="link small">Wszystkie arkusze</RouterLink>
        </div>
        <ul v-if="data.attempts.length" class="list">
          <li v-for="a in data.attempts" :key="a.id">
            <RouterLink :to="examRoutes.result(a.exam_id, a.id)" class="list-row attempt-row">
              <span class="attempt-main">
                <strong>{{ examName(a) }}</strong>
                <span class="card-meta">{{ MODE[a.mode] ?? a.mode }} · {{ timeAgo(a.submitted_at) }}</span>
                <span v-if="a.percent !== null" class="progress" role="presentation"><span :style="{ width: `${a.percent}%` }"></span></span>
              </span>
              <span class="attempt-score tabular">
                <template v-if="a.checkable_points">{{ a.score }}<small>/{{ a.checkable_points }} pkt</small></template>
                <small v-else>wypracowanie</small>
              </span>
            </RouterLink>
          </li>
        </ul>
        <div v-else class="dash-empty">
          <FileText :size="22" />
          <p><strong>Jeszcze nic nie rozwiązane.</strong> Zacznij od jednego zadania w trybie ćwiczeń: od razu zobaczysz, co poszło dobrze według klucza CKE.</p>
          <RouterLink :to="ROUTES.exams" class="button button-dark button-sm">Wybierz arkusz <ArrowRight :size="16" /></RouterLink>
        </div>
      </section>

      <!-- Flashcards due today -->
      <section class="card card-sand dash-flash" aria-labelledby="dash-flash">
        <h2 id="dash-flash" class="section-title">Fiszki na dziś</h2>
        <template v-if="flash.decks">
          <p class="big-number tabular">{{ flash.due }}<small>{{ plural(flash.due, ['fiszka do powtórki', 'fiszki do powtórki', 'fiszek do powtórki']) }}</small></p>
          <ul v-if="flash.byDeck.length" class="deck-due">
            <li v-for="d in flash.byDeck.slice(0, 3)" :key="d.id">
              <RouterLink :to="studyRoute(d.id)"><span>{{ d.title }}</span><span class="badge">{{ d.due }}</span></RouterLink>
            </li>
          </ul>
          <p v-else class="card-meta">Wszystko powtórzone. Kolejne fiszki wrócą, kiedy będzie na nie pora.</p>
          <RouterLink :to="studyTo" class="button button-dark button-sm">{{ flash.due ? 'Zacznij powtórkę' : 'Moje talie' }} <ArrowRight :size="16" /></RouterLink>
        </template>
        <div v-else class="dash-empty">
          <Layers :size="22" />
          <p><strong>Nie masz jeszcze fiszek.</strong> Zrób talię z PDF-a, zdjęcia, strony albo filmu. Powtórki ułożą się same.</p>
          <RouterLink :to="ROUTES.newDeck" class="button button-dark button-sm">Nowa talia <ArrowRight :size="16" /></RouterLink>
        </div>
      </section>

      <!-- AI limits -->
      <section class="card card-purple dash-limits" aria-labelledby="dash-limits">
        <div class="row-between card-head">
          <h2 id="dash-limits" class="section-title">Twoje limity AI</h2>
          <span v-if="limits.length" class="badge" :class="isFree ? 'badge-info' : 'badge-dark'">{{ isFree ? 'plan darmowy' : 'Premium' }}</span>
        </div>
        <ul v-if="limits.length" class="limits">
          <li v-for="f in limits" :key="f.key">
            <div class="row-between">
              <RouterLink :to="f.to" class="limit-label">{{ f.label }}</RouterLink>
              <span class="limit-value tabular" :class="{ 'is-out': f.a.left === 0 }">{{ f.a.left }}/{{ f.a.max }}</span>
            </div>
            <span class="progress" role="presentation"><span :style="{ width: `${f.a.max ? (f.a.left / f.a.max) * 100 : 0}%` }"></span></span>
            <span class="card-meta">{{ f.a.left ? `${leftLabel(f.a)} ${f.a.left}` : f.a.period === 'week' ? 'Limit na ten tydzień wykorzystany.' : 'Dzisiejszy limit wykorzystany.' }}</span>
          </li>
        </ul>
        <p v-else-if="allowancesFailed" class="card-meta">Nie udało się wczytać limitów. Zobaczysz je przy każdym narzędziu AI.</p>
        <div v-else class="stack" style="--gap: 10px" aria-busy="true" aria-label="Ładowanie limitów">
          <div v-for="n in 4" :key="n" class="skeleton" style="height: 34px"></div>
        </div>
      </section>

      <!-- Latest note -->
      <section class="card dash-note" aria-labelledby="dash-note">
        <div class="row-between card-head">
          <h2 id="dash-note" class="section-title">Ostatnia notatka</h2>
          <RouterLink v-if="data.note" :to="ROUTES.notes" class="link small">Wszystkie notatki</RouterLink>
        </div>
        <RouterLink v-if="data.note" :to="noteRoute(data.note.id)" class="list-row note-row">
          <span class="note-icon"><NotebookPen :size="20" /></span>
          <span class="attempt-main">
            <strong>{{ data.note.title || 'Notatka bez tytułu' }}</strong>
            <span class="card-meta">{{ NOTE_SUBJECT[data.note.subject] ?? data.note.subject }} · {{ timeAgo(data.note.created_at) }}</span>
          </span>
          <span v-if="data.note.status === 'done'"><ArrowRight :size="18" /></span>
          <span v-else-if="data.note.interrupted || data.note.status === 'error'" class="badge badge-error">przerwane</span>
          <span v-else class="badge badge-warn">w trakcie…</span>
        </RouterLink>
        <div v-else class="dash-empty">
          <NotebookPen :size="22" />
          <p><strong>Zrób pierwszą notatkę.</strong> Wrzuć zdjęcie zeszytu, PDF albo prezentację, a dostaniesz oś czasu, mapę myśli, fiszki i quiz.</p>
          <RouterLink :to="ROUTES.newNote" class="button button-dark button-sm">Nowa notatka <ArrowRight :size="16" /></RouterLink>
        </div>
      </section>
    </div>

    <RouterLink v-if="isFree" :to="ROUTES.premium" class="premium-banner">
      <span class="pb-icon"><Zap :size="20" fill="currentColor" /></span>
      <span>
        <strong>Więcej AI z Premium</strong>
        <span>Codzienne sprawdzanie wypracowań, więcej notatek, fiszek i rozmów z tutorem. Arkusze zostają darmowe.</span>
      </span>
      <span class="button button-dark button-sm">Zobacz plany <Sparkles :size="15" /></span>
    </RouterLink>
  </div>
</template>

<style scoped>
.countdown { font-size: 12.5px; padding: 7px 12px; }
.quick-actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 22px; }
.quick-action { display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: var(--radius-lg); border: 1px solid var(--line); background: var(--surface); transition: transform .2s, box-shadow .2s, border-color .2s; min-width: 0; }
.quick-action:hover { transform: translateY(-2px); box-shadow: var(--shadow); border-color: var(--line-strong); }
.qa-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0; }
.tone-green .qa-icon { background: #e4edda; color: #607b48; }
.tone-purple .qa-icon { background: #e5dcf0; color: #87719e; }
.tone-sand .qa-icon { background: #eee6d5; color: #99885f; }
.qa-text { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
.qa-text strong { font-family: var(--heading); font-size: 15px; letter-spacing: -.3px; }
.qa-text small { font-size: 12.5px; color: var(--text-soft); line-height: 1.4; }
.qa-arrow { margin-left: auto; color: var(--text-soft); }

.dash-grid { display: grid; grid-template-columns: 1.25fr 1fr; gap: 16px; }
.card-head { margin-bottom: 14px; }
.card-head .section-title { margin-bottom: 0; }
.attempt-row { padding: 13px 15px; }
.attempt-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.attempt-main strong { font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.attempt-main .card-meta { margin-top: 0; }
.attempt-main .progress { margin-top: 8px; height: 6px; max-width: 260px; }
.attempt-score { font-family: var(--heading); font-size: 22px; font-weight: 750; letter-spacing: -.6px; white-space: nowrap; }
.attempt-score small { font-family: 'DM Sans Variable', sans-serif; font-size: 12px; font-weight: 500; color: var(--text-soft); letter-spacing: 0; margin-left: 2px; }

.big-number { font-family: var(--heading); font-size: 44px; font-weight: 750; letter-spacing: -2px; line-height: 1; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.big-number small { font-family: 'DM Sans Variable', sans-serif; font-size: 14px; letter-spacing: 0; font-weight: 500; color: var(--text-soft); }
.deck-due { list-style: none; padding: 0; margin: 16px 0; display: flex; flex-direction: column; gap: 6px; }
.deck-due a { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; background: #fffcf5; border: 1px solid #ede5d6; font-size: 14px; font-weight: 600; }
.deck-due a:hover { border-color: #dfd3be; }
.deck-due a > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dash-flash > .card-meta { margin: 14px 0 16px; }

.limits { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 14px; }
.limits li { display: flex; flex-direction: column; gap: 6px; }
.limits .card-meta { margin-top: 0; font-size: 12px; }
.limits .progress { background: #e2d9ee; height: 6px; }
.limits .progress > span { background: var(--info); }
.limit-label { font-size: 14px; font-weight: 650; }
.limit-label:hover { text-decoration: underline; text-underline-offset: 3px; }
.limit-value { font-size: 14px; font-weight: 700; }
.limit-value.is-out { color: var(--error); }

.note-row { gap: 12px; }
.note-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 11px; background: #f2fbd9; color: #5f7f2c; border: 1px solid #dcef9f; flex-shrink: 0; }

.dash-empty { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 18px; border-radius: var(--radius); border: 1px dashed var(--line-strong); background: #ffffff8c; }
.dash-empty > svg { color: var(--accent); }
.dash-empty p { font-size: 14px; line-height: 1.6; color: var(--text-soft); }
.dash-empty p strong { color: var(--text); }

.premium-banner { display: flex; align-items: center; gap: 16px; margin-top: 16px; padding: 18px 20px; border-radius: var(--radius-lg); background: var(--lime); color: var(--green); transition: transform .2s; }
.premium-banner:hover { transform: translateY(-2px); }
.premium-banner > span:nth-child(2) { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.premium-banner strong { font-family: var(--heading); font-size: 17px; letter-spacing: -.3px; }
.premium-banner > span:nth-child(2) > span { font-size: 14px; line-height: 1.5; color: #4d6427; }
.pb-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: var(--green); color: var(--lime); flex-shrink: 0; }

@media (max-width: 1000px) { .quick-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) {
  .dash-grid { grid-template-columns: 1fr; }
  .premium-banner { flex-wrap: wrap; }
  .premium-banner .button { width: 100%; }
}
@media (max-width: 420px) {
  .quick-actions { grid-template-columns: 1fr 1fr; gap: 8px; }
  .quick-action { flex-direction: column; align-items: flex-start; padding: 14px; gap: 10px; }
  .qa-arrow { display: none; }
  .qa-text strong { font-size: 14px; }
}
</style>
