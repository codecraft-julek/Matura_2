<script setup>
// /fiszki/:deckId — stats, study buttons, 👍/👎 for AI decks, rename (UX: the old app had the
// action but no button), add / edit / delete cards, filter "tylko trudne", TSV export for
// Quizlet / Anki, delete the deck.
import { computed, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Brain, Download, Flame, GraduationCap, Layers, Pencil, Play, Repeat, Shuffle, Trash2 } from '@lucide/vue'
import AddCardForm from '@/components/flashcards/AddCardForm.vue'
import CardRow from '@/components/flashcards/CardRow.vue'
import { useAsync } from '@/composables/useAsync'
import { usePageTitle } from '@/composables/usePageTitle'
import { ROUTES, studyRoute } from '@/config/routes'
import { DECK_SOURCE, cardsToTsv, deleteCard, deleteDeck, getDeck, isAiDeck, isHardCard, renameDeck } from '@/lib/api/flashcards'
import { myRating } from '@/lib/api/ratings'
import { count } from '@/lib/format'
import NotFound from '@/pages/NotFound.vue'
import { useUiStore } from '@/stores/ui'
import AiRating from '@/ui/AiRating.vue'
import AppDialog from '@/ui/AppDialog.vue'
import AppField from '@/ui/AppField.vue'
import ErrorState from '@/ui/ErrorState.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'
import StatTile from '@/ui/StatTile.vue'

const CARDS = ['fiszka', 'fiszki', 'fiszek']
const route = useRoute()
const router = useRouter()
const ui = useUiStore()

async function load() {
  if (!route.params.deckId) return data.value // leaving the page
  const id = String(route.params.deckId)
  const [res, rating] = await Promise.all([getDeck(id), myRating('deck', id).catch(() => null)])
  return res ? { ...res, rating } : null
}
const { data, loading, error, reload } = useAsync(load, { watch: () => route.params.deckId })
// Local copies, updated after every write (no refetch).
const deck = shallowRef(null)
const cards = ref([])
watch(data, value => { deck.value = value?.deck ?? null; cards.value = value?.cards ?? [] })
usePageTitle(() => deck.value?.title)

const nowIso = ref(new Date().toISOString())
const due = computed(() => cards.value.filter(c => c.due_at <= nowIso.value).length)
const learned = computed(() => cards.value.filter(c => c.reps >= 2).length)
const hardCount = computed(() => cards.value.filter(isHardCard).length)

// ─── Filter "tylko trudne" ───
const onlyHard = ref(false)
watch(hardCount, n => { if (n === 0) onlyHard.value = false })
const shown = computed(() => cards.value.map((card, index) => ({ card, index })).filter(({ card }) => !onlyHard.value || isHardCard(card)))

// ─── Cards ───
function onAdded(card) {
  cards.value = [...cards.value, card]
  nowIso.value = new Date().toISOString()
}
function onSaved(id, values) {
  cards.value = cards.value.map(c => (c.id === id ? { ...c, ...values } : c))
  ui.toast('Zapisano fiszkę.')
}
async function removeCard(card) {
  const ok = await ui.confirm({ title: 'Usunąć tę fiszkę?', body: `„${card.front}”`, confirmLabel: 'Usuń', danger: true })
  if (!ok) return
  const res = await deleteCard(card.id)
  if (!res.ok) { ui.toast(res.error, 'error'); return }
  cards.value = cards.value.filter(c => c.id !== card.id)
  ui.toast('Usunięto fiszkę.')
}

// Tab-separated: imports straight into Quizlet ("Importuj") and Anki.
function exportText() {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([cardsToTsv(cards.value)], { type: 'text/plain;charset=utf-8' }))
  a.download = `${deck.value.title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'fiszki'}.txt`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// ─── Rename ───
const renameOpen = ref(false)
const newTitle = ref('')
const renameError = ref('')
const renaming = ref(false)
function openRename() {
  newTitle.value = deck.value.title
  renameError.value = ''
  renameOpen.value = true
}
async function saveRename() {
  renameError.value = ''
  renaming.value = true
  const res = await renameDeck(deck.value.id, newTitle.value)
  renaming.value = false
  if (!res.ok) { renameError.value = res.error; return }
  deck.value = { ...deck.value, title: res.title }
  renameOpen.value = false
  ui.toast('Zmieniono nazwę talii.')
}

// ─── Delete deck ───
const deleting = ref(false)
async function removeDeck() {
  const ok = await ui.confirm({ title: 'Usunąć całą talię?', body: 'Usuniemy ją razem ze wszystkimi fiszkami i postępem powtórek. Tego nie da się cofnąć.', confirmLabel: 'Usuń talię', danger: true })
  if (!ok) return
  deleting.value = true
  const res = await deleteDeck(deck.value.id)
  deleting.value = false
  if (!res.ok) { ui.toast(res.error, 'error'); return }
  ui.toast('Talia usunięta.')
  router.push(ROUTES.flashcards)
}
</script>

<template>
  <PageSkeleton v-if="loading && !data" :rows="4" />
  <ErrorState v-else-if="error" @retry="reload" />
  <NotFound v-else-if="!deck" />
  <div v-else class="deck-page">
    <nav class="breadcrumbs" aria-label="Okruszki"><RouterLink :to="ROUTES.flashcards"><ArrowLeft :size="14" /> Fiszki</RouterLink></nav>

    <header class="page-header deck-header">
      <div class="deck-heading">
        <span class="page-kicker"><Layers :size="14" /> Talia · {{ DECK_SOURCE[deck.source_kind] ?? deck.source_kind }}</span>
        <h1>{{ deck.title }} <button type="button" class="icon-button rename" aria-label="Zmień nazwę talii" title="Zmień nazwę" @click="openRename"><Pencil :size="18" /></button></h1>
        <p v-if="deck.source_label" class="source">Źródło: {{ deck.source_label }}</p>
      </div>
    </header>

    <div class="stat-grid">
      <StatTile label="Fiszki" :value="cards.length" :icon="Layers" tone="sand" />
      <StatTile label="Do powtórki" :value="due" :icon="Repeat" :tone="due ? 'lime' : ''" />
      <StatTile label="Już umiesz" :value="learned" :icon="GraduationCap" />
      <StatTile label="Trudne" :value="hardCount" :icon="Flame" />
    </div>

    <div v-if="cards.length" class="study-actions">
      <RouterLink :to="studyRoute(deck.id, due === 0)" class="button button-dark button-large">
        <Play :size="18" fill="currentColor" /> {{ due > 0 ? `Ucz się (${due})` : 'Powtórz całą talię' }}
      </RouterLink>
      <RouterLink v-if="due > 0 && due < cards.length" :to="studyRoute(deck.id, true)" class="button button-outline button-large"><Shuffle :size="18" /> Wszystkie fiszki</RouterLink>
    </div>

    <div v-if="isAiDeck(deck) && cards.length" class="card card-purple rating">
      <AiRating kind="deck" :target-id="deck.id" :initial="data.rating" question="Czy AI dobrze zrobiło te fiszki?" />
    </div>

    <div class="section-gap">
      <AddCardForm :deck-id="deck.id" @added="onAdded" />
    </div>

    <section class="section-gap" aria-labelledby="cards-title">
      <div class="row-between list-head">
        <h2 id="cards-title" class="section-title" style="margin: 0">Fiszki ({{ cards.length }})</h2>
        <div v-if="cards.length" class="row" style="--gap: 8px">
          <div v-if="hardCount" class="chip-group" role="group" aria-label="Pokaż">
            <button type="button" class="chip" :aria-pressed="!onlyHard" @click="onlyHard = false">Wszystkie</button>
            <button type="button" class="chip" :aria-pressed="onlyHard" @click="onlyHard = true"><Brain :size="15" /> Tylko trudne ({{ hardCount }})</button>
          </div>
          <button type="button" class="button button-ghost button-sm" @click="exportText"><Download :size="16" /> Eksportuj do Quizlet / Anki</button>
        </div>
      </div>
      <p v-if="onlyHard" class="field-hint" style="margin-bottom: 10px">Trudne to fiszki, przy których było już „Nie wiem” albo kilka razy „Trudne”.</p>

      <p v-if="!cards.length" class="card card-tinted empty">Ta talia jest pusta. Dodaj pierwszą fiszkę wyżej.</p>
      <ol v-else class="card-list">
        <CardRow v-for="{ card, index } in shown" :key="card.id" :card="card" :index="index" @saved="values => onSaved(card.id, values)" @remove="removeCard" />
      </ol>
    </section>

    <section class="section-gap danger-zone">
      <button type="button" class="button button-ghost button-sm danger-text" :disabled="deleting" @click="removeDeck"><Trash2 :size="16" /> {{ deleting ? 'Usuwam…' : 'Usuń talię' }}</button>
    </section>

    <AppDialog v-model:open="renameOpen" title="Zmień nazwę talii">
      <form id="rename-form" class="form" style="margin-top: 4px" @submit.prevent="saveRename">
        <AppField label="Nazwa talii" :error="renameError" v-slot="f">
          <input :id="f.id" v-model="newTitle" class="input" maxlength="120" required :aria-invalid="f.invalid" :aria-describedby="f.describedby" />
        </AppField>
      </form>
      <template #actions>
        <button type="button" class="button button-outline button-sm" @click="renameOpen = false">Anuluj</button>
        <button type="submit" form="rename-form" class="button button-dark button-sm" :disabled="renaming || !newTitle.trim()">{{ renaming ? 'Zapisuję…' : 'Zapisz' }}</button>
      </template>
    </AppDialog>
  </div>
</template>

<style scoped>
.deck-page { max-width: 920px; }
.breadcrumbs a { display: inline-flex; align-items: center; gap: 6px; }
.deck-header { margin-bottom: 22px; }
.deck-heading { min-width: 0; }
.deck-heading h1 { overflow-wrap: anywhere; text-wrap: balance; }
.rename { vertical-align: middle; color: var(--text-soft); margin-left: 2px; }
.rename:hover { color: var(--green); }
.source { margin-top: 6px !important; font-size: 14px !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100% !important; }
.study-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.rating { margin-top: 22px; padding: 16px 20px; }
.list-head { margin-bottom: 12px; }
.card-list { margin: 0; padding: 0; list-style: none; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); overflow: hidden; }
.empty { color: var(--text-soft); }
.chip { min-height: 38px; padding: 7px 14px; font-size: 13.5px; }
.danger-zone { padding-top: 22px; border-top: 1px solid var(--line); }
.danger-text { color: var(--error); }
@media (max-width: 560px) { .study-actions .button { flex: 1 1 100%; } }
</style>
