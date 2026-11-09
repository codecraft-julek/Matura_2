// Meta Pixel for the Facebook ads. The first page view comes from the script in index.html; this
// module reports later route changes and handles the "Reklamy" answer in the privacy banner.
//   - only the public pages are reported, so nothing about accounts, essays or payments reaches Meta,
//   - automatic button/form capture and automatic route tracking are off, because they would
//     send page contents and private page addresses on their own,
//   - only on the live domain, so development and Vercel previews don't add fake visits.
import { META_PIXEL_ID } from '@/config/site'
import { PUBLIC_PATHS } from './consent'

const SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js'
let started = false
let granted = false
let lastPath = null

function loadPixel() {
  const fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments) }
  window.fbq = fbq
  window._fbq ??= fbq
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.queue = []
  fbq.disablePushState = true // otherwise Meta reports every route change itself, private pages included
  const script = document.createElement('script')
  script.async = true
  script.src = SCRIPT_SRC
  document.head.appendChild(script)
  fbq('set', 'autoConfig', false, META_PIXEL_ID)
  fbq('init', META_PIXEL_ID)
}

/** Call on every route change and consent change. Reports the current page once, if allowed. */
export function syncMetaPixel(allowed) {
  if (!META_PIXEL_ID || !import.meta.env.PROD || !/(^|\.)ogarnijmature\.com$/.test(window.location.hostname ?? '')) return
  if (!started) { // what the script in index.html has already done on this page load
    started = true
    granted = Boolean(window.fbq)
    lastPath = window.omPixelPath ?? null
  }
  if (!allowed) {
    if (granted) window.fbq?.('consent', 'revoke')
    granted = false
    lastPath = null
    return
  }
  const path = window.location.pathname
  if (!PUBLIC_PATHS.has(path)) { lastPath = null; return }
  if (!window.fbq) loadPixel()
  if (!granted) { window.fbq('consent', 'grant'); granted = true }
  if (path === lastPath) return
  lastPath = path
  window.fbq('track', 'PageView')
}
