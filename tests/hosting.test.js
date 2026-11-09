import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ROUTES, checkoutRoute } from '../src/config/routes'
import { META_PIXEL_ID } from '../src/config/site'

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const rewrite = config.rewrites.find(rule => rule.destination.startsWith('/spa'))
const matcher = new RegExp(`^${rewrite.source}$`)

describe('Content-Security-Policy', () => {
  const csp = config.headers.flatMap(rule => rule.headers).find(header => header.key === 'Content-Security-Policy').value
  const directive = name => csp.split('; ').find(part => part.startsWith(`${name} `))

  it('allows the exact Meta Pixel script from index.html', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1]
    expect(inline).toContain(META_PIXEL_ID)
    expect(directive('script-src')).toContain(`'sha256-${createHash('sha256').update(inline).digest('base64')}'`)
  })

  it('lets the Meta Pixel load and report', () => {
    expect(directive('script-src')).toContain('https://connect.facebook.net')
    expect(directive('img-src')).toContain('https://www.facebook.com')
    expect(directive('connect-src')).toContain('https://www.facebook.com')
  })
})

describe('external payment returns on Vercel', () => {
  it('uses extensionless rewrite targets when cleanUrls is enabled (the payment 404 regression)', () => {
    expect(config.cleanUrls).toBe(true)
    for (const rule of config.rewrites) expect(rule.destination).not.toMatch(/\.html(?:$|\?)/)
  })

  it.each([
    `${ROUTES.premiumDone}?session_id=cs_test_return`,
    `${checkoutRoute('matura')}&anulowano=1`,
    `${ROUTES.login}?next=${encodeURIComponent(`${ROUTES.premiumDone}?session_id=cs_test_return`)}`,
    ROUTES.dashboard,
  ])('serves the app shell for a direct document visit to %s', path => {
    expect(matcher.test(new URL(path, 'https://matura-2.vercel.app').pathname)).toBe(true)
  })

  it.each(['/assets/Checkout.js', '/assets/checkout.css', '/favicon.svg', '/robots.txt', '/dokumenty/regulamin-2026-11-02.html', '/dokumenty/regulamin-2026-11-02', '/dokumenty/formularz-odstapienia.txt'])('leaves real assets alone: %s', path => {
    expect(matcher.test(path)).toBe(false)
  })
})
