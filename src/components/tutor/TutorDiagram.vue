<script setup>
// A diagram in a tutor reply. Tables and timelines reuse the AI note blocks; processes have their
// own component. The data was validated by tutorDiagramSchema, and everything is text in elements.
import { computed } from 'vue'
import CompareBlock from '@/components/notes/CompareBlock.vue'
import TimelineBlock from '@/components/notes/TimelineBlock.vue'
import ProcessDiagram from './ProcessDiagram.vue'

const props = defineProps({ diagram: { type: Object, required: true } })
// Note blocks show an "added by AI" badge unless from_notes: here the whole reply is AI, so no badge.
const block = computed(() => ({ ...props.diagram, from_notes: true }))
</script>

<template>
  <div class="tutor-diagram">
    <ProcessDiagram v-if="diagram.type === 'process'" :diagram="diagram" />
    <CompareBlock v-else-if="diagram.type === 'compare'" :block="block" />
    <TimelineBlock v-else-if="diagram.type === 'timeline'" :block="block" />
  </div>
</template>

<style scoped>
.tutor-diagram { margin: 4px 0; }
.tutor-diagram :deep(.note-block) { padding: 16px; box-shadow: none; }
.tutor-diagram :deep(.block-heading) { font-size: 16.5px; }
.tutor-diagram :deep(.block-body) { margin-top: 10px; font-size: 14.5px; }
</style>
