<script setup>
// Start once for a saved attempt. The backend reuses existing grades and coordinates other tabs.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { LoaderCircle, Sparkles } from '@lucide/vue'
import { gradeOpenAnswers } from '@/lib/ai'
import { useBillingStore } from '@/stores/billing'
import AiRating from '@/ui/AiRating.vue'
import AllowanceNote from '@/ui/AllowanceNote.vue'

const props = defineProps({
  attemptId: { type: String, required: true },
  count: { type: Number, required: true },
  pendingCount: { type: Number, default: 0 },
  gradedAt: { type: String, default: null },
  rating: { type: Object, default: null },
  refreshing: { type: Boolean, default: false },
})
const emit = defineEmits(['graded', 'busy'])
const billing = useBillingStore()
const allowance = computed(() => billing.allowanceFor('open_grading'))
const busy = ref(false)
const error = ref('')
const elapsed = ref(0)
let timer = null
let pollTimer = null
let finishWait = null
let disposed = false

function waitForOtherTab() {
  return new Promise(resolve => {
    finishWait = resolve
    pollTimer = setTimeout(() => { finishWait = null; resolve() }, 2500)
  })
}

async function grade() {
  if (busy.value || props.refreshing || disposed) return
  const attemptId = props.attemptId
  busy.value = true
  emit('busy', true)
  error.value = ''
  const started = Date.now()
  elapsed.value = 0
  timer = setInterval(() => { elapsed.value = Math.floor((Date.now() - started) / 1000) }, 500)
  try {
    // The server makes the final quota decision; an unavailable counter must not block grading.
    await billing.loadAllowances().catch(() => {})
    if (disposed) return
    // Even at zero quota, a different tab may have started or finished this same attempt.
    // The server checks its lease/cache before deciding whether a new use is needed.
    while (!disposed) {
      const res = await gradeOpenAnswers({ attemptId })
      if (disposed) return
      if (!res.ok) { error.value = res.error; return }
      if (!res.pending) { emit('graded', attemptId); return }
      if (Date.now() - started > 190_000) {
        error.value = 'Sprawdzanie trwa dłużej niż zwykle. Odpowiedzi są zapisane. Spróbuj ponownie za chwilę.'
        return
      }
      await waitForOtherTab()
    }
  } catch {
    if (!disposed) error.value = 'Nie udało się dokończyć oceny AI. Twoje odpowiedzi są zapisane. Spróbuj ponownie.'
  } finally {
    clearInterval(timer)
    billing.refreshAllowances()
    if (!disposed) { busy.value = false; emit('busy', false) }
  }
}
onMounted(() => { if (props.pendingCount > 0) grade() })
onBeforeUnmount(() => {
  disposed = true
  clearInterval(timer)
  clearTimeout(pollTimer)
  finishWait?.()
  emit('busy', false)
})
</script>

<template>
  <div v-if="busy || refreshing" class="card card-purple ai-grade" role="status" aria-live="polite">
    <div class="row-between">
      <p class="ai-title"><LoaderCircle :size="18" class="spin" aria-hidden="true" /> AI sprawdza odpowiedzi otwarte…</p>
      <span v-if="busy" class="muted small tabular">{{ elapsed }} s</span>
    </div>
    <p class="ai-text">Odpowiedzi do oceny: {{ pendingCount }}. Sprawdzamy je na podstawie arkusza i zasad oceniania CKE. Punkty i uzasadnienia pojawią się automatycznie.</p>
    <p class="ai-note">Możesz opuścić stronę — Twoje odpowiedzi są już zapisane.</p>
  </div>

  <div v-else class="card card-purple ai-grade">
    <p class="ai-title"><Sparkles :size="18" aria-hidden="true" /> {{ pendingCount ? 'Odpowiedzi czekają na ocenę AI' : 'Odpowiedzi sprawdzone' }}</p>
    <p class="ai-text">
      <template v-if="!pendingCount">Punkty są już uwzględnione w wyniku. Uzasadnienia AI znajdziesz przy odpowiedziach. Nie musisz ich samodzielnie zaliczać.</template>
      <template v-else>AI przyzna punkty i wyjaśni ocenę. Nie musisz samodzielnie porównywać odpowiedzi z kluczem.</template>
    </p>
    <p v-if="!pendingCount" class="ai-note">Ocena AI jest orientacyjna. Niepewne oceny są oznaczone; możesz też opcjonalnie skorygować punkty.</p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <div v-if="pendingCount" class="ai-actions">
      <button type="button" class="button button-dark" :disabled="allowance && allowance.left <= 0" @click="grade">
        <Sparkles :size="16" /> Spróbuj ponownie
      </button>
      <AllowanceNote :allowance="allowance" />
    </div>
    <div v-if="gradedAt" class="ai-rating-wrap">
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
