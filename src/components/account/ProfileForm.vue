<script setup>
// Name, subjects and matura year. Used in onboarding (/witaj, `onboard` also sets onboarded_at)
// and on the account page. Saves itself, updates the cached profile and emits `saved`.
import { computed, reactive, ref, useId, watch } from 'vue'
import { Check } from '@lucide/vue'
import { MATURA_YEARS, SUBJECTS } from '@shared/waitlist'
import AppField from '@/ui/AppField.vue'
import { profileSchema } from '@/lib/validation/auth'
import { saveProfile } from '@/lib/api/account'
import { useAuthStore } from '@/stores/auth'
import FormMessage from './FormMessage.vue'
import SubmitButton from './SubmitButton.vue'
import { focusFirstInvalid, schemaError, useFieldErrors } from './form'

const props = defineProps({
  /** { displayName, subjects, maturaYear } */
  defaults: { type: Object, required: true },
  submitLabel: { type: String, default: 'Zapisz zmiany' },
  onboard: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
})
const emit = defineEmits(['saved'])

const auth = useAuthStore()
const form = ref(null)
const uid = useId()
const values = reactive({
  displayName: props.defaults.displayName ?? '',
  subjects: [...(props.defaults.subjects ?? [])],
  maturaYear: props.defaults.maturaYear ?? null,
})
const saved = ref(JSON.stringify(values))
const dirty = computed(() => JSON.stringify(values) !== saved.value)
const pending = ref(false)
const result = ref(null) // { ok, text }

const f = useFieldErrors({
  displayName: v => schemaError(profileSchema.shape.displayName, v),
  subjects: v => schemaError(profileSchema.shape.subjects, v),
  maturaYear: v => schemaError(profileSchema.shape.maturaYear, v),
})
// Chips: re-check right away once an error is shown; any edit hides the old "Zapisane".
watch(() => [...values.subjects], v => f.input('subjects', v))
watch(() => values.maturaYear, v => f.input('maturaYear', v))
watch(values, () => { if (result.value?.ok) result.value = null })

async function onSubmit() {
  result.value = null
  pending.value = true
  const res = await saveProfile(auth.user.id, values, { onboard: props.onboard })
  pending.value = false
  if (!res.ok) {
    if (res.fieldErrors) { f.set(res.fieldErrors); focusFirstInvalid(form.value) }
    result.value = { ok: false, text: res.error }
    return
  }
  f.clear()
  auth.patchProfile(res.row)
  saved.value = JSON.stringify(values)
  if (!props.onboard) result.value = { ok: true, text: 'Zapisane ✓' }
  emit('saved', res.row)
}
</script>

<template>
  <form ref="form" class="form" novalidate @submit.prevent="onSubmit">
    <AppField v-slot="fld" label="Jak mamy się do Ciebie zwracać?" :error="f.errors.displayName" :counter="values.displayName.length > 30 ? { value: values.displayName.length, max: 40 } : null">
      <input :id="fld.id" v-model="values.displayName" class="input" name="displayName" autocomplete="given-name" placeholder="np. Ala" maxlength="40" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" @blur="f.blur('displayName', values.displayName)" @input="f.input('displayName', values.displayName)" />
    </AppField>

    <fieldset class="field" :aria-describedby="f.errors.subjects ? `${uid}-subjects-error` : undefined">
      <legend class="field-label">Które przedmioty zdajesz?</legend>
      <div class="chip-group">
        <label v-for="s in SUBJECTS" :key="s.value" class="chip">
          <input v-model="values.subjects" type="checkbox" name="subjects" :value="s.value" :aria-invalid="f.errors.subjects ? 'true' : undefined" />
          <Check v-if="values.subjects.includes(s.value)" :size="15" aria-hidden="true" />{{ s.label }}
        </label>
      </div>
      <p v-if="f.errors.subjects" :id="`${uid}-subjects-error`" class="field-error" role="alert">{{ f.errors.subjects }}</p>
    </fieldset>

    <fieldset class="field" :aria-describedby="f.errors.maturaYear ? `${uid}-year-error` : undefined">
      <legend class="field-label">Rok Twojej matury</legend>
      <div class="chip-group">
        <label v-for="y in MATURA_YEARS" :key="y.value" class="chip">
          <input v-model="values.maturaYear" type="radio" name="maturaYear" :value="y.value" :aria-invalid="f.errors.maturaYear ? 'true' : undefined" />{{ y.label }}
        </label>
      </div>
      <p v-if="f.errors.maturaYear" :id="`${uid}-year-error`" class="field-error" role="alert">{{ f.errors.maturaYear }}</p>
    </fieldset>

    <div class="form-actions">
      <SubmitButton :pending="pending" pending-text="Zapisuję…" :block="block" :class="{ 'button-large': block }" :disabled="!onboard && !dirty && !pending">{{ submitLabel }}</SubmitButton>
    </div>
    <FormMessage :message="result?.text ?? ''" :tone="result?.ok ? 'ok' : 'error'" />
  </form>
</template>

<style scoped>
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
legend { padding: 0; margin-bottom: 9px; }
</style>
