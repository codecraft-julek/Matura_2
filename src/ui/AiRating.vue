<script setup>
// 👍/👎 under an AI answer. One click saves it (optimistic, can be changed); after 👎 an optional
// "what was wrong?" box appears. variant="compact" = icon-only, under tutor replies.
import { ref, useId } from 'vue'
import { ThumbsDown, ThumbsUp } from '@lucide/vue'
import { rateAi } from '@/lib/api/ratings'

const props = defineProps({
  kind: { type: String, required: true }, // 'essay' | 'note' | 'deck' | 'tutor_message' | 'open_grading'
  targetId: { type: [String, Number], required: true },
  initial: { type: Object, default: null }, // { rating: 1 | -1, comment }
  question: { type: String, default: 'Czy to było pomocne?' },
  variant: { type: String, default: 'block' },
})
const id = useId()
const rating = ref(props.initial?.rating ?? null)
const comment = ref(props.initial?.comment ?? '')
const phase = ref('idle') // 'ask' = comment box after 👎; 'thanks' = short note after saving
const sending = ref(false)
const error = ref(false)
const compact = props.variant === 'compact'

async function save(value, text = '') {
  const before = rating.value
  rating.value = value
  error.value = false
  sending.value = true
  const res = await rateAi({ kind: props.kind, targetId: props.targetId, rating: value, comment: text })
  sending.value = false
  if (!res.ok) { rating.value = before; error.value = true; return false }
  return true
}
async function pick(value) {
  if (sending.value || (value === rating.value && phase.value !== 'idle')) return
  if (await save(value)) phase.value = value === -1 ? 'ask' : 'thanks'
}
async function sendComment() {
  if (await save(-1, comment.value)) phase.value = 'thanks'
}
</script>

<template>
  <div class="ai-rating no-print" :class="{ compact }">
    <div class="ai-rating-row">
      <p v-if="!compact" class="ai-rating-q">{{ question }}</p>
      <div class="ai-rating-buttons">
        <button type="button" class="rate-btn" :class="{ 'is-up': rating === 1 }" :aria-pressed="rating === 1" :aria-label="compact ? 'Dobra odpowiedź' : undefined" :title="compact ? 'Dobra odpowiedź' : undefined" @click="pick(1)"><ThumbsUp :size="compact ? 15 : 16" /><span v-if="!compact">Tak</span></button>
        <button type="button" class="rate-btn" :class="{ 'is-down': rating === -1 }" :aria-pressed="rating === -1" :aria-label="compact ? 'Słaba odpowiedź' : undefined" :title="compact ? 'Słaba odpowiedź' : undefined" @click="pick(-1)"><ThumbsDown :size="compact ? 15 : 16" /><span v-if="!compact">Nie</span></button>
      </div>
      <p v-if="phase === 'thanks'" role="status" class="ai-rating-note">{{ rating === 1 ? 'Dzięki!' : 'Dzięki, to pomoże nam poprawić AI.' }}</p>
      <p v-if="error" role="alert" class="ai-rating-note is-error">Nie udało się zapisać. Spróbuj jeszcze raz.</p>
    </div>
    <form v-if="phase === 'ask'" class="ai-rating-form" @submit.prevent="sendComment">
      <label :for="`${id}-c`" class="field-label">Co było nie tak? <span class="optional">(opcjonalnie)</span></label>
      <textarea :id="`${id}-c`" v-model="comment" class="textarea" maxlength="500" rows="2" style="min-height: 64px" placeholder="Np. błędna odpowiedź, za ogólne, źle policzone punkty…"></textarea>
      <div class="row" style="--gap: 8px">
        <button type="submit" class="button button-dark button-sm" :disabled="sending">{{ sending ? 'Wysyłam…' : 'Wyślij' }}</button>
        <button type="button" class="button button-ghost button-sm" @click="phase = 'thanks'">Pomiń</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.ai-rating-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; }
.ai-rating-q { font-size: 14px; font-weight: 650; }
.ai-rating-buttons { display: flex; gap: 6px; }
.rate-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--surface); font-size: 13px; font-weight: 650; transition: background .15s, border-color .15s, color .15s; }
.rate-btn:hover { border-color: var(--green); }
.rate-btn.is-up { background: var(--ok); border-color: var(--ok); color: white; }
.rate-btn.is-down { background: var(--error); border-color: var(--error); color: white; }
.compact .rate-btn { padding: 6px; border: 0; background: none; color: var(--text-soft); border-radius: 8px; }
.compact .rate-btn:hover { background: var(--surface-2); color: var(--text); }
.compact .rate-btn.is-up { background: var(--ok-bg); color: var(--ok); }
.compact .rate-btn.is-down { background: var(--error-bg); color: var(--error); }
.ai-rating-note { font-size: 13px; color: var(--text-soft); }
.compact .ai-rating-note { font-size: 12px; }
.ai-rating-note.is-error { color: var(--error); font-weight: 650; }
.ai-rating-form { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; max-width: 560px; }
</style>
