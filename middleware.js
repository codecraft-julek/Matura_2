// Vercel Routing Middleware (runs before every page request, not for files under /assets, /fonts,
// /dokumenty, /cke-arkusze or anything with a file extension; see `matcher`).
//
// Planned maintenance: while MAINTENANCE_ON is true every page answers 503 + Retry-After with the
// page from maintenance/page.js, so Google keeps the site indexed and browsers never cache the break.
// Opening ENTRY_PATH once lets that browser see the real site. To end the break set MAINTENANCE_ON
// to false and push. Everything is wrapped so that a bug here can never take the site down: on any
// error the request just continues to the site. /?podglad=przerwa always shows the page.

import { next } from '@vercel/functions'
import { MAINTENANCE_CSP, renderMaintenancePage, retryAfterSeconds } from './maintenance/page.js'

export const MAINTENANCE_ON = true
// Planned end, ISO 8601 with offset, e.g. '2026-11-08T09:00:00+01:00'. Unset: the page says "za 24 godziny".
const MAINTENANCE_UNTIL = undefined

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!assets/|fonts/|dokumenty/|cke-arkusze/|robots\\.txt|sitemap\\.xml|.*\\.[a-z0-9]+$).*)'],
}

export const ENTRY_PATH = '/wejscie-ekipa'
const COOKIE = 'om_przerwa'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60

function hasEntryCookie(request) {
  return (request.headers.get('cookie') ?? '').split(';').some(part => part.trim() === `${COOKIE}=1`)
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

export function handle(request, { on = MAINTENANCE_ON, until = MAINTENANCE_UNTIL, now = new Date() } = {}) {
  const url = new URL(request.url)

  if (url.pathname === ENTRY_PATH) {
    return new Response(null, {
      status: 303,
      headers: { Location: '/', 'Cache-Control': 'no-store', 'Set-Cookie': `${COOKIE}=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}` },
    })
  }

  // A look at the page from any browser, also one that already got in.
  if (url.searchParams.get('podglad') === 'przerwa') return maintenanceResponse(request, { status: 200, until, now, extra: { 'X-Robots-Tag': 'noindex' } })

  if (!on) return next()
  if (hasEntryCookie(request)) return next({ headers: { 'Cache-Control': 'private, no-store' } })

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
