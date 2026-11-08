<script setup>
// Above a list of notes or decks: the list shows only the active subject (from the header), so
// nothing mixes. This tells the student where the rest is: "Inne" (items about no subject) as a
// second chip, and other subjects as links that switch the header. v-model is 'subject' | 'other'.
import { computed } from 'vue'
import { SUBJECTS } from '@/config/subjects'
import { useSubjectStore } from '@/stores/subject'
import SubjectIcon from './SubjectIcon.vue'

const props = defineProps({
  modelValue: { type: String, required: true }, // 'subject' | 'other'
  /** Everything the student has, each with a `subject` (polish, english, biology, other). */
  items: { type: Array, required: true },
  /** "notatki" / "talie": "3 notatki z polskiego". */
  noun: { type: String, required: true },
})
const emit = defineEmits(['update:modelValue'])
const subject = useSubjectStore()

const count = id => props.items.filter(i => i.subject === id).length
const other = computed(() => count('other'))
const elsewhere = computed(() => SUBJECTS.filter(s => s.id !== subject.active && count(s.id) > 0).map(s => ({ ...s, n: count(s.id), mine: subject.available.some(a => a.id === s.id) })))
const show = computed(() => subject.canSwitch || other.value > 0 || elsewhere.value.length > 0)
</script>

<template>
  <div v-if="show" class="subject-filter">
    <div class="chip-group" role="group" :aria-label="`Które ${noun} pokazać`">
      <button type="button" class="chip" :aria-pressed="modelValue === 'subject'" @click="emit('update:modelValue', 'subject')">
        <SubjectIcon :subject="subject.current" />{{ subject.current.short }}<span class="chip-count tabular">{{ count(subject.active) }}</span>
      </button>
      <button v-if="other" type="button" class="chip" :aria-pressed="modelValue === 'other'" @click="emit('update:modelValue', 'other')">
        Inne<span class="chip-count tabular">{{ other }}</span>
      </button>
    </div>
    <p v-if="elsewhere.length" class="elsewhere">
      Masz też {{ noun }}
      <template v-for="(s, i) in elsewhere" :key="s.id">
        <template v-if="i > 0"> i </template>
        <button v-if="s.mine" type="button" class="link-button" :title="`Przełącz na ${s.label}`" @click="subject.set(s.id)">{{ s.from }} ({{ s.n }})</button>
        <span v-else>{{ s.from }} ({{ s.n }})</span>
      </template>.
      <span v-if="elsewhere.some(s => s.mine)">Kliknij, żeby przełączyć przedmiot.</span>
      <span v-else>Dodaj ten przedmiot w ustawieniach konta, żeby je zobaczyć.</span>
    </p>
  </div>
</template>

<style scoped>
.subject-filter { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.subject-filter .chip { min-height: 38px; padding: 7px 14px 7px 9px; font-size: 13px; }
.chip-count { padding: 1px 7px; border-radius: 999px; background: #0000000f; font-size: 11.5px; font-weight: 700; }
.chip[aria-pressed='true'] .chip-count { background: #ffffff33; }
.elsewhere { font-size: 13.5px; color: var(--text-soft); line-height: 1.6; }
.link-button { padding: 0; border: 0; background: none; font: inherit; font-weight: 700; color: var(--green); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.link-button:hover { color: var(--accent); }
</style>
