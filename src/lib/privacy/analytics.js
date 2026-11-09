import { ref, readonly } from 'vue'
import { createPrivacyChoice, filterAnalyticsEvent, parsePrivacyChoice, PRIVACY_KEY, readPrivacyChoice } from './consent'
import { syncMetaPixel } from './metaPixel'

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

/** Tells Meta about the current page unless the visitor refused ads. Called on every route change too. */
export function reportPageToMeta() {
  try { syncMetaPixel(parsePrivacyChoice(JSON.stringify(choice.value))?.marketing !== false) } catch { /* ads must never interrupt the app */ }
}

function applyChoice() {
  void enableAnalytics().catch(() => {}) // Optional statistics must never interrupt the app.
  reportPageToMeta()
}

export function initPrivacyAnalytics() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  try { choice.value = readPrivacyChoice(window.localStorage) } catch { choice.value = null }
  applyChoice()
  window.addEventListener('storage', event => {
    if (event.key !== PRIVACY_KEY && event.key !== null) return
    try { choice.value = readPrivacyChoice(window.localStorage) } catch { choice.value = null }
    applyChoice()
  })
}

export function setPrivacyChoice(analytics, age16 = false, marketing = false) {
  const next = createPrivacyChoice(analytics, age16, Date.now(), marketing)
  choice.value = next // Revocation gates all future events, even if storage is unavailable.
  let persisted = true
  try { window.localStorage.setItem(PRIVACY_KEY, JSON.stringify(next)) } catch { persisted = false }
  applyChoice()
  return persisted
}
