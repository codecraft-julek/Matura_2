<script setup>
// Grid of task blocks, by section: answered / flagged / checked (practice), like the demo trainer's map.
import { computed } from 'vue'
import { Bookmark, Check, Minus, X } from '@lucide/vue'
import { SECTION_LABEL } from '@/lib/exams/labels'
import { groupCheck, isAnswered } from './sheet'

const props = defineProps({
  groups: { type: Array, required: true },
  activeIndex: { type: Number, default: 0 },
  answers: { type: Object, required: true },
  flags: { type: Array, default: () => [] },
  checked: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
})
defineEmits(['go'])

// Two blocks can share a group number (Polish "10.1" closed + "10.2" open): show the task number then.
const shared = computed(() => {
  const seen = new Map()
  for (const g of props.groups) seen.set(g.no, (seen.get(g.no) ?? 0) + 1)
  return new Set([...seen].filter(([, n]) => n > 1).map(([no]) => no))
})
const mapLabel = g => (shared.value.has(g.no) ? g.tasks[0].number : String(g.no))

const sections = computed(() => {
  const list = []
  props.groups.forEach((g, index) => {
    const last = list.at(-1)
    const item = { g, index, s: state(g) }
    if (last && last.section === g.section) last.items.push(item)
    else list.push({ section: g.section, items: [item] })
  })
  return list
})

function state(g) {
  const done = g.tasks.filter(t => isAnswered(t, props.answers[t.number])).length
  return {
    answered: done === g.tasks.length,
    started: done > 0 && done < g.tasks.length,
    flagged: props.flags.includes(g.key),
    check: groupCheck(g, props.checked),
  }
}
function describe(g, s) {
  const parts = [`Zadanie ${g.no}: ${g.label}`]
  parts.push(s.answered ? 'odpowiedziane' : s.started ? 'zaczęte' : 'bez odpowiedzi')
  if (s.check) parts.push(`sprawdzone, ${s.check.got}/${s.check.max} pkt`)
  if (s.flagged) parts.push('oznaczone do powrotu')
  return parts.join(', ')
}
</script>

<template>
  <nav class="qmap" aria-label="Mapa zadań">
    <div v-for="sec in sections" :key="`${sec.section}-${sec.items[0].index}`" class="qmap-section">
      <span class="qmap-label">{{ SECTION_LABEL[sec.section] ?? sec.section }}</span>
      <div class="qmap-grid">
        <button
          v-for="{ g, index, s } in sec.items" :key="g.key"
            type="button" class="qmap-btn"
            :class="{ 'is-active': index === activeIndex, 'is-answered': s.answered, 'is-started': s.started, [`is-${s.check?.tone}`]: s.check }"
            :disabled="disabled"
            :aria-current="index === activeIndex ? 'step' : undefined"
            :aria-label="describe(g, s)" :title="`Zadanie ${g.no}. ${g.label}`"
            @click="$emit('go', index)"
          >
            {{ mapLabel(g) }}
            <Check v-if="s.check?.tone === 'ok'" :size="10" :stroke-width="3" class="qmap-tick" aria-hidden="true" />
            <Minus v-else-if="s.check?.tone === 'warn'" :size="10" :stroke-width="3" class="qmap-tick" aria-hidden="true" />
            <X v-else-if="s.check?.tone === 'error'" :size="10" :stroke-width="3" class="qmap-tick" aria-hidden="true" />
            <Bookmark v-if="s.flagged" :size="9" class="qmap-flag" fill="currentColor" aria-hidden="true" />
          </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.qmap { display: flex; flex-wrap: wrap; gap: 10px 22px; }
.qmap-section { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.qmap-label { font-size: 11px; font-weight: 700; letter-spacing: .3px; color: var(--text-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qmap-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.qmap-btn { position: relative; display: grid; place-items: center; min-width: 38px; padding: 0 6px; height: 36px; border-radius: 8px; border: 1px solid var(--line); background: #f9fbf6; color: var(--text-soft); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; transition: background .15s, border-color .15s; }
.qmap-btn:hover:not(:disabled, .is-active) { background: var(--surface-2); border-color: var(--line-strong); }
.qmap-btn.is-started { background: linear-gradient(135deg, var(--surface-2) 50%, #f9fbf6 50%); color: var(--text); }
.qmap-btn.is-answered { background: #e4edda; border-color: #cddcbb; color: var(--green); }
.qmap-btn.is-ok { background: var(--ok-bg); border-color: var(--ok-line); color: var(--ok); }
.qmap-btn.is-warn { background: var(--warn-bg); border-color: var(--warn-line); color: var(--warn); }
.qmap-btn.is-error { background: var(--error-bg); border-color: var(--error-line); color: var(--error); }
.qmap-btn.is-active { background: var(--green); border-color: var(--green); color: var(--lime); box-shadow: 0 2px 6px #29463420; }
.qmap-btn:disabled { opacity: .5; }
.qmap-flag { position: absolute; top: 2px; right: 2px; color: var(--warn); }
.qmap-tick { position: absolute; bottom: 2px; right: 2px; }
.qmap-btn.is-active .qmap-flag { color: var(--lime); }
@media (max-width: 600px) {
  .qmap { gap: 10px 16px; }
  .qmap-btn { min-width: 36px; height: 36px; }
}
</style>
