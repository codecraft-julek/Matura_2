<script setup>
// One block of an AI note. The AI only picks the type and fills the data
// (supabase/functions/_shared/notes.ts); everything visual is drawn by these components, so it's
// always sharp, readable on a phone and printable. To add a diagram: a new block type there +
// a component here. Unknown types (e.g. from a newer note format) render nothing.
import CauseEffectBlock from './CauseEffectBlock.vue'
import CompareBlock from './CompareBlock.vue'
import DefinitionBlock from './DefinitionBlock.vue'
import ListBlock from './ListBlock.vue'
import MindmapBlock from './MindmapBlock.vue'
import RememberBlock from './RememberBlock.vue'
import TextBlock from './TextBlock.vue'
import TimelineBlock from './TimelineBlock.vue'

defineProps({ block: { type: Object, required: true } })

const BLOCKS = {
  text: TextBlock,
  list: ListBlock,
  definition: DefinitionBlock,
  remember: RememberBlock,
  timeline: TimelineBlock,
  compare: CompareBlock,
  mindmap: MindmapBlock,
  cause_effect: CauseEffectBlock,
}
</script>

<template>
  <component :is="BLOCKS[block.type]" v-if="BLOCKS[block.type]" :block="block" />
</template>
