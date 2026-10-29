<script setup>
// /arkusze/:examId/cwiczenia (mode 'practice') and /arkusze/:examId/egzamin (mode 'timed').
// Official PDF loads automatically on the left and scrolls to the task's page;
// one task block at a time on the right, with a map of all blocks.
//   practice: no timer; every block has "Sprawdź to zadanie" (grade_exam_answers) and "Zapytaj tutora"
//   timed:    countdown from a remembered start, auto-submit at 0, beforeunload warning, no checking/tutor
// Answers live in localStorage while solving (a refresh or lost connection doesn't wipe them) and are
// removed once the attempt is submitted (submit_exam_attempt → result page).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, ChevronDown, ChevronRight, Clock3, ExternalLink, FileText, ListChecks, LoaderCircle, PanelLeftClose, PanelLeftOpen, RotateCcw, Save, Timer, TriangleAlert } from '@lucide/vue'
import { examRoutes, ROUTES } from '@/config/routes'
import { useAsync } from '@/composables/useAsync'
import { usePageTitle } from '@/composables/usePageTitle'
import { checkTaskGroup, getExam, submitAttempt } from '@/lib/api/exams'
import { SECTION_LABEL, pts } from '@/lib/exams/labels'
import { useUiStore } from '@/stores/ui'
import {
  attemptMode, formatClock, groupAnswers, groupCheck, groupLocation, groupPoints, groupTasks, isAnswered,
  loadSaved, pageUrl, secondsLeft, storageKey, storeSaved,
} from '@/components/exams/sheet'
import ExamPdfViewer from '@/components/exams/ExamPdfViewer.vue'
import ListeningPlayer from '@/components/exams/ListeningPlayer.vue'
import QuestionMap from '@/components/exams/QuestionMap.vue'
import TaskInput from '@/components/exams/TaskInput.vue'
import AskTutor from '@/components/tutor/AskTutor.vue'
import NotFound from '@/pages/NotFound.vue'
import ErrorState from '@/ui/ErrorState.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'

const props = defineProps({ mode: { type: String, default: 'practice' } })
const timed = computed(() => props.mode === 'timed')
const modeLabel = computed(() => (timed.value ? 'Egzamin na czas' : 'Tryb ćwiczeń'))

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const examId = computed(() => String(route.params.examId))
const { data, loading, error, reload } = useAsync(async () => (await getExam(examId.value)) ?? { missing: true }, { watch: examId })
const exam = computed(() => data.value?.exam ?? null)
const tasks = computed(() => data.value?.tasks ?? [])
const groups = computed(() => groupTasks(tasks.value))
usePageTitle(() => exam.value && `${modeLabel.value} · ${exam.value.title}`)

// ---------- Session (answers, flags, checks) ----------
const key = computed(() => storageKey(examId.value, props.mode))
const answers = ref({})
const startedAt = ref(null)
const flags = ref([])
const checked = ref({}) // practice: number → TaskResult from grade_exam_answers
const activeKey = ref(null)
const storageOk = ref(true)
const ready = ref(false)
const started = computed(() => Boolean(startedAt.value))
let submitted = false

const activeIndex = computed(() => Math.max(0, groups.value.findIndex(g => g.key === activeKey.value)))
const current = computed(() => groups.value[activeIndex.value] ?? null)
const answeredCount = computed(() => tasks.value.filter(t => isAnswered(t, answers.value[t.number])).length)
const progress = computed(() => (tasks.value.length ? Math.round((answeredCount.value / tasks.value.length) * 100) : 0))

watch(data, () => {
  if (!exam.value) return
  const saved = loadSaved(key.value)
  answers.value = saved?.answers ?? {}
  flags.value = saved?.flags ?? []
  checked.value = timed.value ? {} : (saved?.checked ?? {})
  activeKey.value = groups.value.some(g => g.key === saved?.active) ? saved.active : (groups.value[0]?.key ?? null)
  startedAt.value = saved?.startedAt ?? (timed.value ? null : new Date().toISOString())
  submitted = false
  ready.value = true
  if (timed.value && startedAt.value && secondsLeft(startedAt.value, exam.value.duration_minutes) === 0) {
    // The time ran out while the student was away: hand in what they wrote; nothing written → start over.
    if (answeredCount.value > 0) { timeUp.value = true; submit(true) }
    else { startedAt.value = null; storeSaved(key.value, null) }
  }
})

function persist() {
  if (!ready.value || submitted || !startedAt.value) return
  storageOk.value = storeSaved(key.value, { answers: answers.value, startedAt: startedAt.value, flags: flags.value, checked: checked.value, active: activeKey.value })
}
watch([answers, flags, checked, activeKey, startedAt], persist, { deep: true })

function setAnswer(number, value) {
  answers.value = { ...answers.value, [number]: value }
  // Changing an answer hides its old check result.
  if (number in checked.value) {
    const next = { ...checked.value }
    delete next[number]
    checked.value = next
  }
}
function toggleFlag() {
  const k = current.value.key
  flags.value = flags.value.includes(k) ? flags.value.filter(f => f !== k) : [...flags.value, k]
}

// ---------- Navigation and focus ----------
const taskHeading = ref(null)
const tabsEl = ref(null)
async function goTo(index) {
  const g = groups.value[index]
  if (!g) return
  activeKey.value = g.key
  checkError.value = ''
  if (!isSplit.value) mapOpen.value = false
  await nextTick()
  if (isSplit.value || mobileView.value === 'task') {
    taskHeading.value?.focus({ preventScroll: true })
    const top = taskHeading.value?.getBoundingClientRect().top ?? 0
    if (top < 150 || top > window.innerHeight - 120) taskHeading.value?.closest('.task-col')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// ---------- PDF split view ----------
const PANEL_KEY = 'om:exam-pdf-panel'
const wrapper = ref(null)
const isSplit = ref(window.innerWidth >= 960) // corrected by the ResizeObserver below
const mobileView = ref('task') // phones / narrow: 'task' | 'pdf'
const pdfVisible = ref(true) // wide screens: the student can hide the PDF column
try { pdfVisible.value = window.localStorage.getItem(PANEL_KEY) !== 'hidden' } catch {}
const mapOpen = ref(false) // narrow screens: the map is folded so the task stays near the top
const pdfSheet = ref(1)
const pdfLoaded = ref({})
const viewers = {}
const showPdf = computed(() => (isSplit.value ? pdfVisible.value : mobileView.value === 'pdf'))
const showTask = computed(() => isSplit.value || mobileView.value === 'task')

const sheets = computed(() => {
  const e = exam.value
  if (!e) return []
  const minPages = no => Math.max(1, ...groups.value.map(groupLocation).filter(l => l?.sheet === no).map(l => l.page))
  return [
    { no: 1, url: e.sheet_url, label: e.sheet2_url ? 'Arkusz 1' : 'Arkusz', minPages: minPages(1) },
    e.sheet2_url && { no: 2, url: e.sheet2_url, label: 'Arkusz 2', minPages: minPages(2) },
  ].filter(Boolean)
})
const location = computed(() => (current.value ? groupLocation(current.value) : null))
const locationSheet = computed(() => sheets.value.find(s => s.no === location.value?.sheet) ?? sheets.value[0])
watch(location, loc => { if (loc && sheets.value.some(s => s.no === loc.sheet)) pdfSheet.value = loc.sheet })
const targetFor = sheetNo => (location.value?.sheet === sheetNo && current.value ? { page: location.value.page, title: `Zadanie ${current.value.no}` } : null)

function togglePdf() {
  pdfVisible.value = !pdfVisible.value
  try { window.localStorage.setItem(PANEL_KEY, pdfVisible.value ? 'shown' : 'hidden') } catch {}
}
async function showInSheet() {
  const loc = location.value
  if (!loc) return
  pdfSheet.value = loc.sheet
  if (isSplit.value) pdfVisible.value = true
  else mobileView.value = 'pdf'
  await nextTick()
  await viewers[loc.sheet]?.jumpToTarget()
  if (!isSplit.value) tabsEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function setMobileView(view) {
  mobileView.value = view
  if (view === 'task') nextTick(() => taskHeading.value?.focus({ preventScroll: true }))
}

// Split view only when there is room (the docked tutor takes 28rem on the right).
let resizeObserver = null
watch(wrapper, el => {
  resizeObserver?.disconnect()
  if (!el) return
  resizeObserver ??= new ResizeObserver(([entry]) => { isSplit.value = entry.contentRect.width >= 900 })
  resizeObserver.observe(el)
}, { flush: 'post' })

// ---------- Practice: check one block ----------
const checking = ref(null)
const checkError = ref('')
const liveMessage = ref('')
const currentCheck = computed(() => (current.value ? groupCheck(current.value, checked.value) : null))
const isWriting = computed(() => current.value?.tasks[0]?.kind === 'writing')

async function checkCurrent() {
  const g = current.value
  checking.value = g.key
  checkError.value = ''
  const res = await checkTaskGroup(examId.value, g.no, groupAnswers(g, answers.value))
  checking.value = null
  if (!res.ok) { checkError.value = res.error; return }
  // Only keep results for this block (a group number can span two blocks).
  checked.value = { ...checked.value, ...Object.fromEntries(g.tasks.map(t => [t.number, res.results[t.number]]).filter(([, r]) => r)) }
  const summary = groupCheck(g, checked.value)
  liveMessage.value = summary ? `Zadanie ${g.no} sprawdzone: ${summary.got} z ${summary.max} pkt${summary.review ? ', część odpowiedzi do porównania z kluczem' : ''}.` : ''
}
const checkTitle = c => (c.tone === 'ok' ? 'Wszystko dobrze. Ogarniasz to!' : c.review ? 'Porównaj z kluczem' : c.tone === 'warn' ? 'Prawie. Zobacz, co poprawić.' : 'To dobry moment na małą powtórkę.')

// ---------- Timed: countdown ----------
const now = ref(Date.now())
const timeUp = ref(false)
const left = computed(() => (exam.value && startedAt.value ? secondsLeft(startedAt.value, exam.value.duration_minutes, now.value) : 0))
const timeShare = computed(() => (exam.value && startedAt.value ? Math.min(100, Math.round((1 - left.value / (exam.value.duration_minutes * 60)) * 100)) : 0))
const timerLabel = computed(() => formatClock(left.value))
let ticker = null
const ANNOUNCE = { 900: 'Zostało 15 minut.', 300: 'Zostało 5 minut.', 60: 'Została minuta.' }
const announced = new Set()

watch([timed, started], ([isTimed, isStarted]) => {
  clearInterval(ticker)
  if (isTimed && isStarted) ticker = setInterval(() => { now.value = Date.now() }, 1000)
}, { immediate: true })
watch(left, value => {
  if (!timed.value || !started.value || !ready.value || submitted) return
  for (const [at, text] of Object.entries(ANNOUNCE)) if (value <= Number(at) && value > 0 && !announced.has(at) && value > Number(at) - 5) { announced.add(at); liveMessage.value = text }
  if (value === 0 && !timeUp.value) {
    timeUp.value = true
    liveMessage.value = 'Czas minął. Oddajemy Twoje odpowiedzi.'
    submit(true)
  }
})
async function startExam() {
  startedAt.value = new Date().toISOString()
  now.value = Date.now()
  await nextTick()
  taskHeading.value?.focus({ preventScroll: true })
}

// Warn before closing the tab in the middle of a timed exam.
function onBeforeUnload(e) {
  if (timed.value && started.value && !submitted && answeredCount.value > 0) { e.preventDefault(); e.returnValue = '' }
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => { window.removeEventListener('beforeunload', onBeforeUnload); clearInterval(ticker); resizeObserver?.disconnect() })
onBeforeRouteLeave(async () => {
  if (!timed.value || !started.value || submitted || timeUp.value || !answeredCount.value) return true
  return ui.confirm({
    title: 'Wychodzisz z egzaminu?',
    body: 'Odpowiedzi zostają zapisane na tym urządzeniu, ale czas egzaminu płynie dalej.',
    confirmLabel: 'Wyjdź',
    cancelLabel: 'Zostaję',
  })
})

// ---------- Submit ----------
const submitting = ref(false)
const submitError = ref('')
async function submit(force = false) {
  if (submitting.value || submitted || !startedAt.value) return
  const missing = tasks.value.length - answeredCount.value
  if (!force && missing > 0) {
    const ok = await ui.confirm({
      title: 'Zostawiasz coś na później?',
      body: `Bez odpowiedzi: ${missing} z ${tasks.value.length}. Pominięte zadania dostaną 0 pkt. Na pewno kończysz?`,
      confirmLabel: 'Tak, kończę',
      cancelLabel: 'Wracam do zadań',
    })
    if (!ok) return
  }
  submitting.value = true
  submitError.value = ''
  const payload = Object.fromEntries(tasks.value.map(t => [t.number, answers.value[t.number] ?? '']).filter(([, v]) => v !== ''))
  const res = await submitAttempt(examId.value, attemptMode(props.mode), payload, startedAt.value)
  if (!res.ok) {
    submitting.value = false
    submitError.value = res.error
    return
  }
  submitted = true
  clearInterval(ticker)
  storeSaved(key.value, null)
  router.replace(examRoutes.result(examId.value, res.attemptId))
}

// ---------- Practice: start over ----------
async function resetPractice() {
  const ok = await ui.confirm({ title: 'Zaczynamy od nowa?', body: 'Usuniesz odpowiedzi i sprawdzenia z tego arkusza, tylko na tym urządzeniu.', confirmLabel: 'Tak, od nowa', danger: true })
  if (!ok) return
  answers.value = {}
  checked.value = {}
  flags.value = []
  startedAt.value = new Date().toISOString()
  goTo(0)
}
</script>

<template>
  <PageSkeleton v-if="loading && !data" :rows="4" />
  <ErrorState v-else-if="error" @retry="reload" />
  <NotFound v-else-if="data?.missing" />
  <div v-else-if="exam && current" ref="wrapper" class="solve" :class="{ 'is-timed': timed }">
    <nav class="breadcrumbs" aria-label="Okruszki">
      <RouterLink :to="ROUTES.exams">Arkusze</RouterLink><ChevronRight :size="13" />
      <RouterLink :to="examRoutes.overview(exam.id)">{{ exam.title }}</RouterLink><ChevronRight :size="13" />
      <span aria-current="page">{{ modeLabel }}</span>
    </nav>

    <header class="solve-head">
      <div>
        <span class="page-kicker"><component :is="timed ? Timer : ListChecks" :size="13" /> {{ timed ? 'Jak na maturze' : 'Bez limitu czasu' }}</span>
        <h1>{{ modeLabel }}<span class="accent-dot">.</span></h1>
        <p class="muted">{{ exam.title }} · {{ exam.duration_minutes }} min · {{ exam.max_points }} pkt</p>
      </div>
      <div class="head-actions">
        <span class="save-note" :class="{ 'is-off': !storageOk }"><Save :size="13" />{{ storageOk ? 'Odpowiedzi zapisują się na tym urządzeniu' : 'Zapis niedostępny — nie zamykaj tej karty przed oddaniem' }}</span>
        <div class="row" style="--gap: 6px">
          <button v-if="!timed" type="button" class="button button-ghost button-sm" @click="resetPractice"><RotateCcw :size="15" /> Od nowa</button>
          <button v-if="isSplit" type="button" class="button button-outline button-sm" :aria-pressed="pdfVisible" @click="togglePdf">
            <component :is="pdfVisible ? PanelLeftClose : PanelLeftOpen" :size="15" /> {{ pdfVisible ? 'Ukryj arkusz' : 'Pokaż arkusz' }}
          </button>
        </div>
      </div>
    </header>

    <p class="sr-only" aria-live="polite" role="status">{{ liveMessage }}</p>

    <div v-if="started" class="solve-strip">
      <div class="strip-progress">
        <div class="strip-row"><span><strong class="tabular">{{ answeredCount }}</strong><span class="muted">/{{ tasks.length }} odpowiedzi</span></span><span class="muted small tabular">{{ progress }}%</span></div>
        <div class="progress" role="progressbar" aria-label="Udzielone odpowiedzi" :aria-valuenow="answeredCount" aria-valuemin="0" :aria-valuemax="tasks.length"><span :style="{ width: `${progress}%` }"></span></div>
      </div>
      <div v-if="timed" class="strip-timer" :class="{ 'is-low': left < 300 }">
        <div class="strip-row">
          <span class="timer-value tabular" role="timer" aria-label="Pozostały czas" aria-live="off"><Clock3 :size="16" /> {{ timerLabel }}</span>
          <span class="muted small">zostało</span>
        </div>
        <div class="progress time-bar" role="progressbar" aria-label="Upływ czasu egzaminu" :aria-valuenow="timeShare" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${timeShare}%` }"></span></div>
      </div>
      <button type="button" class="button button-dark button-sm strip-submit" :disabled="submitting" :aria-busy="submitting" @click="submit(timeUp)">
        <LoaderCircle v-if="submitting" :size="15" class="spin" /> {{ submitting ? 'Sprawdzam…' : 'Zakończ' }}<span v-if="!submitting" class="hide-xs">&nbsp;i sprawdź</span>
      </button>
    </div>

    <div v-if="timeUp" class="alert alert-warn solve-alert" role="alert"><TriangleAlert :size="18" /><span>Czas egzaminu minął. {{ submitError ? 'Nie udało się oddać odpowiedzi — spróbuj ponownie przyciskiem „Zakończ i sprawdź”.' : 'Oddajemy Twoje odpowiedzi…' }}</span></div>
    <div v-if="submitError" class="alert alert-error solve-alert" role="alert">{{ submitError }}</div>

    <section v-if="started" class="card map-card" aria-label="Zadania">
      <button v-if="!isSplit" type="button" class="map-toggle" :aria-expanded="mapOpen" aria-controls="solve-map" @click="mapOpen = !mapOpen">
        <span>Wszystkie zadania <span class="muted">· {{ activeIndex + 1 }} z {{ groups.length }}</span></span><ChevronDown :size="16" class="map-chevron" />
      </button>
      <div v-show="isSplit || mapOpen" id="solve-map" class="map-body">
      <QuestionMap :groups="groups" :active-index="activeIndex" :answers="answers" :flags="flags" :checked="checked" @go="goTo" />
      <p class="map-legend small muted" aria-hidden="true">
        <span><i class="lg is-answered"></i> odpowiedziane</span>
        <span><i class="lg is-flagged"><Bookmark :size="9" fill="currentColor" /></i> do powrotu</span>
        <template v-if="!timed"><span><i class="lg is-ok"></i> sprawdzone</span><span><i class="lg is-warn"></i> częściowo</span><span><i class="lg is-error"></i> do poprawy</span></template>
      </p>
      </div>
    </section>

    <div v-if="!isSplit" ref="tabsEl" class="mobile-tabs" role="group" aria-label="Wybierz widok">
      <button type="button" :class="{ 'is-active': mobileView === 'task' }" :aria-pressed="mobileView === 'task'" @click="setMobileView('task')"><ListChecks :size="16" /> {{ started ? `Zadanie ${current.no}` : 'Start' }}</button>
      <button type="button" :class="{ 'is-active': mobileView === 'pdf' }" :aria-pressed="mobileView === 'pdf'" @click="setMobileView('pdf')"><FileText :size="16" /> {{ pdfLoaded[pdfSheet] ? `Arkusz${location ? ` · str. ${location.page}` : ''}` : 'Arkusz' }}</button>
    </div>

    <div class="solve-layout" :class="{ 'is-split': isSplit && pdfVisible, 'is-single': isSplit && !pdfVisible }">
      <aside v-show="showPdf" class="pdf-col" aria-label="Arkusz CKE">
        <div v-if="sheets.length > 1" class="tabs sheet-tabs" role="tablist" aria-label="Który arkusz">
          <button v-for="s in sheets" :key="s.no" type="button" role="tab" :aria-selected="pdfSheet === s.no" @click="pdfSheet = s.no">{{ s.label }}</button>
        </div>
        <div v-if="!isSplit && started" class="pdf-pager">
          <button type="button" class="icon-button" :disabled="activeIndex === 0" aria-label="Poprzednie zadanie" @click="goTo(activeIndex - 1)"><ArrowLeft :size="16" /></button>
          <span>Zadanie {{ current.no }} · {{ activeIndex + 1 }} z {{ groups.length }}</span>
          <button type="button" class="icon-button" :disabled="activeIndex === groups.length - 1" aria-label="Następne zadanie" @click="goTo(activeIndex + 1)"><ArrowRight :size="16" /></button>
        </div>
        <ExamPdfViewer
          v-for="s in sheets" v-show="pdfSheet === s.no" :key="`${exam.id}:${s.no}:${s.url}`"
          :ref="c => { if (c) viewers[s.no] = c; else delete viewers[s.no] }"
          :exam-id="exam.id" :sheet-no="s.no" :url="s.url" :label="s.label" :min-pages="s.minPages"
          :target="targetFor(s.no)" :active="showPdf && pdfSheet === s.no"
          @loaded="pdfLoaded = { ...pdfLoaded, [s.no]: $event }"
        />
      </aside>

      <div v-show="showTask" class="task-col">
        <!-- Timed: a start screen, so the student can load the PDF before the clock runs -->
        <section v-if="!started" class="card intro" aria-labelledby="task-heading">
          <span class="intro-icon" aria-hidden="true"><Timer :size="24" /></span>
          <h2 id="task-heading" ref="taskHeading" tabindex="-1">Gotowy na {{ exam.duration_minutes }} minut?</h2>
          <ul class="intro-list">
            <li>Czas liczy się od kliknięcia „Zaczynam”. Nie da się go zatrzymać.</li>
            <li>Gdy czas się skończy, oddamy Twoje odpowiedzi automatycznie.</li>
            <li>Bez sprawdzania i tutora — wynik zobaczysz na końcu, jak na maturze.</li>
            <li>Odpowiedzi zapisują się na tym urządzeniu, więc odświeżenie strony ich nie skasuje.</li>
          </ul>
          <p v-if="!pdfLoaded[1]" class="intro-pdf"><FileText :size="16" /> Arkusz wczytuje się automatycznie {{ isSplit && pdfVisible ? 'obok' : 'w zakładce „Arkusz”' }}. Przed uruchomieniem czasu sprawdź, czy jest gotowy.</p>
          <button type="button" class="button button-lime button-large" @click="startExam">Zaczynam egzamin <ArrowRight :size="18" /></button>
        </section>

        <template v-else>
          <div class="task-topline">
            <span>ZADANIE {{ current.no }} <span class="muted">· {{ activeIndex + 1 }} z {{ groups.length }}</span></span>
            <button type="button" class="flag-btn" :class="{ 'is-on': flags.includes(current.key) }" :aria-pressed="flags.includes(current.key)" @click="toggleFlag">
              <Bookmark :size="15" :fill="flags.includes(current.key) ? 'currentColor' : 'none'" /> {{ flags.includes(current.key) ? 'Wrócę do tego' : 'Oznacz do powrotu' }}
            </button>
          </div>

          <ListeningPlayer v-if="exam.audio_url && groups.some(g => g.section === 'listening')" v-show="current.section === 'listening'" :src="exam.audio_url" class="task-audio" />

          <section class="card task-card" aria-labelledby="task-heading">
            <div class="task-meta">
              <span class="badge">{{ SECTION_LABEL[current.section] ?? current.section }}</span>
              <span class="muted small tabular">{{ pts(groupPoints(current)) }}</span>
            </div>
            <h2 id="task-heading" ref="taskHeading" tabindex="-1">Zadanie {{ current.no }}. <span class="task-label">{{ current.label }}</span></h2>
            <p v-if="current.meta.hint" class="task-hint">{{ current.meta.hint }}</p>
            <div v-if="location" class="task-source">
              <button type="button" class="source-btn" @click="showInSheet"><BookOpen :size="15" /> Pokaż w {{ locationSheet.no === 2 ? 'Arkuszu 2' : 'arkuszu' }} · str. {{ location.page }}</button>
              <a :href="pageUrl(locationSheet.url, location.page)" target="_blank" rel="noopener noreferrer" class="source-ext">w nowej karcie <ExternalLink :size="12" /></a>
            </div>

            <fieldset class="task-inputs" :disabled="timeUp || submitting">
              <legend class="sr-only">Odpowiedzi do zadania {{ current.no }}</legend>
              <TaskInput
                v-for="t in current.tasks" :key="t.number" :task="t" :subject="exam.subject"
                :model-value="answers[t.number] ?? ''" :result="timed ? null : checked[t.number]"
                @update:model-value="setAnswer(t.number, $event)"
              />
            </fieldset>

            <!-- Practice only: no checking or tutor help during the timed exam -->
            <template v-if="!timed">
              <div v-if="currentCheck" class="check-summary" :class="`is-${currentCheck.tone}`">
                <strong>{{ checkTitle(currentCheck) }}</strong>
                <span class="tabular">{{ currentCheck.got }} / {{ currentCheck.max }} pkt w tym zadaniu</span>
              </div>
              <p v-if="checkError" class="field-error" role="alert">{{ checkError }}</p>
              <div class="task-actions">
                <button v-if="!isWriting" type="button" class="button button-dark button-sm" :disabled="checking === current.key" :aria-busy="checking === current.key" @click="checkCurrent">
                  <LoaderCircle v-if="checking === current.key" :size="15" class="spin" /> {{ checking === current.key ? 'Sprawdzam…' : currentCheck ? 'Sprawdź jeszcze raz' : 'Sprawdź to zadanie' }}
                </button>
                <AskTutor :key="current.key" :exam-id="exam.id" :group-no="current.no" :label="`Zadanie ${current.no}. ${current.label}`" :answers="groupAnswers(current, answers)" />
              </div>
            </template>
          </section>

          <div class="pager">
            <button type="button" class="button button-ghost button-sm" :disabled="activeIndex === 0" @click="goTo(activeIndex - 1)"><ArrowLeft :size="16" /> Poprzednie</button>
            <span class="muted small tabular">{{ activeIndex + 1 }} z {{ groups.length }}</span>
            <button v-if="activeIndex < groups.length - 1" type="button" class="button button-outline button-sm" @click="goTo(activeIndex + 1)">Następne <ArrowRight :size="16" /></button>
            <button v-else type="button" class="button button-dark button-sm" :disabled="submitting" @click="submit(timeUp)">Zakończ i sprawdź <ArrowRight :size="16" /></button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.solve { --strip-top: 70px; }
.solve-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap; margin-bottom: 18px; }
.solve-head h1 { font-size: clamp(28px, 3.6vw, 36px); line-height: 1.15; letter-spacing: -1.3px; font-weight: 750; }
.solve-head p { margin-top: 6px; font-size: 14px; }
.head-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.save-note { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-soft); }
.save-note.is-off { color: var(--warn); font-weight: 650; }

.solve-strip { position: sticky; top: var(--strip-top); z-index: 20; display: flex; align-items: center; gap: 14px 26px; padding: 12px 16px; margin-bottom: 12px; background: #fafbf7f2; backdrop-filter: blur(14px); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow-sm); }
.strip-progress { flex: 1; min-width: 150px; max-width: 320px; }
.strip-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 7px; font-size: 14px; }
.strip-timer { flex: 1; min-width: 150px; max-width: 320px; }
.timer-value { display: inline-flex; align-items: center; gap: 6px; font-family: var(--heading); font-size: 20px; font-weight: 750; letter-spacing: -.3px; color: var(--green); }
.time-bar > span { background: #9cc35a; }
.strip-timer.is-low .timer-value { color: var(--error); }
.strip-timer.is-low .time-bar > span { background: var(--error); }
.strip-submit { margin-left: auto; gap: 0; }
.strip-submit svg { margin-right: 6px; }
.solve-alert { margin-bottom: 12px; }

.map-card { padding: 16px 18px; margin-bottom: 16px; }
.map-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 10px; padding: 2px 0; background: none; font-size: 14px; font-weight: 700; text-align: left; }
.map-chevron { transition: transform .2s; }
.map-toggle[aria-expanded='true'] .map-chevron { transform: rotate(180deg); }
.map-toggle + .map-body { margin-top: 12px; }
.map-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 12px; }
.map-legend > span { display: inline-flex; align-items: center; gap: 6px; }
.lg { display: inline-grid; place-items: center; width: 14px; height: 14px; border-radius: 4px; border: 1px solid var(--line); background: #f9fbf6; color: var(--warn); }
.lg.is-answered { background: #e4edda; border-color: #cddcbb; }
.lg.is-ok { background: var(--ok-bg); border-color: var(--ok-line); }
.lg.is-warn { background: var(--warn-bg); border-color: var(--warn-line); }
.lg.is-error { background: var(--error-bg); border-color: var(--error-line); }

.mobile-tabs { display: flex; gap: 5px; padding: 5px; margin-bottom: 14px; border-radius: var(--radius); background: var(--surface-2); border: 1px solid var(--line); scroll-margin-top: 150px; }
.mobile-tabs button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; border-radius: 9px; background: none; font-size: 14px; font-weight: 650; color: var(--text-soft); }
.mobile-tabs button.is-active { background: var(--surface); color: var(--green); box-shadow: var(--shadow-sm); }

.solve-layout { display: block; }
.solve-layout.is-split { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr); gap: 22px; align-items: start; }
.solve-layout.is-single .task-col { max-width: 780px; margin-inline: auto; }
.pdf-col { --pdf-h: 65dvh; display: flex; flex-direction: column; gap: 10px; min-width: 0; margin-bottom: 16px; }
.is-split .pdf-col { position: sticky; top: calc(var(--strip-top) + 90px); margin-bottom: 0; --pdf-h: max(320px, calc(100dvh - 350px)); }
.is-timed .is-split .pdf-col { --pdf-h: max(320px, calc(100dvh - 360px)); }
.sheet-tabs { align-self: flex-start; }
.pdf-pager { display: flex; align-items: center; gap: 10px; }
.pdf-pager span { flex: 1; text-align: center; font-size: 14px; color: var(--text-soft); }
.pdf-pager .icon-button { width: 38px; height: 38px; border-radius: 9px; background: var(--surface-2); }
.pdf-pager .icon-button:disabled { opacity: .35; }

.task-col { min-width: 0; scroll-margin-top: 160px; }
.task-topline { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 34px; margin-bottom: 10px; font-size: 12px; font-weight: 700; letter-spacing: 1px; color: var(--accent); }
.flag-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 0 6px 8px; background: none; font-size: 13px; font-weight: 600; letter-spacing: 0; color: var(--text-soft); }
.flag-btn:hover { color: var(--green); }
.flag-btn.is-on { color: var(--warn); }
.task-audio { margin-bottom: 12px; }
.task-card { padding: 26px; display: flex; flex-direction: column; gap: 14px; }
.task-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.task-card h2 { font-size: clamp(22px, 2.4vw, 27px); font-weight: 750; letter-spacing: -.8px; line-height: 1.3; scroll-margin-top: 170px; }
.task-card h2:focus { outline: none; }
.task-card h2:focus-visible { outline: 3px solid var(--focus); outline-offset: 4px; border-radius: 4px; }
.task-label { color: var(--text-soft); font-weight: 600; }
.task-hint { font-size: 15px; line-height: 1.65; color: var(--text-soft); }
.task-source { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.source-btn { display: inline-flex; align-items: center; gap: 7px; padding: 8px 13px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--line); font-size: 13px; font-weight: 650; color: var(--green); }
.source-btn:hover { background: var(--surface-3); border-color: var(--line-strong); }
.source-ext { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-soft); text-decoration: underline; text-underline-offset: 3px; }
.source-ext:hover { color: var(--green); }
.task-inputs { display: flex; flex-direction: column; gap: 14px; border: 0; padding: 14px 0 0; margin: 0; min-width: 0; border-top: 1px solid var(--line); }
.check-summary { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; padding: 12px 14px; border-radius: var(--radius); border: 1px solid; font-size: 14px; }
.check-summary.is-ok { background: var(--ok-bg); border-color: var(--ok-line); color: var(--ok); }
.check-summary.is-warn { background: var(--warn-bg); border-color: var(--warn-line); color: var(--warn); }
.check-summary.is-error { background: var(--error-bg); border-color: var(--error-line); color: var(--error); }
.task-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding-top: 14px; border-top: 1px solid var(--line); }
.pager { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; }

.intro { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; padding: 28px; }
.intro-icon { display: grid; place-items: center; width: 50px; height: 50px; border-radius: 14px; background: var(--lime); color: var(--green); }
.intro h2 { font-size: 26px; letter-spacing: -.8px; }
.intro h2:focus { outline: none; }
.intro-list { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 15px; line-height: 1.6; color: var(--text-soft); }
.intro-pdf { display: flex; align-items: flex-start; gap: 8px; padding: 11px 13px; border-radius: var(--radius-sm); background: var(--info-bg); border: 1px solid var(--info-line); color: var(--info); font-size: 14px; line-height: 1.5; }
.intro-pdf svg { margin-top: 2px; }

@media (max-width: 860px) {
  .head-actions { align-items: flex-start; }
  .solve-strip { flex-wrap: wrap; gap: 10px 16px; padding: 10px 12px; }
  .strip-progress, .strip-timer { min-width: 120px; }
  .timer-value { font-size: 18px; }
  .task-card { padding: 20px 18px; }
  .map-card { padding: 14px; }
}
@media (max-width: 520px) {
  .solve-strip { gap: 8px 12px; }
  .hide-xs { display: none; }
  .strip-progress, .strip-timer { min-width: 0; flex-basis: 0; }
  .strip-row .small { display: none; }
  .strip-row { margin-bottom: 5px; }
  .pager .button { padding-inline: 11px; }
}
</style>
