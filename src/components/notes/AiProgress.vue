<script setup>
// The "AI is working" screen for notes and flashcards: real progress from the streamed character
// count, a stage text and the seconds so far. The parent computes `progress` (0..1) and `stage`.
import { nextTick, onMounted, ref } from 'vue'
import { Sparkles } from '@lucide/vue'

defineProps({
  title: { type: String, required: true },
  progress: { type: Number, required: true },
  stage: { type: String, required: true },
  seconds: { type: Number, required: true },
  hint: { type: String, default: '' },
})
const heading = ref(null)
onMounted(() => nextTick(() => heading.value?.focus()))
</script>

<template>
  <section class="card card-purple ai-progress" aria-labelledby="ai-progress-title">
    <div class="row-between">
      <h2 id="ai-progress-title" ref="heading" tabindex="-1" class="ai-title"><Sparkles :size="20" aria-hidden="true" /> {{ title }}</h2>
      <span class="muted small tabular" aria-hidden="true">{{ seconds }} s</span>
    </div>
    <div class="progress ai-bar" role="progressbar" :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100" :aria-label="title">
      <span :style="{ width: `${Math.round(progress * 100)}%` }"></span>
    </div>
    <p class="stage" aria-live="polite">{{ stage }}</p>
    <p v-if="hint" class="muted small">{{ hint }}</p>
  </section>
</template>

<style scoped>
.ai-progress { padding: 26px; }
.ai-title { display: inline-flex; align-items: center; gap: 10px; font-size: 21px; letter-spacing: -.5px; color: var(--info); outline: none; }
.ai-bar { height: 10px; margin-top: 18px; background: #e2dbeb; }
.ai-bar > span { background: var(--info); transition: width .7s; }
.stage { margin-top: 14px; font-family: var(--heading); font-weight: 750; font-size: 16px; }
.small { margin-top: 4px; line-height: 1.55; }
</style>
