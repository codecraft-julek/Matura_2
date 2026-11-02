// Vercel Routing Middleware (runs before every page request, not for files under /assets, /fonts,
// /dokumenty, /cke-arkusze or anything with a file extension; see `matcher`).
//
// Planned maintenance: with MAINTENANCE_MODE=on every page answers 503 + Retry-After with the page
// from maintenance/page.js, so Google keeps the site indexed and browsers never cache the break.
// Environment variables (Vercel → Settings → Environment Variables; changing them needs a Redeploy):
//   MAINTENANCE_MODE          "on" turns the break on; anything else (or unset) = normal site
//   MAINTENANCE_UNTIL         planned end, ISO 8601 with offset, e.g. 2026-11-08T09:00:00+01:00
//   MAINTENANCE_BYPASS_TOKEN  long random secret; /przerwa-wejscie?klucz=<token> lets the owner in
// Everything is wrapped so that a bug here can never take the site down: on any error the request
// just continues to the site. /?podglad=przerwa shows the page (200, noindex) while the site is up.

import { next } from '@vercel/functions'
import { MAINTENANCE_CSP, renderMaintenancePage, retryAfterSeconds } from './maintenance/page.js'

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!assets/|fonts/|dokumenty/|cke-arkusze/|robots\\.txt|sitemap\\.xml|.*\\.[a-z0-9]+$).*)'],
}

export const BYPASS_PATH = '/przerwa-wejscie'
const COOKIE = 'om_przerwa'
const COOKIE_MAX_AGE = 4 * 60 * 60

export const isMaintenanceOn = (env = process.env) => (env.MAINTENANCE_MODE ?? '').trim().toLowerCase() === 'on'

function readCookie(request, name) {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}

/** Same-length comparison without an early exit, so timing says nothing about the token. */
function sameSecret(a, b) {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function maintenanceResponse(request, { status = 503, until, now, extra = {} } = {}) {
  const body = request.method === 'HEAD' ? null : renderMaintenancePage({ until, now })
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': MAINTENANCE_CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extra,
    },
  })
}

export function handle(request, env = process.env, now = new Date()) {
  const url = new URL(request.url)
  const token = (env.MAINTENANCE_BYPASS_TOKEN ?? '').trim()
  const until = (env.MAINTENANCE_UNTIL ?? '').trim() || undefined

  // The owner's door: with the right key sets the bypass cookie, without a key removes it.
  if (url.pathname === BYPASS_PATH) {
    const key = url.searchParams.get('klucz')
    if (key === null) {
      return new Response(null, { status: 303, headers: { Location: '/', 'Cache-Control': 'no-store', 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } })
    }
    if (!sameSecret(key, token)) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
    return new Response(null, {
      status: 303,
      headers: { Location: '/', 'Cache-Control': 'no-store', 'Set-Cookie': `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}` },
    })
  }

  // A look at the page while the site is up (for checking the design before the break).
  if (!isMaintenanceOn(env)) {
    if (url.searchParams.get('podglad') === 'przerwa') return maintenanceResponse(request, { status: 200, until, now, extra: { 'X-Robots-Tag': 'noindex' } })
    return next()
  }

  if (sameSecret(readCookie(request, COOKIE), token)) return next({ headers: { 'Cache-Control': 'private, no-store' } })

  return maintenanceResponse(request, { until, now, extra: { 'Retry-After': String(retryAfterSeconds(until, now)) } })
}

export default function middleware(request) {
  try {
    return handle(request)
  } catch (err) {
    console.error('maintenance middleware failed; serving the site', err)
    return next()
  }
}
