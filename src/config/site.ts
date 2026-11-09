// Single source of truth for site-wide constants.
// Change the product name here and it updates everywhere (page, metadata, privacy policy, OG image).

export const PRODUCT_NAME = "Ogarnij Maturę";

// Where the site lives (canonical links, sitemap, OG tags). Set at build time in vite.config.js
// from Vercel's built-in VERCEL_PROJECT_PRODUCTION_URL, so you don't need to set anything there.
// Outside Vite (Node scripts, tests) import.meta.env is undefined and the fallback is used.
const siteUrl: string = (import.meta as { env?: Record<string, string> }).env?.VITE_SITE_URL ?? "http://localhost:5173";

export const SITE = {
  name: PRODUCT_NAME,
  url: siteUrl,
  description:
    "Rozwiązuj prawdziwe arkusze maturalne CKE w formule 2023 i od razu sprawdzaj odpowiedzi według oficjalnego klucza. Darmowe konto na start.",
  // Public contact address shown in the privacy policy and footer.
  contactEmail: "ogarnijmature@o2.pl",
} as const;

/** Shown in the footer of public pages. */
export const AUTHOR = { name: "Julian Mil", email: "ogarnijmature@o2.pl" } as const;

// Feature switch. true = the landing page shows "Załóż konto" / "Zaloguj się" (live app).
// false = it shows the waitlist form instead (pre-launch mode).
export const LAUNCHED = true;

// Bump when the terms or privacy policy change in a way users must accept again.
// Saved on every profile at signup.
export { LEGAL_VERSION as TERMS_VERSION } from './legal.js';

// Supabase project "Matura". These values are PUBLIC by design (anyone can see them in the browser),
// so they can live in the code. All SECRETS live in Supabase (Edge Function secrets), never here.

/**
 * Cloudflare Turnstile (CAPTCHA) on signup, login and password reset: stops bots from making
 * hundreds of accounts to use up the free AI. The site key is public by design.
 *   null = no widget at all (current state: turned off for now).
 * To turn it back on: put the site key here, turn on CAPTCHA protection in Supabase Dashboard →
 * Authentication → Attack Protection, and set the TURNSTILE_SECRET_KEY secret for the contact form.
 * The widget only works on the hostnames listed for the key in Cloudflare.
 */
export const CAPTCHA_SITE_KEY: string | null = null;

/**
 * Meta Pixel for the Facebook ads. Public by design. Loads only after the visitor allows ads in the
 * privacy banner and only on public pages (src/lib/privacy/metaPixel.js).
 *   null = off.
 */
export const META_PIXEL_ID: string | null = "1488831509979158";

/**
 * Stripe publishable key (pk_test_… in the sandbox, pk_live_… for real payments). Public by design,
 * like the Supabase key: it only lets the browser show Stripe's payment form. Set → the payment
 * form opens inside our payment page; null → students go to Stripe's own payment page.
 * It must come from the same Stripe account as STRIPE_SECRET_KEY in Supabase.
 */
export const STRIPE_PUBLISHABLE_KEY: string | null = "pk_live_51UVZ3DJmbNO0yPKJ8rkJPsIbavAxxAcZbWzR8LvIedOhtdY5CrkgA6N7T07Wr9pctw4jx8sdhPfZ6Hg1q742nMC600N99C73dM";

/**
 * Web3Forms access key: e-mails each contact form message to the address it was created for.
 * Public by design, it can only send to that address, and its free plan only accepts browser requests.
 */
export const WEB3FORMS_ACCESS_KEY = "8cb24cd2-9f8c-4c62-8336-cb728da1a523";

export const SUPABASE = {
  url: "https://mwtqlqbzsxeakqrjyxwg.supabase.co",
  // The publishable key only allows what our RLS policies allow, so it's safe in the browser.
  publishableKey: "sb_publishable_l0yuM_rjvWY4Cs8ekMWymg_4qkJ6xM6",
  waitlistFunctionUrl: "https://mwtqlqbzsxeakqrjyxwg.supabase.co/functions/v1/waitlist-signup",
} as const;
