<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import App from './App.vue'
import { EXAM_ROUTE } from './exam/examData'

const ExamPage = defineAsyncComponent(() => import('./exam/ExamPage.vue'))
const hash = ref(window.location.hash)
const isExam = computed(() => hash.value.split('?')[0] === EXAM_ROUTE)
function syncRoute() { hash.value = window.location.hash }
window.addEventListener('hashchange', syncRoute)
watch(isExam, async value => {
  document.title = value ? 'Polski 2026 — trening z arkuszem | Ogarnij Maturę' : 'Ogarnij Maturę — małe kroki, duży progres.'
  await nextTick()
  const anchor = !value && !hash.value.startsWith('#/') ? document.getElementById(hash.value.slice(1)) : null
  if (anchor) anchor.scrollIntoView()
  else window.scrollTo({ top: 0, behavior: 'instant' })
}, { immediate: true })
onBeforeUnmount(() => window.removeEventListener('hashchange', syncRoute))
</script>

<template><ExamPage v-if="isExam" /><App v-else /></template>
