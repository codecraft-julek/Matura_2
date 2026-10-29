<script setup>
// Label + control + hint/error/counter, wired up for screen readers. The control goes in the slot
// and receives { id, describedby, invalid } to bind:
//   <AppField label="E-mail" :error="errors.email" v-slot="f">
//     <input :id="f.id" v-model="email" class="input" :aria-invalid="f.invalid" :aria-describedby="f.describedby" />
//   </AppField>
import { computed, useId } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  optional: { type: Boolean, default: false },
  /** Character/word counter: { value: 120, max: 2000, unit?: 'zn.' } */
  counter: { type: Object, default: null },
  srLabel: { type: Boolean, default: false },
})
const id = useId()
const describedby = computed(() => [props.error && `${id}-error`, props.hint && `${id}-hint`].filter(Boolean).join(' ') || undefined)
</script>

<template>
  <div class="field">
    <label :for="id" class="field-label" :class="{ 'sr-only': srLabel }">{{ label }}<span v-if="optional" class="optional"> (opcjonalnie)</span></label>
    <slot :id="id" :describedby="describedby" :invalid="error ? 'true' : undefined" />
    <div v-if="hint || counter" class="row-between">
      <p v-if="hint" :id="`${id}-hint`" class="field-hint">{{ hint }}</p>
      <span v-if="counter" class="field-counter" :class="{ 'is-over': counter.value > counter.max }" aria-live="polite">{{ counter.value.toLocaleString('pl-PL') }} / {{ counter.max.toLocaleString('pl-PL') }}{{ counter.unit ? ` ${counter.unit}` : '' }}</span>
    </div>
    <p v-if="error" :id="`${id}-error`" class="field-error" role="alert">{{ error }}</p>
  </div>
</template>
