<script setup>
// One page of a local PDF: canvas + selectable text layer, rendered only while `active` (near the
// viewport). Adapted copy of src/exam/PdfSheet.vue (the public demo keeps its own).
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
  <div ref="element" class="pdf-page" :data-page="page.pageNumber" role="group" :aria-label="`Strona ${page.pageNumber} arkusza`" :style="{ width: `${width}px`, height: `${height}px`, '--total-scale-factor': scale, '--scale-round-x': '1px', '--scale-round-y': '1px' }">
    <canvas ref="canvas" aria-hidden="true" :style="{ width: `${width}px`, height: `${height}px` }"></canvas>
    <div ref="textContainer" class="text-layer"></div>
    <div v-if="!ready" class="placeholder"><span>Strona {{ page.pageNumber }}</span><button v-if="failed" type="button" class="button button-outline button-sm" @click="render">Ponów wyświetlanie</button></div>
  </div>
</template>

<style scoped>
.pdf-page { position: relative; background: white; box-shadow: 0 2px 8px #253b2514; flex-shrink: 0; overflow: hidden; }
canvas { display: block; }
.placeholder { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: #fff; color: var(--text-soft); font-size: 13px; }
/* TextLayer layout follows Mozilla PDF.js (Apache-2.0). The spans are created by pdf.js, hence :deep. */
.text-layer { position: absolute; inset: 0; overflow: clip; text-align: initial; line-height: 1; letter-spacing: normal; word-spacing: normal; text-size-adjust: none; forced-color-adjust: none; transform-origin: 0 0; --min-font-size: 1; --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size)); --min-font-size-inv: calc(1 / var(--min-font-size)); }
.text-layer :deep(:is(span, br)) { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0 0; user-select: text; }
.text-layer > :deep(:not(.markedContent)), .text-layer :deep(.markedContent span:not(.markedContent)) { z-index: 1; --font-height: 0; font-size: calc(var(--text-scale-factor) * var(--font-height)); --scale-x: 1; --rotate: 0deg; transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv)); }
.text-layer :deep(.markedContent) { display: contents; }
.text-layer :deep(::selection) { color: transparent; background: #a3bc7e66; }
</style>
