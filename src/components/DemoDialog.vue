<script setup>
// Showcase on the homepage: a sample task, a ready-made essay feedback and a few flashcards, without
// an account. Every tab ends with a real next step (signup or the public demo exam).
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCheck, FileText, Layers, Lightbulb, RotateCw, Sparkles, X } from '@lucide/vue'
import { ROUTES } from '@/config/routes'
import { EXAM_ROUTE } from '@/exam/examData'
import { exercises, flashcards } from '../data'

const dialog = ref(null)
const activeTab = ref('exercise')
const subject = ref('polski')
const selected = ref(null)
const checked = ref(false)
const cardIndex = ref(0)
const cardFlipped = ref(false)
const exercise = computed(() => exercises[subject.value])
const card = computed(() => flashcards[cardIndex.value])
let opener = null

function open(tab = 'exercise') {
  activeTab.value = tab
  opener = document.activeElement
  dialog.value.showModal()
  document.body.classList.add('modal-open')
}

function onClose() {
  document.body.classList.remove('modal-open')
  opener?.focus()
}

function close() {
  dialog.value.close()
}

function resetExercise() {
  selected.value = null
  checked.value = false
}

function moveCard(direction) {
  cardIndex.value = (cardIndex.value + direction + flashcards.length) % flashcards.length
  cardFlipped.value = false
}

function onBackdrop(event) {
  if (event.target !== dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close()
}

onBeforeUnmount(() => document.body.classList.remove('modal-open'))
defineExpose({ open })
</script>

<template>
  <dialog ref="dialog" class="demo-dialog" aria-labelledby="demo-title" @close="onClose" @click="onBackdrop">
    <div class="dialog-topline"><span class="eyebrow"><span class="status-dot"></span> MAŁY KROK ZACZYNA SIĘ TUTAJ</span><button class="icon-button" aria-label="Zamknij demo" @click="close"><X :size="22" /></button></div>
    <h2 id="demo-title">Twoja strefa ogarniania<span class="accent-dot">.</span></h2>
    <p class="dialog-description">Sprawdź, jak to działa. Bez konta i bez presji.</p>
    <div class="demo-navigation" aria-label="Wybierz narzędzie">
      <button :class="{ active: activeTab === 'exercise' }" :aria-pressed="activeTab === 'exercise'" @click="activeTab = 'exercise'"><FileText :size="17" /> Zadanie</button>
      <button :class="{ active: activeTab === 'essay' }" :aria-pressed="activeTab === 'essay'" @click="activeTab = 'essay'"><Sparkles :size="17" /> Feedback</button>
      <button :class="{ active: activeTab === 'flashcards' }" :aria-pressed="activeTab === 'flashcards'" @click="activeTab = 'flashcards'"><Layers :size="17" /> Fiszki</button>
    </div>

    <section v-if="activeTab === 'exercise'" class="demo-exercise" aria-label="Przykładowe zadanie">
      <div class="exercise-controls"><span class="mini-eyebrow">ZADANIE DEMONSTRACYJNE</span><select v-model="subject" aria-label="Przedmiot" @change="resetExercise"><option value="polski">Język polski</option><option value="angielski">Język angielski</option></select></div>
      <p class="exercise-category">{{ exercise.category }}</p>
      <h3>{{ exercise.question }}</h3>
      <div class="exercise-options" role="group" aria-label="Wybierz odpowiedź">
        <button v-for="(answer, index) in exercise.answers" :key="`${subject}-${index}`" class="exercise-option" :class="{ selected: selected === index, 'is-correct': checked && index === exercise.correct, 'is-incorrect': checked && selected === index && selected !== exercise.correct }" :aria-pressed="selected === index" :disabled="checked" @click="selected = index">
          <span>{{ String.fromCharCode(65 + index) }}</span>{{ answer }}<Check v-if="checked && index === exercise.correct" :size="18" />
        </button>
      </div>
      <div v-if="checked" class="answer-feedback" :class="{ 'try-again': selected !== exercise.correct }" role="status"><strong>{{ selected === exercise.correct ? 'Dokładnie tak. Ogarniasz to! ✨' : 'Jeszcze jeden krok i będzie Twoje.' }}</strong><p>{{ exercise.explanation }}</p></div>
      <button v-if="!checked" class="button button-dark full-width" :disabled="selected === null" @click="checked = true">Sprawdź odpowiedź <ArrowRight :size="18" /></button>
      <button v-else class="button button-dark full-width" @click="resetExercise"><RotateCw :size="17" /> Spróbuj jeszcze raz</button>
      <p class="demo-footnote">Przykładowe zadanie autorskie · nie jest częścią oficjalnego arkusza CKE.</p>
      <RouterLink class="button button-outline full-width demo-next" :to="EXAM_ROUTE">Cały trening z arkuszem CKE, bez konta <ArrowUpRight :size="17" /></RouterLink>
    </section>

    <section v-else-if="activeTab === 'essay'" class="demo-essay" aria-label="Przykładowy feedback">
      <div class="essay-subject"><span class="tag">JĘZYK POLSKI</span><span>Przykładowy feedback</span></div>
      <h3>Czy miłość może prowadzić do zguby?</h3>
      <blockquote><mark>Miłość, która staje się obsesją, potrafi zniszczyć człowieka.</mark> Pokazuje to Wokulski z „Lalki”, który dla Izabeli porzuca naukę i plany. <span class="marked-error">Jest to</span> bardzo ważne, bo <span class="marked-error">jest to</span> przykład tego, że uczucie odbiera mu rozsądek.</blockquote>
      <div class="feedback-item"><span class="feedback-badge good"><CheckCheck :size="19" /></span><div><h4>Teza i argumentacja</h4><p>Jasna teza i trafnie dobrany bohater. Widać związek przykładu z tematem.</p></div></div>
      <div class="feedback-item"><span class="feedback-badge tip"><Lightbulb :size="19" /></span><div><h4>Dodaj kontekst</h4><p>Odwołaj się do romantycznego ideału miłości. Wyjaśnij, jak wpływa na wybory Wokulskiego.</p></div></div>
      <div class="feedback-item"><span class="feedback-badge purple"><Sparkles :size="19" /></span><div><h4>Dopracuj język</h4><p>Usuń powtórzenie „jest to”. Spróbuj: „Ten przykład pokazuje, że uczucie odbiera mu rozsądek”.</p></div></div>
      <p class="demo-footnote">Gotowy przykład oceny fragmentu. Swój tekst sprawdzisz po założeniu darmowego konta.</p>
      <RouterLink class="button button-dark full-width demo-next" :to="ROUTES.signup">Załóż konto i sprawdź swój tekst <ArrowUpRight :size="17" /></RouterLink>
    </section>

    <section v-else class="demo-flashcards" aria-label="Powtórka z fiszkami">
      <div class="flashcard-topline"><span class="mini-eyebrow">{{ card.category }}</span><span>{{ cardIndex + 1 }} / {{ flashcards.length }}</span></div>
      <button class="large-flashcard" :class="{ flipped: cardFlipped }" :aria-label="cardFlipped ? 'Pokaż pytanie' : 'Odwróć fiszkę'" @click="cardFlipped = !cardFlipped">
        <span class="flashcard-symbol"><Lightbulb :size="28" /></span>
        <strong>{{ cardFlipped ? card.answer : card.question }}</strong>
        <span>{{ cardFlipped ? 'O jeden fakt bliżej matury. Tak trzymaj!' : card.hint }}</span>
        <span class="flip-instruction"><RotateCw :size="15" /> Kliknij, żeby {{ cardFlipped ? 'wrócić do pytania' : 'odwrócić' }}</span>
      </button>
      <div class="flashcard-navigation"><button class="button button-outline" @click="moveCard(-1)"><ArrowLeft :size="17" /> Poprzednia</button><div class="flashcard-dots" aria-hidden="true"><i v-for="(_, index) in flashcards" :key="index" :class="{ active: index === cardIndex }"></i></div><button class="button button-dark" @click="moveCard(1)">Następna <ArrowRight :size="17" /></button></div>
      <RouterLink class="button button-outline full-width demo-next" :to="ROUTES.signup">Zrób własne fiszki za darmo <ArrowUpRight :size="17" /></RouterLink>
    </section>
  </dialog>
</template>

<style scoped>
.demo-next { margin-top: 14px; }
</style>
