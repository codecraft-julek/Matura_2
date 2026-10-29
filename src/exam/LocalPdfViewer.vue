<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, FileText, FolderOpen, Link2, LoaderCircle, LockKeyhole, Minus, Plus, RefreshCw, Upload } from '@lucide/vue'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import PdfSheet from './PdfSheet.vue'
import { officialExam } from './examData'
import './pdf-viewer.css'

GlobalWorkerOptions.workerSrc = workerUrl
const props = defineProps({ question: { type: Object, required: true }, active: { type: Boolean, default: true } })
const emit = defineEmits(['loaded'])
const fileInput = ref(null)
const scroller = ref(null)
const viewer = ref(null)
const pages = shallowRef([])
const filename = ref('')
const error = ref('')
const loading = ref(false)
const dragging = ref(false)
const zoom = ref(1)
const availableWidth = ref(600)
const visiblePage = ref(1)
const visiblePages = ref([])
const pdf = shallowRef(null)
const pageRefs = new Map()
const pageWidth = computed(() => Math.max(200, availableWidth.value - 36) * zoom.value)
let loadingTask, resizeObserver, pageResizeObserver, scrollFrame, resizeTimer
let loadRevision = 0
let disposed = false

function selectFile() { fileInput.value?.click() }
function onFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) loadFile(file)
}
function onDrop(event) {
  dragging.value = false
  const file = event.dataTransfer.files?.[0]
  if (file) loadFile(file)
}
async function loadFile(file) {
  error.value = ''
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { error.value = 'Wybierz plik PDF pobrany z CKE.'; return }
  if (file.size > 30 * 1024 * 1024) { error.value = 'Ten plik jest za duży. Wybierz arkusz PDF do 30 MB.'; return }
  if (!file.size) { error.value = 'Plik jest pusty. Pobierz arkusz ponownie.'; return }
  const ticket = ++loadRevision
  loading.value = true
  let candidate, task
  try {
    const data = new Uint8Array(await file.arrayBuffer())
    if (ticket !== loadRevision || disposed) return
    task = getDocument({ data })
    loadingTask = task
    candidate = await task.promise
    const identifyingPages = await Promise.all([1, 2, 3].filter(number => number <= candidate.numPages).map(number => candidate.getPage(number)))
    const cover = (await Promise.all(identifyingPages.map(page => page.getTextContent()))).flatMap(content => content.items.map(item => item.str || '')).join(' ').replace(/\s+/g, '')
    if (candidate.numPages !== 24 || !/MPOP-P1-100/.test(cover) || !/2605/.test(cover)) {
      throw new Error('WRONG_EXAM')
    }
    const loadedPages = await Promise.all(Array.from({ length: candidate.numPages }, (_, i) => candidate.getPage(i + 1)))
    if (ticket !== loadRevision || disposed) { await candidate.loadingTask.destroy(); return }
    const previousPdf = pdf.value
    pageResizeObserver?.disconnect()
    pages.value = []
    await nextTick()
    await previousPdf?.loadingTask.destroy()
    pdf.value = markRaw(candidate)
    pages.value = loadedPages.map(markRaw)
    filename.value = file.name
    zoom.value = 1
    emit('loaded', true)
    await nextTick()
    if (pageRefs.get(1)?.element) pageResizeObserver.observe(pageRefs.get(1).element)
    measure()
    await jumpToQuestion(false)
  } catch (failure) {
    if (ticket === loadRevision && !disposed) {
      error.value = failure.message === 'WRONG_EXAM'
        ? 'To inny arkusz. Wybierz język polski, maj 2026, arkusz 1 (24 strony) z linku CKE.'
        : failure.name === 'PasswordException'
          ? 'Ten PDF wymaga hasła. Oficjalny arkusz CKE nie jest zabezpieczony hasłem.'
          : 'Nie udało się odczytać PDF-u. Pobierz arkusz ponownie i wybierz zapisany plik.'
    }
    if (candidate !== pdf.value) await task?.destroy().catch(() => {})
  } finally {
    if (ticket === loadRevision) loading.value = false
    if (loadingTask === task) loadingTask = null
  }
}

function measure() {
  if (scroller.value?.clientWidth) availableWidth.value = scroller.value.clientWidth
}
async function scrollToPage(pageNumber, offset = 0, smooth = true) {
  await nextTick()
  await new Promise(resolve => requestAnimationFrame(resolve))
  if (disposed) return
  const element = pageRefs.get(pageNumber)?.element
  if (!element || !scroller.value) return
  const top = element.offsetTop + element.clientHeight * offset - 20
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  scroller.value.scrollTo({ top: Math.max(0, top), left: 0, behavior: smooth && !reducedMotion ? 'smooth' : 'instant' })
  visiblePage.value = pageNumber
  onScroll()
}
async function jumpToQuestion(smooth = true) {
  await scrollToPage(props.question.sourcePage, Math.max(0, (props.question.sourceTop || 0) - 0.025), smooth)
}
function onScroll() {
  if (scrollFrame) return
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = null
    if (!scroller.value) return
    const firstVisible = scroller.value.scrollTop - 650
    const lastVisible = scroller.value.scrollTop + scroller.value.clientHeight + 650
    const nextVisible = pages.value.filter(page => {
      const element = pageRefs.get(page.pageNumber)?.element
      return element && element.offsetTop + element.clientHeight >= firstVisible && element.offsetTop <= lastVisible
    }).map(page => page.pageNumber)
    if (nextVisible.join(',') !== visiblePages.value.join(',')) visiblePages.value = nextVisible
    const target = scroller.value.scrollTop + 50
    for (let i = pages.value.length; i >= 1; i--) {
      const element = pageRefs.get(i)?.element
      if (element && element.offsetTop <= target) { visiblePage.value = i; break }
    }
  })
}
async function setZoom(value) {
  zoom.value = Math.max(0.75, Math.min(2, Math.round(value * 100) / 100))
  await nextTick()
  await jumpToQuestion(false)
}
watch(() => props.question.id, () => jumpToQuestion())
watch(() => props.active, async (active) => {
  if (!active) return
  await nextTick()
  measure()
  await jumpToQuestion(false)
})
onMounted(() => {
  pageResizeObserver = new ResizeObserver(() => jumpToQuestion(false))
  resizeObserver = new ResizeObserver(() => {
    if (!scroller.value?.clientWidth || scroller.value.clientWidth === availableWidth.value) return
    measure()
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => jumpToQuestion(false), 100)
  })
  resizeObserver.observe(scroller.value)
  measure()
})
onBeforeUnmount(() => {
  disposed = true
  loadRevision++
  resizeObserver?.disconnect()
  pageResizeObserver?.disconnect()
  cancelAnimationFrame(scrollFrame)
  clearTimeout(resizeTimer)
  loadingTask?.destroy().catch(() => {})
  pdf.value?.loadingTask.destroy().catch(() => {})
})
defineExpose({ jumpToQuestion, selectFile })
</script>

<template>
  <section ref="viewer" class="pdf-viewer" :class="{ 'has-document': pdf, 'is-dragging': dragging }" aria-label="Podgląd oficjalnego arkusza" @dragover.prevent="dragging = true" @dragleave.self="dragging = false" @drop.prevent="onDrop">
    <input ref="fileInput" class="sr-only" type="file" accept="application/pdf,.pdf" tabindex="-1" aria-label="Wybierz arkusz PDF z urządzenia" @change="onFileChange" />
    <div class="pdf-heading"><span class="pdf-heading-icon"><FileText :size="19" /></span><div><h2>Oficjalny arkusz</h2><span :title="filename">{{ pdf ? filename : 'CKE · język polski · maj 2026' }}</span></div><button v-if="pdf" class="pdf-icon-button" :disabled="loading" aria-label="Zmień plik PDF" title="Zmień plik PDF" @click="selectFile"><RefreshCw :size="16" /></button><span v-else class="pdf-badge">PDF</span></div>

    <div v-if="pdf" class="pdf-toolbar" aria-label="Sterowanie podglądem PDF">
      <div class="pdf-page-controls"><button class="pdf-icon-button" :disabled="visiblePage <= 1" aria-label="Poprzednia strona PDF" @click="scrollToPage(visiblePage - 1)"><ArrowLeft :size="16" /></button><label class="pdf-page-select"><span class="sr-only">Strona PDF</span><select aria-label="Strona PDF" :value="visiblePage" @change="scrollToPage(Number($event.target.value))"><option v-for="page in pages" :key="page.pageNumber" :value="page.pageNumber">{{ page.pageNumber }}</option></select><span>/ {{ pages.length }}</span></label><button class="pdf-icon-button" :disabled="visiblePage >= pages.length" aria-label="Następna strona PDF" @click="scrollToPage(visiblePage + 1)"><ArrowRight :size="16" /></button></div>
      <div class="pdf-zoom-controls"><button class="pdf-icon-button" :disabled="zoom <= 0.75" aria-label="Pomniejsz PDF" @click="setZoom(zoom - 0.25)"><Minus :size="16" /></button><button class="pdf-fit-button" title="Dopasuj do szerokości" aria-label="Dopasuj PDF do szerokości" @click="setZoom(1)">{{ Math.round(zoom * 100) }}%</button><button class="pdf-icon-button" :disabled="zoom >= 2" aria-label="Powiększ PDF" @click="setZoom(zoom + 0.25)"><Plus :size="16" /></button></div>
    </div>

    <div v-if="error" class="pdf-error" role="alert">{{ error }}</div>
    <div v-if="loading" class="pdf-loading" role="status"><LoaderCircle :size="18" /> Otwieram arkusz na Twoim urządzeniu…</div>

    <div ref="scroller" class="pdf-scroll" :class="{ 'pdf-scroll-empty': !pdf }" tabindex="0" aria-label="Arkusz PDF — przewijaj, aby czytać kolejne strony" @scroll.passive="onScroll">
      <div v-if="pdf" class="pdf-pages">
        <div v-for="page in pages" :key="`${filename}-${page.pageNumber}`" class="pdf-page-wrap"><PdfSheet :ref="component => component ? pageRefs.set(page.pageNumber, component) : pageRefs.delete(page.pageNumber)" :page="page" :width="pageWidth" :active="visiblePages.includes(page.pageNumber)" /><span class="pdf-page-caption">{{ page.pageNumber }} / {{ pages.length }}</span></div>
      </div>
      <div v-else class="pdf-empty">
        <div class="pdf-empty-art" aria-hidden="true"><div class="pdf-mini-page"><span></span><i></i><i></i><i></i><b><Check :size="14" /></b></div><span class="pdf-empty-link"><Link2 :size="21" /></span></div>
        <span class="pdf-empty-kicker">ARKUSZ + ĆWICZENIA</span><h3>Wszystko obok siebie.</h3><p>Wybierz PDF. Gdy zmienisz ćwiczenie,<br />arkusz przewinie się razem z Tobą.</p>
        <div class="pdf-setup-steps"><a :href="officialExam.url" target="_blank" rel="noopener noreferrer"><span>1</span><div><strong>Pobierz oficjalny arkusz</strong><small>Zapisz PDF z serwisu CKE.</small></div><ArrowDownToLine :size="18" /></a><button :disabled="loading" @click="selectFile"><span>2</span><div><strong>Wybierz pobrany PDF</strong><small>Lub przeciągnij go tutaj.</small></div><FolderOpen :size="19" /></button></div>
        <span class="pdf-privacy"><LockKeyhole :size="13" /> Plik pozostaje na Twoim urządzeniu.</span><small class="pdf-reload-note">Po odświeżeniu wybierz go ponownie.</small>
      </div>
    </div>

    <div class="pdf-sync-bar"><span><Link2 :size="14" /><span>{{ pdf ? `Powiązane zad. ${question.sourceTask} · str. ${question.sourcePage}` : 'Automatyczne przewijanie do ćwiczenia' }}</span></span><button v-if="pdf" @click="jumpToQuestion()">Wróć do zadania <ArrowRight :size="14" /></button></div>
    <div v-if="dragging" class="pdf-drop-overlay"><Upload :size="32" /><strong>Upuść arkusz tutaj</strong></div>
  </section>
</template>
