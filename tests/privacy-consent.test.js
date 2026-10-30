import { describe, expect, it } from 'vitest'
import { clearLocalStudyData, CONSENT_TTL, createPrivacyChoice, filterAnalyticsEvent, parsePrivacyChoice, PRIVACY_KEY, readPrivacyChoice } from '../src/lib/privacy/consent'

const now = Date.UTC(2026, 9, 30)
const origin = 'https://matura-2.vercel.app'
const allowed = createPrivacyChoice(true, true, now)
const event = url => ({ type: 'pageview', url: `${origin}${url}` })

describe('optional analytics consent', () => {
  it('defaults off for missing, corrupt, unsupported, future or expired choices', () => {
    for (const raw of [null, '', '{}', 'null', 'true', '{', JSON.stringify({ ...allowed, version: 'old' }), JSON.stringify({ ...allowed, at: now + 1 }), JSON.stringify({ ...allowed, at: now - CONSENT_TTL })]) {
      expect(parsePrivacyChoice(raw, now)).toBeNull()
    }
    expect(readPrivacyChoice({ getItem: () => { throw new Error('storage blocked') } }, now)).toBeNull()
  })

  it('requires explicit opt-in and a separate age confirmation', () => {
    expect(() => createPrivacyChoice(true, false, now)).toThrow()
    expect(() => createPrivacyChoice(undefined, true, now)).toThrow()
    expect(parsePrivacyChoice(JSON.stringify({ ...allowed, age16: false }), now)).toBeNull()
    expect(parsePrivacyChoice(JSON.stringify(allowed), now)).toEqual(allowed)
    expect(parsePrivacyChoice(JSON.stringify(createPrivacyChoice(false, false, now)), now)?.analytics).toBe(false)
  })

  it('blocks all events before consent, after rejection, after revocation and after expiry', () => {
    for (const consent of [null, createPrivacyChoice(false, false, now), { ...allowed, at: now - CONSENT_TTL }]) {
      expect(filterAnalyticsEvent(event('/'), consent, origin, now)).toBeNull()
    }
    expect(filterAnalyticsEvent(event('/'), allowed, origin, now)).not.toBeNull()
    expect(filterAnalyticsEvent(event('/'), createPrivacyChoice(false, false, now), origin, now)).toBeNull()
  })

  it.each(['/konto', '/auth/potwierdz?token_hash=private', '/premium/gotowe?session_id=private', '/wypracowania/private-id', '/panel', '/arkusze-maturalne/private-id'])('excludes private or non-allowlisted paths: %s', path => {
    expect(filterAnalyticsEvent(event(path), allowed, origin, now)).toBeNull()
  })

  it('strips query strings and fragments; discards unknown payload fields', () => {
    expect(filterAnalyticsEvent({ ...event('/kontakt?email=student@example.com#private'), secret: 'do-not-send' }, allowed, origin, now)).toEqual({ type: 'pageview', url: `${origin}/kontakt` })
    expect(filterAnalyticsEvent({ type: 'event', url: `${origin}/` }, allowed, origin, now)).toBeNull()
    expect(filterAnalyticsEvent({ type: 'pageview', url: 'https://other.example/' }, allowed, origin, now)).toBeNull()
  })

  it('clears only local study data, preserving authentication, privacy choices and other apps', () => {
    const values = new Map([
      ['ogarnij-mature:draft:essay-new', 'work'], ['om:sheet:exam:2026', 'answers'],
      ['ogarnij-mature:polski-2026:v1', 'progress'], ['om:exam-pdf-panel', 'hidden'],
      ['sb-project-auth-token', 'session'], [PRIVACY_KEY, JSON.stringify(allowed)], ['unrelated', 'value'],
    ])
    const storage = { get length() { return values.size }, key: index => [...values.keys()][index], removeItem: key => values.delete(key) }
    expect(clearLocalStudyData(storage)).toBe(4)
    expect([...values.keys()]).toEqual(['sb-project-auth-token', PRIVACY_KEY, 'unrelated'])
  })
})
