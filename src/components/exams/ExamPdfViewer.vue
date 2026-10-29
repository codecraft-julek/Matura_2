<script>
// PDFs opened in this browser tab, per exam and sheet. Kept in memory (not uploaded anywhere),
// so moving between /cwiczenia, /egzamin and the overview doesn't ask for the file again.
// sessionStorage only remembers THAT a file was opened (and its name), for the hint after a refresh.
const cache = new Map() // `${examId}:${sheetNo}` → { bytes: Uint8Array, filename }
const sessionKey = (examId, sheetNo) => `om:pdf:${examId}:${sheetNo}`

export function rememberedPdf(examId, sheetNo) {
  try { return JSON.parse(window.sessionStorage.getItem(sessionKey(examId, sheetNo)) ?? 'null') } catch { return null }
}
export const hasPdfInMemory = (examId, sheetNo) => cache.has(`${examId}:${sheetNo}`)
</script>

<script setup>
// Official CKE sheet next to the answer sheet. CKE blocks embedding, so the student downloads the
// PDF and picks it here; it is rendered locally with pdf.js and scrolls to the current task's page.
// Generalised from src/exam/LocalPdfViewer.vue (the public demo keeps its own copy).
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ArrowDownToLine, ArrowLeft, ArrowRight, ExternalLink, FileText, FolderOpen, Link2, LoaderCircle, LockKeyhole, Minus, Plus, RefreshCw, TriangleAlert, Upload } from '@lucide/vue'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import PdfPage from './PdfPage.vue'
import { looksLikeSheet, pageUrl, sheetCode } from './sheet'

GlobalWorkerOptions.workerSrc = workerUrl

const props = defineProps({
  examId: { type: String, required: true },
  sheetNo: { type: Number, default: 1 },
  url: { type: String, required: true },
  /** "Arkusz", "Arkusz 1", "Arkusz 2" */
  label: { type: String, default: 'Arkusz' },
  /** Where to scroll: { page, title } of the current task, or null. */
  target: { type: Object, default: null },
  /** The highest page our tasks point to: a shorter PDF is certainly the wrong file. */
  minPages: { type: Number, default: 1 },
  /** Visible right now (split view, or the "Arkusz" tab on phones). */
  active: { type: Boolean, default: true },
})
const emit = defineEmits(['loaded'])

const cacheKey = computed(() => `${props.examId}:${props.sheetNo}`)
const code = computed(() => sheetCode(props.url))
const fileInput = ref(null)
const scroller = ref(null)
const pages = shallowRef([])
const pdf = shallowRef(null)
const filename = ref('')
const error = ref('')
const warning = ref('')
const loading = ref(false)
const dragging = ref(false)
const zoom = ref(1)
const availableWidth = ref(600)
const visiblePage = ref(1)
const visiblePages = ref([])
const remembered = ref(rememberedPdf(props.examId, props.sheetNo))
const pageRefs = new Map()
const pageWidth = computed(() => Math.max(200, availableWidth.value - 36) * zoom.value)
const targetUrl = computed(() => pageUrl(props.url, props.target?.page))
let loadingTask, resizeObserver, scrollFrame, resizeTimer
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
  let bytes
  try { bytes = new Uint8Array(await file.arrayBuffer()) } catch { error.value = 'Nie udało się odczytać pliku. Spróbuj jeszcze raz.'; return }
  await open(bytes, file.name, true)
}

async function open(bytes, name, fresh) {
  const ticket = ++loadRevision
  loading.value = true
  error.value = ''
  let candidate, task
  try {
    // pdf.js takes ownership of the buffer it gets, so it gets a copy and the cache keeps the original.
    task = getDocument({ data: bytes.slice() })
    loadingTask = task
    candidate = await task.promise
    if (fresh) {
      if (candidate.numPages < props.minPages) throw new Error('TOO_SHORT')
      const first = await Promise.all([1, 2, 3].filter(n => n <= candidate.numPages).map(n => candidate.getPage(n)))
      const cover = (await Promise.all(first.map(p => p.getTextContent()))).flatMap(c => c.items.map(i => i.str || '')).join(' ')
      warning.value = looksLikeSheet(code.value, cover, name) ? '' : `To chyba inny arkusz niż ${props.label.toLowerCase()} z tego egzaminu${code.value ? ` (kod ${code.value.series}, sesja ${code.value.session})` : ''}. Jeśli się pomyliłeś, wybierz właściwy plik.`
    }
    const loadedPages = await Promise.all(Array.from({ length: candidate.numPages }, (_, i) => candidate.getPage(i + 1)))
    if (ticket !== loadRevision || disposed) { await candidate.loadingTask.destroy(); return }
    const previous = pdf.value
    pages.value = []
    await nextTick()
    await previous?.loadingTask.destroy()
    pdf.value = markRaw(candidate)
    pages.value = loadedPages.map(markRaw)
    filename.value = name
    zoom.value = 1
    cache.set(cacheKey.value, { bytes, filename: name })
    try { window.sessionStorage.setItem(sessionKey(props.examId, props.sheetNo), JSON.stringify({ filename: name })) } catch {}
    remembered.value = { filename: name }
    emit('loaded', true)
    await nextTick()
    measure()
    await jumpToTarget(false)
  } catch (failure) {
    if (ticket === loadRevision && !disposed) {
      error.value = failure.message === 'TOO_SHORT'
        ? `Ten PDF ma za mało stron. Wybierz ${props.label.toLowerCase()} z linku CKE.`
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
async function scrollToPage(pageNumber, smooth = true) {
  await nextTick()
  await new Promise(resolve => requestAnimationFrame(resolve))
  if (disposed) return
  const element = pageRefs.get(pageNumber)?.element
  if (!element || !scroller.value) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  scroller.value.scrollTo({ top: Math.max(0, element.offsetTop - 12), left: 0, behavior: smooth && !reducedMotion ? 'smooth' : 'instant' })
  visiblePage.value = pageNumber
  onScroll()
}
async function jumpToTarget(smooth = true) {
  if (!pdf.value) return
  const page = Math.min(Math.max(1, props.target?.page || 1), pages.value.length)
  await scrollToPage(page, smooth)
}
function onScroll() {
  if (scrollFrame) return
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = null
    if (!scroller.value) return
    const top = scroller.value.scrollTop - 650
    const bottom = scroller.value.scrollTop + scroller.value.clientHeight + 650
    const next = pages.value.filter(p => {
      const el = pageRefs.get(p.pageNumber)?.element
      return el && el.offsetTop + el.clientHeight >= top && el.offsetTop <= bottom
    }).map(p => p.pageNumber)
    if (next.join(',') !== visiblePages.value.join(',')) visiblePages.value = next
    const probe = scroller.value.scrollTop + 50
    for (let i = pages.value.length; i >= 1; i--) {
      const el = pageRefs.get(i)?.element
      if (el && el.offsetTop <= probe) { visiblePage.value = i; break }
    }
  })
}
async function setZoom(value) {
  const keep = visiblePage.value
  zoom.value = Math.max(0.75, Math.min(2, Math.round(value * 100) / 100))
  await nextTick()
  await scrollToPage(keep, false)
}

watch(() => `${props.target?.title}|${props.target?.page}`, () => { if (props.active) jumpToTarget() })
watch(() => props.active, async active => {
  if (!active) return
  await nextTick()
  measure()
  await jumpToTarget(false)
})
onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    if (!scroller.value?.clientWidth || scroller.value.clientWidth === availableWidth.value) return
    measure()
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => scrollToPage(visiblePage.value, false), 100)
  })
  resizeObserver.observe(scroller.value)
  measure()
  const cached = cache.get(cacheKey.value)
  if (cached) open(cached.bytes, cached.filename, false)
})
onBeforeUnmount(() => {
  disposed = true
  loadRevision++
  resizeObserver?.disconnect()
  cancelAnimationFrame(scrollFrame)
  clearTimeout(resizeTimer)
  loadingTask?.destroy().catch(() => {})
  pdf.value?.loadingTask.destroy().catch(() => {})
})
defineExpose({ jumpToTarget, selectFile, isLoaded: () => Boolean(pdf.value) })
</script>

<template>
  <section class="pdf-viewer" :class="{ 'is-dragging': dragging }" :aria-label="`${label} CKE — podgląd`" @dragover.prevent="dragging = true" @dragleave.self="dragging = false" @drop.prevent="onDrop">
    <input ref="fileInput" class="sr-only" type="file" accept="application/pdf,.pdf" tabindex="-1" :aria-label="`Wybierz plik PDF: ${label}`" @change="onFileChange" />
    <div class="pdf-head">
      <span class="pdf-head-icon" aria-hidden="true"><FileText :size="18" /></span>
      <div class="pdf-head-text">
        <h2>{{ label }} CKE</h2>
        <span :title="filename">{{ pdf ? filename : 'Plik z Twojego urządzenia' }}</span>
      </div>
      <button v-if="pdf" type="button" class="icon-button pdf-icon" :disabled="loading" aria-label="Zmień plik PDF" title="Zmień plik PDF" @click="selectFile"><RefreshCw :size="16" /></button>
      <a :href="targetUrl" target="_blank" rel="noopener noreferrer" class="icon-button pdf-icon" :aria-label="`Otwórz ${label.toLowerCase()} CKE w nowej karcie`" title="Otwórz w nowej karcie"><ExternalLink :size="16" /></a>
    </div>

    <div v-if="pdf" class="pdf-toolbar" role="toolbar" aria-label="Sterowanie podglądem PDF">
      <div class="pdf-controls">
        <button type="button" class="icon-button pdf-icon" :disabled="visiblePage <= 1" aria-label="Poprzednia strona PDF" @click="scrollToPage(visiblePage - 1)"><ArrowLeft :size="16" /></button>
        <label class="pdf-page-select">
          <span class="sr-only">Strona PDF</span>
          <select :value="visiblePage" @change="scrollToPage(Number($event.target.value))"><option v-for="p in pages" :key="p.pageNumber" :value="p.pageNumber">{{ p.pageNumber }}</option></select>
          <span>/ {{ pages.length }}</span>
        </label>
        <button type="button" class="icon-button pdf-icon" :disabled="visiblePage >= pages.length" aria-label="Następna strona PDF" @click="scrollToPage(visiblePage + 1)"><ArrowRight :size="16" /></button>
      </div>
      <div class="pdf-controls">
        <button type="button" class="icon-button pdf-icon" :disabled="zoom <= 0.75" aria-label="Pomniejsz PDF" @click="setZoom(zoom - 0.25)"><Minus :size="16" /></button>
        <button type="button" class="pdf-fit" aria-label="Dopasuj PDF do szerokości" title="Dopasuj do szerokości" @click="setZoom(1)">{{ Math.round(zoom * 100) }}%</button>
        <button type="button" class="icon-button pdf-icon" :disabled="zoom >= 2" aria-label="Powiększ PDF" @click="setZoom(zoom + 0.25)"><Plus :size="16" /></button>
      </div>
    </div>

    <div v-if="error" class="pdf-note is-error" role="alert">{{ error }}</div>
    <div v-else-if="warning && pdf" class="pdf-note is-warn" role="status"><TriangleAlert :size="16" /><span>{{ warning }} <button type="button" class="link" @click="selectFile">Wybierz inny plik</button></span></div>
    <div v-if="loading" class="pdf-loading" role="status"><LoaderCircle :size="18" class="spin" /> Otwieram arkusz na Twoim urządzeniu…</div>

    <div ref="scroller" class="pdf-scroll" :class="{ 'is-empty': !pdf }" :tabindex="pdf ? 0 : -1" :aria-label="pdf ? 'Arkusz PDF — przewijaj, aby czytać kolejne strony' : undefined" @scroll.passive="onScroll">
      <div v-if="pdf" class="pdf-pages">
        <div v-for="p in pages" :key="`${filename}-${p.pageNumber}`" class="pdf-page-wrap">
          <PdfPage :ref="c => (c ? pageRefs.set(p.pageNumber, c) : pageRefs.delete(p.pageNumber))" :page="p" :width="pageWidth" :active="visiblePages.includes(p.pageNumber)" />
          <span class="pdf-caption">{{ p.pageNumber }} / {{ pages.length }}</span>
        </div>
      </div>
      <div v-else class="pdf-empty">
        <span class="pdf-empty-kicker">ARKUSZ + ODPOWIEDZI</span>
        <h3>Wszystko obok siebie.</h3>
        <p>CKE nie pozwala osadzać arkuszy, więc wczytaj pobrany PDF. Gdy zmienisz zadanie, arkusz przewinie się razem z Tobą.</p>
        <p v-if="remembered?.filename" class="pdf-remembered">Wczytany wcześniej: <strong>{{ remembered.filename }}</strong>. Po odświeżeniu strony wybierz go ponownie.</p>
        <div class="pdf-steps">
          <a :href="url" target="_blank" rel="noopener noreferrer" class="pdf-step"><span class="pdf-step-no">1</span><span class="pdf-step-text"><strong>Pobierz {{ label.toLowerCase() }} z CKE</strong><small>Zapisz PDF na urządzeniu.</small></span><ArrowDownToLine :size="18" /></a>
          <button type="button" class="pdf-step is-primary" :disabled="loading" @click="selectFile"><span class="pdf-step-no">2</span><span class="pdf-step-text"><strong>Wybierz pobrany PDF</strong><small>Lub przeciągnij go tutaj.</small></span><FolderOpen :size="19" /></button>
        </div>
        <span class="pdf-privacy"><LockKeyhole :size="13" /> Plik zostaje na Twoim urządzeniu.</span>
        <a :href="targetUrl" target="_blank" rel="noopener noreferrer" class="pdf-fallback link">Wolisz bez podglądu? Otwórz arkusz w nowej karcie<template v-if="target?.page"> (str. {{ target.page }})</template></a>
      </div>
    </div>

    <div class="pdf-sync">
      <span><Link2 :size="14" aria-hidden="true" /><span>{{ target?.page ? `${target.title} · str. ${target.page}` : 'Automatyczne przewijanie do zadania' }}</span></span>
      <button v-if="pdf && target?.page" type="button" @click="jumpToTarget()">Wróć do zadania <ArrowRight :size="14" /></button>
    </div>
    <div v-if="dragging" class="pdf-drop"><Upload :size="32" /><strong>Upuść arkusz tutaj</strong></div>
  </section>
</template>

<style scoped>
.pdf-viewer { position: relative; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); overflow: hidden; box-shadow: var(--shadow-sm); }
.pdf-head { display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 16px; border-bottom: 1px solid var(--line); }
.pdf-head-icon { display: grid; place-items: center; width: 36px; height: 36px; flex-shrink: 0; border-radius: 9px; background: var(--surface-3); color: var(--accent); }
.pdf-head-text { flex: 1; min-width: 0; }
.pdf-head-text h2 { font-size: 15px; font-weight: 750; letter-spacing: -.2px; }
.pdf-head-text span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--text-soft); margin-top: 2px; }
.pdf-icon { width: 36px; height: 36px; border-radius: 9px; color: var(--accent); }
.pdf-icon:disabled { opacity: .35; }
.pdf-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 6px 10px; background: #fbfcf8; border-bottom: 1px solid var(--line); }
.pdf-controls { display: flex; align-items: center; gap: 4px; }
.pdf-page-select { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-soft); }
.pdf-page-select select { border: 1px solid var(--line-strong); background: var(--surface); border-radius: 7px; min-width: 52px; height: 32px; padding-inline: 6px; font: inherit; color: var(--text); }
.pdf-fit { padding: 6px 4px; min-width: 48px; border-radius: 7px; background: none; color: var(--accent); font-size: 13px; font-weight: 650; font-variant-numeric: tabular-nums; }
.pdf-fit:hover { background: var(--surface-2); }
.pdf-scroll { position: relative; height: var(--pdf-h, 70dvh); min-height: 320px; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #acbaa0 #e7ebdf; background: #e9ede3; overflow-anchor: none; }
.pdf-scroll:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; }
.pdf-scroll.is-empty { display: grid; place-items: center; background: var(--paper); height: auto; min-height: var(--pdf-h, 460px); }
.pdf-pages { width: max-content; min-width: 100%; padding: 18px; display: flex; flex-direction: column; align-items: center; gap: 18px; }
.pdf-page-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.pdf-caption { font-size: 11px; color: var(--text-soft); font-variant-numeric: tabular-nums; }
.pdf-note { display: flex; gap: 8px; align-items: flex-start; margin: 10px 12px 0; padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid; font-size: 13px; line-height: 1.55; }
.pdf-note svg { margin-top: 2px; }
.pdf-note.is-error { background: var(--error-bg); border-color: var(--error-line); color: #7d3f2c; }
.pdf-note.is-warn { background: var(--warn-bg); border-color: var(--warn-line); color: #6d5418; margin-bottom: 10px; }
.pdf-note .link { background: none; padding: 0; font-size: inherit; }
.pdf-loading { display: flex; justify-content: center; align-items: center; gap: 8px; padding: 12px; background: var(--surface-3); color: var(--accent); font-size: 13px; }
.pdf-empty { width: min(400px, 100%); padding: 28px 24px; text-align: center; }
.pdf-empty-kicker { font-size: 11px; font-weight: 700; letter-spacing: 1.3px; color: var(--accent); }
.pdf-empty h3 { font-size: 24px; letter-spacing: -.8px; margin-top: 8px; font-weight: 750; }
.pdf-empty > p { font-size: 14px; line-height: 1.65; color: var(--text-soft); margin-top: 10px; }
.pdf-remembered { padding: 10px 12px; border-radius: var(--radius-sm); background: var(--info-bg); border: 1px solid var(--info-line); color: var(--info) !important; font-size: 13px !important; }
.pdf-steps { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
.pdf-step { display: flex; align-items: center; gap: 12px; text-align: left; padding: 14px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--surface); color: var(--text); font-size: 14px; transition: box-shadow .15s; }
.pdf-step:hover { box-shadow: var(--shadow); }
.pdf-step.is-primary { border-color: var(--green); background: var(--green); color: white; }
.pdf-step-no { display: grid; place-items: center; width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; background: var(--surface-2); color: var(--green); font-size: 12px; font-weight: 750; }
.is-primary .pdf-step-no { background: var(--lime); }
.pdf-step-text { flex: 1; }
.pdf-step strong { display: block; font-size: 14px; font-weight: 700; }
.pdf-step small { display: block; font-size: 12px; opacity: .75; margin-top: 3px; }
.pdf-privacy { display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--text-soft); font-size: 12px; margin-top: 16px; }
.pdf-fallback { display: inline-block; margin-top: 12px; font-size: 13px; }
.pdf-sync { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; color: var(--accent); background: var(--surface-3); font-size: 13px; border-top: 1px solid var(--line); }
.pdf-sync > span, .pdf-sync button { display: flex; align-items: center; gap: 6px; }
.pdf-sync > span { min-width: 0; }
.pdf-sync button { background: none; font-size: 13px; font-weight: 700; color: var(--green); white-space: nowrap; padding: 4px 0; }
.pdf-drop { position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: #edf5e3f2; border: 2px dashed #91ad6c; border-radius: var(--radius-lg); color: var(--accent); pointer-events: none; }
@media (max-width: 520px) {
  .pdf-empty { padding: 24px 16px; }
  .pdf-sync { font-size: 12px; padding-inline: 10px; }
}
</style>
