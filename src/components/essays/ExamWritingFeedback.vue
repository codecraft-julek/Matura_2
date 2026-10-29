<script setup>
// On an exam results page: AI feedback for the English writing task or the Polish essay.
// We don't store exam texts (copyright), so the student can paste the task instructions;
// without them the AI can't check "Treść" against the bullet points.
import { computed, onMounted, ref, useId } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, Sparkles } from '@lucide/vue'
import { rubricFor } from '@shared/essay'
import AllowanceNote from '@/ui/AllowanceNote.vue'
import { essayRoute } from '@/config/routes'
import { useBillingStore } from '@/stores/billing'
import AnalyzingPanel from './AnalyzingPanel.vue'
import { useEssayAnalysis } from './useEssayAnalysis'

const props = defineProps({
  attemptId: { type: String, required: true },
  taskNumber: { type: String, required: true },
  existingEssayId: { type: String, default: undefined },
  level: { type: String, required: true }, // 'basic' | 'extended'
  subject: { type: String, required: true }, // 'polish' | 'english'
})

const id = useId()
const billing = useBillingStore()
const prompt = ref('')
const { state, run, busy } = useEssayAnalysis()

const polish = computed(() => props.subject === 'polish')
const rubric = computed(() => rubricFor(polish.value ? 'polish_essay' : 'english_writing', props.level === 'extended' ? 'extended' : 'basic'))
const allowance = computed(() => billing.allowanceFor('essay_feedback'))
const noChecksLeft = computed(() => allowance.value?.left === 0)
const promptLabel = computed(() => (polish.value ? (props.level === 'extended' ? 'Wybrany temat z arkusza' : 'Wybrany temat z Arkusza 2') : 'Polecenie z arkusza'))

onMounted(() => { if (!props.existingEssayId) billing.loadAllowances().catch(() => {}) })

function onSubmit() {
  if (busy.value) return
  run({ mode: 'exam', attemptId: props.attemptId, taskNumber: props.taskNumber, prompt: prompt.value })
}
</script>

<template>
  <RouterLink v-if="existingEssayId" :to="essayRoute(existingEssayId)" class="button button-dark">
    <Sparkles :size="16" /> Zobacz feedback AI <ArrowRight :size="16" />
  </RouterLink>

  <AnalyzingPanel v-else-if="busy" :state="state" :rubric="rubric" />

  <form v-else class="exam-feedback card card-purple form" @submit.prevent="onSubmit">
    <h3 class="exam-feedback-title"><Sparkles :size="17" /> {{ polish ? 'Feedback AI do wypracowania' : 'Feedback AI do tej wypowiedzi' }}</h3>
    <div class="field">
      <label :for="`${id}-prompt`" class="field-label">{{ promptLabel }} <span class="optional">(opcjonalnie, ale bardzo pomaga)</span></label>
      <textarea
        :id="`${id}-prompt`"
        v-model="prompt"
        class="textarea"
        rows="4"
        maxlength="3000"
        :aria-describedby="state.error ? `${id}-error` : undefined"
        :placeholder="polish ? 'Przepisz temat, który wybrano, żeby AI sprawdziło, czy wypracowanie go realizuje.' : 'Przepisz polecenie i podpunkty z arkusza, żeby AI sprawdziło też treść.'"
      ></textarea>
    </div>
    <div class="form-actions">
      <button type="submit" class="button button-dark" :disabled="noChecksLeft">
        <Sparkles :size="16" /> {{ noChecksLeft ? 'Limit wykorzystany' : 'Sprawdź z AI' }}
      </button>
      <AllowanceNote :allowance="allowance" />
    </div>
    <p v-if="state.error" :id="`${id}-error`" class="alert alert-error" role="alert">{{ state.error }}</p>
  </form>
</template>

<style scoped>
.exam-feedback { gap: 14px; }
.exam-feedback-title { display: inline-flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 750; letter-spacing: -.3px; color: var(--info); }
.exam-feedback .textarea { font-size: 15px; min-height: 104px; }
@media (max-width: 760px) { .exam-feedback .textarea { font-size: 16px; } }
</style>
