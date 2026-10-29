<script setup>
// One card in the deck list: front | back, "trudna" badge, edit in place (Escape cancels), delete.
// Saves edits itself and emits `saved` with { front, back }; deleting is confirmed by the page.
import { nextTick, ref } from 'vue'
import { Pencil, Trash2 } from '@lucide/vue'
import { FLASHCARD_LIMITS } from '@shared/flashcards'
import { isHardCard, updateCard } from '@/lib/api/flashcards'

const props = defineProps({ card: { type: Object, required: true }, index: { type: Number, required: true } })
const emit = defineEmits(['saved', 'remove'])
const editing = ref(false)
const draft = ref({ front: '', back: '' })
const pending = ref(false)
const error = ref('')
const frontInput = ref(null)
const editButton = ref(null)

function start() {
  draft.value = { front: props.card.front, back: props.card.back }
  error.value = ''
  editing.value = true
  nextTick(() => frontInput.value?.focus())
}
function cancel() {
  editing.value = false
  nextTick(() => editButton.value?.focus())
}
async function save() {
  error.value = ''
  pending.value = true
  const res = await updateCard(props.card.id, draft.value)
  pending.value = false
  if (!res.ok) { error.value = res.error; return }
  emit('saved', res.card)
  cancel()
}
</script>

<template>
  <li class="card-row" :class="{ editing }">
    <form v-if="editing" class="edit" @submit.prevent="save" @keydown.esc.prevent="cancel">
      <div class="field">
        <label :for="`front-${card.id}`" class="field-label">Przód</label>
        <input :id="`front-${card.id}`" ref="frontInput" v-model="draft.front" class="input" :maxlength="FLASHCARD_LIMITS.frontChars" />
      </div>
      <div class="field">
        <label :for="`back-${card.id}`" class="field-label">Tył</label>
        <textarea :id="`back-${card.id}`" v-model="draft.back" class="textarea" rows="2" style="min-height: 72px" :maxlength="FLASHCARD_LIMITS.backChars"></textarea>
      </div>
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <div class="row" style="--gap: 8px">
        <button type="submit" class="button button-dark button-sm" :disabled="pending || !draft.front.trim() || !draft.back.trim()">{{ pending ? 'Zapisuję…' : 'Zapisz' }}</button>
        <button type="button" class="button button-ghost button-sm" @click="cancel">Anuluj</button>
      </div>
    </form>
    <template v-else>
      <span class="num tabular" aria-hidden="true">{{ index + 1 }}.</span>
      <div class="sides">
        <p class="front"><span class="sr-only">Przód: </span>{{ card.front }}<span v-if="isHardCard(card)" class="badge badge-warn hard">trudna</span></p>
        <p class="back"><span class="sr-only">Tył: </span>{{ card.back }}</p>
      </div>
      <div class="actions">
        <button ref="editButton" type="button" class="icon-button" :aria-label="`Edytuj fiszkę ${index + 1}`" title="Edytuj" @click="start"><Pencil :size="16" /></button>
        <button type="button" class="icon-button del" :aria-label="`Usuń fiszkę ${index + 1}`" title="Usuń" @click="emit('remove', card)"><Trash2 :size="16" /></button>
      </div>
    </template>
  </li>
</template>

<style scoped>
.card-row { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; }
.card-row + .card-row { border-top: 1px solid var(--line); }
.card-row.editing { background: var(--surface-3); }
.num { width: 28px; flex-shrink: 0; padding-top: 2px; font-size: 13px; color: var(--text-soft); }
.sides { flex: 1; min-width: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
.front { font-weight: 650; overflow-wrap: anywhere; line-height: 1.5; }
.back { color: var(--text-soft); overflow-wrap: anywhere; line-height: 1.5; }
.hard { margin-left: 8px; vertical-align: 1px; }
.actions { display: flex; flex-shrink: 0; margin: -8px -8px -8px 0; }
.icon-button { color: var(--text-soft); }
.icon-button:hover { color: var(--text); }
.del:hover { color: var(--error); background: var(--error-bg); }
.edit { flex: 1; display: flex; flex-direction: column; gap: 10px; }
@media (max-width: 640px) { .sides { grid-template-columns: 1fr; } }
</style>
