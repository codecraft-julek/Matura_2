<script setup>
// "Dodaj fiszkę" on the deck page. Emits `added` with the new row; focus goes back to "Przód".
import { ref } from 'vue'
import { LoaderCircle, Plus } from '@lucide/vue'
import { FLASHCARD_LIMITS } from '@shared/flashcards'
import { addCard } from '@/lib/api/flashcards'

const props = defineProps({ deckId: { type: String, required: true } })
const emit = defineEmits(['added'])
const front = ref('')
const back = ref('')
const error = ref('')
const pending = ref(false)
const frontInput = ref(null)

async function add() {
  if (pending.value || !front.value.trim() || !back.value.trim()) return
  error.value = ''
  pending.value = true
  const res = await addCard(props.deckId, { front: front.value, back: back.value })
  pending.value = false
  if (!res.ok) { error.value = res.error; return }
  emit('added', res.card)
  front.value = ''
  back.value = ''
  frontInput.value?.focus()
}
</script>

<template>
  <section class="card add-card" aria-labelledby="add-card-title">
    <h2 id="add-card-title" class="card-title">Dodaj fiszkę</h2>
    <form class="add-grid" @submit.prevent="add">
      <div class="field">
        <label for="new-front" class="field-label">Przód</label>
        <input id="new-front" ref="frontInput" v-model="front" class="input" :maxlength="FLASHCARD_LIMITS.frontChars" placeholder="np. pozytywizm" autocomplete="off" />
      </div>
      <div class="field">
        <label for="new-back" class="field-label">Tył</label>
        <input id="new-back" v-model="back" class="input" :maxlength="FLASHCARD_LIMITS.backChars" placeholder="np. epoka po 1863 r., praca u podstaw" autocomplete="off" />
      </div>
      <button type="submit" class="button button-dark" :disabled="pending || !front.trim() || !back.trim()" :aria-busy="pending">
        <LoaderCircle v-if="pending" class="spin" :size="17" /><Plus v-else :size="17" /> Dodaj
      </button>
    </form>
    <p v-if="error" class="field-error" role="alert" style="margin-top: 8px">{{ error }}</p>
  </section>
</template>

<style scoped>
.add-grid { display: grid; grid-template-columns: 1fr 1fr auto; align-items: end; gap: 12px; margin-top: 14px; }
.add-grid .button { min-height: 50px; }
@media (max-width: 640px) { .add-grid { grid-template-columns: 1fr; } }
</style>
