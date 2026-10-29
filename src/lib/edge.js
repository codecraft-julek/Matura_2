// Calls to our Supabase Edge Functions from the browser, with the student's own token.
//   callEdge(name, body)              → plain JSON request/response ({ ok, ... })
//   streamEdge(name, body, handlers)  → Server-Sent Events: start / delta / progress / done / error
// Errors are always returned as { ok: false, error: "<Polish message>" }, never thrown.

import { SUPABASE } from '@/config/site'
import { supabase } from '@/lib/supabase'

export const NETWORK_ERROR = 'Brak połączenia. Sprawdź internet i spróbuj ponownie.'
export const GENERIC_ERROR = 'Coś poszło nie tak. Spróbuj ponownie za chwilę.'
const TOO_LARGE = 'Za dużo danych naraz. Spróbuj z mniejszym plikiem albo mniejszą liczbą zdjęć.'
const LOGGED_OUT = 'Zaloguj się ponownie.'

async function headers(extra = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return null
  return { 'content-type': 'application/json', authorization: `Bearer ${token}`, apikey: SUPABASE.publishableKey, ...extra }
}

const url = name => `${SUPABASE.url}/functions/v1/${name}`

/** JSON call. Resolves to the function's own { ok, ... } payload or { ok: false, error }. */
export async function callEdge(name, body = {}, { auth = true } = {}) {
  const h = auth ? await headers() : { 'content-type': 'application/json', apikey: SUPABASE.publishableKey }
  if (!h) return { ok: false, error: LOGGED_OUT }
  let res
  try {
    res = await fetch(url(name), { method: 'POST', headers: h, body: JSON.stringify(body) })
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
  try {
    return await res.json()
  } catch {
    return { ok: false, error: res.status === 413 ? TOO_LARGE : GENERIC_ERROR }
  }
}

/**
 * Streamed call. `onEvent(event)` gets every parsed `data:` event (`: ping` keep-alives are skipped).
 * Resolves with the `done` event as `{ ok: true, ...event }`, the `error` event as `{ ok: false, error }`,
 * or `{ ok: false, error: interrupted }` when the stream ends without either.
 */
export async function streamEdge(name, body, { onEvent, interrupted, signal } = {}) {
  const h = await headers({ accept: 'text/event-stream' })
  if (!h) return { ok: false, error: LOGGED_OUT }
  let res
  try {
    res = await fetch(url(name), { method: 'POST', headers: h, body: JSON.stringify(body), signal })
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }

  // Errors before the AI starts (limit reached, bad input...) come back as plain JSON.
  if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream') || !res.body) {
    try {
      const payload = await res.json()
      if (!payload.ok && payload.error) return { ok: false, error: payload.error }
    } catch {}
    return { ok: false, error: res.status === 413 ? TOO_LARGE : GENERIC_ERROR }
  }

  let buffer = ''
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      let idx
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        if (!chunk.startsWith('data:')) continue
        const event = JSON.parse(chunk.slice(5))
        onEvent?.(event)
        if (event.type === 'done') return { ok: true, ...event }
        if (event.type === 'error') return { ok: false, error: event.error }
      }
    }
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
  return { ok: false, error: interrupted ?? 'Połączenie zostało przerwane. Spróbuj ponownie.' }
}
