<script setup>
// /notatki/nowa — subject, up to 4 photos (shrunk in the browser), a PDF/Word/PowerPoint file (text
// read locally; a scan sends its first pages as images), extra text. Sent to `notes-generate`
// (streamed progress). Subject and text are kept as a draft in localStorage (photos are too big).
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ArrowLeft, CircleAlert, FileText, Sparkles, X } from '@lucide/vue'
import { NOTE_LIMITS } from '@shared/notes'
import AiProgress from '@/components/notes/AiProgress.vue'
import PhotoTiles from '@/components/notes/PhotoTiles.vue'
import { useDraft } from '@/composables/useDraft'
import { ROUTES, noteRoute } from '@/config/routes'
import { streamNote } from '@/lib/ai'
import { extractFile } from '@/lib/flashcards/extract'
import { shrinkPhoto } from '@/lib/notes/image'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'
import AllowanceNote from '@/ui/AllowanceNote.vue'
import AppField from '@/ui/AppField.vue'

const SUBJECTS = [
  { value: 'polish', label: 'Polski' },
  { value: 'english', label: 'Angielski' },
  { value: 'other', label: 'Inne' },
]
/** A finished note is about this many characters of JSON; used to show real progress. */
const EXPECTED_CHARS = 9000
const STAGES = [
  { from: 0, text: 'Czytam Twoje notatki…' },
  { from: 0.25, text: 'Układam najważniejsze rzeczy…' },
  { from: 0.5, text: 'Rysuję diagramy i tabele…' },
  { from: 0.8, text: 'Robię fiszki i quiz…' },
]

const router = useRouter()
const auth = useAuthStore()
const billing = useBillingStore()
const subjects = auth.profile?.subjects ?? []
const defaultSubject = subjects.includes('polish') ? 'polish' : subjects.includes('english') ? 'english' : 'other'
const draft = useDraft('note-new', { subject: defaultSubject, text: '' })

const photos = ref([]) // [{ id, url }]
const file = ref(null) // Extracted from extract.ts
const readingFile = ref(false)
const preparing = ref(false)
const busy = ref(false)
const error = ref('')
const chars = ref(0)
const seconds = ref(0)
let nextId = 0
let timer = null

onMounted(() => billing.loadAllowances().catch(() => {}))
const allowance = computed(() => billing.allowanceFor('notes'))
const noneLeft = computed(() => allowance.value !== null && allowance.value.left <= 0)

watch(busy, value => {
  clearInterval(timer)
  if (!value) return
  const t0 = Date.now()
  timer = setInterval(() => { seconds.value = Math.round((Date.now() - t0) / 1000) }, 1000)
})
onBeforeUnmount(() => clearInterval(timer))

// A scanned PDF brings its pages as images; together with photos max NOTE_LIMITS.images.
const usedImages = computed(() => photos.value.length + (file.value?.images.length ?? 0))

async function addPhotos(files) {
  error.value = ''
  const room = NOTE_LIMITS.images - usedImages.value
  if (room <= 0) { error.value = `Możesz dodać maks. ${NOTE_LIMITS.images} zdjęcia.`; return }
  preparing.value = true
  try {
    const urls = await Promise.all(files.slice(0, room).map(shrinkPhoto))
    photos.value = [...photos.value, ...urls.map(url => ({ id: nextId++, url }))]
    if (files.length > room) error.value = `Dodano ${room} — maks. ${NOTE_LIMITS.images} zdjęcia na notatkę.`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Nie udało się wczytać zdjęcia.'
  } finally {
    preparing.value = false
  }
}
const removePhoto = id => { photos.value = photos.value.filter(p => p.id !== id) }

/** PDF / Word / PowerPoint: read in the browser, only the text (or a scan's pages) goes to the AI. */
async function addDocument(picked) {
  error.value = ''
  readingFile.value = true
  try {
    const doc = await extractFile(picked)
    if (photos.value.length + doc.images.length > NOTE_LIMITS.images) {
      throw new Error(`Ten skan ma strony jako obrazy, a razem ze zdjęciami to więcej niż ${NOTE_LIMITS.images}. Usuń kilka zdjęć.`)
    }
    file.value = doc
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Nie udało się odczytać pliku.'
  } finally {
    readingFile.value = false
  }
}

const combinedText = computed(() => [file.value?.text ?? '', draft.value.text.trim()].filter(Boolean).join('\n\n'))
const enough = computed(() => usedImages.value > 0 || combinedText.value.length >= NOTE_LIMITS.minTextChars)
const canSubmit = computed(() => enough.value && !preparing.value && !readingFile.value && !noneLeft.value && !busy.value)

async function submit() {
  if (!canSubmit.value) return
  error.value = ''
  chars.value = 0
  seconds.value = 0
  busy.value = true
  const res = await streamNote(
    {
      subject: draft.value.subject,
      text: combinedText.value.slice(0, NOTE_LIMITS.textChars),
      images: [...(file.value?.images ?? []), ...photos.value.map(p => p.url)],
      ...(file.value ? { file: { kind: file.value.kind, name: file.value.label } } : {}),
    },
    { onProgress: n => { chars.value = n } },
  )
  billing.refreshAllowances()
  if (res.ok) {
    draft.clear()
    router.push(noteRoute(res.id)) // keep the loader until the note page opens
    return
  }
  busy.value = false
  error.value = res.error
}

const progress = computed(() => (chars.value ? 0.2 + 0.78 * Math.min(chars.value / EXPECTED_CHARS, 1) : Math.min(seconds.value / 60, 0.2)))
const stage = computed(() => [...STAGES].reverse().find(s => progress.value >= s.from)?.text ?? STAGES[0].text)
</script>

<template>
  <div class="new-note">
    <nav class="breadcrumbs no-print" aria-label="Okruszki"><RouterLink :to="ROUTES.notes"><ArrowLeft :size="14" /> Notatki</RouterLink></nav>
    <header class="page-header">
      <div>
        <span class="page-kicker">Notatki AI</span>
        <h1>Nowa notatka<span class="accent-dot">.</span></h1>
        <p>Dodaj zdjęcia zeszytu, plik (PDF, Word, PowerPoint) albo wklej tekst. AI wybierze, co najlepiej pokazać na osi czasu, w tabeli albo na mapie myśli, i dorzuci fiszki z quizem.</p>
      </div>
    </header>

    <AiProgress
      v-if="busy" title="AI robi notatkę" :progress="progress" :stage="stage" :seconds="seconds"
      hint="Zwykle trwa to 30–60 sekund. Możesz zostać na tej stronie; gotowa notatka otworzy się sama."
    />

    <form v-else class="form" novalidate @submit.prevent="submit">
      <fieldset class="field">
        <legend class="field-label">Przedmiot</legend>
        <div class="chip-group" style="margin-top: 8px">
          <label v-for="o in SUBJECTS" :key="o.value" class="chip"><input v-model="draft.subject" type="radio" name="subject" :value="o.value" />{{ o.label }}</label>
        </div>
      </fieldset>

      <div class="field">
        <p class="field-label" id="sources-label">Zdjęcia albo plik</p>
        <p class="field-hint">Zdjęcie zeszytu (do {{ NOTE_LIMITS.images }}, najlepiej w dobrym świetle, cała strona) albo plik PDF, Word lub PowerPoint, np. prezentacja z lekcji.</p>
        <div v-if="file" class="file-row">
          <span class="file-icon" aria-hidden="true"><FileText :size="20" /></span>
          <div class="file-info">
            <p class="file-name">{{ file.label }}</p>
            <p class="field-hint">{{ file.info }}<template v-if="file.text.length > NOTE_LIMITS.textChars"> AI dostanie początek pliku.</template></p>
          </div>
          <button type="button" class="icon-button" aria-label="Usuń plik" @click="file = null"><X :size="18" /></button>
        </div>
        <PhotoTiles
          role="group" aria-labelledby="sources-label" style="margin-top: 6px"
          :photos="photos" :can-add="usedImages < NOTE_LIMITS.images" :busy="preparing"
          :doc-tile="!file" :doc-busy="readingFile"
          @add="addPhotos" @remove="removePhoto" @doc="addDocument"
        />
      </div>

      <AppField
        :label="photos.length || file ? 'Dodatkowy tekst' : 'Albo wklej tekst notatek'" :optional="Boolean(photos.length || file)"
        :counter="{ value: draft.text.length, max: NOTE_LIMITS.textChars, unit: 'zn.' }" v-slot="f"
      >
        <textarea
          :id="f.id" v-model="draft.text" class="textarea" rows="8" :maxlength="NOTE_LIMITS.textChars" :aria-describedby="f.describedby"
          placeholder="Np. notatki z lekcji, fragment z podręcznika, swoje punkty do powtórki…"
        ></textarea>
      </AppField>

      <div v-if="error" class="alert alert-error" role="alert"><CircleAlert :size="18" /><span>{{ error }}</span></div>

      <div class="form-actions">
        <button type="submit" class="button button-dark button-large" :disabled="!canSubmit"><Sparkles :size="18" /> Zrób notatkę</button>
        <AllowanceNote :allowance="allowance" />
      </div>
      <p v-if="!enough" class="field-hint">Dodaj zdjęcie, plik albo co najmniej {{ NOTE_LIMITS.minTextChars }} znaków tekstu.</p>
      <p class="field-hint privacy">
        Zdjęć i plików nie zapisujemy: pliki czytamy w Twojej przeglądarce, AI dostaje tylko ich treść, a my zachowujemy sam tekst.
        Nie fotografuj danych osobowych. AI może się pomylić, więc sprawdzaj rzeczy oznaczone jako „dodane przez AI”.
      </p>
    </form>
  </div>
</template>

<style scoped>
.new-note { max-width: 760px; }
fieldset { border: 0; margin: 0; padding: 0; }
.breadcrumbs a { display: inline-flex; align-items: center; gap: 6px; }
.file-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--ok-line); background: var(--ok-bg); border-radius: var(--radius); }
.file-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; background: var(--surface); color: var(--ok); flex-shrink: 0; }
.file-info { flex: 1; min-width: 0; }
.file-name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.privacy { font-size: 12.5px; }
</style>
