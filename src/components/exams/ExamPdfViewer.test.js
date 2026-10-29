import { createRenderer, defineComponent, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDocument } from 'pdfjs-dist'
import { fetchOfficialPdf } from '@/lib/exams/pdf'
import ExamPdfViewer from './ExamPdfViewer.vue'
import LocalPdfViewer from '@/exam/LocalPdfViewer.vue'
import { officialExam, questions } from '@/exam/examData'

vi.mock('@/lib/exams/pdf', () => ({ fetchOfficialPdf: vi.fn(), MAX_PDF_BYTES: 30 * 1024 * 1024 }))
vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn(), GlobalWorkerOptions: {} }))
vi.mock('./PdfPage.vue', () => ({ default: { render: () => null } }))
vi.mock('@/exam/PdfSheet.vue', () => ({ default: { render: () => null } }))

// A minimal Vue host exercises mount, events and cleanup without a browser canvas.
// PDF.js rendering itself is mocked; network behaviour is covered in exam-pdf.test.js.
const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null, clientWidth: 600, scrollTo: vi.fn() })
const renderer = createRenderer({
  createElement: tag => node(tag), createText: text => node('text', text), createComment: text => node('comment', text),
  setText: (el, text) => { el.text = text },
  setElementText: (el, text) => { el.text = text; el.children = [] },
  patchProp: (el, key, prev, value) => { el.props[key] = value },
  insert(el, parent, anchor) {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, el)
    el.parent = parent
  },
  remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1) },
  parentNode: el => el.parent,
  nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
})
const nodes = root => [root, ...root.children.flatMap(nodes)]
const textOf = root => root.text + root.children.map(textOf).join(' ')
const button = (root, text) => nodes(root).find(el => el.type === 'button' && textOf(el).includes(text))
const flush = async () => { for (let n = 0; n < 6; n++) await new Promise(resolve => setTimeout(resolve, 0)); await nextTick() }
let app, nextId = 0
function mount(component, props) {
  const root = node('root')
  app = renderer.createApp(defineComponent({ render: () => h(component, props) }))
  app.mount(root)
  return root
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', cb => setTimeout(cb, 0))
  vi.stubGlobal('cancelAnimationFrame', id => clearTimeout(id))
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
  fetchOfficialPdf.mockResolvedValue({ bytes: new TextEncoder().encode('%PDF-1.7'), filename: 'MPOP-P1-100-A-2605-arkusz.pdf' })
  getDocument.mockImplementation(() => {
    const task = { destroy: vi.fn().mockResolvedValue() }
    task.promise = Promise.resolve({
      numPages: 24, loadingTask: task,
      getPage: async number => ({ pageNumber: number, getTextContent: async () => ({ items: [{ str: 'MPOP-P1-100-A-2605' }] }) }),
    })
    return task
  })
})
afterEach(() => { app?.unmount(); app = null; vi.unstubAllGlobals() })

describe.each([
  ['Arkusze', ExamPdfViewer, () => ({ examId: `exam-${nextId++}`, url: officialExam.url })],
  ['public practice', LocalPdfViewer, () => ({ question: questions[0] })],
])('%s automatic viewer', (name, component, props) => {
  it('opens the official PDF on mount without a file selection', async () => {
    const loaded = vi.fn()
    const root = mount(component, { ...props(), onLoaded: loaded })
    expect(fetchOfficialPdf).toHaveBeenCalledWith(officialExam.url, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    await flush()
    expect(getDocument).toHaveBeenCalled()
    expect(loaded).toHaveBeenCalledWith(true)
    expect(button(root, 'Wybierz PDF z urządzenia')).toBeUndefined()
    expect(textOf(root)).not.toContain('Pobierz oficjalny arkusz')
  })

  it('shows retry and local-file fallback after failure, then recovers', async () => {
    fetchOfficialPdf.mockRejectedValueOnce(new Error('offline'))
    const root = mount(component, props())
    await flush()
    expect(textOf(root)).toContain('Nie udało się wczytać arkusza z CKE')
    expect(button(root, 'Wybierz PDF z urządzenia')).toBeDefined()
    button(root, 'Spróbuj ponownie').props.onClick()
    await flush()
    expect(fetchOfficialPdf).toHaveBeenCalledTimes(2)
    expect(textOf(root)).not.toContain('Nie udało się wczytać arkusza z CKE')
    expect(button(root, 'Spróbuj ponownie')).toBeUndefined()
  })

  it('cancels pending downloads and ignores a late response after leaving', async () => {
    let finish
    fetchOfficialPdf.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    mount(component, props())
    const signal = fetchOfficialPdf.mock.calls[0][1].signal
    app.unmount(); app = null
    expect(signal.aborted).toBe(true)
    finish({ bytes: new Uint8Array([1]), filename: 'late.pdf' })
    await flush()
    expect(getDocument).not.toHaveBeenCalled()
  })
})

it('opens the second exam sheet from its own URL', async () => {
  const sheet2 = officialExam.url.replace('MPOP-P1', 'MPOP-P2')
  mount(ExamPdfViewer, { examId: `exam-${nextId++}`, sheetNo: 2, url: sheet2 })
  await flush()
  expect(fetchOfficialPdf).toHaveBeenCalledWith(sheet2, expect.any(Object))
})
