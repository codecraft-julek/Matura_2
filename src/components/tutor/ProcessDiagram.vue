<script setup>
// A process from the tutor: numbered steps joined by arrows, top to bottom (fits a phone and the
// docked panel). "Name: what happens" steps get the name in bold. A cycle ends with an arrow back.
import { ArrowDown, RotateCcw } from '@lucide/vue'
import NoteBlockShell from '@/components/notes/NoteBlockShell.vue'

defineProps({ diagram: { type: Object, required: true } })

function split(step) {
  const at = step.indexOf(': ')
  return at > 0 && at <= 40 ? { name: step.slice(0, at), text: step.slice(at + 2) } : { name: '', text: step }
}
</script>

<template>
  <NoteBlockShell :kind="diagram.cycle ? 'cykl' : 'proces'" :heading="diagram.heading">
    <ol class="steps">
      <li v-for="(step, i) in diagram.steps" :key="i" class="step">
        <div class="step-card">
          <span class="step-no" aria-hidden="true">{{ i + 1 }}</span>
          <p><strong v-if="split(step).name">{{ split(step).name }}: </strong>{{ split(step).text }}</p>
        </div>
        <ArrowDown v-if="i < diagram.steps.length - 1" class="arrow" :size="18" aria-hidden="true" />
      </li>
    </ol>
    <p v-if="diagram.cycle" class="cycle"><RotateCcw :size="16" aria-hidden="true" /> Potem wszystko od etapu 1</p>
  </NoteBlockShell>
</template>

<style scoped>
.steps { display: flex; flex-direction: column; align-items: stretch; gap: 0; margin: 0; padding: 0; list-style: none; }
.steps > .step { display: flex; flex-direction: column; align-items: center; margin: 0; padding: 0; }
.step-card { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 10px 12px; border-radius: 12px; background: var(--surface-3); border: 1px solid var(--line); }
.step-card p { margin: 0; font-size: 14.5px; line-height: 1.5; color: var(--text); overflow-wrap: anywhere; }
.step-card strong { color: var(--green); }
.step-no { flex-shrink: 0; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--green); color: white; font-family: var(--heading); font-size: 13px; font-weight: 800; }
.arrow { margin: 4px 0; color: var(--accent); }
.cycle { margin: 10px 0 0; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13.5px; font-weight: 650; color: var(--accent); }
</style>
