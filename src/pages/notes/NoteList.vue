<script setup>
// /notatki — the student's AI notes with source and status. Notes still being made are re-checked
// every few seconds (UX: no "refresh the page"); after 5 minutes a pending note counts as interrupted.
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, CircleAlert, LoaderCircle, NotebookPen, Plus } from '@lucide/vue'
import { useAsync } from '@/composables/useAsync'
import { usePolling } from '@/composables/usePolling'
import { ROUTES, noteRoute } from '@/config/routes'
import { NOTE_SOURCE, NOTE_SUBJECT, isInProgress, listNotes } from '@/lib/api/notes'
import { formatDateTime } from '@/lib/format'
import { useBillingStore } from '@/stores/billing'
import AllowanceNote from '@/ui/AllowanceNote.vue'
import EmptyState from '@/ui/EmptyState.vue'
import ErrorState from '@/ui/ErrorState.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'

const billing = useBillingStore()
const { data: notes, loading, error, reload } = useAsync(() => listNotes())
onMounted(() => billing.loadAllowances().catch(() => {}))

// Silent refresh while something is in progress (no skeleton, a failed check is just skipped).
const anyInProgress = computed(() => (notes.value ?? []).some(n => isInProgress(n)))
usePolling(() => anyInProgress.value, async () => {
  try {
    const fresh = await listNotes()
    if (fresh.some(n => n.status === 'done' && notes.value?.find(o => o.id === n.id)?.status === 'pending')) billing.refreshAllowances()
    notes.value = fresh
  } catch {}
})

const status = n => (n.status === 'done' ? 'done' : n.interrupted || n.status === 'error' ? 'stopped' : 'pending')
</script>

<template>
  <PageSkeleton v-if="loading && !notes" />
  <ErrorState v-else-if="error && !notes" @retry="reload" />
  <template v-else>
    <header class="page-header">
      <div>
        <span class="page-kicker"><NotebookPen :size="14" /> Notatki AI</span>
        <h1>Notatki AI<span class="accent-dot">.</span></h1>
        <p>Zrób zdjęcie zeszytu, dodaj prezentację lub PDF albo wklej tekst, a AI ułoży z tego notatkę do powtórki: z osią czasu, tabelami, mapą myśli, fiszkami i krótkim quizem.</p>
      </div>
      <div class="header-cta">
        <RouterLink :to="ROUTES.newNote" class="button button-dark"><Plus :size="18" /> Zrób nową notatkę</RouterLink>
        <AllowanceNote :allowance="billing.allowanceFor('notes')" />
      </div>
    </header>

    <EmptyState v-if="!notes.length" :icon="NotebookPen" title="Nic tu jeszcze nie ma" text="Zacznij od notatek z ostatniej lekcji: zdjęcie zeszytu wystarczy.">
      <RouterLink :to="ROUTES.newNote" class="button button-dark">Zrób pierwszą notatkę</RouterLink>
    </EmptyState>

    <section v-else aria-labelledby="notes-title">
      <h2 id="notes-title" class="section-title">Twoje notatki</h2>
      <ul class="list">
        <li v-for="n in notes" :key="n.id">
          <RouterLink :to="noteRoute(n.id)" class="list-row note-row">
            <span class="note-main">
              <span class="note-title">{{ n.title || 'Notatka' }}</span>
              <span class="card-meta" style="margin: 0">{{ NOTE_SUBJECT[n.subject] }} · {{ NOTE_SOURCE[n.source_kind] ?? n.source_kind }} · {{ formatDateTime(n.created_at) }}</span>
            </span>
            <span v-if="status(n) === 'done'" class="row-end"><ChevronRight :size="18" aria-hidden="true" /></span>
            <span v-else-if="status(n) === 'stopped'" class="badge badge-error"><CircleAlert :size="13" /> przerwane</span>
            <span v-else class="badge badge-info"><LoaderCircle class="spin" :size="13" /> w trakcie…</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </template>
</template>

<style scoped>
.header-cta { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
@media (max-width: 760px) { .header-cta { align-items: flex-start; } }
.note-row { min-height: 70px; }
.note-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.note-title { font-weight: 700; font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-end { color: var(--text-soft); display: inline-flex; }
a.note-row:hover .row-end { color: var(--green); }
</style>
