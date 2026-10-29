<script setup>
// /wypracowania: what the AI checked so far, the weekly/daily limit and the way to a new check.
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, PenLine, Plus } from '@lucide/vue'
import AllowanceNote from '@/ui/AllowanceNote.vue'
import EmptyState from '@/ui/EmptyState.vue'
import ErrorState from '@/ui/ErrorState.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'
import { ROUTES, essayRoute } from '@/config/routes'
import { useAsync } from '@/composables/useAsync'
import { usePolling } from '@/composables/usePolling'
import { listMyEssays } from '@/lib/api/essays'
import { formatDateTime } from '@/lib/format'
import { useBillingStore } from '@/stores/billing'

const billing = useBillingStore()
const { data: essays, loading, error, reload } = useAsync(() => listMyEssays())
const allowance = computed(() => billing.allowanceFor('essay_feedback'))
onMounted(() => billing.loadAllowances().catch(() => {}))

const title = e => e.topic || (e.kind === 'english_writing' ? 'Wypowiedź pisemna (angielski)' : 'Wypracowanie')
const meta = e => `${e.kind === 'polish_essay' ? 'polski' : 'angielski'}${e.level === 'extended' ? ' rozszerzony' : ''} · ${formatDateTime(e.created_at)}`

// A check still running (e.g. opened in another tab) finishes on its own: refresh quietly.
const RECENT = 16 * 60 * 1000
const hasPending = () => Boolean(essays.value?.some(e => e.status === 'pending' && Date.now() - new Date(e.created_at).getTime() < RECENT))
usePolling(hasPending, async () => {
  try { essays.value = await listMyEssays() } catch {}
}, { interval: 4000, maxMs: RECENT })
</script>

<template>
  <PageSkeleton v-if="loading && !essays" />
  <ErrorState v-else-if="error && !essays" @retry="reload" />
  <template v-else>
    <header class="page-header">
      <div>
        <span class="page-kicker">Wypracowania</span>
        <h1>Feedback AI do wypracowań<span class="accent-dot">.</span></h1>
        <p>Wklejasz wypracowanie i dostajesz uwagi kryterium po kryterium według zasad CKE: co działa, co poprawić i od czego zacząć.</p>
      </div>
    </header>

    <div class="card card-purple new-card">
      <div class="row new-row">
        <RouterLink :to="ROUTES.newEssay" class="button button-dark button-large"><Plus :size="18" /> Sprawdź nowe wypracowanie</RouterLink>
        <AllowanceNote :allowance="allowance" />
      </div>
      <p class="muted small">Wypowiedzi z angielskiego sprawdzisz w wyniku arkusza, przyciskiem „Sprawdź z AI”.</p>
    </div>

    <section class="section-gap" aria-labelledby="essays-title">
      <h2 id="essays-title" class="section-title">Twoje teksty</h2>
      <EmptyState v-if="!essays.length" :icon="PenLine" title="Nic tu jeszcze nie ma" text="Wklej pierwsze wypracowanie i zobacz, co powie AI.">
        <RouterLink :to="ROUTES.newEssay" class="button button-dark">Sprawdź wypracowanie</RouterLink>
      </EmptyState>
      <ul v-else class="list">
        <li v-for="e in essays" :key="e.id">
          <RouterLink :to="essayRoute(e.id)" class="list-row essay-row">
            <span class="essay-main">
              <span class="essay-title">{{ title(e) }}</span>
              <span class="card-meta">{{ meta(e) }}</span>
            </span>
            <span class="essay-side">
              <span v-if="e.status === 'done' && e.feedback" class="badge badge-ok tabular">{{ e.feedback.total }}/{{ e.feedback.max }} pkt</span>
              <span v-else-if="e.status === 'error'" class="badge badge-error">błąd</span>
              <span v-else class="badge badge-info">AI sprawdza…</span>
              <ChevronRight :size="18" class="muted" aria-hidden="true" />
            </span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </template>
</template>

<style scoped>
.new-card { display: flex; flex-direction: column; gap: 12px; }
.new-row { --gap: 10px 18px; }
.essay-row { gap: 14px; }
.essay-main { display: flex; flex-direction: column; min-width: 0; }
.essay-title { font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.essay-main .card-meta { margin-top: 2px; }
.essay-side { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; }
@media (max-width: 560px) { .new-row .button { width: 100%; } }
</style>
