<script setup>
// /wypracowania/:essayId: the AI feedback for one essay. While the check is still running
// ("pending", e.g. opened from the list or another tab) the page asks again every 3 s.
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronLeft, LoaderCircle, RotateCw } from '@lucide/vue'
import { RUBRICS, rubricFor } from '@shared/essay'
import AiRating from '@/ui/AiRating.vue'
import ErrorState from '@/ui/ErrorState.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'
import FeedbackView from '@/components/essays/FeedbackView.vue'
import NotFound from '@/pages/NotFound.vue'
import { ROUTES } from '@/config/routes'
import { useAsync } from '@/composables/useAsync'
import { usePageTitle } from '@/composables/usePageTitle'
import { usePolling } from '@/composables/usePolling'
import { getEssay, getEssayStatus } from '@/lib/api/essays'
import { myRating } from '@/lib/api/ratings'
import { count } from '@/lib/format'

const route = useRoute()
const { data, loading, error, reload } = useAsync(async () => {
  const id = String(route.params.essayId)
  const [essay, rating] = await Promise.all([getEssay(id), myRating('essay', id).catch(() => null)])
  return { essay, rating }
}, { watch: () => route.params.essayId })

const essay = computed(() => data.value?.essay ?? null)
const rubric = computed(() => {
  const e = essay.value
  if (!e) return null
  return RUBRICS[rubricFor(e.kind === 'english_writing' ? 'english_writing' : 'polish_essay', e.level === 'extended' ? 'extended' : 'basic')]
})
usePageTitle(() => (essay.value ? `${essay.value.topic || 'Wypowiedź pisemna'} · Feedback AI` : ''))

// Pending rows older than ~15 min are closed by the database (fail_stuck_ai_jobs), so stop by then.
const POLL_MAX = 16 * 60 * 1000
const justFinished = ref('')
const pending = () => essay.value?.status === 'pending' && Date.now() - new Date(essay.value.created_at).getTime() < POLL_MAX
usePolling(pending, async () => {
  try {
    const fresh = await getEssayStatus(essay.value.id)
    if (!fresh || fresh.status === 'pending' || !data.value?.essay) return
    data.value = { ...data.value, essay: { ...data.value.essay, ...fresh } }
    justFinished.value = fresh.status === 'done' ? 'Feedback jest gotowy.' : 'Nie udało się sprawdzić tekstu.'
  } catch {}
}, { interval: 3000, maxMs: POLL_MAX })
const stale = computed(() => essay.value?.status === 'pending' && !pending())
</script>

<template>
  <PageSkeleton v-if="loading && !data" />
  <ErrorState v-else-if="error && !data" @retry="reload" />
  <NotFound v-else-if="!essay" />
  <article v-else class="essay-page">
    <nav class="breadcrumbs" aria-label="Okruszki">
      <RouterLink :to="ROUTES.essays" class="row" style="--gap: 4px"><ChevronLeft :size="15" /> Wypracowania</RouterLink>
    </nav>
    <header class="page-header">
      <div>
        <span class="page-kicker">{{ essay.kind === 'polish_essay' ? 'Polski' : 'Angielski' }} · {{ rubric.title }} · {{ count(essay.word_count, ['wyraz', 'wyrazy', 'wyrazów']) }}</span>
        <h1 class="essay-h1">{{ essay.topic || 'Wypowiedź pisemna' }}</h1>
      </div>
    </header>

    <p class="sr-only" role="status" aria-live="polite">{{ justFinished }}</p>

    <template v-if="essay.status === 'done' && essay.feedback">
      <FeedbackView :feedback="essay.feedback" :content="essay.content" :word-count="essay.word_count" />
      <div class="card rating-card">
        <AiRating :key="essay.id" kind="essay" :target-id="essay.id" :initial="data.rating" question="Czy ten feedback był pomocny?" />
      </div>
    </template>

    <div v-else-if="essay.status === 'error' || stale" class="alert alert-error state-box" role="alert">
      <div class="stack" style="--gap: 12px">
        <p>Tym razem AI nie dało rady. Twój tekst jest zapisany, a próba nie liczy się do limitu. Spróbuj ponownie za chwilę.</p>
        <div v-if="!essay.attempt_id"><RouterLink :to="ROUTES.newEssay" class="button button-outline button-sm"><RotateCw :size="15" /> Spróbuj ponownie</RouterLink></div>
      </div>
    </div>

    <div v-else class="card card-purple state-box pending-box">
      <LoaderCircle :size="20" class="spin" aria-hidden="true" />
      <p>AI jeszcze analizuje ten tekst. Wynik pojawi się tutaj sam, za kilka sekund.</p>
    </div>

    <p v-if="essay.attempt_id" class="back-link"><RouterLink :to="ROUTES.exams" class="link">Wróć do arkuszy</RouterLink></p>
  </article>
</template>

<style scoped>
.essay-page { max-width: 760px; margin-inline: auto; }
.essay-h1 { text-wrap: balance; }
.page-kicker { text-transform: none; letter-spacing: .2px; font-size: 13px; }
.rating-card { margin-top: 32px; }
.state-box { line-height: 1.6; }
.pending-box { display: flex; align-items: center; gap: 12px; color: var(--info); font-weight: 600; }
.back-link { margin-top: 32px; font-size: 14px; }
</style>
