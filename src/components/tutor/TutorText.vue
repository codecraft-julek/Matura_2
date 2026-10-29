<script setup>
// The tutor's reply (paragraphs, lists, **bold**) rendered as elements, never as HTML,
// so AI output can't inject markup.
import { computed } from 'vue'
import { parseTutorText } from '@/lib/tutor/format'

const props = defineProps({ text: { type: String, required: true } })
const blocks = computed(() => parseTutorText(props.text))
</script>

<template>
  <div class="tutor-text">
    <template v-for="(b, i) in blocks" :key="i">
      <p v-if="b.type === 'p'">
        <template v-for="(line, j) in b.lines" :key="j">
          <br v-if="j > 0" />
          <template v-for="(part, k) in line" :key="k"><strong v-if="part.bold">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template>
        </template>
      </p>
      <component :is="b.type" v-else>
        <li v-for="(item, j) in b.items" :key="j">
          <template v-for="(part, k) in item" :key="k"><strong v-if="part.bold">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template>
        </li>
      </component>
    </template>
  </div>
</template>

<style scoped>
.tutor-text { display: flex; flex-direction: column; gap: 8px; }
.tutor-text ul, .tutor-text ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
.tutor-text strong { font-weight: 700; color: var(--green); }
</style>
