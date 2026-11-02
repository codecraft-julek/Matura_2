import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONSENT_TTL, createPrivacyChoice, PRIVACY_KEY } from '../src/lib/privacy/consent'
let storage
let listeners
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('PROD', true)
  storage = new Map()
  listeners = new Map()
  vi.stubGlobal('window', {
    location: { origin: 'https://matura-2.vercel.app' },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    addEventListener: (name, handler) => listeners.set(name, handler),
  })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('analytics script lifecycle', () => {
  it('does not show analytics before consent or after refusal', async () => {
    const analytics = await import('../src/lib/privacy/analytics')
    analytics.initPrivacyAnalytics()
    analytics.setPrivacyChoice(false)
    expect(analytics.showAnalytics.value).toBe(false)
    expect(analytics.privacyChoice.value.analytics).toBe(false)
  })

  it('shows analytics after explicit opt-in and suppresses subsequent events immediately on revocation', async () => {
    const analytics = await import('../src/lib/privacy/analytics')
    analytics.initPrivacyAnalytics()
    analytics.setPrivacyChoice(true, true)
    expect(analytics.showAnalytics.value).toBe(true)
    const beforeSend = analytics.getBeforeSendFilter()
    const event = { type: 'pageview', url: 'https://matura-2.vercel.app/?session_id=secret' }
    expect(beforeSend(event)).toEqual({ type: 'pageview', url: 'https://matura-2.vercel.app/' })
    analytics.setPrivacyChoice(false)
    expect(analytics.showAnalytics.value).toBe(false)
    expect(beforeSend(event)).toBeNull()
  })

  it('honours revocation in another tab', async () => {
    storage.set(PRIVACY_KEY, JSON.stringify(createPrivacyChoice(true, true)))
    const analytics = await import('../src/lib/privacy/analytics')
    analytics.initPrivacyAnalytics()
    expect(analytics.showAnalytics.value).toBe(true)
    const beforeSend = analytics.getBeforeSendFilter()
    storage.set(PRIVACY_KEY, JSON.stringify(createPrivacyChoice(false, false)))
    listeners.get('storage')({ key: PRIVACY_KEY })
    expect(analytics.showAnalytics.value).toBe(false)
    expect(beforeSend({ type: 'pageview', url: 'https://matura-2.vercel.app/' })).toBeNull()
  })

  it('does not restore expired consent and fails closed when storage is blocked', async () => {
    storage.set(PRIVACY_KEY, JSON.stringify(createPrivacyChoice(true, true, Date.now() - CONSENT_TTL - 1)))
    const analytics = await import('../src/lib/privacy/analytics')
    analytics.initPrivacyAnalytics()
    expect(analytics.privacyChoice.value).toBeNull()
    expect(analytics.showAnalytics.value).toBe(false)
    window.localStorage.setItem = () => { throw new Error('storage blocked') }
    expect(analytics.setPrivacyChoice(false)).toBe(false)
    expect(analytics.showAnalytics.value).toBe(false)
  })
})
