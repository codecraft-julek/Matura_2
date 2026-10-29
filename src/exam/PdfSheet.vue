<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { TextLayer } from 'pdfjs-dist'

const props = defineProps({ page: { type: Object, required: true }, width: { type: Number, required: true }, active: { type: Boolean, default: false } })
const element = ref(null)
const canvas = ref(null)
const textContainer = ref(null)
const ready = ref(false)
const failed = ref(false)
const original = props.page.getViewport({ scale: 1 })
const scale = computed(() => props.width / original.width)
const height = computed(() => original.height * scale.value)
let timer, renderTask, textTask
let revision = 0

async function render() {
  const ticket = ++revision
  const previous = renderTask
  previous?.cancel()
  textTask?.cancel()
  if (previous) await previous.promise.catch(() => {})
  if (ticket !== revision || !canvas.value) return
  ready.value = false
  failed.value = false
  textContainer.value.replaceChildren()
  if (!props.active || props.width < 1) {
    canvas.value.width = canvas.value.height = 0
    return
  }
  try {
    const viewport = props.page.getViewport({ scale: scale.value })
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.value.width = Math.floor(viewport.width * pixelRatio)
    canvas.value.height = Math.floor(viewport.height * pixelRatio)
    renderTask = props.page.render({
      canvasContext: canvas.value.getContext('2d'), viewport,
      transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0],
    })
    await renderTask.promise
    if (ticket !== revision) return
    ready.value = true
    textTask = new TextLayer({ textContentSource: props.page.streamTextContent(), container: textContainer.value, viewport })
    await textTask.render()
  } catch (error) {
    if (ticket === revision && error.name !== 'RenderingCancelledException' && error.name !== 'AbortException') failed.value = true
  }
}

watch([() => props.active, () => props.width], () => {
  clearTimeout(timer)
  timer = setTimeout(render, 60)
})
onMounted(render)
onBeforeUnmount(() => {
  revision++
  clearTimeout(timer)
  renderTask?.cancel()
  textTask?.cancel()
})
defineExpose({ element })
</script>

<template>
  <div ref="element" class="pdf-sheet" :data-page="page.pageNumber" :data-ready="ready" role="group" :aria-label="`Strona ${page.pageNumber} arkusza`" :style="{ width: `${width}px`, height: `${height}px`, '--total-scale-factor': scale, '--scale-round-x': '1px', '--scale-round-y': '1px' }">
    <canvas ref="canvas" aria-hidden="true" :style="{ width: `${width}px`, height: `${height}px` }"></canvas>
    <div ref="textContainer" class="pdf-text-layer"></div>
    <div v-if="!ready" class="pdf-sheet-placeholder"><span>Strona {{ page.pageNumber }}</span><button v-if="failed" @click="render">Ponów wyświetlanie</button></div>
  </div>
</template>
