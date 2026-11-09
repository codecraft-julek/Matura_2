import { ref, readonly } from 'vue'
import { createPrivacyChoice, filterAnalyticsEvent, parsePrivacyChoice, PRIVACY_KEY, readPrivacyChoice } from './consent'

const choice = ref(null)
export const privacyChoice = readonly(choice)
let initialized = false
let injected = false

async function enableAnalytics() {
  if (injected || !choice.value?.analytics || !import.meta.env.PROD) return
  // No analytics script or network request before opt-in. Recheck after the async import.
  const { inject } = await import('@vercel/analytics')
  if (injected || !parsePrivacyChoice(JSON.stringify(choice.value))?.analytics) return
  injected = true
  inject({ mode: 'production', beforeSend: event => filterAnalyticsEvent(event, choice.value, window.location.origin) })
}

export function initPrivacyAnalytics() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  try { choice.value = readPrivacyChoice(window.localStorage) } catch { choice.value = null }
  void enableAnalytics().catch(() => {}) // Optional statistics must never interrupt the app.
  window.addEventListener('storage', event => {
    if (event.key !== PRIVACY_KEY && event.key !== null) return
    try { choice.value = readPrivacyChoice(window.localStorage) } catch { choice.value = null }
    void enableAnalytics().catch(() => {})
  })
}

export function setPrivacyChoice(analytics, age16 = false) {
  const next = createPrivacyChoice(analytics, age16)
  choice.value = next // Revocation gates all future events, even if storage is unavailable.
  let persisted = true
  try { window.localStorage.setItem(PRIVACY_KEY, JSON.stringify(next)) } catch { persisted = false }
  void enableAnalytics().catch(() => {})
  return persisted
}
