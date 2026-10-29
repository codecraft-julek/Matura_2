<script setup>
import NoteBlockShell from './NoteBlockShell.vue'

defineProps({ block: { type: Object, required: true } })
</script>

<template>
  <NoteBlockShell kind="porównanie" :heading="block.heading" :from-notes="block.from_notes">
    <!-- Wide tables scroll inside the card on phones instead of squashing the text. -->
    <div class="table-scroll" tabindex="0" role="region" :aria-label="block.heading || 'Tabela porównawcza'">
      <table :class="`cols-${block.columns.length}`">
        <thead>
          <tr>
            <td class="corner"></td>
            <th v-for="c in block.columns" :key="c" scope="col">{{ c }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in block.rows" :key="i">
            <th scope="row">{{ r.feature }}</th>
            <td v-for="(v, j) in r.values" :key="j">{{ v }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </NoteBlockShell>
</template>

<style scoped>
.table-scroll { overflow-x: auto; margin-inline: -4px; padding-inline: 4px; border-radius: var(--radius-sm); }
.table-scroll:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 15px; }
table.cols-3 { min-width: 27rem; }
table.cols-4 { min-width: 34rem; }
th, td { padding: 10px 12px; text-align: left; vertical-align: top; line-height: 1.5; }
thead th { background: var(--green); color: white; font-family: var(--heading); font-weight: 750; font-size: 14.5px; }
thead th:first-of-type { border-top-left-radius: 10px; }
thead th:last-child { border-top-right-radius: 10px; }
.corner { width: 24%; }
tbody th { font-weight: 700; }
tbody tr:nth-child(odd) { background: var(--surface-3); }
tbody tr > * { border-bottom: 1px solid var(--line); }
@media print { .table-scroll { overflow: visible; } table { min-width: 0 !important; font-size: 12.5px; } thead th, tbody tr { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
