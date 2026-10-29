// The website proxies public CKE sheets so PDF.js can read them on the same origin.
// No student answers or account credentials are sent with the request.
export const CKE_SHEETS_PATH = '/images/_EGZAMIN_MATURALNY_OD_2023/Arkusze_egzaminacyjne/'
export const PDF_PROXY_PATH = '/cke-arkusze/'
export const MAX_PDF_BYTES = 30 * 1024 * 1024

export function officialPdfPath(source) {
  const url = new URL(source)
  const path = url.pathname.slice(CKE_SHEETS_PATH.length)
  if (url.origin !== 'https://cke.gov.pl' || url.username || url.password || url.search
    || !url.pathname.startsWith(CKE_SHEETS_PATH)
    || !/^20\d{2}\/Jezyk_(polski|angielski)\/poziom_(podstawowy|rozszerzony)\/[A-Za-z0-9_-]+\.pdf$/.test(path)) {
    throw new Error('Unsupported official exam URL')
  }
  return `${PDF_PROXY_PATH}${path}`
}

export async function fetchOfficialPdf(source, { signal } = {}) {
  const path = officialPdfPath(source)
  const timeout = AbortSignal.timeout(30_000)
  const response = await fetch(path, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    credentials: 'omit',
    redirect: 'error',
  })
  if (!response.ok || !response.body) throw new Error('Official PDF unavailable')
  if (Number(response.headers.get('content-length')) > MAX_PDF_BYTES) {
    await response.body.cancel()
    throw new Error('Official PDF too large')
  }
  // Check the actual body too: an upstream failure can be HTML with status 200.
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_PDF_BYTES) throw new Error('Official PDF too large')
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-')) throw new Error('Response is not a PDF')
  return { bytes, filename: path.split('/').at(-1) }
}
