<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bookmark, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Clock3, ExternalLink, FileText, Lightbulb, ListChecks, Pause, Play, RotateCcw, Save, Sparkles, X } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import LocalPdfViewer from './LocalPdfViewer.vue'
import { officialExam, questions } from './examData'
import { STORAGE_KEY, createSession, isAnswered, pointsFor, restoreSession, totalScore } from './session'
import './exam.css'

const storageAvailable = ref(true)
function initialSession() {
  try { return restoreSession(window.localStorage.getItem(STORAGE_KEY)) }
  catch { storageAvailable.value = false; return createSession() }
}
const session = reactive(initialSession())
const currentIndex = computed(() => Math.max(0, questions.findIndex(question => question.id === session.activeId)))
const current = computed(() => questions[currentIndex.value])
const answeredCount = computed(() => questions.filter(question => isAnswered(question, session.answers[question.id])).length)
const isCurrentAnswered = computed(() => isAnswered(current.value, session.answers[current.value.id]))
const isChecked = computed(() => session.checked.includes(current.value.id))
const currentPoints = computed(() => pointsFor(current.value, session.answers[current.value.id]))
const score = computed(() => totalScore(session.answers))
const openQuestions = computed(() => questions.filter(question => question.type === 'open'))
const selfAssessedCount = computed(() => openQuestions.value.filter(question => session.selfAssessments[question.id]).length)
const wordCount = computed(() => String(session.answers[current.value.id] || '').trim().split(/\s+/).filter(Boolean).length)
const hintOpen = ref(false)
const pdfViewer = ref(null)
const mobileView = ref('question')
const pdfLoaded = ref(false)
const timerRunning = ref(!session.complete)
const questionHeading = ref(null)
const summaryHeading = ref(null)
const confirmDialog = ref(null)
const confirmAction = ref('finish')
const timeLabel = computed(() => {
  const seconds = session.elapsedSeconds
  const minutes = Math.floor(seconds / 60)
  return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
})
let ticker
let lastTick = Date.now()
let elapsedCarryMs = 0
let dialogOpener

function persist() {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); storageAvailable.value = true }
  catch { storageAvailable.value = false }
}
watch(session, persist, { deep: true })

function updateAnswer(value) {
  if (!isChecked.value) session.answers[current.value.id] = value
}
function updateBoolean(statementId, value) {
  updateAnswer({ ...(session.answers[current.value.id] || {}), [statementId]: value })
}
function checkAnswer() {
  if (!isCurrentAnswered.value || isChecked.value) return
  session.checked.push(current.value.id)
  hintOpen.value = false
}
function editAnswer() {
  session.checked = session.checked.filter(id => id !== current.value.id)
  delete session.selfAssessments[current.value.id]
}
function toggleFlag() {
  const id = current.value.id
  session.flags = session.flags.includes(id) ? session.flags.filter(flag => flag !== id) : [...session.flags, id]
}
async function goToQuestion(id) {
  session.activeId = id
  session.complete = false
  hintOpen.value = false
  await nextTick()
  if (window.innerWidth > 850 || mobileView.value === 'question') {
    questionHeading.value?.focus({ preventScroll: true })
    if (window.innerWidth <= 850) document.querySelector('.study-mobile-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else if (questionHeading.value?.getBoundingClientRect().top < 100) document.querySelector('.study-layout')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
async function viewSource() {
  mobileView.value = 'pdf'
  await nextTick()
  await pdfViewer.value?.jumpToQuestion()
  if (window.innerWidth <= 850) document.querySelector('.study-mobile-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function updateClock() {
  const now = Date.now()
  if (timerRunning.value && !document.hidden && !session.complete) {
    elapsedCarryMs += Math.max(0, now - lastTick)
    const seconds = Math.floor(elapsedCarryMs / 1000)
    if (seconds) {
      session.elapsedSeconds += seconds
      elapsedCarryMs -= seconds * 1000
    }
  }
  lastTick = now
}
function toggleTimer() { updateClock(); timerRunning.value = !timerRunning.value }
function resetTick() { lastTick = Date.now() }
function showConfirm(action) {
  confirmAction.value = action
  dialogOpener = document.activeElement
  confirmDialog.value.showModal()
  document.body.classList.add('modal-open')
}
function closeConfirm() { confirmDialog.value.close() }
function onConfirmClosed() {
  document.body.classList.remove('modal-open')
  if (dialogOpener?.isConnected) dialogOpener.focus()
}
function requestFinish() {
  if (!answeredCount.value) return
  if (answeredCount.value < questions.length) showConfirm('finish')
  else finish()
}
async function finish() {
  updateClock()
  session.checked = questions.filter(question => isAnswered(question, session.answers[question.id])).map(question => question.id)
  session.complete = true
  timerRunning.value = false
  dialogOpener = null
  if (confirmDialog.value.open) closeConfirm()
  await nextTick()
  summaryHeading.value?.focus({ preventScroll: true })
  summaryHeading.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
async function reset() {
  dialogOpener = null
  closeConfirm()
  Object.assign(session, createSession())
  hintOpen.value = false
  mobileView.value = 'question'
  timerRunning.value = true
  lastTick = Date.now()
  elapsedCarryMs = 0
  persist()
  await nextTick()
  questionHeading.value?.focus({ preventScroll: true })
}
function answerText(question) {
  const answer = session.answers[question.id]
  if (question.type === 'choice') return question.options.find(option => option.id === answer)?.text || 'Brak odpowiedzi'
  if (question.type === 'boolean') return question.statements.map(statement => `${statement.text} — ${typeof answer?.[statement.id] !== 'boolean' ? 'Brak odpowiedzi' : answer[statement.id] ? 'Prawda' : 'Fałsz'}`).join('\n')
  return answer?.trim() || 'Brak odpowiedzi'
}
function exportAnswers() {
  const lines = ['OGARNIJ MATURĘ — AUTORSKI TRENING DO ARKUSZA 2026', `Pytania zamknięte: ${score.value.earned}/${score.value.max} pkt`, 'Odpowiedzi otwarte wymagają samooceny. To nie jest wynik egzaminu CKE.', `Czas nauki: ${timeLabel.value}`, '', ...questions.flatMap((question, index) => {
    const points = pointsFor(question, session.answers[question.id])
    return [`${index + 1}. ${question.title}`, question.prompt, answerText(question), points ? `Punkty: ${points.earned}/${points.max}` : `Samoocena: ${session.selfAssessments[question.id] === 'understood' ? 'Ogarnięte' : session.selfAssessments[question.id] === 'review' ? 'Do powtórki' : 'Do wykonania'}`, `Powiązane zagadnienie: zad. ${question.sourceTask}, str. ${question.sourcePage} oficjalnego PDF-u.`, '']
  }), `Arkusz CKE: ${officialExam.url}`, 'Pytania i objaśnienia w aplikacji: opracowanie własne.']
  const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'moj-trening-polski-2026.txt'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

onMounted(() => {
  persist()
  ticker = window.setInterval(updateClock, 250)
  document.addEventListener('visibilitychange', resetTick)
})
onBeforeUnmount(() => {
  window.clearInterval(ticker)
  document.removeEventListener('visibilitychange', resetTick)
  document.body.classList.remove('modal-open')
  persist()
})
</script>

<template>
  <div class="exam-app">
    <a href="#exam-question" class="skip-link" @click.prevent="(session.complete ? summaryHeading : questionHeading)?.focus()">Przejdź do ćwiczenia</a>
    <header class="exam-header"><div class="exam-container exam-header-inner">
      <RouterLink to="/" class="brand" aria-label="Ogarnij Maturę — strona główna"><span class="brand-icon"><BrandMark /></span><span>ogarnij<span class="brand-second">maturę.</span></span></RouterLink>
      <div class="exam-header-label"><span></span> TWOJA STREFA NAUKI</div>
      <RouterLink to="/" class="exam-back-link"><ArrowLeft :size="16" /> Strona główna</RouterLink>
    </div></header>

    <main class="exam-container exam-main">
      <nav class="exam-breadcrumbs" aria-label="Okruszki nawigacyjne"><RouterLink to="/">Start</RouterLink><ChevronRight :size="12" /><RouterLink to="/arkusze-maturalne">Arkusze</RouterLink><ChevronRight :size="12" /><span aria-current="page">Polski 2026</span></nav>
      <div class="exam-title-row"><div><span class="exam-kicker"><span class="status-dot"></span> TRENING AUTORSKI</span><h1>Polski? <span>Ćwiczymy.</span></h1><p>8 krótkich ćwiczeń do zagadnień z arkusza CKE.</p></div><div class="exam-title-actions"><a :href="officialExam.url" target="_blank" rel="noopener noreferrer" class="button button-outline"><FileText :size="17" /> Oficjalny arkusz <ArrowUpRight :size="17" /></a><span class="exam-save-state" :class="{ 'save-unavailable': !storageAvailable }"><Save :size="12" />{{ storageAvailable ? 'Postęp zapisuje się na tym urządzeniu' : 'Zapis niedostępny — pobierz odpowiedzi przed wyjściem' }}</span></div></div>
      <div class="exam-meta"><span>Język polski</span><i></i><span>Poziom podstawowy</span><i></i><span>Maj 2026</span><span class="exam-mode"><Sparkles :size="13" /> Tryb nauki</span></div>

      <section class="study-bar" aria-label="Postęp i wybór ćwiczenia">
        <div class="study-progress"><div><strong>Twój progres</strong><span>{{ answeredCount }} / {{ questions.length }}</span></div><div class="session-progress" role="progressbar" aria-label="Uzupełnione ćwiczenia" :aria-valuenow="answeredCount" :aria-valuemax="questions.length" aria-valuemin="0"><span :style="{ width: `${answeredCount / questions.length * 100}%` }"></span></div></div>
        <nav class="study-question-nav" aria-label="Ćwiczenia"><button v-for="(question, index) in questions" :key="question.id" :class="{ active: session.activeId === question.id && !session.complete, answered: isAnswered(question, session.answers[question.id]) }" :aria-current="session.activeId === question.id && !session.complete ? 'step' : undefined" :aria-label="`Ćwiczenie ${index + 1}: ${question.title}${session.flags.includes(question.id) ? ', oznaczone do powrotu' : ''}`" :title="question.title" @click="goToQuestion(question.id)"><Check v-if="session.checked.includes(question.id)" :size="15" /><template v-else>{{ String(index + 1).padStart(2, '0') }}</template><Bookmark v-if="session.flags.includes(question.id)" :size="8" class="study-nav-flag" fill="currentColor" /></button></nav>
        <div class="study-session-actions"><span class="study-time"><Clock3 :size="15" />{{ timeLabel }}</span><button :disabled="session.complete" :aria-label="timerRunning ? 'Wstrzymaj licznik czasu' : 'Wznów licznik czasu'" @click="toggleTimer"><Pause v-if="timerRunning && !session.complete" :size="15" /><Play v-else :size="15" /></button><button aria-label="Zacznij od nowa" title="Zacznij od nowa" @click="showConfirm('reset')"><RotateCcw :size="15" /></button></div>
      </section>
      <div v-if="!session.complete" class="study-mobile-tabs" role="group" aria-label="Wybierz widok"><button :class="{ active: mobileView === 'question' }" :aria-pressed="mobileView === 'question'" @click="mobileView = 'question'"><ListChecks :size="16" /> Ćwiczenie {{ currentIndex + 1 }}</button><button :class="{ active: mobileView === 'pdf' }" :aria-pressed="mobileView === 'pdf'" @click="viewSource"><FileText :size="16" />{{ pdfLoaded ? `Arkusz · str. ${current.sourcePage}` : 'Arkusz' }}</button></div>
      <div class="exam-layout study-layout" :class="{ 'study-show-pdf': mobileView === 'pdf', 'study-complete': session.complete }">
        <div v-show="!session.complete" class="study-document">
          <div class="study-document-label"><span>TWÓJ ARKUSZ</span><span>Synchronizacja z ćwiczeniem</span></div>
          <div class="mobile-question-pager"><button :disabled="currentIndex === 0" aria-label="Poprzednie ćwiczenie przy PDF" @click="goToQuestion(questions[currentIndex - 1].id)"><ArrowLeft :size="16" /></button><span>Ćwiczenie {{ currentIndex + 1 }} z {{ questions.length }} · {{ current.title }}</span><button :disabled="currentIndex === questions.length - 1" aria-label="Następne ćwiczenie przy PDF" @click="goToQuestion(questions[currentIndex + 1].id)"><ArrowRight :size="16" /></button></div>
          <LocalPdfViewer ref="pdfViewer" :question="current" :active="!session.complete && mobileView === 'pdf'" @loaded="pdfLoaded = $event" />
        </div>
        <div class="exam-workspace study-exercise">
          <template v-if="!session.complete">
            <div class="workspace-topline"><span>ĆWICZENIE {{ String(currentIndex + 1).padStart(2, '0') }} <span>/ {{ String(questions.length).padStart(2, '0') }}</span></span><button class="flag-button" :class="{ flagged: session.flags.includes(current.id) }" :aria-pressed="session.flags.includes(current.id)" @click="toggleFlag"><Bookmark :size="15" :fill="session.flags.includes(current.id) ? 'currentColor' : 'none'" />{{ session.flags.includes(current.id) ? 'Wrócę do tego' : 'Oznacz do powrotu' }}</button></div>
            <section id="exam-question" class="question-card" aria-labelledby="question-heading">
              <div class="question-meta"><span class="question-category">{{ current.section }}</span><span class="question-type">{{ current.type === 'open' ? 'Odpowiedź otwarta · samoocena' : current.type === 'boolean' ? 'Prawda / fałsz · 2 pkt' : 'Jedna odpowiedź · 1 pkt' }}</span></div>
              <h2 id="question-heading" ref="questionHeading" tabindex="-1">{{ current.title }}<span>.</span></h2>
              <button class="question-source" @click="viewSource"><BookOpen :size="14" /> Pokaż powiązane zad. {{ current.sourceTask }} · str. {{ current.sourcePage }} w PDF <ArrowUpRight :size="13" /></button>
              <blockquote v-if="current.excerpt" class="authored-excerpt"><span>NASZ PRZYKŁAD</span>{{ current.excerpt }}</blockquote>
              <p class="question-prompt">{{ current.prompt }}</p><p class="question-instruction">{{ current.instruction }}</p>

              <fieldset v-if="current.type === 'choice'" class="answer-choices" :disabled="isChecked"><legend class="sr-only">{{ current.prompt }}</legend><label v-for="option in current.options" :key="`${current.id}-${option.id}`" class="answer-choice" :class="{ selected: session.answers[current.id] === option.id, 'answer-correct': isChecked && option.id === current.correct, 'answer-wrong': isChecked && session.answers[current.id] === option.id && option.id !== current.correct }"><input type="radio" :name="current.id" :value="option.id" :checked="session.answers[current.id] === option.id" @change="updateAnswer(option.id)" /><span class="answer-letter">{{ option.id.toUpperCase() }}</span><span class="answer-copy">{{ option.text }}</span><Check v-if="isChecked && option.id === current.correct" :size="18" /><X v-else-if="isChecked && session.answers[current.id] === option.id" :size="18" /></label></fieldset>

              <div v-else-if="current.type === 'boolean'" class="boolean-answers"><fieldset v-for="(statement, index) in current.statements" :key="statement.id" :disabled="isChecked" class="boolean-row"><legend><span>{{ index + 1 }}.</span> {{ statement.text }}</legend><div class="boolean-buttons"><label v-for="value in [true, false]" :key="String(value)" :class="{ selected: session.answers[current.id]?.[statement.id] === value, 'answer-correct': isChecked && statement.correct === value, 'answer-wrong': isChecked && session.answers[current.id]?.[statement.id] === value && statement.correct !== value }"><input type="radio" :name="`${current.id}-${statement.id}`" :value="String(value)" :checked="session.answers[current.id]?.[statement.id] === value" @change="updateBoolean(statement.id, value)" />{{ value ? 'Prawda' : 'Fałsz' }}<Check v-if="isChecked && statement.correct === value" :size="14" /></label></div></fieldset></div>

              <div v-else class="open-answer"><label for="written-answer">Twoja odpowiedź</label><textarea id="written-answer" :key="current.id" :value="session.answers[current.id] || ''" :readonly="isChecked" maxlength="5000" rows="6" placeholder="Zacznij od najważniejszej myśli…" @input="updateAnswer($event.target.value)"></textarea><div><span>Zapis tylko w Twojej przeglądarce</span><span>{{ wordCount }} słów</span></div></div>

              <div v-if="!isChecked" class="question-actions"><button class="hint-button" :aria-expanded="hintOpen" aria-controls="question-hint" @click="hintOpen = !hintOpen"><Lightbulb :size="16" /> Mała podpowiedź <ChevronDown :size="14" /></button><button class="button button-dark check-answer-button" :disabled="!isCurrentAnswered" @click="checkAnswer">{{ current.type === 'open' ? 'Porównaj odpowiedź' : 'Sprawdź odpowiedź' }} <ArrowRight :size="17" /></button></div>
              <div v-if="hintOpen && !isChecked" id="question-hint" class="question-hint"><Lightbulb :size="17" /><p>{{ current.hint }}</p></div>

              <section v-if="isChecked && current.type !== 'open'" class="question-feedback" :class="{ 'feedback-review': currentPoints.earned !== currentPoints.max }" aria-label="Wyjaśnienie odpowiedzi" role="status"><div class="feedback-heading"><span class="feedback-result-icon"><CheckCheck v-if="currentPoints.earned === currentPoints.max" :size="21" /><Lightbulb v-else :size="21" /></span><div><h3>{{ currentPoints.earned === currentPoints.max ? 'Dokładnie. Ogarniasz to!' : 'To dobry moment na małą powtórkę.' }}</h3><span>{{ currentPoints.earned }} / {{ currentPoints.max }} pkt w tym ćwiczeniu</span></div></div><p>{{ current.explanation }}</p><button class="feedback-edit" @click="editAnswer"><RotateCcw :size="13" /> Spróbuj jeszcze raz</button></section>

              <section v-if="isChecked && current.type === 'open'" class="self-assessment" aria-label="Samoocena odpowiedzi"><div class="self-assessment-title"><Sparkles :size="18" /><h3>Porównaj, nie przepisuj.</h3></div><span class="model-label">PRZYKŁADOWA ODPOWIEDŹ AUTORSKA</span><p class="model-answer">{{ current.model }}</p><ul><li v-for="criterion in current.criteria" :key="criterion"><Check :size="14" />{{ criterion }}</li></ul><p class="self-assessment-note">Nie oceniamy tego tekstu automatycznie. Samodzielnie sprawdź, czy Twoja odpowiedź uwzględnia te elementy.</p><div class="self-assessment-buttons"><button :class="{ active: session.selfAssessments[current.id] === 'understood' }" :aria-pressed="session.selfAssessments[current.id] === 'understood'" @click="session.selfAssessments[current.id] = 'understood'"><Check :size="15" /> Mam to</button><button :class="{ active: session.selfAssessments[current.id] === 'review' }" :aria-pressed="session.selfAssessments[current.id] === 'review'" @click="session.selfAssessments[current.id] = 'review'"><Bookmark :size="15" /> Jeszcze powtórzę</button><button @click="editAnswer">Popraw odpowiedź <ArrowRight :size="14" /></button></div></section>
            </section>

            <div class="question-pagination"><button class="pagination-back" :disabled="currentIndex === 0" @click="goToQuestion(questions[currentIndex - 1].id)"><ArrowLeft :size="17" /> Poprzednie</button><span>{{ currentIndex + 1 }} z {{ questions.length }}</span><button v-if="currentIndex < questions.length - 1" class="button button-outline" @click="goToQuestion(questions[currentIndex + 1].id)">Następne <ArrowRight :size="17" /></button><button v-else class="button button-dark" :disabled="answeredCount === 0" @click="requestFinish">Podsumowanie <ArrowRight :size="17" /></button></div>
            <div class="practice-note"><span class="practice-note-icon"><Sparkles :size="18" /></span><div><strong>Małe kroki robią różnicę.</strong><p>Możesz pominąć pytanie i wrócić do niego później.</p></div><button :disabled="answeredCount === 0" @click="requestFinish">Podsumuj <ArrowUpRight :size="15" /></button></div>
          </template>

          <section v-else class="results-card" aria-labelledby="results-heading"><span class="results-icon"><CheckCheck :size="30" /></span><span class="exam-kicker">TWÓJ MAŁY KROK ZROBIONY</span><h2 id="results-heading" ref="summaryHeading" tabindex="-1">O jeden trening dalej<span>.</span></h2><p class="results-description">Sprawdź, co już umiesz i do czego warto wrócić.</p><div class="results-metrics"><div><span>Pytania zamknięte</span><strong>{{ score.earned }}<small> / {{ score.max }} pkt</small></strong></div><div><span>Uzupełnione</span><strong>{{ answeredCount }}<small> / {{ questions.length }}</small></strong></div><div><span>Czas nauki</span><strong>{{ timeLabel }}</strong></div></div><p class="score-explainer">Wynik autorskiego treningu, nie egzaminu CKE. Dwie odpowiedzi otwarte ocenisz samodzielnie ({{ selfAssessedCount }}/2 ocenione).</p><div class="results-list"><button v-for="(question, index) in questions" :key="question.id" @click="goToQuestion(question.id)"><span class="result-number">{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ question.title }}</strong><span class="result-label" :class="{ 'result-success': question.type !== 'open' && pointsFor(question, session.answers[question.id]).earned === pointsFor(question, session.answers[question.id]).max }">{{ !isAnswered(question, session.answers[question.id]) ? 'Pominięte' : question.type === 'open' ? session.selfAssessments[question.id] === 'understood' ? 'Ogarnięte · samoocena' : session.selfAssessments[question.id] === 'review' ? 'Do powtórki' : 'Do samooceny' : `${pointsFor(question, session.answers[question.id]).earned}/${pointsFor(question, session.answers[question.id]).max} pkt` }}</span><ArrowUpRight :size="15" /></button></div><div class="results-actions"><button class="button button-dark" @click="exportAnswers"><ArrowDownToLine :size="17" /> Pobierz odpowiedzi</button><button class="button button-outline" @click="showConfirm('reset')"><RotateCcw :size="16" /> Nowy trening</button></div></section>

          <details class="exam-rights"><summary><CircleHelp :size="14" /> Źródła i prawa autorskie <ChevronDown :size="14" /></summary><div><p>Ćwiczenia, przykłady i objaśnienia w tym treningu są autorskie. Nie są zadaniami ani oficjalnym kluczem oceniania CKE. Synchronizacja wskazuje wyłącznie powiązane zagadnienia w arkuszu.</p><p><strong>Materiał źródłowy:</strong> Centralna Komisja Egzaminacyjna, język polski, poziom podstawowy, arkusz 1 (testy), {{ officialExam.date }}. Kod pliku: {{ officialExam.code }}.</p><p>Oficjalny PDF wczytuje się automatycznie z CKE i jest wyświetlany w przeglądarce. Możesz też wybrać plik z urządzenia — wtedy nie przesyłamy go na serwer. Po odświeżeniu arkusz otworzy się ponownie, a odpowiedzi pozostaną zapisane. Autorzy i źródła jego materiałów są wskazani w oryginalnym dokumencie. Ogarnij Maturę jest niezależnym projektem, niepowiązanym z CKE.</p><div class="rights-links"><a :href="officialExam.url" target="_blank" rel="noopener noreferrer">Arkusz źródłowy <ExternalLink :size="12" /></a><a :href="officialExam.catalogUrl" target="_blank" rel="noopener noreferrer">Katalog CKE <ExternalLink :size="12" /></a><a :href="officialExam.legalUrl" target="_blank" rel="noopener noreferrer">Ustawa o prawie autorskim <ExternalLink :size="12" /></a></div></div></details>
        </div>
      </div>
    </main>
    <footer class="exam-container exam-footer"><span>© {{ new Date().getFullYear() }} Ogarnij Maturę</span><span>Autorski trening · oficjalny arkusz u źródła</span><RouterLink to="/">Wróć na stronę główną <ArrowUpRight :size="13" /></RouterLink></footer>

    <dialog ref="confirmDialog" class="exam-confirm-dialog" aria-labelledby="exam-confirm-title" @close="onConfirmClosed"><button class="confirm-close icon-button" aria-label="Zamknij okno" @click="closeConfirm"><X :size="20" /></button><span class="confirm-symbol"><RotateCcw v-if="confirmAction === 'reset'" :size="25" /><ListChecks v-else :size="25" /></span><h2 id="exam-confirm-title">{{ confirmAction === 'reset' ? 'Zaczynamy od nowa?' : 'Zostawiasz coś na później?' }}</h2><p>{{ confirmAction === 'reset' ? 'Usuniesz odpowiedzi i czas tylko z tego treningu, na tym urządzeniu.' : `Uzupełnione ćwiczenia: ${answeredCount} z ${questions.length}. Pominięte pytania zamknięte otrzymają 0 punktów. Do odpowiedzi możesz później wrócić.` }}</p><div><button class="button button-outline" @click="closeConfirm">{{ confirmAction === 'reset' ? 'Zostaję przy odpowiedziach' : 'Wracam do pytań' }}</button><button class="button button-dark" @click="confirmAction === 'reset' ? reset() : finish()">{{ confirmAction === 'reset' ? 'Tak, nowy trening' : 'Pokaż podsumowanie' }} <ArrowRight :size="16" /></button></div></dialog>
  </div>
</template>
