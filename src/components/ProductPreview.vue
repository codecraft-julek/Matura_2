<script setup>
// The product window in the hero: three tabs (essay feedback, a sheet task, a flashcard) that
// visitors can click, each ending in a real demo. Shown straight, with a slight perspective that
// flattens on hover; no stickers or doodles around it, the window is the illustration.
import { ref } from 'vue'
import { Check, ChevronRight, FileText, Layers, Lightbulb, RotateCw, Sparkles } from '@lucide/vue'
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
    <div class="study-window">
      <div class="window-bar">
        <div class="window-dots" aria-hidden="true"><i></i><i></i><i></i></div>
        <span>ogarnijmature.com/panel</span>
        <span class="window-logo"><BrandMark /></span>
      </div>
      <div class="window-content">
        <div class="preview-greeting">
          <div><span class="mini-eyebrow">Dziś</span><h2>Dzisiaj też ogarniesz.</h2></div>
          <span class="demo-pill">Demo</span>
        </div>

        <div class="preview-tabs" aria-label="Podgląd narzędzi">
          <button v-for="tab in tabs" :key="tab.id" :class="{ active: activeTab === tab.id }" :aria-pressed="activeTab === tab.id" @click="activeTab = tab.id">
            <component :is="tab.icon" :size="14" />{{ tab.label }}
          </button>
        </div>

        <div v-if="activeTab === 'essay'" class="preview-panel">
          <div class="paper-heading"><span>Język polski</span><span>Wypracowanie 1</span></div>
          <h3>Czy miłość może<br />prowadzić do zguby?</h3>
          <p class="paper-text"><mark>Miłość, która staje się obsesją, potrafi zniszczyć człowieka.</mark> Pokazuje to Wokulski z „Lalki”, który dla Izabeli porzuca naukę i plany.</p>
          <div class="paper-annotation"><Check :size="13" /> Dobra teza. Tak trzymaj.</div>
          <div class="feedback-line"><span class="feedback-icon"><Sparkles :size="16" /></span><div><strong>Mała zmiana, lepszy argument</strong><p>Dodaj kontekst romantycznego ideału miłości.</p></div><ChevronRight :size="16" /></div>
          <button class="preview-action" @click="emit('open-demo', 'essay')">Zobacz przykładowy feedback</button>
        </div>

        <div v-else-if="activeTab === 'exercise'" class="preview-panel exercise-preview">
          <div class="paper-heading"><span>Język polski</span><span>Zadanie 4 z 21</span></div>
          <h3>Która postawa Wokulskiego<br />ilustruje pozytywizm?</h3>
          <p class="paper-text">Zaznacz jedną odpowiedź. Sprawdzamy według klucza CKE.</p>
          <div class="mini-answer"><span>A</span> Idealizowanie Izabeli Łęckiej</div>
          <div class="mini-answer correct"><span>B</span> Wiara w naukę i pracę <Check :size="14" /></div>
          <button class="preview-action" @click="emit('open-demo', 'exercise')">Rozwiąż przykładowe zadanie</button>
        </div>

        <div v-else class="preview-panel flashcard-preview">
          <div class="paper-heading"><span>Lalka · szybka powtórka</span><span>1 z 3</span></div>
          <button class="preview-flashcard" :aria-label="flipped ? 'Pokaż pytanie fiszki' : 'Odwróć fiszkę i zobacz odpowiedź'" @click="flipped = !flipped">
            <Lightbulb :size="23" />
            <strong>{{ flipped ? 'Bolesław Prus' : 'Kto napisał „Lalkę”?' }}</strong>
            <span>{{ flipped ? 'czyli Aleksander Głowacki' : 'Kliknij, żeby sprawdzić odpowiedź' }}</span>
            <RotateCw :size="16" />
          </button>
          <button class="preview-action" @click="emit('open-demo', 'flashcards')">Jeszcze jedna powtórka</button>
        </div>
      </div>
    </div>
  </div>
</template>
