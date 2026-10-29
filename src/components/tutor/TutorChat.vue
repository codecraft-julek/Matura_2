<script setup>
// The chat itself: messages, the streamed reply, the input. Used on the /tutor pages
// (variant "page": the window scrolls, the input sticks to the bottom) and in the exam side panel
// (variant "panel": the panel scrolls). Limits from @shared/tutor: 2000 chars per message,
// 25 student messages per chat. Enter sends, Shift+Enter makes a new line.
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { SendHorizontal } from '@lucide/vue'
import { TUTOR_LIMITS } from '@shared/tutor'
import AiRating from '@/ui/AiRating.vue'
import { ROUTES } from '@/config/routes'
import { streamTutorReply } from '@/lib/ai'
import { useBillingStore } from '@/stores/billing'
import TutorText from './TutorText.vue'

const props = defineProps({
  chatId: { type: String, default: null },
  /** [{ role: 'user' | 'assistant', content, id?, rating? }] — id/rating only for saved replies. */
  messages: { type: Array, default: () => [] },
  /** The task this chat is about { examId, groupNo } (only used when starting a new chat). */
  task: { type: Object, default: null },
  /** The student's current answers to that task, sent along with every message. */
  answers: { type: Object, default: null },
  suggestions: { type: Array, default: () => [] },
  variant: { type: String, default: 'page' }, // 'page' | 'panel'
  autofocus: { type: Boolean, default: false },
})
const emit = defineEmits(['chat-created'])

const billing = useBillingStore()
const uid = useId()
const chatId = ref(props.chatId)
const messages = ref([...props.messages])
const streaming = ref(null) // null = not waiting for a reply, '' = thinking, text = reply so far
const input = ref('')
const error = ref('')
const announce = ref('')
const scroller = ref(null)
const endRef = ref(null)
const inputRef = ref(null)

const panel = computed(() => props.variant === 'panel')
const pending = computed(() => streaming.value !== null)
const userMessages = computed(() => messages.value.filter(m => m.role === 'user').length)
const chatFull = computed(() => userMessages.value >= TUTOR_LIMITS.userMessagesPerChat)
const remaining = computed(() => billing.allowanceFor('tutor')?.left ?? null)
const outOfQuota = computed(() => remaining.value !== null && remaining.value <= 0)
const showCounter = computed(() => input.value.length > TUTOR_LIMITS.messageChars - 300)

onMounted(() => {
  billing.loadAllowances().catch(() => {})
  if (props.autofocus) inputRef.value?.focus({ preventScroll: true })
  if (messages.value.length) scrollToEnd(true)
})

// Keep the newest message in view, but don't yank the student back down if they scrolled up to read.
function nearBottom() {
  if (panel.value) {
    const el = scroller.value
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 160
  }
  return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 240
}
async function scrollToEnd(force = false) {
  if (!force && !nearBottom()) return
  await nextTick()
  if (panel.value && scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  else endRef.value?.scrollIntoView({ block: 'end' })
}
watch(streaming, () => scrollToEnd())

/** Only what the Edge Function accepts (≤ 12 keys, short keys, values up to 3000 chars). */
function cleanAnswers(answers) {
  if (!answers) return null
  const entries = Object.entries(answers)
    .filter(([k, v]) => typeof v === 'string' && k.length <= 10)
    .slice(0, 12)
    .map(([k, v]) => [k, v.slice(0, TUTOR_LIMITS.answerChars)])
  return Object.fromEntries(entries)
}

async function send(text) {
  const message = text.trim()
  if (!message || pending.value || chatFull.value || outOfQuota.value) return
  error.value = ''
  input.value = ''
  resize()
  messages.value.push({ role: 'user', content: message })
  streaming.value = ''
  announce.value = 'Tutor myśli…'
  scrollToEnd(true)

  let created = null
  let reply = ''
  const answers = cleanAnswers(props.answers)
  const res = await streamTutorReply(
    { message, ...(chatId.value ? { chatId: chatId.value } : props.task ? { examId: props.task.examId, groupNo: props.task.groupNo } : {}), ...(answers ? { answers } : {}) },
    {
      onStart: id => { if (!chatId.value) created = id },
      onText: full => { reply = full; streaming.value = full },
    },
  )
  billing.refreshAllowances()

  if (res.ok) {
    messages.value.push({ role: 'assistant', content: reply, id: res.messageId, rating: null })
    streaming.value = null
    announce.value = `Tutor: ${reply}`
    if (created) {
      chatId.value = created
      emit('chat-created', created, messages.value)
    }
  } else {
    // The server removed the message: take it back into the input so nothing is lost.
    messages.value.pop()
    streaming.value = null
    announce.value = ''
    input.value = message
    error.value = res.error
    await nextTick()
    resize()
    inputRef.value?.focus({ preventScroll: true })
  }
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    send(input.value)
  }
}
function resize() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

defineExpose({ focus: () => inputRef.value?.focus({ preventScroll: true }) })
</script>

<template>
  <div class="tutor-chat" :class="panel ? 'is-panel' : 'is-page'">
    <div ref="scroller" class="chat-scroll">
      <div v-if="messages.length === 0 && !pending" class="suggestions">
        <p class="muted small">Zacznij od jednej z tych albo napisz własne pytanie:</p>
        <div class="suggestion-list">
          <button v-for="s in suggestions" :key="s" type="button" class="suggestion" :disabled="outOfQuota" @click="send(s)">{{ s }}</button>
        </div>
      </div>

      <ol class="messages" aria-label="Rozmowa z tutorem">
        <li v-for="(m, i) in messages" :key="i" :class="m.role === 'user' ? 'msg-user' : 'msg-ai'">
          <template v-if="m.role === 'user'">
            <span class="sr-only">Ty:</span>
            <p class="bubble bubble-user">{{ m.content }}</p>
          </template>
          <template v-else>
            <span class="sr-only">Tutor:</span>
            <div class="bubble bubble-ai"><TutorText :text="m.content" /></div>
            <AiRating v-if="m.id !== undefined && m.id !== null" class="msg-rating" kind="tutor_message" :target-id="m.id" :initial="m.rating" variant="compact" />
          </template>
        </li>
        <li v-if="pending" class="msg-ai" aria-hidden="true">
          <div v-if="streaming" class="bubble bubble-ai"><TutorText :text="streaming" /></div>
          <span v-else class="bubble bubble-ai thinking">Tutor myśli<span class="dots"><span>.</span><span>.</span><span>.</span></span></span>
        </li>
      </ol>
      <div ref="endRef" class="chat-end" />
    </div>

    <p class="sr-only" role="status" aria-live="polite">{{ pending ? 'Tutor myśli…' : announce }}</p>

    <form class="chat-form" @submit.prevent="send(input)">
      <p v-if="error" role="alert" class="chat-error">{{ error }}</p>
      <p v-if="chatFull" class="muted small">
        Ta rozmowa jest już długa. Zacznij nową, żeby tutor lepiej się skupił.
        <RouterLink v-if="!panel" :to="ROUTES.tutor" class="link">Nowa rozmowa</RouterLink>
      </p>
      <div v-else class="chat-input-row">
        <label :for="`${uid}-msg`" class="sr-only">Wiadomość do tutora</label>
        <textarea
          :id="`${uid}-msg`"
          ref="inputRef"
          v-model="input"
          class="textarea chat-input"
          rows="1"
          :maxlength="TUTOR_LIMITS.messageChars"
          enterkeyhint="send"
          :disabled="outOfQuota"
          :aria-describedby="`${uid}-note`"
          :placeholder="outOfQuota ? 'Dzisiejszy limit wykorzystany, wróć jutro' : 'Napisz pytanie albo swoją odpowiedź…'"
          @keydown="onKeydown"
          @input="resize"
        ></textarea>
        <button type="submit" class="button button-dark send-button" :disabled="pending || !input.trim() || outOfQuota" :aria-busy="pending">
          <SendHorizontal :size="17" /><span class="send-label">{{ pending ? 'Czekaj…' : 'Wyślij' }}</span>
        </button>
      </div>
      <p :id="`${uid}-note`" class="chat-note">
        Tutor to AI i może się mylić. Nie podawaj danych osobowych.
        <template v-if="remaining !== null"> Zostało dziś: <strong>{{ remaining }}</strong>.</template>
        <span v-if="showCounter" :class="{ 'is-over': input.length >= TUTOR_LIMITS.messageChars }"> {{ input.length }}/{{ TUTOR_LIMITS.messageChars }} znaków.</span>
      </p>
    </form>
  </div>
</template>

<style scoped>
.tutor-chat.is-panel { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.is-panel .chat-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 16px; }
.is-page .chat-scroll { padding: 8px 0; }

.suggestions { margin-bottom: 16px; }
.suggestion-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.suggestion { padding: 9px 14px; border-radius: 999px; border: 1px solid var(--info-line); background: var(--info-bg); color: var(--info); font-size: 14px; font-weight: 600; text-align: left; line-height: 1.35; transition: border-color .15s, background .15s; }
.suggestion:hover:not(:disabled) { border-color: var(--info); background: var(--surface); }

.messages { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.msg-user { display: flex; justify-content: flex-end; }
.msg-ai { display: flex; flex-direction: column; align-items: flex-start; }
.bubble { border-radius: 16px; padding: 11px 15px; font-size: 15px; line-height: 1.6; overflow-wrap: anywhere; }
.bubble-user { max-width: 85%; background: var(--green); color: white; border-top-right-radius: 5px; white-space: pre-wrap; }
.bubble-ai { max-width: 92%; background: var(--info-bg); border: 1px solid var(--info-line); color: var(--text); border-top-left-radius: 5px; }
.msg-rating { margin-top: 2px; }
.thinking { color: var(--info); font-size: 14px; }
.dots span { animation: blink 1.2s infinite both; }
.dots span:nth-child(2) { animation-delay: .2s; }
.dots span:nth-child(3) { animation-delay: .4s; }
@keyframes blink { 0%, 80%, 100% { opacity: .2; } 40% { opacity: 1; } }
.chat-end { scroll-margin-bottom: 150px; }

.chat-form { display: flex; flex-direction: column; gap: 8px; background: var(--paper); border-top: 1px solid var(--line); padding-top: 12px; }
.is-panel .chat-form { padding: 12px 16px max(12px, env(safe-area-inset-bottom)); }
.is-page .chat-form { position: sticky; bottom: 0; z-index: 5; padding-bottom: max(12px, env(safe-area-inset-bottom)); }
@media (max-width: 860px) { .is-page .chat-form { bottom: calc(62px + env(safe-area-inset-bottom)); padding-bottom: 12px; } }
.chat-error { font-size: 14px; font-weight: 650; color: var(--error); }
.chat-input-row { display: flex; align-items: flex-end; gap: 8px; }
.chat-input { flex: 1; min-height: 50px; max-height: 160px; resize: none; padding: 12px 14px; line-height: 1.45; }
.send-button { min-height: 50px; gap: 8px; flex-shrink: 0; }
.chat-note { font-size: 12px; color: var(--text-soft); line-height: 1.5; }
.chat-note strong { color: var(--text); }
.chat-note .is-over { color: var(--error); font-weight: 700; }
@media (max-width: 520px) { .send-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); } .send-button { padding-inline: 15px; } }
</style>
