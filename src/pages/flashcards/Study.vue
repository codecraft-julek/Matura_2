<script setup>
// /fiszki/:deckId/nauka — the due cards of a deck (oldest first), or all of them shuffled with
// ?wszystkie=1. The session itself lives in StudySession; a new load = a fresh session.
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import StudySession from '@/components/flashcards/StudySession.vue'
import { useAsync } from '@/composables/useAsync'
import { usePageTitle } from '@/composables/usePageTitle'
import { deckRoute } from '@/config/routes'
import { studyCards } from '@/lib/api/flashcards'
import NotFound from '@/pages/NotFound.vue'
import ErrorState from '@/ui/ErrorState.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'

const route = useRoute()
const deckId = computed(() => String(route.params.deckId))
const all = computed(() => route.query.wszystkie === '1')
let session = 0

const { data, loading, error, reload } = useAsync(
  async () => {
    if (!route.params.deckId) return data.value // leaving the page
    const res = await studyCards(deckId.value, all.value)
    return res ? { ...res, session: ++session, all: all.value } : null
  },
  { watch: () => `${route.params.deckId}|${route.query.wszystkie}` },
)
usePageTitle(() => (data.value?.title ? `Nauka · ${data.value.title}` : ''))
</script>

<template>
  <div class="study-page">
    <nav class="breadcrumbs" aria-label="Okruszki"><RouterLink :to="deckRoute(deckId)"><ArrowLeft :size="14" /> Talia</RouterLink></nav>
    <div v-if="loading" aria-busy="true" aria-label="Ładowanie" class="stack">
      <div class="skeleton" style="height: 18px; width: 60%"></div>
      <div class="skeleton" style="height: 300px"></div>
      <div class="skeleton" style="height: 57px"></div>
    </div>
    <ErrorState v-else-if="error" @retry="reload" />
    <NotFound v-else-if="!data" />
    <StudySession v-else :key="data.session" :deck-id="deckId" :title="data.title" :subject="data.subject" :cards="data.cards" :all="data.all" />
  </div>
</template>

<style scoped>
.study-page { max-width: 640px; margin-inline: auto; }
.breadcrumbs a { display: inline-flex; align-items: center; gap: 6px; }
</style>
