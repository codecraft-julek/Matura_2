<script setup>
// /notatki/:noteId — the AI note (8 block types), its flashcards (+ "Zapisz jako talię"), the quiz,
// print / save as PDF (browser print dialog, print styles below), delete, 👍/👎.
// A note still being made is re-checked every few seconds until it's done.
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, CircleAlert, LoaderCircle, Printer, Trash2 } from '@lucide/vue'
import NoteView from '@/components/notes/NoteView.vue'
import { useAsync } from '@/composables/useAsync'
import { usePageTitle } from '@/composables/usePageTitle'
import { usePolling } from '@/composables/usePolling'
import { ROUTES } from '@/config/routes'
import { NOTE_SUBJECT_LONG, deleteNote, getNote, isInProgress, isInterrupted } from '@/lib/api/notes'
import { myRating } from '@/lib/api/ratings'
import { formatDate } from '@/lib/format'
import NotFound from '@/pages/NotFound.vue'
import { useBillingStore } from '@/stores/billing'
import { useUiStore } from '@/stores/ui'
import AiRating from '@/ui/AiRating.vue'
import ErrorState from '@/ui/ErrorState.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const billing = useBillingStore()

async function load() {
  if (!route.params.noteId) return data.value // leaving the page
  const id = String(route.params.noteId)
  const [note, rating] = await Promise.all([getNote(id), myRating('note', id).catch(() => null)])
  return { note, rating }
}
const { data, loading, error, reload } = useAsync(load, { watch: () => route.params.noteId })
const n = computed(() => data.value?.note ?? null)
const title = computed(() => n.value?.note?.title || n.value?.title || 'Notatka')
usePageTitle(() => (n.value ? title.value : ''))

const inProgress = computed(() => Boolean(n.value && isInProgress(n.value)))
usePolling(() => inProgress.value, async () => {
  try {
    const fresh = await getNote(n.value.id)
    if (fresh) {
      if (fresh.status !== 'pending') billing.refreshAllowances()
      data.value = { ...data.value, note: fresh }
    }
  } catch {}
})

const sourceLabel = computed(() => {
  const kind = n.value?.source_kind
  if (kind === 'text') return 'Twój tekst'
  if (['pdf', 'docx', 'pptx'].includes(kind)) return 'Tekst z Twojego pliku'
  return 'Co AI odczytało z Twoich notatek'
})

const deleting = ref(false)
async function remove() {
  const ok = await ui.confirm({ title: 'Usunąć tę notatkę?', body: 'Tego nie da się cofnąć. Talie zapisane z tej notatki zostaną.', confirmLabel: 'Usuń notatkę', danger: true })
  if (!ok) return
  deleting.value = true
  const res = await deleteNote(n.value.id)
  deleting.value = false
  if (!res.ok) { ui.toast(res.error, 'error'); return }
  ui.toast('Notatka usunięta.')
  router.push(ROUTES.notes)
}
const print = () => window.print()
</script>

<template>
  <PageSkeleton v-if="loading && !data" :rows="4" />
  <ErrorState v-else-if="error && !data" @retry="reload" />
  <NotFound v-else-if="!n" />
  <article v-else class="note-page">
    <nav class="breadcrumbs no-print" aria-label="Okruszki"><RouterLink :to="ROUTES.notes"><ArrowLeft :size="14" /> Notatki</RouterLink></nav>

    <header class="note-header">
      <div class="note-heading">
        <p class="page-kicker">{{ NOTE_SUBJECT_LONG[n.subject] ?? 'Notatka' }} · {{ formatDate(n.created_at) }}</p>
        <h1>{{ title }}</h1>
      </div>
      <div class="note-actions no-print">
        <button v-if="n.status === 'done'" type="button" class="button button-outline button-sm" @click="print"><Printer :size="16" /> Drukuj / PDF</button>
        <button type="button" class="button button-ghost button-sm danger-text" :disabled="deleting" @click="remove"><Trash2 :size="16" /> {{ deleting ? 'Usuwam…' : 'Usuń' }}</button>
      </div>
    </header>

    <template v-if="n.status === 'done' && n.note">
      <NoteView :note="n.note" :note-id="n.id" />
      <div class="card card-purple rating-card no-print">
        <AiRating kind="note" :target-id="n.id" :initial="data.rating" question="Czy ta notatka jest dobra?" />
      </div>
    </template>
    <div v-else-if="inProgress" class="card card-purple state-card" role="status">
      <LoaderCircle class="spin" :size="22" />
      <div>
        <p class="card-title">Ta notatka jeszcze się robi…</p>
        <p class="card-meta">Zwykle trwa to 30–60 sekund. Strona odświeży się sama, gdy notatka będzie gotowa.</p>
      </div>
    </div>
    <div v-else class="alert alert-error" role="alert">
      <CircleAlert :size="18" />
      <span>{{ n.status === 'pending' && isInterrupted(n) ? 'Ta notatka została przerwana. Usuń ją i spróbuj ponownie.' : 'Tej notatki nie udało się zrobić. Usuń ją i spróbuj ponownie.' }}
        <RouterLink :to="ROUTES.newNote" class="link">Nowa notatka</RouterLink></span>
    </div>

    <details v-if="n.source_text" class="card source no-print">
      <summary>{{ sourceLabel }}</summary>
      <p class="source-text">{{ n.source_text }}</p>
    </details>
    <p class="disclaimer">Notatka przygotowana przez AI na podstawie Twoich materiałów. Może zawierać błędy: sprawdzaj zwłaszcza fragmenty oznaczone jako „dodane przez AI”.</p>
  </article>
</template>

<style scoped>
.note-page { max-width: 860px; }
.breadcrumbs a { display: inline-flex; align-items: center; gap: 6px; }
.note-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 26px; }
.note-heading { min-width: 0; flex: 1 1 380px; }
.note-heading .page-kicker { margin-bottom: 8px; }
.note-heading h1 { font-size: clamp(28px, 4vw, 40px); line-height: 1.15; letter-spacing: -1.4px; font-weight: 750; text-wrap: balance; }
.note-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.danger-text { color: var(--error); }
.rating-card { margin-top: 26px; padding: 16px 20px; }
.state-card { display: flex; gap: 14px; align-items: flex-start; color: var(--info); }
.state-card .card-title { color: var(--text); }
.source { margin-top: 30px; padding: 16px 20px; }
.source summary { cursor: pointer; font-family: var(--heading); font-weight: 750; }
.source-text { margin-top: 12px; font-size: 14px; line-height: 1.65; color: var(--text-soft); white-space: pre-wrap; overflow-wrap: anywhere; }
.disclaimer { margin-top: 22px; font-size: 12.5px; line-height: 1.55; color: var(--text-soft); }

@media print {
  @page { margin: 14mm 12mm; }
  .note-page { max-width: none; font-size: 12.5px; }
  .note-header { margin-bottom: 14px; }
  .note-heading h1 { font-size: 24px; letter-spacing: -.5px; }
  .disclaimer { margin-top: 14px; font-size: 10px; }
}
</style>
