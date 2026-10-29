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
  // TODO: replace with a real inbox you check (e.g. kontakt@twojadomena.pl).
  // TODO: switch to an address on your own domain (e.g. kontakt@ogarnijmature.pl) once it's set up.
  contactEmail: "miljulek@gmail.com",
} as const;

/** Shown in the footer of public pages. */
export const AUTHOR = { name: "Julian Mil", email: "miljulek@gmail.com" } as const;

// Feature switch. true = the landing page shows "Załóż konto" / "Zaloguj się" (live app).
// false = it shows the waitlist form instead (pre-launch mode).
export const LAUNCHED = true;

// Bump when the terms or privacy policy change in a way users must accept again.
// Saved on every profile at signup.
export const TERMS_VERSION = "2026-10-17";

// Supabase project "Matura". These values are PUBLIC by design (anyone can see them in the browser),
// so they can live in the code. All SECRETS live in Supabase (Edge Function secrets), never here.

/**
 * Cloudflare Turnstile (CAPTCHA) on signup, login and password reset: stops bots from making
 * hundreds of accounts to use up the free AI. The site key is public by design.
 *   "1x0000…AA" = Cloudflare's TEST key: the widget shows (with a "testing only" note) and always
 *                 passes. Used everywhere until you create your own key.
 *   null        = no widget at all.
 * Going live: replace it with your site key AND enable CAPTCHA protection (Turnstile + secret key)
 * in Supabase Dashboard → Authentication → Attack Protection. Do both together.
 */
export const CAPTCHA_SITE_KEY: string | null = "1x00000000000000000000AA";

export const SUPABASE = {
  url: "https://mwtqlqbzsxeakqrjyxwg.supabase.co",
  // The publishable key only allows what our RLS policies allow, so it's safe in the browser.
  publishableKey: "sb_publishable_l0yuM_rjvWY4Cs8ekMWymg_4qkJ6xM6",
  waitlistFunctionUrl: "https://mwtqlqbzsxeakqrjyxwg.supabase.co/functions/v1/waitlist-signup",
} as const;
