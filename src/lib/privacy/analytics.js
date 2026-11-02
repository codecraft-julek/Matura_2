import { ref, readonly, computed } from 'vue'
import { createPrivacyChoice, filterAnalyticsEvent, parsePrivacyChoice, PRIVACY_KEY, readPrivacyChoice } from './consent'

const choice = ref(null)
export const privacyChoice = readonly(choice)

// Computed property to determine if analytics should be shown (for Vue component approach)
export const showAnalytics = computed(() => {
  return choice.value?.analytics === true && import.meta.env.PROD
})

// beforeSend filter for the Analytics component
export function getBeforeSendFilter() {
  return (event) => filterAnalyticsEvent(event, choice.value, window.location.origin)
}

let initialized = false

export function initPrivacyAnalytics() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  try { choice.value = readPrivacyChoice(window.localStorage) } catch { choice.value = null }
  window.addEventListener('storage', event => {
    if (event.key !== PRIVACY_KEY && event.key !== null) return
    try { choice.value = readPrivacyChoice(window.localStorage) } catch { choice.value = null }
  })
}

export function setPrivacyChoice(analytics, age16 = false) {
  const next = createPrivacyChoice(analytics, age16)
  choice.value = next // Revocation gates all future events, even if storage is unavailable.
  let persisted = true
  try { window.localStorage.setItem(PRIVACY_KEY, JSON.stringify(next)) } catch { persisted = false }
  return persisted
}
