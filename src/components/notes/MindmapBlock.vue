<script setup>
// Mind map: on phones a tree (centre on top, branches below); on wider screens the branches sit
// around the centre in a 3-column grid, joined by dashed lines (an SVG behind the cards).
import { computed } from 'vue'
import NoteBlockShell from './NoteBlockShell.vue'

const props = defineProps({ block: { type: Object, required: true } })

// Where branches go around the centre (row, column). The centre is in column 1 of 0..2.
const LAYOUTS = {
  2: { rows: 1, center: 0, cells: [[0, 0], [0, 2]] },
  3: { rows: 2, center: 0, cells: [[0, 0], [0, 2], [1, 1]] },
  4: { rows: 3, center: 1, cells: [[0, 0], [0, 2], [2, 0], [2, 2]] },
  5: { rows: 3, center: 1, cells: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 2]] },
  6: { rows: 3, center: 1, cells: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]] },
}
const layout = computed(() => LAYOUTS[props.block.branches.length] ?? LAYOUTS[6])
const branches = computed(() => props.block.branches.slice(0, 6))
const tone = i => `tone-${i % 6}`
</script>

<template>
  <NoteBlockShell kind="mapa myśli" :from-notes="block.from_notes">
    <!-- Phones -->
    <div class="mm-tree">
      <p class="mm-center">{{ block.center }}</p>
      <ul class="mm-tree-list">
        <li v-for="(br, i) in branches" :key="i">
          <div class="mm-branch" :class="tone(i)">
            <p class="mm-label"><span class="mm-dot" aria-hidden="true"></span>{{ br.label }}</p>
            <ul v-if="br.items.length" class="mm-items"><li v-for="(it, j) in br.items" :key="j">{{ it }}</li></ul>
          </div>
        </li>
      </ul>
    </div>

    <!-- Wider screens -->
    <div class="mm-grid" :style="{ gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))` }">
      <svg class="mm-lines" aria-hidden="true" :viewBox="`0 0 300 ${layout.rows * 100}`" preserveAspectRatio="none">
        <line
          v-for="([r, c], i) in layout.cells.slice(0, branches.length)" :key="i"
          :x1="150" :y1="layout.center * 100 + 50" :x2="c * 100 + 50" :y2="r * 100 + 50"
          stroke="currentColor" stroke-width="2" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"
        />
      </svg>
      <div class="mm-cell" :style="{ gridRow: layout.center + 1, gridColumn: 2 }"><p class="mm-center">{{ block.center }}</p></div>
      <div v-for="(br, i) in branches" :key="i" class="mm-cell" :style="{ gridRow: layout.cells[i][0] + 1, gridColumn: layout.cells[i][1] + 1 }">
        <div class="mm-branch" :class="tone(i)">
          <p class="mm-label"><span class="mm-dot" aria-hidden="true"></span>{{ br.label }}</p>
          <ul v-if="br.items.length" class="mm-items"><li v-for="(it, j) in br.items" :key="j">{{ it }}</li></ul>
        </div>
      </div>
    </div>
  </NoteBlockShell>
</template>

<style scoped>
.mm-center { position: relative; z-index: 1; padding: 13px 16px; border-radius: 14px; background: var(--green); color: white; text-align: center; font-family: var(--heading); font-size: 17px; font-weight: 800; letter-spacing: -.3px; line-height: 1.35; text-wrap: balance; box-shadow: 0 0 0 4px var(--lime); }
.mm-branch { position: relative; z-index: 1; width: 100%; padding: 12px 14px; border-radius: var(--radius); border: 1px solid; background: var(--surface); }
.mm-label { display: flex; align-items: center; gap: 8px; font-family: var(--heading); font-weight: 750; font-size: 15px; line-height: 1.35; }
.mm-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; background: currentColor; }
.mm-items { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; padding: 0; list-style: none; }
.mm-items li { padding: 3px 9px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); font-size: 13.5px; line-height: 1.4; color: var(--text); }

/* Six branch tints from the palette (the dot takes the label colour). */
.tone-0 { background: var(--surface-3); border-color: #d1ddc0; } .tone-0 .mm-label { color: var(--ok); }
.tone-1 { background: #f2fbd9; border-color: #dcef9f; } .tone-1 .mm-label { color: #5f7f2a; }
.tone-2 { background: #efebf5; border-color: #e1d8ec; } .tone-2 .mm-label { color: var(--info); }
.tone-3 { background: #f5f0e5; border-color: #e6dcc7; } .tone-3 .mm-label { color: #8a7440; }
.tone-4 { background: var(--error-bg); border-color: var(--error-line); } .tone-4 .mm-label { color: var(--error); }
.tone-5 { background: var(--warn-bg); border-color: var(--warn-line); } .tone-5 .mm-label { color: var(--warn); }

.mm-tree-list { margin: 14px 0 0 14px; padding: 0 0 0 16px; list-style: none; border-left: 2px dashed var(--line-strong); display: flex; flex-direction: column; gap: 12px; }
.mm-tree-list > li { position: relative; }
.mm-tree-list > li::before { content: ''; position: absolute; left: -16px; top: 22px; width: 16px; border-top: 2px dashed var(--line-strong); }

.mm-grid { display: none; position: relative; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px 40px; }
.mm-lines { position: absolute; inset: 0; width: 100%; height: 100%; color: var(--line-strong); }
.mm-cell { display: flex; align-items: center; }
.mm-cell .mm-center { width: 100%; }

@media (min-width: 640px) {
  .mm-tree { display: none; }
  .mm-grid { display: grid; }
}
@media print {
  .mm-tree { display: none; }
  .mm-grid { display: grid; gap: 16px 28px; }
  .mm-center, .mm-branch, .mm-items li { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
</style>
