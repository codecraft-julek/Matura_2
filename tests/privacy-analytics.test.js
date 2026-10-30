import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONSENT_TTL, createPrivacyChoice, PRIVACY_KEY } from '../src/lib/privacy/consent'

const { inject } = vi.hoisted(() => ({ inject: vi.fn() }))
vi.mock('@vercel/analytics', () => ({ inject }))
let storage
let listeners
beforeEach(() => {
  vi.resetModules()
  inject.mockReset()
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
  it('does not inject the tracker before consent or after refusal', async () => {
    const analytics = await import('../src/lib/privacy/analytics')
    analytics.initPrivacyAnalytics()
    analytics.setPrivacyChoice(false)
    expect(inject).not.toHaveBeenCalled()
    expect(analytics.privacyChoice.value.analytics).toBe(false)
  })

  it('injects after explicit opt-in and suppresses subsequent events immediately on revocation', async () => {
    const analytics = await import('../src/lib/privacy/analytics')
    analytics.initPrivacyAnalytics()
    analytics.setPrivacyChoice(true, true)
    await vi.waitFor(() => expect(inject).toHaveBeenCalledTimes(1))
    const { beforeSend } = inject.mock.calls[0][0]
    const event = { type: 'pageview', url: 'https://matura-2.vercel.app/?session_id=secret' }
    expect(beforeSend(event)).toEqual({ type: 'pageview', url: 'https://matura-2.vercel.app/' })
    analytics.setPrivacyChoice(false)
    expect(beforeSend(event)).toBeNull()
    expect(inject).toHaveBeenCalledTimes(1)
  })

  it('honours revocation in another tab', async () => {
    storage.set(PRIVACY_KEY, JSON.stringify(createPrivacyChoice(true, true)))
    const analytics = await import('../src/lib/privacy/analytics')
    analytics.initPrivacyAnalytics()
    await vi.waitFor(() => expect(inject).toHaveBeenCalledTimes(1))
    storage.set(PRIVACY_KEY, JSON.stringify(createPrivacyChoice(false, false)))
    listeners.get('storage')({ key: PRIVACY_KEY })
    expect(inject.mock.calls[0][0].beforeSend({ type: 'pageview', url: 'https://matura-2.vercel.app/' })).toBeNull()
  })

  it('does not restore expired consent and fails closed when storage is blocked', async () => {
    storage.set(PRIVACY_KEY, JSON.stringify(createPrivacyChoice(true, true, Date.now() - CONSENT_TTL - 1)))
    const analytics = await import('../src/lib/privacy/analytics')
    analytics.initPrivacyAnalytics()
    expect(analytics.privacyChoice.value).toBeNull()
    expect(inject).not.toHaveBeenCalled()
    window.localStorage.setItem = () => { throw new Error('storage blocked') }
    expect(analytics.setPrivacyChoice(false)).toBe(false)
    expect(inject).not.toHaveBeenCalled()
  })
})
