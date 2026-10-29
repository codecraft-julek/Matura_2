# Checkout audit and implementation — 29 October 2026

## Decision

Use one focused order-review page followed by Stripe's hosted payment page. Remove numbered form sections: the old “3. Płatność” was informational, while the actual payment happened on a different website. Keep the plan, amount due, billing agreement, required consents and primary action understandable together.

This is an evidence-informed redesign, not a demonstrated conversion winner. The reviewed education companies do not publish comparable checkout completion rates. Their popularity, claimed student outcomes and marketing testimonials are not evidence that their checkout converts best. No conversion uplift for Matura 2 has been measured.

## Research and comparison

Reviewed public product/pricing pages, purchase instructions, original usability research, payment-provider experiments and deployment documentation. Account-gated competitor checkouts were not purchased or tested; observations below distinguish public behavior from measured findings.

| Source | Finding | Application to Matura 2 |
| --- | --- | --- |
| [Baymard: checkout form complexity](https://baymard.com/research-articles/checkout-flow-average-form-fields) | What users must do matters more than the step count alone. More fields generally worsen usability. | No extra contact, address or card form. Use the existing account email; put required consents immediately before the payment action. |
| [Baymard: checkout friction audit](https://baymard.com/learn/audit-checkout-flow-hidden-friction) | Progress displays should match the actual process. Preserve information when navigating and recovering from errors. | Remove the misleading three-section “step” sequence. Explain the Stripe handoff next to the button. Keep the selected plan in the URL and preserve inputs after checkout errors. |
| [Baymard: online learning research](https://baymard.com/research/online-learning) | Research includes seven learning sites, including Udemy, DataCamp and MasterClass; checkout is a distinct research area. | This supports using education-specific examples, but the public overview does not establish a conversion ranking or expose all paid guidelines. |
| [Więcej niż Matura: pricing](https://wiecejnizmatura.pl/cennik) | Clearly distinguishes recurring monthly access from payment upfront, including the total upfront price. | Two plainly named options: “Co miesiąc” and “Do matury”. Show the actual charge and renewal/expiry details, rather than an estimated monthly equivalent for the pass. |
| [Maturalni: course purchase page](https://maturalni.com/produkt/kurs-wideo-matematyka-rozszerzona/) | Product/bundle selection, stated access benefits and a direct purchase action. | Keep benefits available in a compact disclosure; avoid another upsell decision in checkout. Do not copy their outcome guarantees, reviews or refund promises. |
| [Udemy: purchasing a course](https://support.udemy.com/hc/en-us/sections/206458408-Purchasing-a-course) | A single-course “Buy Now” avoids a separate cart. Available payment methods depend on location/device and purchase type. | Keep direct plan-to-checkout navigation and let Stripe show eligible methods. No cart for a single access plan. |
| [Quizlet: upgrade page](https://quizlet.com/upgrade) and [renewal help](https://help.quizlet.com/hc/en-us/articles/360029963211-Canceling-auto-renewal-if-you-paid-on-the-website) | Shows monthly equivalents alongside the billed annual amount; subscriptions auto-renew and have an account-management path. | Make today's actual total more prominent than any comparison price. Explain recurring billing and where to turn off renewal. No trial is implied for Matura. |
| [Stripe: controlled payment-method experiment](https://stripe.com/blog/testing-the-conversion-impact-of-50-plus-global-payment-methods) | Stripe reports 7.4% average conversion improvement with an additional relevant method, and 46% for offering BLIK to Polish customers under the study's conditions. These are provider-reported averages, not Matura forecasts. | Keep local methods visible for the pass and retain hosted Checkout's dynamic eligibility. Payment configuration and device availability still determine what a buyer actually sees. |
| [Stripe: BLIK capabilities](https://docs.stripe.com/payments/blik) | Current documentation includes recurring-payment support; availability depends on the integration and account. | Remove the old categorical claim that subscriptions can only use cards or that BLIK can never recur. Do not enable or promise a new method without verifying the merchant configuration. |
| [Stripe: confirmation and fulfillment](https://docs.stripe.com/payments/checkout/custom-success-page?payment-ui=stripe-hosted) | A browser return is not reliable proof of payment; fulfillment must rely on server notifications. | Keep webhook-backed access as the source of truth. Show waiting, connection-error and active-access states; never unlock Premium because a session ID appears in the URL. |

## Concrete changes

- A compact branded checkout layout, without the app's study navigation and mobile bottom bar competing with the purchase.
- Unnumbered plan choices and one order summary. The total, recurring obligation, consent controls and CTA are together on desktop and mobile.
- An explicit “Przejdź do płatności · [price]” action and a sentence explaining that the user chooses a method and authorizes payment on Stripe.
- No invented popularity or savings badges in checkout. Existing plan prices and entitlements stay unchanged.
- Account email is shown without re-entry. Benefits are available in a native keyboard-accessible disclosure rather than another mandatory section.
- Missing consents are identified on submission and focus moves to the first missing checkbox. A plan change resets agreement to that plan's billing terms; other inputs survive payment errors.
- Busy-state protection stops duplicate submissions and disables plan/consent changes during the handoff.
- A cancelled return no longer claims “nothing was charged” without verification. Users who already confirmed at their bank are directed to check access before trying again.
- The return page reads actual access and its end date. Polling is sequential, capped at 30 seconds even for a hung request, retryable, and stopped on navigation. Late responses cannot overwrite a new check.
- The payment-result page bypasses onboarding while retaining authentication; an expired login keeps the original return URL through the existing `next` parameter.

## The 404 defect

The reported URL is on `https://matura-2.vercel.app/premium/gotowe` (a Stripe test-session return). Its route already existed in Vue.

`vercel.json` combined `cleanUrls: true` with a rewrite destination of `/spa.html`. [Vercel's Vite documentation](https://vercel.com/docs/frameworks/frontend/vite) explicitly requires extensionless rewrite destinations with that setting. The corrected destination is `/spa`, backed by `dist/spa.html`. Build configuration now explicitly runs the full project build so the post-build shell cannot be omitted by a plain `vite build` deployment command.

The build also emits app-shell HTML for `/premium/gotowe` and `/premium/platnosc` with `noindex`; these files contain no account data or assumed success. Build validation checks the fallback target, both entry pages and their referenced JavaScript. Unit tests check the payment, cancellation and login paths and ensure asset paths are not rewritten.

A separate development defect was found: `returnOrigin` permitted `localhost` but not `127.0.0.1`, despite the dev server binding to the latter. Loopback hosts now work consistently. This was not the cause of the supplied Vercel URL's 404.

## Verification and rollout

Local checks: `npm test`, `npm run content:check`, `npm run build`, `git diff --check`. The build includes `scripts/check-checkout-build.mjs`. Regression coverage includes delayed webhook access, temporary/offline errors, hung requests, retry races, leaving the page, and visits without a payment session.

Browser/layout QA and a new Stripe end-to-end test remain unverified: this execution sandbox denied the local server bind and Chromium launch. The deployed URL could not be fetched by the available web tool. GitHub's connected account reports `push: false`, so these changes are local and have not been deployed.

Deploy the frontend through the existing Matura_2 → Vercel workflow; do not deploy it to the older Sites demo. The frontend deployment fixes the reported Vercel routing problem without a Supabase deployment. The additional loopback-origin fix requires redeploying `billing-checkout` and `billing-portal` if local payments are needed. No database migration or payment-data changes are required.

After deployment, verify direct navigation and reload of `/premium/gotowe`, login recovery with `next`, both plan selections, cancellation and a full Stripe test-mode payment. Check 320/390px mobile and desktop layouts, keyboard access, and at least one actual eligible Polish payment method. Existing paid access remains governed by the existing webhook; returning to the page does not charge the user again.

## How to establish which version performs better

Use verified successful payments per checkout entrant as the primary conversion measure. Keep purchase confirmation server-side to avoid counting only buyers who return in their browser. Track the steps “checkout viewed”, “payment session opened”, “verified payment”, “access activated”; exclude test sessions, staff and existing Premium users.

Segment by mobile/desktop, monthly/pass, new/returning account, payment method and acquisition channel. Monitor failed handoffs, time to access, duplicate sessions, payment-related support and refunds as guardrails. Never include email addresses or Stripe session IDs in frontend analytics events.

After fixing the 404, establish a clean baseline, then compare the new order review in a randomized test with the same prices, traffic mix and payment settings. Choose sample size and minimum meaningful lift from actual baseline volume; do not stop at the first favorable daily result. Until then, describe the design as researched and tested functionally, not “highest converting”.
