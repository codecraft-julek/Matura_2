<script>
let instances = 0
</script>

<script setup>
// "Zapytaj tutora" button for one task group + the tutor panel it opens. Continues the student's
// latest chat about this task, if any, and sends their current answers with every message.
//   ≥1024px: docked on the right, the page makes room (ui.setTutorDocked → --tutor-w) and stays usable
//   640–1023px: modal sheet on the right over a dimmed page
//   <640px: full-screen sheet (close button, Escape or swipe down on the header)
// Only one panel is open at a time (openTutorPanel in ./shared.js).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { MessageCircle, Plus, X } from '@lucide/vue'
import { tutorChatRoute } from '@/config/routes'
import { latestTaskChat } from '@/lib/api/tutor'
import { useBillingStore } from '@/stores/billing'
import { useUiStore } from '@/stores/ui'
import TutorChat from './TutorChat.vue'
import { TASK_SUGGESTIONS, openTutorPanel } from './shared'

const props = defineProps({
  examId: { type: String, required: true },
  groupNo: { type: Number, required: true },
  /** Shown in the panel header, e.g. "Zadanie 3. Dobieranie". */
  label: { type: String, required: true },
  /** The student's current answers to this task, e.g. { "3.1": "B" }. */
  answers: { type: Object, default: undefined },
  small: { type: Boolean, default: false },
})

const ui = useUiStore()
const billing = useBillingStore()
const uid = useId()
// Unique per button (not per task), so the same task rendered twice still opens only one panel.
const panelKey = `ask-tutor-${++instances}`
const open = computed(() => openTutorPanel.value === panelKey)

const loaded = ref(null) // { chatId, messages }
const failed = ref(false)
const started = ref(false) // a new chat got its first reply in this panel
const session = ref(0) // bump = start a fresh chat
const buttonRef = ref(null)
const panelRef = ref(null)
const closeRef = ref(null)
const chatRef = ref(null)

// Layout mode follows the viewport, also while the panel is open (rotating a tablet).
const dockedQuery = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null
const phoneQuery = typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)') : null
const docked = ref(dockedQuery?.matches ?? false)
const phone = ref(phoneQuery?.matches ?? false)
const onMedia = () => { docked.value = dockedQuery.matches; phone.value = phoneQuery.matches }
onMounted(() => { dockedQuery?.addEventListener('change', onMedia); phoneQuery?.addEventListener('change', onMedia) })

function show() { openTutorPanel.value = panelKey }
function close() { if (open.value) openTutorPanel.value = null }
function newChat() {
  loaded.value = { chatId: null, messages: [] }
  started.value = false
  session.value++
  nextTick(() => chatRef.value?.focus())
}

let ticket = 0
async function load() {
  const mine = ++ticket
  failed.value = false
  try {
    const [chat] = await Promise.all([latestTaskChat(props.examId, props.groupNo), billing.loadAllowances().catch(() => null)])
    if (mine !== ticket || !open.value) return
    loaded.value = chat
  } catch (e) {
    console.error(e)
    if (mine !== ticket || !open.value) return
    failed.value = true
    loaded.value = { chatId: null, messages: [] }
  }
}

// Escape closes (docked: only when focus is inside the panel, the page next to it keeps working).
// As a modal, Tab stays inside the panel.
function onKeydown(e) {
  if (!open.value) return
  const inside = panelRef.value?.contains(document.activeElement)
  if (e.key === 'Escape') {
    if (docked.value && !inside) return
    e.preventDefault()
    close()
  } else if (e.key === 'Tab' && !docked.value && panelRef.value) {
    const items = [...panelRef.value.querySelectorAll('a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (!inside || (e.shiftKey && document.activeElement === first)) { e.preventDefault(); (e.shiftKey ? last : first).focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
}

const lockScroll = value => document.body.classList.toggle('modal-open', value)

watch(open, async (value, was) => {
  if (value) {
    ui.setTutorDocked(true)
    lockScroll(!docked.value)
    window.addEventListener('keydown', onKeydown)
    loaded.value = null
    started.value = false
    load()
    await nextTick()
    closeRef.value?.focus({ preventScroll: true }) // the chat input takes focus once the chat is loaded
  } else if (was) {
    const hadFocus = panelRef.value?.contains(document.activeElement)
    ticket++
    loaded.value = null
    failed.value = false
    window.removeEventListener('keydown', onKeydown)
    lockScroll(false)
    if (!openTutorPanel.value) ui.setTutorDocked(false) // another task's panel took over: it stays docked
    if (hadFocus || (!docked.value && !openTutorPanel.value)) buttonRef.value?.focus({ preventScroll: true })
  }
})
watch(docked, value => { if (open.value) lockScroll(!value) })
// The same button reused for another task while open: show that task's chat.
watch(() => [props.examId, props.groupNo], () => {
  if (!open.value) return
  loaded.value = null
  started.value = false
  session.value++
  load()
})

onBeforeUnmount(() => {
  dockedQuery?.removeEventListener('change', onMedia)
  phoneQuery?.removeEventListener('change', onMedia)
  window.removeEventListener('keydown', onKeydown)
  if (open.value) {
    openTutorPanel.value = null
    ui.setTutorDocked(false)
    lockScroll(false)
  }
})

// Phone: drag the header down to close.
const dragY = ref(0)
let startY = null
function onTouchStart(e) { if (phone.value) startY = e.touches[0].clientY }
function onTouchMove(e) {
  if (startY === null) return
  dragY.value = Math.max(0, e.touches[0].clientY - startY)
}
function onTouchEnd() {
  if (startY === null) return
  startY = null
  if (dragY.value > 110) close()
  dragY.value = 0
}
const sheetStyle = computed(() => (dragY.value ? { transform: `translateY(${dragY.value}px)`, transition: 'none' } : null))
</script>

<template>
  <button
    ref="buttonRef"
    type="button"
    class="ask-tutor-button"
    :class="small ? 'is-small' : 'button button-outline button-sm'"
    aria-haspopup="dialog"
    :aria-expanded="open"
    @click="open ? close() : show()"
  >
    <MessageCircle :size="small ? 14 : 16" />
    {{ small ? `Zapytaj tutora o zadanie ${groupNo}` : 'Zapytaj tutora' }}
  </button>

  <Teleport to="body">
    <Transition name="tutor-panel">
      <div v-if="open" class="tutor-layer" :class="{ 'is-docked': docked, 'is-phone': phone }">
        <button v-if="!docked && !phone" type="button" class="tutor-backdrop" tabindex="-1" aria-label="Zamknij tutora" @click="close"></button>
        <section
          :id="`${uid}-panel`"
          ref="panelRef"
          class="tutor-panel"
          role="dialog"
          :aria-modal="docked ? undefined : 'true'"
          :aria-labelledby="`${uid}-title`"
          :style="sheetStyle"
        >
          <header class="tutor-head" @touchstart.passive="onTouchStart" @touchmove.passive="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd">
            <span v-if="phone" class="grab" aria-hidden="true"></span>
            <div class="tutor-head-text">
              <span class="tutor-kicker"><MessageCircle :size="13" /> Tutor AI</span>
              <h2 :id="`${uid}-title`" class="tutor-title">{{ label }}</h2>
              <p class="tutor-sub">Najpierw podpowie, odpowiedź pokaże, gdy poprosisz.</p>
            </div>
            <button v-if="loaded && (loaded.chatId || loaded.messages.length || started)" type="button" class="button button-outline button-sm new-chat" @click="newChat">
              <Plus :size="15" /> Nowa rozmowa
            </button>
            <button ref="closeRef" type="button" class="icon-button close" aria-label="Zamknij tutora" @click="close"><X :size="20" /></button>
          </header>

          <p v-if="!loaded" class="tutor-loading" role="status">Ładuję rozmowę…</p>
          <template v-else>
            <p v-if="failed" class="tutor-notice is-error" role="alert">Nie udało się wczytać poprzedniej rozmowy. Możesz zacząć nową.</p>
            <p v-else-if="loaded.chatId && loaded.messages.length" class="tutor-notice">
              Kontynuujesz rozmowę o tym zadaniu ·
              <RouterLink :to="tutorChatRoute(loaded.chatId)" class="link">otwórz w Tutorze</RouterLink>
            </p>
            <TutorChat
              ref="chatRef"
              :key="session"
              variant="panel"
              autofocus
              :chat-id="loaded.chatId"
              :messages="loaded.messages"
              :task="{ examId, groupNo }"
              :answers="answers"
              :suggestions="TASK_SUGGESTIONS"
              @chat-created="started = true"
            />
          </template>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ask-tutor-button { gap: 8px; }
.ask-tutor-button.is-small { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--info-line); background: var(--info-bg); color: var(--info); font-size: 12.5px; font-weight: 650; transition: border-color .15s, background .15s; }
.ask-tutor-button.is-small:hover { border-color: var(--info); background: var(--surface); }
.ask-tutor-button[aria-expanded='true'] { border-color: var(--info); }

.tutor-layer { position: fixed; inset: 0; z-index: 60; display: flex; justify-content: flex-end; }
.tutor-layer.is-docked { left: auto; width: var(--tutor-w); z-index: 35; }
.tutor-backdrop { position: absolute; inset: 0; background: #183c2e66; backdrop-filter: blur(3px); border: 0; padding: 0; cursor: default; }

.tutor-panel { position: relative; display: flex; flex-direction: column; width: 100%; height: 100dvh; background: var(--paper); transition: transform .25s ease-out; }
.tutor-layer:not(.is-phone) .tutor-panel { max-width: var(--tutor-w); border-left: 1px solid var(--info-line); box-shadow: var(--shadow-pop); }
.is-docked .tutor-panel { box-shadow: -8px 0 28px #22432b10; }

.tutor-head { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: max(14px, env(safe-area-inset-top)) 14px 14px 18px; border-bottom: 1px solid var(--info-line); background: var(--info-bg); }
.is-phone .tutor-head { padding-top: max(22px, env(safe-area-inset-top)); touch-action: none; }
.grab { position: absolute; top: 8px; left: 50%; width: 40px; height: 4px; margin-left: -20px; border-radius: 99px; background: var(--info-line); }
.tutor-head-text { flex: 1; min-width: 0; }
.tutor-kicker { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--info); }
.tutor-title { margin-top: 4px; font-size: 17px; font-weight: 750; letter-spacing: -.3px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tutor-sub { margin-top: 2px; font-size: 12.5px; color: var(--text-soft); line-height: 1.45; }
.new-chat { flex-shrink: 0; min-height: 36px; padding: 7px 11px; font-size: 12px; gap: 6px; background: var(--surface); }
.close { flex-shrink: 0; width: 36px; height: 36px; }
.tutor-loading { padding: 18px; font-size: 14px; color: var(--text-soft); }
.tutor-notice { padding: 12px 18px 0; font-size: 12.5px; color: var(--text-soft); }
.tutor-notice.is-error { color: var(--error); font-weight: 600; }

@media (max-width: 400px) { .new-chat { padding-inline: 9px; } }

/* Slide in from the right (bottom on phones). */
.tutor-panel-enter-active, .tutor-panel-leave-active { transition: opacity .2s; }
.tutor-panel-enter-active .tutor-panel, .tutor-panel-leave-active .tutor-panel { transition: transform .25s ease-out; }
.tutor-panel-enter-from, .tutor-panel-leave-to { opacity: 0; }
.tutor-panel-enter-from .tutor-panel, .tutor-panel-leave-to .tutor-panel { transform: translateX(40px); }
.is-phone.tutor-panel-enter-from .tutor-panel, .is-phone.tutor-panel-leave-to .tutor-panel { transform: translateY(40px); }
.is-docked.tutor-panel-enter-from, .is-docked.tutor-panel-leave-to { opacity: 1; }
.is-docked.tutor-panel-enter-from .tutor-panel, .is-docked.tutor-panel-leave-to .tutor-panel { transform: translateX(100%); }
</style>
