<script setup>
// Under a tutor reply: the proposed deck. Nothing happens until the click, so reloading the page
// can't create a deck. The server decides what the click may do (see claim_tutor_deck); the busy
// flag only keeps a double click from sending a second request. While the deck is being made the
// student sees real progress, and a toast when it's saved, also if they've moved to another page.
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, Check, Layers, LoaderCircle } from '@lucide/vue'
import { deckProposalSchema } from '@shared/tutor'
import { cardsDoneText, deckProgress } from '@/components/flashcards/deckProgress'
import { deckRoute } from '@/config/routes'
import { streamFlashcards } from '@/lib/ai'
import { useBillingStore } from '@/stores/billing'
import { useUiStore } from '@/stores/ui'

const props = defineProps({
  messageId: { type: Number, required: true },
  proposal: { type: Object, required: true },
  deckId: { type: String, default: null },
})

const billing = useBillingStore()
const ui = useUiStore()
const offer = computed(() => {
  const parsed = deckProposalSchema.safeParse(props.proposal)
  return parsed.success ? parsed.data : null
})
const createdId = ref(null)
const linkId = computed(() => props.deckId ?? createdId.value)
const busy = ref(false)
const chars = ref(0)
const seconds = ref(0)
const error = ref('')
const progress = computed(() => deckProgress({ chars: chars.value, seconds: seconds.value, count: offer.value.count }))
const stage = computed(() => (chars.value ? cardsDoneText(chars.value, offer.value.count) : 'Czytam rozmowę…'))

let timer = null
onBeforeUnmount(() => clearInterval(timer))

async function create() {
  if (busy.value || linkId.value) return
  busy.value = true
  error.value = ''
  chars.value = 0
  seconds.value = 0
  const t0 = Date.now()
  timer = setInterval(() => { seconds.value = Math.round((Date.now() - t0) / 1000) }, 1000)
  const res = await streamFlashcards({ tutorMessageId: props.messageId }, { onProgress: n => { chars.value = n } })
  clearInterval(timer)
  busy.value = false
  billing.refreshAllowances()
  if (res.ok) {
    createdId.value = res.id
    ui.toast('Talia gotowa. Znajdziesz ją też w Fiszkach.')
  } else {
    error.value = res.error
  }
}
</script>

<template>
  <div v-if="offer" class="deck-offer">
    <template v-if="linkId">
      <p class="deck-offer-text deck-offer-done" role="status"><Check :size="16" aria-hidden="true" /><span>Talia gotowa: <strong>{{ offer.topic }}</strong></span></p>
      <RouterLink :to="deckRoute(linkId)" class="button button-dark button-sm">
        <Layers :size="16" aria-hidden="true" /> Otwórz talię <ArrowRight :size="16" aria-hidden="true" />
      </RouterLink>
    </template>
    <div v-else-if="busy" class="deck-offer-busy">
      <p class="deck-offer-text"><LoaderCircle :size="16" class="spin" aria-hidden="true" /><span>Tworzę talię: <strong>{{ offer.topic }}</strong></span></p>
      <div class="progress deck-offer-bar" role="progressbar" :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100" aria-label="Tworzenie talii">
        <span :style="{ width: `${Math.round(progress * 100)}%` }"></span>
      </div>
      <p class="deck-offer-stage"><span aria-live="polite">{{ stage }}</span><span class="tabular" aria-hidden="true">{{ seconds }} s</span></p>
      <p class="deck-offer-stage">Zwykle 15–40 sekund.</p>
    </div>
    <template v-else>
      <p class="deck-offer-text"><span><strong>{{ offer.topic }}</strong>, około {{ offer.count }} fiszek</span></p>
      <button type="button" class="button button-dark button-sm" @click="create">
        <Layers :size="16" aria-hidden="true" /> Utwórz talię
      </button>
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    </template>
  </div>
</template>

<style scoped>
.deck-offer { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; width: 100%; max-width: 92%; margin-top: 8px; }
.deck-offer-text { display: flex; align-items: flex-start; gap: 6px; font-size: 14px; line-height: 1.5; color: var(--text-soft); overflow-wrap: anywhere; }
.deck-offer-text svg { flex-shrink: 0; margin-top: 3px; }
.deck-offer-text strong { color: var(--text); }
.deck-offer-done svg { color: var(--green); }
.deck-offer-busy { display: flex; flex-direction: column; gap: 6px; width: 100%; max-width: 420px; }
.deck-offer-bar { height: 6px; }
.deck-offer-bar > span { transition: width .7s; }
.deck-offer-stage { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; line-height: 1.4; color: var(--text-soft); }
</style>
