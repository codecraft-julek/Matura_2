<script setup>
// /tutor: a new general chat, suggestions and the list of earlier chats. Once the first reply is
// saved, the page moves to /tutor/<id> with the conversation still on screen.
import { computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ChevronRight, FileText, Lightbulb, MessageCircle } from '@lucide/vue'
import { chatTitle } from '@shared/tutor'
import AllowanceNote from '@/ui/AllowanceNote.vue'
import ErrorState from '@/ui/ErrorState.vue'
import TutorChat from '@/components/tutor/TutorChat.vue'
import { GENERAL_SUGGESTIONS } from '@/components/tutor/shared'
import { tutorChatRoute } from '@/config/routes'
import { useAsync } from '@/composables/useAsync'
import { handOffChat, listMyChats } from '@/lib/api/tutor'
import { formatDateTime } from '@/lib/format'
import { useBillingStore } from '@/stores/billing'

const router = useRouter()
const billing = useBillingStore()
const { data: chats, loading, error, reload } = useAsync(() => listMyChats())
const allowance = computed(() => billing.allowanceFor('tutor'))
onMounted(() => billing.loadAllowances().catch(() => {}))

function onChatCreated(id, messages) {
  const first = messages.find(m => m.role === 'user')?.content ?? ''
  handOffChat({
    chat: { id, title: chatTitle(first, null), exam_id: null, group_no: null, updated_at: new Date().toISOString() },
    messages: messages.map(m => ({ ...m })),
  })
  router.replace(tutorChatRoute(id))
}
</script>

<template>
  <div class="tutor-home">
    <header class="page-header">
      <div>
        <span class="page-kicker">Pomoc w nauce</span>
        <h1>Tutor AI<span class="accent-dot">.</span></h1>
        <p>Pytaj o lektury, epoki, gramatykę albo wypracowanie. Tutor najpierw naprowadza, a pełną odpowiedź pokazuje, gdy o nią poprosisz.</p>
      </div>
      <AllowanceNote :allowance="allowance" />
    </header>

    <p class="alert alert-info tip">
      <Lightbulb :size="18" />
      <span><strong>Najlepiej działa przy konkretnym zadaniu:</strong> w trybie ćwiczeń kliknij „Zapytaj tutora” pod zadaniem. Wtedy zna typ zadania i klucz.</span>
    </p>

    <section class="new-chat" aria-label="Nowa rozmowa">
      <TutorChat :suggestions="GENERAL_SUGGESTIONS" @chat-created="onChatCreated" />
    </section>

    <section class="section-gap" aria-labelledby="chats-title">
      <h2 id="chats-title" class="section-title">Twoje rozmowy</h2>
      <div v-if="loading && !chats" class="stack" style="--gap: 10px" aria-busy="true" aria-label="Ładowanie rozmów">
        <div v-for="n in 3" :key="n" class="skeleton" style="height: 66px"></div>
      </div>
      <ErrorState v-else-if="error && !chats" message="Nie udało się wczytać Twoich rozmów." @retry="reload" />
      <p v-else-if="!chats.length" class="muted empty">Tu pojawią się Twoje rozmowy z tutorem.</p>
      <ul v-else class="list">
        <li v-for="c in chats" :key="c.id">
          <RouterLink :to="tutorChatRoute(c.id)" class="list-row chat-row">
            <span class="chat-icon" aria-hidden="true"><component :is="c.exam_id ? FileText : MessageCircle" :size="17" /></span>
            <span class="chat-main">
              <span class="chat-title">{{ c.title }}</span>
              <span class="card-meta">{{ c.exam_id ? 'zadanie z arkusza' : 'pytanie ogólne' }} · {{ formatDateTime(c.updated_at) }}</span>
            </span>
            <ChevronRight :size="18" class="muted" aria-hidden="true" />
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.tutor-home { max-width: 760px; margin-inline: auto; }
.tip { margin-bottom: 20px; }
.new-chat { padding-top: 4px; }
.empty { font-size: 14px; }
.chat-row { justify-content: flex-start; }
.chat-icon { display: inline-grid; place-items: center; flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px; background: var(--info-bg); color: var(--info); border: 1px solid var(--info-line); }
.chat-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.chat-title { font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-main .card-meta { margin-top: 2px; }
</style>
