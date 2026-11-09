// Meta Pixel for the Facebook ads. Same base code as Meta's snippet, with three differences:
//   - it loads only after the visitor allows ads in the privacy banner (no script tag in index.html),
//   - it reports only the public pages, so nothing about accounts, essays or payments reaches Meta,
//   - automatic button/form capture and automatic route tracking are off, because they would
//     send page contents and private page addresses on their own.
// Meta's <noscript> image is left out on purpose: it fires without consent and the app needs JS anyway.
import { META_PIXEL_ID } from '@/config/site'
import { PUBLIC_PATHS } from './consent'

const SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js'
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
  if (!META_PIXEL_ID || !import.meta.env.PROD) return
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
