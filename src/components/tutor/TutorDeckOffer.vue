<script setup>
// Under a tutor reply: the proposed deck. Nothing happens until the click, so reloading the page
// can't create a deck. The server decides what the click may do (see claim_tutor_deck); the busy
// flag only keeps a double click from sending a second request.
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, Layers, LoaderCircle } from '@lucide/vue'
import { deckProposalSchema } from '@shared/tutor'
import { deckRoute } from '@/config/routes'
import { streamFlashcards } from '@/lib/ai'
import { useBillingStore } from '@/stores/billing'

const props = defineProps({
  messageId: { type: Number, required: true },
  proposal: { type: Object, required: true },
  deckId: { type: String, default: null },
})

const billing = useBillingStore()
const offer = computed(() => {
  const parsed = deckProposalSchema.safeParse(props.proposal)
  return parsed.success ? parsed.data : null
})
const createdId = ref(null)
const linkId = computed(() => props.deckId ?? createdId.value)
const busy = ref(false)
const error = ref('')

async function create() {
  if (busy.value || linkId.value) return
  busy.value = true
  error.value = ''
  const res = await streamFlashcards({ tutorMessageId: props.messageId })
  busy.value = false
  billing.refreshAllowances()
  if (res.ok) createdId.value = res.id
  else error.value = res.error
}
</script>

<template>
  <div v-if="offer" class="deck-offer">
    <RouterLink v-if="linkId" :to="deckRoute(linkId)" class="button button-dark button-sm">
      <Layers :size="16" aria-hidden="true" /> Otwórz talię <ArrowRight :size="16" aria-hidden="true" />
    </RouterLink>
    <template v-else>
      <p class="deck-offer-text"><strong>{{ offer.topic }}</strong>, około {{ offer.count }} fiszek</p>
      <button type="button" class="button button-dark button-sm" :disabled="busy" :aria-busy="busy" @click="create">
        <LoaderCircle v-if="busy" :size="16" class="spin" aria-hidden="true" /><Layers v-else :size="16" aria-hidden="true" />
        {{ busy ? 'Tworzę talię…' : 'Utwórz talię' }}
      </button>
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    </template>
  </div>
</template>

<style scoped>
.deck-offer { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: 92%; margin-top: 8px; }
.deck-offer-text { font-size: 14px; line-height: 1.5; color: var(--text-soft); overflow-wrap: anywhere; }
.deck-offer-text strong { color: var(--text); }
</style>
