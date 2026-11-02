import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ENTRY_PATH, config, handle } from '../middleware.js'
import { MAINTENANCE_SCRIPT, MAINTENANCE_SCRIPT_HASH, describeUntil, renderMaintenancePage, retryAfterSeconds } from '../maintenance/page.js'

const now = new Date('2026-11-07T20:00:00+01:00')
const until = '2026-11-08T09:00:00+01:00'
const on = { on: true, until, now }
const off = { on: false, until, now }
const req = (path, init) => new Request(`https://www.ogarnijmature.com${path}`, init)
const matcher = new RegExp(`^${config.matcher[0].replace(/^\//, '/')}$`)

describe('the maintenance page', () => {
  it('names the planned end in Polish time and says it is at most 24 hours', () => {
    expect(describeUntil(until, now)).toEqual({ weekday: 'w niedzielę', date: '8 listopada 2026', time: '9:00', late: false })
    expect(describeUntil('2026-11-10T13:05:00Z', now)).toMatchObject({ weekday: 'we wtorek', time: '14:05' })
    const html = renderMaintenancePage({ until, now })
    expect(html).toContain('<html lang="pl">')
    expect(html).toContain('Wracamy najpóźniej <span class="when">w niedzielę o 9:00</span>')
    expect(html).toContain('Dokładniej: w niedzielę, 8 listopada 2026, <strong>najpóźniej o 9:00 czasu polskiego</strong>')
    expect(html).toContain('maksymalnie 24 godziny')
    expect(html).toContain('<title>Przerwa techniczna – Ogarnij Maturę</title>')
    expect(html).toContain('ogarnijmature@o2.pl')
    expect(html.replace(/<script>[\s\S]*<\/script>/, '')).not.toMatch(/stripe|sandbox|undefined|null/i)
  })
  it('without a planned end promises 24 hours, after it apologises instead of showing a stale time', () => {
    expect(renderMaintenancePage({ now })).toContain('Wracamy najpóźniej <span class="when">za 24 godziny</span>')
    const late = renderMaintenancePage({ until, now: new Date('2026-11-08T10:30:00+01:00') })
    expect(late).toContain('tak szybko, jak się da')
    expect(late).toContain('trwają trochę dłużej. Przepraszamy.')
    expect(late).not.toContain('Wracamy najpóźniej')
  })
  it('loads nothing from outside the site', () => {
    const html = renderMaintenancePage({ until, now })
    expect(html.match(/https?:\/\//g)).toBeNull()
    expect(html).not.toContain('supabase')
  })
  it('keeps the inline script hash in the CSP of the page and in vercel.json', () => {
    expect(renderMaintenancePage({ until, now })).toContain(`<script>${MAINTENANCE_SCRIPT}</script>`)
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
    const csp = vercel.headers.find(h => h.source === '/(.*)').headers.find(h => h.key === 'Content-Security-Policy').value
    expect(csp).toContain(`script-src 'self' '${MAINTENANCE_SCRIPT_HASH}'`)
  })
})

describe('Retry-After', () => {
  it('counts to the planned end, between 5 minutes and 24 hours', () => {
    expect(retryAfterSeconds(until, now)).toBe(13 * 3600)
    expect(retryAfterSeconds(until, new Date('2026-11-08T08:59:00+01:00'))).toBe(300)
    expect(retryAfterSeconds('2026-11-20T09:00:00+01:00', now)).toBe(86400)
    expect(retryAfterSeconds(undefined, now)).toBe(3600)
  })
})

describe('the middleware', () => {
  it('runs for pages but not for files, fonts, documents, robots or the sitemap', () => {
    for (const p of ['/', '/tutor', '/arkusze-maturalne/2025-maj-polski-pp', '/auth/potwierdz', '/regulamin', ENTRY_PATH]) expect(matcher.test(p)).toBe(true)
    for (const p of ['/assets/index-abc.js', '/fonts/manrope-latin.woff2', '/dokumenty/regulamin-2026-11-02.html', '/cke-arkusze/x.pdf', '/robots.txt', '/sitemap.xml', '/favicon.svg', '/og.png']) expect(matcher.test(p)).toBe(false)
  })
  it('lets everything through when the break is off', () => {
    expect(handle(req('/tutor'), off).headers.get('x-middleware-next')).toBe('1')
    expect(handle(req('/'), off).headers.get('x-middleware-next')).toBe('1')
  })
  it('answers 503 with Retry-After, no caching and the page while the break is on', async () => {
    const res = handle(req('/tutor'), on)
    expect(res.status).toBe(503)
    expect(res.headers.get('retry-after')).toBe(String(13 * 3600))
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(res.headers.get('content-security-policy')).toContain(MAINTENANCE_SCRIPT_HASH)
    expect(await res.text()).toContain('Planowana przerwa techniczna')
    const head = handle(req('/', { method: 'HEAD' }), on)
    expect(head.status).toBe(503)
    expect(head.body).toBeNull()
  })
  it('lets a browser in after it opens the entry address, keeps everyone else out', () => {
    const door = handle(req(ENTRY_PATH), on)
    expect(door.status).toBe(303)
    expect(door.headers.get('location')).toBe('/')
    expect(door.headers.get('set-cookie')).toBe('om_przerwa=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000')

    expect(handle(req('/tutor', { headers: { cookie: 'a=b; om_przerwa=1' } }), on).headers.get('x-middleware-next')).toBe('1')
    expect(handle(req('/tutor', { headers: { cookie: 'om_przerwa=inny' } }), on).status).toBe(503)
    expect(handle(req('/tutor'), on).status).toBe(503)
  })
  it('shows the page with 200 and noindex at the preview address, also after getting in', async () => {
    for (const init of [undefined, { headers: { cookie: 'om_przerwa=1' } }]) {
      const res = handle(req('/?podglad=przerwa', init), on)
      expect(res.status).toBe(200)
      expect(res.headers.get('x-robots-tag')).toBe('noindex')
      expect(await res.text()).toContain('w niedzielę o 9:00')
    }
    expect(handle(req('/?podglad=przerwa'), off).status).toBe(200)
  })
})
