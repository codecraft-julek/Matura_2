<script setup>
// /fiszki/nowa — 7 sources: file, photos, web page, YouTube (+ optional pasted transcript), text
// (all via the `flashcards-generate` Edge Function, streamed), Quizlet/Anki import and an empty
// deck typed by hand (both saved directly, no AI). Options and texts are kept as a draft in
// localStorage; files and photos are not (too big, and they are read again in a second).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ArrowLeft, Camera, CircleAlert, CirclePlay, FileText, Globe, Import, LoaderCircle, Pencil, Plus, Sparkles } from '@lucide/vue'
import { FLASHCARD_LIMITS, isSafePublicUrl, parseImport, youtubeId } from '@shared/flashcards'
import AiProgress from '@/components/notes/AiProgress.vue'
import PhotoTiles from '@/components/notes/PhotoTiles.vue'
import { useDraft } from '@/composables/useDraft'
import { ROUTES, deckRoute } from '@/config/routes'
import { streamFlashcards } from '@/lib/ai'
import { createDeck } from '@/lib/api/flashcards'
import { extractFile } from '@/lib/flashcards/extract'
import { count as countOf } from '@/lib/format'
import { shrinkPhoto } from '@/lib/notes/image'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'
import AllowanceNote from '@/ui/AllowanceNote.vue'
import AppField from '@/ui/AppField.vue'

const TABS = [
  { id: 'file', label: 'PDF / Word / PPT', icon: FileText },
  { id: 'photo', label: 'Zdjęcia', icon: Camera },
  { id: 'url', label: 'Strona www', icon: Globe },
  { id: 'youtube', label: 'YouTube', icon: CirclePlay },
  { id: 'text', label: 'Tekst', icon: Pencil },
  { id: 'import', label: 'Quizlet / Anki', icon: Import },
  { id: 'manual', label: 'Ręcznie', icon: Plus },
]
const SUBJECTS = [
  { value: 'polish', label: 'Polski' },
  { value: 'english', label: 'Angielski' },
  { value: 'other', label: 'Inne' },
]
const STYLES = [
  { value: 'auto', label: 'Sam wybierz' },
  { value: 'qa', label: 'Pytania i odpowiedzi' },
  { value: 'vocab', label: 'Słówka' },
]
const CARDS = ['fiszka', 'fiszki', 'fiszek']

const router = useRouter()
const auth = useAuthStore()
const billing = useBillingStore()
const subjects = auth.profile?.subjects ?? []
const defaultSubject = subjects.includes('polish') ? 'polish' : subjects.includes('english') ? 'english' : 'other'
const draft = useDraft('deck-new', {
  tab: 'file', subject: defaultSubject, count: 20, style: defaultSubject === 'english' ? 'vocab' : 'auto', url: '', text: '', title: '',
})
if (!TABS.some(t => t.id === draft.value.tab)) draft.value.tab = 'file'

const file = ref(null)
const photos = ref([])
const reading = ref(false)
const busy = ref(false)
const saving = ref(false)
const chars = ref(0)
const seconds = ref(0)
const error = ref('')
let nextId = 0
let timer = null

onMounted(() => billing.loadAllowances().catch(() => {}))
const allowance = computed(() => billing.allowanceFor('flashcards'))
const noneLeft = computed(() => allowance.value !== null && allowance.value.left <= 0)

watch(busy, value => {
  clearInterval(timer)
  if (!value) return
  const t0 = Date.now()
  timer = setInterval(() => { seconds.value = Math.round((Date.now() - t0) / 1000) }, 1000)
})
onBeforeUnmount(() => clearInterval(timer))

// ─── Tabs (roving focus with ← → Home End) ───
const tabRefs = [] // plain array, filled by function refs
function switchTab(id) {
  draft.value.tab = id
  error.value = ''
}
function onTabKey(e, i) {
  const last = TABS.length - 1
  const next = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null
  if (next === null) return
  e.preventDefault()
  switchTab(TABS[next].id)
  nextTick(() => tabRefs[next]?.focus())
}
const tab = computed(() => draft.value.tab)
// Open the transcript box at the start when the draft already has text (not reactively: it would close while typing).
const transcriptOpen = draft.value.text.length > 0

// ─── Sources ───
async function pickFile(e) {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (!f) return
  error.value = ''
  file.value = null
  reading.value = true
  try {
    file.value = await extractFile(f)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Nie udało się odczytać pliku.'
  } finally {
    reading.value = false
  }
}

async function addPhotos(files) {
  error.value = ''
  const room = FLASHCARD_LIMITS.images - photos.value.length
  reading.value = true
  try {
    const urls = await Promise.all(files.slice(0, room).map(shrinkPhoto))
    photos.value = [...photos.value, ...urls.map(u => ({ id: nextId++, url: u }))]
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Nie udało się wczytać zdjęcia.'
  } finally {
    reading.value = false
  }
}
const removePhoto = id => { photos.value = photos.value.filter(p => p.id !== id) }

const enough = t => t.trim().length >= FLASHCARD_LIMITS.minTextChars
// What we'd send to the AI for the current tab (null = not ready yet).
const aiBody = computed(() => {
  const { url, text, title } = draft.value
  switch (tab.value) {
    case 'file':
      return file.value && (file.value.images.length || enough(file.value.text)) ? { kind: file.value.kind, label: file.value.label, text: file.value.text, images: file.value.images } : null
    case 'photo':
      return photos.value.length ? { kind: 'photo', label: '', text: '', images: photos.value.map(p => p.url) } : null
    case 'url':
      return isSafePublicUrl(url.trim()) ? { kind: 'url', label: '', text: '', images: [], url: url.trim() } : null
    case 'youtube':
      // The transcript is optional: without it, the server fetches the video's captions.
      return youtubeId(url.trim()) ? { kind: 'youtube', label: '', text: text.trim(), images: [], url: url.trim() } : null
    case 'text':
      return enough(text) ? { kind: 'text', label: title.trim(), text: text.trim(), images: [] } : null
    default:
      return null
  }
})
const isAi = computed(() => tab.value !== 'import' && tab.value !== 'manual')
const ready = computed(() => (isAi.value ? aiBody.value !== null : draft.value.title.trim().length > 0 && (tab.value === 'manual' || draft.value.text.trim().length > 0)))
const urlProblem = computed(() => {
  const u = draft.value.url.trim()
  if (!u) return ''
  if (tab.value === 'url' && !isSafePublicUrl(u)) return 'To nie wygląda na link do publicznej strony (powinien zaczynać się od https://).'
  if (tab.value === 'youtube' && !youtubeId(u)) return 'To nie wygląda na link do filmu na YouTube.'
  return ''
})
const importCount = computed(() => (tab.value === 'import' && draft.value.text.trim() ? parseImport(draft.value.text).length : 0))

async function generate() {
  const body = aiBody.value
  if (!body || busy.value || noneLeft.value) return
  error.value = ''
  chars.value = 0
  seconds.value = 0
  busy.value = true
  const { subject, count, style } = draft.value
  const res = await streamFlashcards({ ...body, subject, count, style }, { onProgress: n => { chars.value = n } })
  billing.refreshAllowances()
  if (res.ok) {
    draft.clear()
    router.push(deckRoute(res.id))
    return
  }
  busy.value = false
  error.value = res.error
}

async function saveWithoutAi() {
  if (!ready.value || saving.value) return
  error.value = ''
  saving.value = true
  const res = await createDeck({ title: draft.value.title.trim(), subject: draft.value.subject, importText: tab.value === 'import' ? draft.value.text : undefined })
  saving.value = false
  if (!res.ok) { error.value = res.error; return }
  draft.clear()
  router.push(deckRoute(res.id))
}
const submit = () => (isAi.value ? generate() : saveWithoutAi())

const expected = computed(() => draft.value.count * 120)
const progress = computed(() => (chars.value ? 0.15 + 0.83 * Math.min(chars.value / expected.value, 1) : Math.min(seconds.value / 40, 0.15)))
const stage = computed(() => {
  if (chars.value) return `Gotowe mniej więcej ${Math.min(draft.value.count, Math.round(chars.value / 120))} z ${draft.value.count} fiszek…`
  if (tab.value === 'url') return 'Czytam stronę…'
  if (tab.value === 'youtube' && draft.value.text.trim().length < FLASHCARD_LIMITS.minTextChars) return 'Pobieram napisy filmu…'
  return 'Czytam materiał…'
})
</script>

<template>
  <div class="new-deck">
    <nav class="breadcrumbs" aria-label="Okruszki"><RouterLink :to="ROUTES.flashcards"><ArrowLeft :size="14" /> Fiszki</RouterLink></nav>
    <header class="page-header">
      <div>
        <span class="page-kicker">Fiszki</span>
        <h1>Nowa talia<span class="accent-dot">.</span></h1>
        <p>Skąd mamy wziąć fiszki?</p>
      </div>
    </header>

    <AiProgress v-if="busy" title="AI robi fiszki" :progress="progress" :stage="stage" :seconds="seconds" hint="Zwykle 15–40 sekund. Talia otworzy się sama." />

    <form v-else class="form" novalidate @submit.prevent="submit">
      <div class="tabs source-tabs" role="tablist" aria-label="Skąd fiszki">
        <button
          v-for="(t, i) in TABS" :id="`deck-tab-${t.id}`" :key="t.id" :ref="el => (tabRefs[i] = el)"
          type="button" role="tab" :aria-selected="tab === t.id" :aria-controls="`deck-panel`" :tabindex="tab === t.id ? 0 : -1"
          @click="switchTab(t.id)" @keydown="onTabKey($event, i)"
        ><component :is="t.icon" :size="16" />{{ t.label }}</button>
      </div>

      <!-- ── Source ── -->
      <div id="deck-panel" role="tabpanel" :aria-labelledby="`deck-tab-${tab}`" class="stack panel">
        <template v-if="tab === 'file'">
          <label class="drop" :class="{ busy: reading }">
            <input type="file" accept=".pdf,.docx,.pptx,.doc,.ppt,application/pdf" class="sr-only" :disabled="reading" @change="pickFile" />
            <span class="drop-icon" aria-hidden="true"><LoaderCircle v-if="reading" class="spin" :size="24" /><FileText v-else :size="24" /></span>
            <span class="drop-title">{{ reading ? 'Czytam plik…' : file ? 'Wybierz inny plik' : 'Wybierz plik' }}</span>
            <span class="field-hint">PDF, Word (.docx) albo PowerPoint (.pptx), do 25 MB</span>
          </label>
          <p v-if="file" class="alert alert-ok" role="status"><FileText :size="18" /><span><strong>{{ file.label }}</strong> · {{ file.info }}</span></p>
          <p class="field-hint">Plik czytamy w Twojej przeglądarce. Do AI trafia tylko jego tekst.</p>
        </template>

        <template v-else-if="tab === 'photo'">
          <PhotoTiles :photos="photos" :can-add="photos.length < FLASHCARD_LIMITS.images" :busy="reading" add-hint="zeszyt, podręcznik, tablica" @add="addPhotos" @remove="removePhoto" />
          <p class="field-hint">Do {{ FLASHCARD_LIMITS.images }} zdjęć. Zdjęć nie zapisujemy.</p>
        </template>

        <AppField v-else-if="tab === 'url'" label="Link do strony" :error="urlProblem" hint="Artykuł, streszczenie, opracowanie. Strony za logowaniem nie zadziałają: wtedy skopiuj tekst do zakładki „Tekst”." v-slot="f">
          <input :id="f.id" v-model="draft.url" class="input" type="url" inputmode="url" autocomplete="off" placeholder="https://pl.wikipedia.org/wiki/Pozytywizm" :aria-invalid="f.invalid" :aria-describedby="f.describedby" />
        </AppField>

        <template v-else-if="tab === 'youtube'">
          <AppField label="Link do filmu" :error="urlProblem" hint="Pobierzemy napisy filmu i zrobimy z nich fiszki. Działa z filmami, które mają napisy (także automatyczne)." v-slot="f">
            <input :id="f.id" v-model="draft.url" class="input" type="url" inputmode="url" autocomplete="off" placeholder="https://www.youtube.com/watch?v=…" :aria-invalid="f.invalid" :aria-describedby="f.describedby" />
          </AppField>
          <details class="card transcript" :open="transcriptOpen">
            <summary>Film nie ma napisów? Wklej transkrypcję sam <span class="muted">(opcjonalnie)</span></summary>
            <p class="field-hint" style="margin-top: 8px">Na YouTube pod filmem kliknij „…więcej”, potem „Pokaż transkrypcję”, zaznacz tekst w panelu i skopiuj go tutaj. Wtedy nie pobieramy napisów.</p>
            <AppField label="Transkrypcja" sr-label :counter="{ value: draft.text.length, max: FLASHCARD_LIMITS.textChars, unit: 'zn.' }" v-slot="f">
              <textarea :id="f.id" v-model="draft.text" class="textarea" rows="6" :maxlength="FLASHCARD_LIMITS.textChars" placeholder="0:00 Dzisiaj omówimy pozytywizm…"></textarea>
            </AppField>
          </details>
        </template>

        <template v-else>
          <AppField label="Nazwa talii" :optional="tab === 'text'" v-slot="f">
            <input :id="f.id" v-model="draft.title" class="input" maxlength="120" :placeholder="tab === 'import' ? 'np. Unit 5 – vocabulary' : 'np. Romantyzm – pojęcia'" :aria-describedby="f.describedby" />
          </AppField>
          <AppField
            v-if="tab === 'text' || tab === 'import'"
            :label="tab === 'text' ? 'Tekst do nauki' : 'Fiszki do importu'"
            :hint="tab === 'import' ? 'Quizlet: zestaw → „⋯” → „Eksportuj”, skopiuj i wklej. Anki: eksport do pliku tekstowego. Albo pisz sam: jedna fiszka w linii, przód i tył oddzielone tabulatorem albo „ - ”.' : ''"
            :counter="tab === 'text' ? { value: draft.text.length, max: FLASHCARD_LIMITS.textChars, unit: 'zn.' } : null"
            v-slot="f"
          >
            <textarea
              :id="f.id" v-model="draft.text" class="textarea" :class="{ mono: tab === 'import' }" rows="9" :aria-describedby="f.describedby"
              :maxlength="tab === 'import' ? 200000 : FLASHCARD_LIMITS.textChars"
              :placeholder="tab === 'import' ? 'apple\tjabłko\nto give up - poddać się' : 'Wklej notatki, fragment podręcznika, listę słówek…'"
            ></textarea>
          </AppField>
          <p v-if="tab === 'import' && draft.text.trim()" class="badge" :class="importCount ? 'badge-ok' : 'badge-warn'" aria-live="polite" style="align-self: flex-start">
            {{ importCount ? `Rozpoznano ${countOf(importCount, CARDS)}` : 'Nie rozpoznaliśmy jeszcze żadnej fiszki' }}
          </p>
          <p v-if="tab === 'manual'" class="field-hint">Zrobimy pustą talię, a fiszki dodasz na jej stronie.</p>
        </template>
      </div>

      <!-- ── Options ── -->
      <fieldset class="field">
        <legend class="field-label">Przedmiot</legend>
        <div class="chip-group"><label v-for="o in SUBJECTS" :key="o.value" class="chip"><input v-model="draft.subject" type="radio" name="subject" :value="o.value" />{{ o.label }}</label></div>
      </fieldset>
      <template v-if="isAi">
        <fieldset class="field">
          <legend class="field-label">Ile fiszek</legend>
          <div class="chip-group"><label v-for="c in FLASHCARD_LIMITS.counts" :key="c" class="chip"><input v-model="draft.count" type="radio" name="count" :value="c" />{{ c }}</label></div>
        </fieldset>
        <fieldset class="field">
          <legend class="field-label">Rodzaj</legend>
          <div class="chip-group"><label v-for="o in STYLES" :key="o.value" class="chip"><input v-model="draft.style" type="radio" name="style" :value="o.value" />{{ o.label }}</label></div>
        </fieldset>
      </template>

      <div v-if="error" class="alert alert-error" role="alert"><CircleAlert :size="18" /><span>{{ error }}</span></div>

      <div class="form-actions">
        <template v-if="isAi">
          <button type="submit" class="button button-dark button-large" :disabled="!ready || reading || noneLeft"><Sparkles :size="18" /> Zrób fiszki z AI</button>
          <AllowanceNote :allowance="allowance" />
        </template>
        <button v-else type="submit" class="button button-dark button-large" :disabled="!ready || saving" :aria-busy="saving">
          <LoaderCircle v-if="saving" class="spin" :size="18" />{{ saving ? 'Zapisuję…' : tab === 'import' ? 'Importuj fiszki' : 'Utwórz talię' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.new-deck { max-width: 780px; }
.breadcrumbs a { display: inline-flex; align-items: center; gap: 6px; }
fieldset { border: 0; margin: 0; padding: 0; }
fieldset .chip-group { margin-top: 8px; }
.source-tabs { flex-wrap: wrap; }
@media (max-width: 640px) { .source-tabs { flex-wrap: nowrap; margin-inline: -16px; border-radius: 0; border-inline: 0; padding-inline: 12px; } }
.panel { --gap: 12px; }
.drop { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 30px 20px; text-align: center; border: 1.5px dashed var(--line-strong); border-radius: var(--radius-lg); background: var(--surface); cursor: pointer; transition: border-color .15s, background .15s; }
.drop:hover { border-color: var(--green); background: var(--surface-3); }
.drop:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 3px; }
.drop.busy { cursor: progress; }
.drop-icon { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: #f5f0e5; color: #99885f; margin-bottom: 8px; }
.drop-title { font-family: var(--heading); font-weight: 750; font-size: 16px; }
.transcript { padding: 14px 18px; }
.transcript summary { cursor: pointer; font-weight: 650; font-size: 14.5px; }
.transcript .field { margin-top: 10px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; }
@media (max-width: 860px) { .mono { font-size: 16px; } }
</style>
