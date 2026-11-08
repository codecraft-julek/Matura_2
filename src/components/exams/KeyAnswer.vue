<script setup>
// What the key says for one task, after checking. A one-line key stays inline ("Klucz: B");
// a worked solution (several lines, e.g. a chemistry calculation) becomes a block with one
// step per line, so the student can compare it with their own work on paper.
import { computed } from 'vue'

const props = defineProps({
  /** TaskResult from grade_exam_answers: `answer` is the key text, `note` the scoring hint. */
  result: { type: Object, required: true },
  /** Marked calculation task (exam_tasks.meta.calc): the block is called "Rozwiązanie". */
  calc: { type: Boolean, default: false },
})
const lines = computed(() => String(props.result.answer ?? '').split('\n').map(l => l.trim()).filter(Boolean))
const block = computed(() => props.calc || lines.value.length > 1)
</script>

<template>
  <div v-if="block" class="key-block">
    <span class="key-title">{{ calc ? 'Rozwiązanie' : 'Klucz' }}</span>
    <ol class="key-steps">
      <li v-for="(line, i) in lines" :key="i">{{ line }}</li>
    </ol>
    <p v-if="result.note" class="key-note">{{ result.note }}</p>
  </div>
  <p v-else class="key-line"><span class="muted">Klucz: </span><strong>{{ result.answer }}</strong><span v-if="result.note" class="muted"> ({{ result.note }})</span></p>
</template>

<style scoped>
.key-block { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-radius: var(--radius-sm); background: var(--surface-2); border: 1px solid var(--line); }
.key-title { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--accent); }
.key-steps { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 5px; font-size: 14px; line-height: 1.6; color: var(--text); overflow-wrap: anywhere; }
.key-steps li::marker { color: var(--text-soft); font-variant-numeric: tabular-nums; }
.key-note { font-size: 13px; line-height: 1.55; color: var(--text-soft); }
.key-line { font-size: 14px; line-height: 1.55; overflow-wrap: anywhere; }
.muted { color: var(--text-soft); }
</style>
