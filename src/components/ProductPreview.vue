<script setup>
import { ref } from 'vue'
import { ArrowUpRight, Check, ChevronRight, FileText, Layers, Lightbulb, RotateCw, Sparkles } from '@lucide/vue'
import BrandMark from './BrandMark.vue'

const emit = defineEmits(['open-demo'])
const activeTab = ref('essay')
const flipped = ref(false)
const tabs = [
  { id: 'essay', label: 'Wypracowanie', icon: Sparkles },
  { id: 'exercise', label: 'Arkusze', icon: FileText },
  { id: 'flashcards', label: 'Fiszki', icon: Layers },
]
</script>

<template>
  <div class="hero-visual">
    <div class="orbit orbit-one" aria-hidden="true"></div>
    <div class="orbit orbit-two" aria-hidden="true"></div>
    <BrandMark class="hero-spark" />
    <div class="floating-note"><Sparkles :size="19" /><span>Twój nowy<br /><strong>study buddy.</strong></span></div>

    <div class="study-window">
      <div class="window-bar">
        <div class="window-dots" aria-hidden="true"><i></i><i></i><i></i></div>
        <span>twoja strefa ogarniania</span>
        <span class="window-logo"><BrandMark /></span>
      </div>
      <div class="window-content">
        <div class="preview-greeting">
          <div><span class="mini-eyebrow">MAŁE KROKI, DUŻY PROGRES</span><h2>Dzisiaj też ogarniesz.<span>✌️</span></h2></div>
          <span class="demo-pill">DEMO</span>
        </div>

        <div class="preview-tabs" aria-label="Podgląd narzędzi">
          <button v-for="tab in tabs" :key="tab.id" :class="{ active: activeTab === tab.id }" :aria-pressed="activeTab === tab.id" @click="activeTab = tab.id">
            <component :is="tab.icon" :size="14" />{{ tab.label }}
          </button>
        </div>

        <div v-if="activeTab === 'essay'" class="preview-panel">
          <div class="paper-heading"><span><i class="subject-dot"></i> Język polski</span><span>Wypracowanie #01</span></div>
          <h3>Czy miłość może<br />prowadzić do zguby?</h3>
          <p class="paper-text"><mark>Miłość, która staje się obsesją, potrafi zniszczyć człowieka.</mark> Pokazuje to Wokulski z „Lalki”, który dla Izabeli porzuca naukę i plany.</p>
          <div class="paper-annotation"><Check :size="13" /> Dobra teza. Tak trzymaj!</div>
          <div class="feedback-line"><span class="feedback-icon"><Sparkles :size="16" /></span><div><strong>Mała zmiana, lepszy argument</strong><p>Dodaj kontekst romantycznego ideału miłości.</p></div><ChevronRight :size="16" /></div>
          <button class="preview-action" @click="emit('open-demo', 'essay')">Zobacz przykładowy feedback <ArrowUpRight :size="15" /></button>
        </div>

        <div v-else-if="activeTab === 'exercise'" class="preview-panel exercise-preview">
          <div class="paper-heading"><span><i class="subject-dot"></i> Język polski</span><span>Przykładowe zadanie</span></div>
          <h3>Jeden krok bliżej<br />do „umiem to”.</h3>
          <p class="paper-text">Która postawa Wokulskiego najlepiej ilustruje ideały pozytywizmu?</p>
          <div class="mini-answer"><span>A</span> Idealizowanie Izabeli Łęckiej</div>
          <div class="mini-answer correct"><span>B</span> Wiara w naukę i pracę <Check :size="14" /></div>
          <button class="preview-action" @click="emit('open-demo', 'exercise')">Rozwiąż przykładowe zadanie <ArrowUpRight :size="15" /></button>
        </div>

        <div v-else class="preview-panel flashcard-preview">
          <div class="paper-heading"><span><i class="subject-dot"></i> Szybka powtórka</span><span>01 / 03</span></div>
          <button class="preview-flashcard" :aria-label="flipped ? 'Pokaż pytanie fiszki' : 'Odwróć fiszkę i zobacz odpowiedź'" @click="flipped = !flipped">
            <Lightbulb :size="23" />
            <strong>{{ flipped ? 'Bolesław Prus' : 'Kto napisał „Lalkę”?' }}</strong>
            <span>{{ flipped ? 'czyli Aleksander Głowacki' : 'Kliknij, żeby sprawdzić odpowiedź' }}</span>
            <RotateCw :size="16" />
          </button>
          <button class="preview-action" @click="emit('open-demo', 'flashcards')">Jeszcze jedna mała powtórka <ArrowUpRight :size="15" /></button>
        </div>
      </div>
    </div>

    <div class="progress-sticker"><span class="sticker-icon"><Check :size="21" :stroke-width="2.8" /></span><div><strong>Mniej stresu.</strong><span>Więcej „umiem to”.</span></div><span class="sticker-confetti" aria-hidden="true">✦</span></div>
    <div class="visual-caption"><svg viewBox="0 0 60 36" fill="none" aria-hidden="true"><path d="M3 3c4 24 29 30 50 14m-13-2 15 0-4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg><span>klikaj, sprawdzaj, ogarniaj.</span></div>
  </div>
</template>
