<script setup>
// A small "● Biologia" tag for page kickers, so every page says which subject it shows.
// Hidden when the student has one subject (then the whole app is about it anyway).
import { useSubjectStore } from '@/stores/subject'
import SubjectIcon from './SubjectIcon.vue'

defineProps({ always: { type: Boolean, default: false } })
const subject = useSubjectStore()
</script>

<template>
  <span v-if="always || subject.canSwitch" class="subject-tag" :title="`Pokazujemy treści ${subject.current.from}. Przedmiot zmienisz w górnym pasku.`">
    <SubjectIcon :subject="subject.current" />{{ subject.current.short }}
  </span>
</template>

<style scoped>
.subject-tag { display: inline-flex; align-items: center; gap: 6px; margin-left: 4px; padding: 2px 9px 2px 3px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line-strong); font-size: 11.5px; font-weight: 700; letter-spacing: 0; text-transform: none; color: var(--text); }
</style>
