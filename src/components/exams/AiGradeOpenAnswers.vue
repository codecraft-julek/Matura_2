<script setup>
// On a Polish exam result: let AI propose points for the open answers (Arkusz 1).
// The AI only sees our scoring descriptions and the student's answers, never the exam texts,
// so its grades are a suggestion the student can change with SelfCheck below.
// Emits `graded` after a successful run; the page then reloads the attempt.
import { computed, onBeforeUnmount, ref } from 'vue'
import { LoaderCircle, Sparkles } from '@lucide/vue'
import { gradeOpenAnswers } from '@/lib/ai'
import { useBillingStore } from '@/stores/billing'
import AiRating from '@/ui/AiRating.vue'
import AllowanceNote from '@/ui/AllowanceNote.vue'

const props = defineProps({
  attemptId: { type: String, required: true },
  count: { type: Number, required: true },
  gradedAt: { type: String, default: null },
  rating: { type: Object, default: null },
  /** true while the page reloads the attempt after grading */
  refreshing: { type: Boolean, default: false },
})
const emit = defineEmits(['graded'])
const billing = useBillingStore()
const allowance = computed(() => billing.allowanceFor('open_grading'))
const busy = ref(false)
const error = ref('')
const elapsed = ref(0)
let timer = null

async function grade() {
  busy.value = true
  error.value = ''
  const started = Date.now()
  elapsed.value = 0
  timer = setInterval(() => { elapsed.value = Math.floor((Date.now() - started) / 1000) }, 500)
  const res = await gradeOpenAnswers({ attemptId: props.attemptId })
  clearInterval(timer)
  busy.value = false
  billing.refreshAllowances()
  if (!res.ok) { error.value = res.error; return }
  emit('graded')
}
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div v-if="busy || refreshing" class="card card-purple ai-grade" role="status" aria-live="polite">
    <div class="row-between">
      <p class="ai-title"><LoaderCircle :size="18" class="spin" aria-hidden="true" /> AI ocenia odpowiedzi ({{ count }})…</p>
      <span v-if="busy" class="muted small tabular">{{ elapsed }} s</span>
    </div>
    <p class="ai-text">Porównuję każdą odpowiedź z opisem punktacji. Zwykle trwa to 10–30 sekund.</p>
  </div>

  <div v-else class="card card-purple ai-grade">
    <p class="ai-title"><Sparkles :size="18" aria-hidden="true" /> {{ gradedAt ? 'Ocenione z AI' : 'Nie wiesz, ile punktów dać?' }}</p>
    <p class="ai-text">
      <template v-if="gradedAt">AI zaproponowało punkty przy odpowiedziach otwartych poniżej. Jeśli się nie zgadzasz, po prostu zmień ocenę.</template>
      <template v-else>AI porówna {{ count === 1 ? 'Twoją odpowiedź otwartą' : `Twoje odpowiedzi otwarte (${count})` }} z opisem tego, za co są punkty, i zaproponuje ocenę. Potem możesz ją zmienić.</template>
    </p>
    <p class="ai-note">AI nie widzi tekstów z arkusza, więc przy niektórych zadaniach może się mylić. Takie oceny oznaczamy jako niepewne.</p>
    <div class="ai-actions">
      <button type="button" class="button" :class="gradedAt ? 'button-outline' : 'button-dark'" :disabled="allowance && allowance.left <= 0" @click="grade">
        <Sparkles :size="16" /> {{ gradedAt ? 'Oceń jeszcze raz z AI' : 'Oceń z AI' }}
      </button>
      <AllowanceNote :allowance="allowance" />
    </div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <div v-if="gradedAt" class="ai-rating-wrap">
      <!-- key: after grading again, take the rating fresh from the server -->
      <AiRating :key="gradedAt" kind="open_grading" :target-id="attemptId" :initial="rating" question="Czy oceny AI były trafne?" />
    </div>
  </div>
</template>

<style scoped>
.ai-grade { display: flex; flex-direction: column; gap: 8px; }
.ai-title { display: flex; align-items: center; gap: 8px; font-family: var(--heading); font-weight: 750; font-size: 17px; color: var(--text); }
.ai-title svg { color: var(--info); }
.ai-text { font-size: 15px; line-height: 1.6; color: var(--text-soft); }
.ai-note { font-size: 13px; line-height: 1.55; color: var(--info); }
.ai-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin-top: 6px; }
.ai-rating-wrap { margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--info-line); }
</style>
