export const PRIVACY_KEY = 'om:privacy-choice'
export const CONSENT_VERSION = '2026-10-30'
export const CONSENT_TTL = 180 * 24 * 60 * 60 * 1000

export function parsePrivacyChoice(raw, now = Date.now()) {
  try {
    const record = JSON.parse(raw)
    if (!record || record.version !== CONSENT_VERSION || typeof record.analytics !== 'boolean' ||
      !Number.isFinite(record.at) || record.at > now || now - record.at >= CONSENT_TTL) return null
    if (record.analytics && record.age16 !== true) return null
    return record
  } catch { return null }
}

export function createPrivacyChoice(analytics, age16, now = Date.now()) {
  if (analytics !== true && analytics !== false) throw new TypeError('An explicit choice is required')
  if (analytics && age16 !== true) throw new TypeError('Age confirmation is required for optional analytics')
  return { version: CONSENT_VERSION, analytics, age16: analytics && age16 === true, at: now }
}

export function readPrivacyChoice(storage, now = Date.now()) {
  try { return parsePrivacyChoice(storage.getItem(PRIVACY_KEY), now) } catch { return null }
}

// These are public marketing/legal pages only. Never send account IDs, payment session IDs,
// auth codes, private page paths, URL queries, fragments, or custom event payloads.
const PUBLIC_PATHS = new Set(['/', '/arkusze-maturalne', '/kontakt', '/regulamin', '/polityka-prywatnosci'])
export function filterAnalyticsEvent(event, consent, origin, now = Date.now()) {
  if (!parsePrivacyChoice(JSON.stringify(consent), now)?.analytics || event?.type !== 'pageview') return null
  try {
    const url = new URL(event.url, origin)
    if (url.origin !== origin || !PUBLIC_PATHS.has(url.pathname)) return null
    return { type: 'pageview', url: `${url.origin}${url.pathname}` }
  } catch { return null }
}

export function clearLocalStudyData(storage) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
  const owned = keys.filter(key => key && (key.startsWith('ogarnij-mature:draft:') || key.startsWith('om:sheet:') ||
    key === 'ogarnij-mature:polski-2026:v1' || key === 'om:exam-pdf-panel'))
  for (const key of owned) storage.removeItem(key)
  return owned.length
}
