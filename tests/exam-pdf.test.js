import { readFileSync, readdirSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CKE_SHEETS_PATH, fetchOfficialPdf, MAX_PDF_BYTES, officialPdfPath } from '../src/lib/exams/pdf'

const source = `https://cke.gov.pl${CKE_SHEETS_PATH}2026/Jezyk_polski/poziom_podstawowy/MPOP-P1-100-A-2605-arkusz.pdf`
const pdf = '%PDF-1.7\nexample document'
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('automatic official exam loading', () => {
  it('routes every catalogue sheet, including second sheets, through the deployed proxy', () => {
    const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
    const proxy = config.rewrites[0]
    const folder = new URL('../content/exams/', import.meta.url)
    for (const name of readdirSync(folder).filter(n => n.endsWith('.json'))) {
      const exam = JSON.parse(readFileSync(new URL(name, folder), 'utf8'))
      for (const url of [exam.sources.sheet, exam.sources.sheet2].filter(Boolean)) {
        const path = officialPdfPath(url)
        const prefix = proxy.source.replace(':path*', '')
        expect(path.startsWith(prefix)).toBe(true)
        expect(proxy.destination.replace(':path*', path.slice(prefix.length))).toBe(url)
      }
    }
  })

  it('fetches the PDF without cookies or a file picker', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(pdf))
    vi.stubGlobal('fetch', fetcher)
    const loaded = await fetchOfficialPdf(`${source}#page=3`)
    expect(new TextDecoder().decode(loaded.bytes)).toBe(pdf)
    expect(loaded.filename).toBe('MPOP-P1-100-A-2605-arkusz.pdf')
    expect(fetcher).toHaveBeenCalledWith(officialPdfPath(source), expect.objectContaining({ credentials: 'omit', redirect: 'error' }))
  })

  it.each([
    source.replace('cke.gov.pl', 'example.com'),
    source.replace('https:', 'http:'),
    source.replace('cke.gov.pl', 'cke.gov.pl.example.com'),
    source.replace('cke.gov.pl', 'user:password@cke.gov.pl'),
    `${source}?url=https://example.com`,
    source.replace('.pdf', '.html'),
    'https://cke.gov.pl/private.pdf',
  ])('rejects unsupported sources before requesting them: %s', async url => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(fetchOfficialPdf(url)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects HTML error pages and HTTP failures, and permits a subsequent retry', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('<html>Upstream error</html>'))
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(pdf)))
    await expect(fetchOfficialPdf(source)).rejects.toThrow('not a PDF')
    await expect(fetchOfficialPdf(source)).rejects.toThrow('unavailable')
    expect((await fetchOfficialPdf(source)).bytes.length).toBe(pdf.length)
  })

  it('bounds downloads even when the upstream omits Content-Length', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(MAX_PDF_BYTES + 1)) },
      cancel,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)))
    await expect(fetchOfficialPdf(source)).rejects.toThrow('too large')
    expect(cancel).toHaveBeenCalled()
  })

  it('passes cancellation through when the student leaves the page', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })))
    const result = fetchOfficialPdf(source, { signal: controller.signal })
    controller.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('times out a stalled download so the retry UI can appear', async () => {
    vi.useFakeTimers()
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms)
      return controller.signal
    })
    vi.stubGlobal('fetch', vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })))
    const rejection = expect(fetchOfficialPdf(source)).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(30_000)
    await rejection
    vi.restoreAllMocks()
  })
})
