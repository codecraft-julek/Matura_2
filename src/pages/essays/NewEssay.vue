<script setup>
// /wypracowania/nowe: level, topic and the essay (draft kept in this browser), then the live
// analysis (AnalyzingPanel) and the feedback page.
import { computed, onMounted, ref, useId } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronLeft, Sparkles } from '@lucide/vue'
import { MIN_WORDS_FOR_FEEDBACK, RUBRICS, countWords, essayRequestSchema, rubricFor } from '@shared/essay'
import AllowanceNote from '@/ui/AllowanceNote.vue'
import AppField from '@/ui/AppField.vue'
import AnalyzingPanel from '@/components/essays/AnalyzingPanel.vue'
import { useEssayAnalysis } from '@/components/essays/useEssayAnalysis'
import { ROUTES } from '@/config/routes'
import { useDraft } from '@/composables/useDraft'
import { count } from '@/lib/format'
import { useBillingStore } from '@/stores/billing'

const LEVELS = [
  { value: 'basic', label: 'Podstawowy' },
  { value: 'extended', label: 'Rozszerzony' },
]
const MAX_CHARS = 20000
const WORD_FORMS = ['wyraz', 'wyrazy', 'wyrazów']

const id = useId()
const billing = useBillingStore()
// A draft is kept in this browser while typing, so a refresh doesn't wipe a 400-word essay.
const draft = useDraft('essay-new', { level: 'basic', topic: '', content: '' })
const formError = ref('')
const { state, run, busy } = useEssayAnalysis()

onMounted(() => billing.loadAllowances().catch(() => {}))
const allowance = computed(() => billing.allowanceFor('essay_feedback'))
const noChecksLeft = computed(() => allowance.value?.left === 0)

const level = computed(() => (draft.value.level === 'extended' ? 'extended' : 'basic'))
const rubric = computed(() => rubricFor('polish_essay', level.value))
const minWords = computed(() => RUBRICS[rubric.value].minWords)
const words = computed(() => countWords(draft.value.content))
const error = computed(() => formError.value || state.error)

async function onSubmit() {
  if (busy.value) return
  const parsed = essayRequestSchema.safeParse({ mode: 'polish', level: level.value, topic: draft.value.topic, content: draft.value.content })
  if (!parsed.success) { formError.value = parsed.error.issues[0]?.message ?? 'Sprawdź formularz.'; return }
  if (words.value < MIN_WORDS_FOR_FEEDBACK) { formError.value = `Napisz co najmniej ${MIN_WORDS_FOR_FEEDBACK} wyrazów.`; return }
  formError.value = ''
  await run(parsed.data, () => draft.clear())
}
</script>

<template>
  <div class="new-essay">
    <nav class="breadcrumbs" aria-label="Okruszki">
      <RouterLink :to="ROUTES.essays" class="row" style="--gap: 4px"><ChevronLeft :size="15" /> Wypracowania</RouterLink>
    </nav>
    <header class="page-header">
      <div>
        <span class="page-kicker">Feedback AI</span>
        <h1>Sprawdź wypracowanie<span class="accent-dot">.</span></h1>
        <p>Język polski, formuła 2023, poziom podstawowy albo rozszerzony. AI oceni tekst według kryteriów CKE i pokaże, co poprawić.</p>
      </div>
    </header>

    <!-- While the AI works, the form is replaced by the live analysis panel. -->
    <AnalyzingPanel v-if="busy" :state="state" :rubric="rubric" />

    <form v-else class="card form" novalidate @submit.prevent="onSubmit">
      <fieldset class="field level-field">
        <legend class="field-label">Poziom matury</legend>
        <div class="chip-group">
          <label v-for="l in LEVELS" :key="l.value" class="chip">
            <input v-model="draft.level" type="radio" :name="`${id}-level`" :value="l.value" />
            {{ l.label }}
          </label>
        </div>
        <p class="field-hint">
          {{ level === 'extended' ? 'Kryteria z poziomu rozszerzonego: trzy utwory, układ problemowy, ostrzejsze progi błędów.' : 'Kryteria z poziomu podstawowego.' }}
        </p>
      </fieldset>

      <AppField v-slot="f" label="Temat wypracowania" hint="Przepisz temat z arkusza albo wpisz własny.">
        <input :id="f.id" v-model="draft.topic" class="input" maxlength="500" placeholder="np. Czy miłość może prowadzić do zguby?" :aria-describedby="f.describedby" />
      </AppField>

      <AppField v-slot="f" label="Twoje wypracowanie" :counter="draft.content.length > MAX_CHARS - 2000 ? { value: draft.content.length, max: MAX_CHARS, unit: 'zn.' } : null">
        <textarea
          :id="f.id"
          v-model="draft.content"
          class="textarea essay-input"
          rows="14"
          :maxlength="MAX_CHARS"
          placeholder="Wklej albo napisz tutaj swoje wypracowanie…"
          :aria-describedby="[f.describedby, `${id}-words`].filter(Boolean).join(' ')"
        ></textarea>
      </AppField>
      <p :id="`${id}-words`" class="word-count" :class="{ 'is-enough': words >= minWords }" aria-live="polite">
        {{ count(words, WORD_FORMS) }}<template v-if="words < minWords"> (na maturze minimum to {{ minWords }})</template>
      </p>

      <div class="submit stack" style="--gap: 10px">
        <button type="submit" class="button button-dark button-large full-width" :disabled="noChecksLeft">
          <Sparkles :size="18" /> {{ noChecksLeft ? 'Limit wykorzystany' : 'Sprawdź z AI' }}
        </button>
        <p class="muted small submit-note">
          <AllowanceNote :allowance="allowance" />
          <span class="block">Nie wpisuj w tekście danych osobowych. Szkic zapisuje się w tej przeglądarce.</span>
        </p>
      </div>
      <p v-if="error" class="alert alert-error" role="alert">{{ error }}</p>
    </form>
  </div>
</template>

<style scoped>
.new-essay { max-width: 760px; margin-inline: auto; }
.level-field { border: 0; margin: 0; padding: 0; min-width: 0; }
.level-field legend { margin-bottom: 8px; padding: 0; }
.essay-input { min-height: 320px; line-height: 1.7; }
.word-count { margin-top: -10px; font-size: 13px; color: var(--text-soft); font-variant-numeric: tabular-nums; }
.word-count.is-enough { color: var(--ok); font-weight: 650; }
.submit-note { text-align: center; }
.block { display: block; margin-top: 4px; }
</style>
