<script setup>
// Saves the note's flashcards as a deck with spaced repetition (no AI call, no limit).
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Layers, LoaderCircle } from '@lucide/vue'
import { deckRoute } from '@/config/routes'
import { deckFromNote } from '@/lib/api/flashcards'
import { useUiStore } from '@/stores/ui'

const props = defineProps({ noteId: { type: String, required: true }, count: { type: Number, required: true } })
const router = useRouter()
const ui = useUiStore()
const pending = ref(false)
const error = ref('')

async function save() {
  error.value = ''
  pending.value = true
  const res = await deckFromNote(props.noteId)
  pending.value = false
  if (!res.ok) { error.value = res.error; return }
  ui.toast('Zapisano talię. Powtórki ułożą się same.')
  router.push(deckRoute(res.id))
}
</script>

<template>
  <div class="card card-sand save-deck no-print">
    <span class="save-icon" aria-hidden="true"><Layers :size="20" /></span>
    <div class="save-text">
      <p class="card-title">Ucz się tych fiszek z powtórkami</p>
      <p class="card-meta">Zapiszemy {{ count }} fiszek jako talię. Każda wróci wtedy, kiedy zaczniesz ją zapominać.</p>
      <p v-if="error" class="field-error" role="alert" style="margin-top: 6px">{{ error }}</p>
    </div>
    <button type="button" class="button button-dark button-sm" :disabled="pending" :aria-busy="pending" @click="save">
      <LoaderCircle v-if="pending" class="spin" :size="16" />{{ pending ? 'Zapisuję…' : 'Zapisz jako talię' }}<ArrowRight v-if="!pending" :size="16" />
    </button>
  </div>
</template>

<style scoped>
.save-deck { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.save-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: #eae2cc; color: #99885f; flex-shrink: 0; }
.save-text { flex: 1; min-width: 200px; }
</style>
