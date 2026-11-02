import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BYPASS_PATH, config, handle } from '../middleware.js'
import { MAINTENANCE_SCRIPT, MAINTENANCE_SCRIPT_HASH, describeUntil, renderMaintenancePage, retryAfterSeconds } from '../maintenance/page.js'

const now = new Date('2026-11-07T20:00:00+01:00')
const until = '2026-11-08T09:00:00+01:00'
const on = { MAINTENANCE_MODE: 'on', MAINTENANCE_UNTIL: until, MAINTENANCE_BYPASS_TOKEN: 'tajny-klucz-123' }
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
    for (const p of ['/', '/tutor', '/arkusze-maturalne/2025-maj-polski-pp', '/auth/potwierdz', '/regulamin']) expect(matcher.test(p)).toBe(true)
    for (const p of ['/assets/index-abc.js', '/fonts/manrope-latin.woff2', '/dokumenty/regulamin-2026-11-02.html', '/cke-arkusze/x.pdf', '/robots.txt', '/sitemap.xml', '/favicon.svg', '/og.png']) expect(matcher.test(p)).toBe(false)
  })
  it('lets everything through when the break is off', () => {
    const res = handle(req('/tutor'), {}, now)
    expect(res.headers.get('x-middleware-next')).toBe('1')
    expect(handle(req('/'), { MAINTENANCE_MODE: 'off' }, now).headers.get('x-middleware-next')).toBe('1')
  })
  it('answers 503 with Retry-After, no caching and the page while the break is on', async () => {
    const res = handle(req('/tutor'), on, now)
    expect(res.status).toBe(503)
    expect(res.headers.get('retry-after')).toBe(String(13 * 3600))
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(res.headers.get('content-security-policy')).toContain(MAINTENANCE_SCRIPT_HASH)
    expect(await res.text()).toContain('Planowana przerwa techniczna')
    const head = handle(req('/', { method: 'HEAD' }), on, now)
    expect(head.status).toBe(503)
    expect(head.body).toBeNull()
  })
  it('lets the owner in with the key, keeps everyone else out', async () => {
    const door = handle(req(`${BYPASS_PATH}?klucz=tajny-klucz-123`), on, now)
    expect(door.status).toBe(303)
    expect(door.headers.get('set-cookie')).toMatch(/^om_przerwa=tajny-klucz-123; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=14400$/)
    expect(handle(req(`${BYPASS_PATH}?klucz=zly`), on, now).status).toBe(404)
    expect(handle(req(`${BYPASS_PATH}?klucz=`), on, now).status).toBe(404)
    expect(handle(req(`${BYPASS_PATH}?klucz=tajny-klucz-123`), { ...on, MAINTENANCE_BYPASS_TOKEN: '' }, now).status).toBe(404)

    const inside = handle(req('/tutor', { headers: { cookie: 'a=b; om_przerwa=tajny-klucz-123' } }), on, now)
    expect(inside.headers.get('x-middleware-next')).toBe('1')
    expect(handle(req('/tutor', { headers: { cookie: 'om_przerwa=inny' } }), on, now).status).toBe(503)
    expect(handle(req('/tutor', { headers: { cookie: 'om_przerwa=' } }), { ...on, MAINTENANCE_BYPASS_TOKEN: '' }, now).status).toBe(503)

    const out = handle(req(BYPASS_PATH), on, now)
    expect(out.status).toBe(303)
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0')
  })
  it('shows a preview of the page with 200 and noindex while the site is up', async () => {
    const res = handle(req('/?podglad=przerwa'), { MAINTENANCE_UNTIL: until }, now)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-robots-tag')).toBe('noindex')
    expect(await res.text()).toContain('w niedzielę o 9:00')
  })
})
