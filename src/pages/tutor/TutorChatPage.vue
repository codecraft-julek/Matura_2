<script setup>
// /tutor/:chatId: one saved chat (with 👍/👎 under the replies), continue it, delete it,
// or go back to the exam the chat is about.
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowRight, ChevronLeft, Trash2 } from '@lucide/vue'
import ErrorState from '@/ui/ErrorState.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'
import TutorChat from '@/components/tutor/TutorChat.vue'
import { GENERAL_SUGGESTIONS, TASK_SUGGESTIONS } from '@/components/tutor/shared'
import NotFound from '@/pages/NotFound.vue'
import { ROUTES, examRoutes } from '@/config/routes'
import { useAsync } from '@/composables/useAsync'
import { usePageTitle } from '@/composables/usePageTitle'
import { deleteChat, getChat } from '@/lib/api/tutor'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const { data, loading, error, reload } = useAsync(() => getChat(String(route.params.chatId)), { watch: () => route.params.chatId })
const chat = computed(() => data.value?.chat ?? null)
usePageTitle(() => (chat.value ? `${chat.value.title} · Tutor AI` : ''))

const deleting = ref(false)
async function remove() {
  const ok = await ui.confirm({ title: 'Usunąć tę rozmowę?', body: 'Tego nie da się cofnąć.', confirmLabel: 'Usuń', danger: true })
  if (!ok) return
  deleting.value = true
  const res = await deleteChat(chat.value.id)
  deleting.value = false
  if (!res.ok) { ui.toast(res.error, 'error'); return }
  ui.toast('Rozmowa usunięta.')
  router.push(ROUTES.tutor)
}
</script>

<template>
  <PageSkeleton v-if="loading && !data" :rows="2" />
  <ErrorState v-else-if="error && !data" @retry="reload" />
  <NotFound v-else-if="!chat" />
  <div v-else class="chat-page">
    <nav class="breadcrumbs" aria-label="Okruszki">
      <RouterLink :to="ROUTES.tutor" class="row" style="--gap: 4px"><ChevronLeft :size="15" /> Wszystkie rozmowy</RouterLink>
    </nav>
    <header class="chat-header">
      <div class="chat-header-text">
        <span class="page-kicker">Tutor AI</span>
        <h1>{{ chat.title }}</h1>
        <RouterLink v-if="chat.exam_id" :to="examRoutes.practice(chat.exam_id)" class="link exam-link">
          Otwórz ten arkusz w trybie ćwiczeń <ArrowRight :size="15" />
        </RouterLink>
      </div>
      <button type="button" class="button button-outline button-sm delete" :disabled="deleting" :aria-busy="deleting" @click="remove">
        <Trash2 :size="15" /> {{ deleting ? 'Usuwam…' : 'Usuń' }}
      </button>
    </header>

    <TutorChat
      :key="chat.id"
      :chat-id="chat.id"
      :messages="data.messages"
      :autofocus="Boolean(data.fresh)"
      :suggestions="chat.exam_id ? TASK_SUGGESTIONS : GENERAL_SUGGESTIONS"
    />
  </div>
</template>

<style scoped>
.chat-page { max-width: 760px; margin-inline: auto; }
.chat-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 18px; }
.chat-header-text { min-width: 0; }
.chat-header h1 { font-size: clamp(24px, 3.4vw, 32px); line-height: 1.2; letter-spacing: -1px; font-weight: 750; text-wrap: balance; overflow-wrap: anywhere; }
.exam-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 14px; }
.delete { flex-shrink: 0; }
.delete:hover:not(:disabled) { border-color: var(--error); color: var(--error); background: var(--error-bg); }
</style>
