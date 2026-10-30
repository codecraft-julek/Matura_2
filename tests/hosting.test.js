import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ROUTES, checkoutRoute } from '../src/config/routes'

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const rewrite = config.rewrites.find(rule => rule.destination.startsWith('/spa'))
const matcher = new RegExp(`^${rewrite.source}$`)

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

  it.each(['/assets/Checkout.js', '/assets/checkout.css', '/favicon.svg', '/robots.txt', '/dokumenty/regulamin-2026-10-30.html', '/dokumenty/regulamin-2026-10-30', '/dokumenty/formularz-odstapienia.txt'])('leaves real assets alone: %s', path => {
    expect(matcher.test(path)).toBe(false)
  })
})
