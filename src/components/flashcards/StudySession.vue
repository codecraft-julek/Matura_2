<script setup>
// One SRS study session (SM-2 light, src/lib/flashcards/srs.ts). Space / Enter flips the card,
// 1–4 answers. Every answer is saved in the background (a toast tells when that fails), so the next
// card shows at once. A card answered "Nie wiem" comes back 4 cards later in the same session.
// The parent re-creates this component (key) for a new session, e.g. "Powtórz całą talię".
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Keyboard, PartyPopper, RotateCw, Volume2 } from '@lucide/vue'
import FlipCard from './FlipCard.vue'
import { deckRoute, studyRoute } from '@/config/routes'
import { saveReview } from '@/lib/api/flashcards'
import { formatInterval, nextReview } from '@/lib/flashcards/srs'
import { count, plural } from '@/lib/format'
import { useUiStore } from '@/stores/ui'

const props = defineProps({
  deckId: { type: String, required: true },
  title: { type: String, required: true },
  subject: { type: String, default: 'other' },
  cards: { type: Array, required: true }, // StudyCard: { id, front, back, interval_days, ease, reps, lapses }
  all: { type: Boolean, default: false },
})

const GRADES = [
  { grade: 0, label: 'Nie wiem', key: '1', tone: 'g-again' },
  { grade: 1, label: 'Trudne', key: '2', tone: 'g-hard' },
  { grade: 2, label: 'Dobrze', key: '3', tone: 'g-good' },
  { grade: 3, label: 'Łatwe', key: '4', tone: 'g-easy' },
]
const CARDS = ['fiszka', 'fiszki', 'fiszek']
/** A forgotten card comes back a few cards later in the same session. */
const RELEARN_GAP = 4

const ui = useUiStore()
const queue = ref([...props.cards])
const index = ref(0)
const flipped = ref(false)
const counts = ref([0, 0, 0, 0])
const failed = ref(false)
const announce = ref('')
const flipCard = ref(null)
// The newest SRS state of every card answered in this session (the database gets the same values).
const latest = new Map()
let lastFailToast = 0

const card = computed(() => queue.value[index.value])
const finished = computed(() => index.value >= queue.value.length)
const reviewed = computed(() => new Set(queue.value.slice(0, index.value).map(c => c.id)).size)
const srsState = c => latest.get(c.id) ?? { interval_days: c.interval_days, ease: c.ease, reps: c.reps, lapses: c.lapses }
const previews = computed(() => (card.value ? GRADES.map(g => formatInterval(nextReview(srsState(card.value), g.grade))) : []))
// Pronunciation for English cards, where the browser can speak.
const canSpeak = props.subject === 'english' && typeof window !== 'undefined' && 'speechSynthesis' in window

function onFail() {
  failed.value = true
  if (Date.now() - lastFailToast > 15000) {
    lastFailToast = Date.now()
    ui.toast('Nie udało się zapisać odpowiedzi. Sprawdź internet.', 'error')
  }
}

function flip(value = !flipped.value) {
  if (!card.value) return
  flipped.value = value
  announce.value = value ? `Odpowiedź: ${card.value.back}` : `Pytanie: ${card.value.front}`
}

function showAnswer() {
  flip(true)
  nextTick(() => flipCard.value?.focus())
}

function grade(g) {
  const c = card.value
  if (!c || !flipped.value) return
  const next = nextReview(srsState(c), g)
  latest.set(c.id, { interval_days: next.interval_days, ease: next.ease, reps: next.reps, lapses: next.lapses })
  // Save in the background so the next card shows at once.
  saveReview(c.id, next).then(r => { if (!r.ok) onFail() }, onFail)
  counts.value = counts.value.map((n, i) => (i === g ? n + 1 : n))
  if (g === 0) {
    const copy = [...queue.value]
    copy.splice(Math.min(index.value + 1 + RELEARN_GAP, copy.length), 0, c)
    queue.value = copy
  }
  flipped.value = false
  index.value += 1
  if (card.value) {
    announce.value = `Fiszka ${index.value + 1} z ${queue.value.length}. Pytanie: ${card.value.front}`
    nextTick(() => flipCard.value?.focus())
  } else {
    announce.value = 'Koniec sesji.'
  }
}

function speak(text) {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-GB'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

// Keyboard: Space / Enter flips, 1–4 answers. Other buttons and links keep their own Enter/Space.
function onKey(e) {
  if (finished.value || e.ctrlKey || e.metaKey || e.altKey) return
  const target = e.target instanceof Element ? e.target : null
  if (target?.closest('input, textarea, select, [contenteditable="true"], dialog')) return
  const onCard = target?.closest('.flip-card')
  const onOtherControl = !onCard && target?.closest('button, a, summary')
  if (e.key === ' ' || e.key === 'Enter') {
    if (onOtherControl) return
    e.preventDefault()
    if (!e.repeat) flip()
  } else if (flipped.value && ['1', '2', '3', '4'].includes(e.key) && !e.repeat) {
    e.preventDefault()
    grade(Number(e.key) - 1)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (canSpeak) window.speechSynthesis.cancel()
})
</script>

<template>
  <p class="sr-only" aria-live="polite">{{ announce }}</p>

  <!-- Nothing due -->
  <div v-if="cards.length === 0" class="card card-tinted end">
    <span class="end-icon" aria-hidden="true"><PartyPopper :size="26" /></span>
    <h1 class="end-title">Wszystko powtórzone!</h1>
    <p class="muted">Na dziś nie ma fiszek do powtórki w tej talii. Wróć jutro albo powtórz całość.</p>
    <div class="end-actions">
      <RouterLink :to="studyRoute(deckId, true)" class="button button-dark"><RotateCw :size="17" /> Powtórz całą talię</RouterLink>
      <RouterLink :to="deckRoute(deckId)" class="button button-outline">Wróć do talii</RouterLink>
    </div>
  </div>

  <!-- End of the session -->
  <div v-else-if="finished" class="card card-tinted end">
    <span class="end-icon" aria-hidden="true"><PartyPopper :size="26" /></span>
    <h1 class="end-title">Brawo, koniec sesji!</h1>
    <p class="end-count">{{ count(reviewed, CARDS) }} {{ plural(reviewed, ['powtórzona', 'powtórzone', 'powtórzonych']) }}</p>
    <ul class="end-grades">
      <li v-for="g in GRADES" :key="g.grade" :class="g.tone"><strong class="tabular">{{ counts[g.grade] }}</strong>{{ g.label }}</li>
    </ul>
    <p v-if="counts[0] > 0" class="muted small">Fiszki z „Nie wiem” wrócą do Ciebie szybciej, aż je zapamiętasz.</p>
    <p v-if="failed" class="field-error" role="alert">Części odpowiedzi nie udało się zapisać (internet?).</p>
    <div class="end-actions">
      <RouterLink :to="deckRoute(deckId)" class="button button-dark">Wróć do talii</RouterLink>
      <RouterLink v-if="!all" :to="studyRoute(deckId, true)" class="button button-outline"><RotateCw :size="17" /> Powtórz całą talię</RouterLink>
    </div>
  </div>

  <!-- A card -->
  <div v-else class="session">
    <h1 class="sr-only">Nauka: {{ title }}</h1>
    <div class="session-top">
      <span class="deck-name">{{ title }}</span>
      <span class="tabular muted">{{ Math.min(index + 1, queue.length) }} / {{ queue.length }}</span>
    </div>
    <div class="progress is-lime" aria-hidden="true"><span :style="{ width: `${(index / queue.length) * 100}%` }"></span></div>

    <!-- key: every card is a new element, so it never "flips back" showing the next answer -->
    <FlipCard
      :key="`${card.id}-${index}`" ref="flipCard" class="study-card" :front="card.front" :back="card.back"
      :flipped="flipped" @update:flipped="flip"
    />

    <div v-if="canSpeak" class="speak">
      <button type="button" class="button button-ghost button-sm" @click="speak(card.front)"><Volume2 :size="16" /> Posłuchaj wymowy</button>
    </div>

    <div class="answer">
      <div v-if="flipped" class="grades" role="group" aria-label="Jak Ci poszło?">
        <button v-for="(g, i) in GRADES" :key="g.grade" type="button" class="grade" :class="g.tone" @click="grade(g.grade)">
          <span class="grade-label">{{ g.label }}</span>
          <span class="grade-sub">{{ previews[i] }}<kbd class="kbd" :aria-label="`skrót: ${g.key}`">{{ g.key }}</kbd></span>
        </button>
      </div>
      <button v-else type="button" class="button button-dark button-large show" @click="showAnswer">
        Pokaż odpowiedź <kbd class="kbd kbd-dark" aria-label="skrót: spacja">Spacja</kbd>
      </button>
    </div>
    <p class="shortcuts muted"><Keyboard :size="15" aria-hidden="true" /> Skróty: <kbd class="kbd">Spacja</kbd> odwraca fiszkę, <kbd class="kbd">1</kbd>–<kbd class="kbd">4</kbd> to odpowiedzi.</p>
  </div>
</template>

<style scoped>
.session { display: flex; flex-direction: column; }
.session-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 14px; }
.deck-name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.progress { margin-top: 10px; }
.study-card { margin-top: 20px; }
.speak { display: flex; justify-content: center; margin-top: 12px; }
.answer { margin-top: 20px; }
.show { width: 100%; gap: 12px; }
.grades { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.grade { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; border-radius: var(--radius); border: 1px solid; font-family: var(--heading); transition: transform .15s, background .15s; }
.grade:hover { transform: translateY(-2px); }
.grade-label { font-weight: 800; font-size: 15px; }
.grade-sub { display: inline-flex; align-items: center; gap: 6px; font-family: 'DM Sans Variable', sans-serif; font-size: 12.5px; opacity: .9; }
.g-again { background: var(--error); border-color: var(--error); color: white; }
.g-again:hover { background: #8c4430; }
.g-hard { background: var(--warn-bg); border-color: var(--warn-line); color: var(--warn); }
.g-hard:hover { background: #f1e9d6; }
.g-good { background: var(--ok); border-color: var(--ok); color: white; }
.g-good:hover { background: #3f672b; }
.g-easy { background: var(--green); border-color: var(--green); color: white; }
.g-easy:hover { background: #2c5142; }
.kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 5px; border: 1px solid currentColor; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; font-weight: 600; line-height: 1; opacity: .8; }
.kbd-dark { border-color: #ffffff80; color: white; }
.shortcuts { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; margin-top: 18px; font-size: 13px; }
.shortcuts .kbd { color: var(--text); }
/* Touch screens have no keyboard: hide the shortcut hints. */
@media (hover: none) and (pointer: coarse) { .kbd, .shortcuts { display: none; } }
@media (max-width: 560px) { .grades { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

.end { text-align: center; padding: 34px 24px; }
.end-icon { display: inline-grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: var(--lime); color: var(--green); margin-bottom: 14px; }
.end-title { font-size: clamp(26px, 4vw, 32px); letter-spacing: -1px; line-height: 1.2; }
.end-count { margin-top: 8px; font-family: var(--heading); font-size: 19px; font-weight: 750; }
.end .muted { margin-top: 8px; line-height: 1.6; }
.end-grades { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; max-width: 420px; margin: 18px auto 0; padding: 0; list-style: none; }
.end-grades li { display: flex; flex-direction: column; gap: 2px; padding: 10px 6px; border-radius: var(--radius); font-size: 13px; border: 1px solid; }
.end-grades strong { font-family: var(--heading); font-size: 22px; }
.end .field-error { margin-top: 10px; }
.end-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 22px; }
@media (max-width: 420px) { .end-grades { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
