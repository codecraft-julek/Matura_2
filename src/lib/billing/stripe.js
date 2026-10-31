// Stripe's payment form inside our payment page (Embedded Checkout). Stripe.js is loaded from
// js.stripe.com only when the student goes to pay: Stripe requires that (no bundled copy, PCI).
// Card and BLIK details are typed into Stripe's iframe and never reach our code.
//   loadStripe() → Stripe instance, or null when no publishable key is set or the script is
//   blocked (an ad blocker, no network) → the page falls back to Stripe's own payment page.

import { STRIPE_PUBLISHABLE_KEY } from '@/config/site'

const STRIPE_JS = 'https://js.stripe.com/clover/stripe.js'
let stripePromise = null

export function loadStripe() {
  if (!STRIPE_PUBLISHABLE_KEY) return Promise.resolve(null)
  stripePromise ??= new Promise(resolve => {
    const ready = () => resolve(window.Stripe ? window.Stripe(STRIPE_PUBLISHABLE_KEY, { locale: 'pl' }) : null)
    if (window.Stripe) return ready()
    const script = document.createElement('script')
    script.src = STRIPE_JS
    script.async = true
    script.onload = ready
    script.onerror = () => { stripePromise = null; script.remove(); resolve(null) } // try again next time
    document.head.appendChild(script)
  })
  return stripePromise
}

/** Mounts the form for a Checkout Session (ui_mode embedded_page). → instance with destroy() */
export async function mountEmbeddedCheckout(stripe, element, clientSecret, onComplete) {
  const create = stripe.createEmbeddedCheckoutPage ?? stripe.initEmbeddedCheckout // older Stripe.js name
  const checkout = await create.call(stripe, { fetchClientSecret: async () => clientSecret, onComplete })
  checkout.mount(element)
  return checkout
}
