// The planned-maintenance page, served by middleware.js with HTTP 503 while MAINTENANCE_MODE is on.
// Self-contained on purpose: inline CSS, the brand mark as inline SVG, fonts from /fonts (static
// files Vercel keeps serving), and no call to the app, Supabase or any CDN. One small inline script
// checks once a minute whether the site is back and then reloads; its hash is in the CSP below
// (and in vercel.json), so change MAINTENANCE_SCRIPT and the test tells you to update both.

import { createHash } from 'node:crypto'
import { OM_PATH } from '../src/brand/identity.js'

export const CONTACT_EMAIL = 'ogarnijmature@o2.pl'
const TIME_ZONE = 'Europe/Warsaw'
const WEEKDAY_IN = { Sunday: 'w niedzielę', Monday: 'w poniedziałek', Tuesday: 'we wtorek', Wednesday: 'w środę', Thursday: 'w czwartek', Friday: 'w piątek', Saturday: 'w sobotę' }

/** { weekday: 'w środę', date: '4 listopada 2026', time: '9:00' } in Polish time, or null for a bad value. */
export function describeUntil(until, now = new Date()) {
  const t = until ? Date.parse(until) : NaN
  if (!Number.isFinite(t)) return null
  const d = new Date(t)
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'long' }).format(d)
  const date = new Intl.DateTimeFormat('pl-PL', { timeZone: TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  const time = new Intl.DateTimeFormat('pl-PL', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: false }).format(d).replace(/^0/, '')
  return { weekday: WEEKDAY_IN[weekday], date, time, late: t < now.getTime() }
}

/** Seconds for Retry-After: until the planned end, never under 5 minutes or over 24 hours. */
export function retryAfterSeconds(until, now = new Date()) {
  const t = until ? Date.parse(until) : NaN
  if (!Number.isFinite(t)) return 3600
  return Math.max(300, Math.min(86400, Math.ceil((t - now.getTime()) / 1000)))
}

// Checks once a minute (backing off to 10 minutes, with jitter, paused in hidden tabs) whether /
// answers with anything below 500, then reloads. Keep it ES5-plain: it runs on old phones too.
export const MAINTENANCE_SCRIPT = `(function(){var s=document.getElementById('status'),b=document.getElementById('check'),d=60000,t=null,busy=false;document.documentElement.className+=' js';function say(m){s.textContent=m}function plan(ms){clearTimeout(t);t=setTimeout(check,ms+Math.random()*5000)}function later(){busy=false;b.disabled=false;var m=Math.round(d/60000);say('Jeszcze pracujemy. Sprawdzimy znowu za '+(m<=1?'minutę':m<5?m+' minuty':m+' minut')+'.');plan(d)}function check(){if(busy)return;busy=true;b.disabled=true;say('Sprawdzamy, czy aplikacja już działa…');fetch('/?p='+Date.now(),{method:'HEAD',cache:'no-store',credentials:'omit',redirect:'follow'}).then(function(r){if(r.status<500){say('Jest! Aplikacja znów działa. Za chwilę Cię przeniesiemy.');setTimeout(function(){location.replace('/')},1200);return}var ra=parseInt(r.headers.get('Retry-After'),10);d=Math.min(ra>0?ra*1000:d*1.5,600000);later()}).catch(function(){d=Math.min(d*1.5,600000);later()})}b.addEventListener('click',check);document.addEventListener('visibilitychange',function(){if(document.hidden)clearTimeout(t);else plan(1000)});plan(d)})();`
export const MAINTENANCE_SCRIPT_HASH = `sha256-${createHash('sha256').update(MAINTENANCE_SCRIPT).digest('base64')}`

/** The policy for the maintenance response itself: nothing but this page's own pieces. */
export const MAINTENANCE_CSP = `default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; script-src '${MAINTENANCE_SCRIPT_HASH}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const CSS = `
:root{color-scheme:light dark;--paper:#fafbf7;--surface:#ffffff;--ink:#1c3c32;--text:#213d33;--soft:#5e6f5f;--line:#e2e8da;--lime:#d7f781;--lime-soft:#edfad6;--mark-bg:#1c3c32;--mark-fg:#d7f781;--glow:#d7f78155;--focus:#7a54b0}
@media (prefers-color-scheme:dark){:root{--paper:#132923;--surface:#1c3c32;--ink:#f1f5ec;--text:#eef3ea;--soft:#b3c2b5;--line:#2f5247;--lime:#d7f781;--lime-soft:#2a4a3f;--mark-bg:#d7f781;--mark-fg:#1c3c32;--glow:#d7f78126}}
*,*::before,*::after{box-sizing:border-box}
html{background:var(--paper);-webkit-text-size-adjust:100%}
@font-face{font-family:'Manrope';font-style:normal;font-weight:200 800;font-display:swap;src:url(/fonts/manrope-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Manrope';font-style:normal;font-weight:200 800;font-display:swap;src:url(/fonts/manrope-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'DM Sans';font-style:normal;font-weight:100 1000;font-display:swap;src:url(/fonts/dm-sans-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'DM Sans';font-style:normal;font-weight:100 1000;font-display:swap;src:url(/fonts/dm-sans-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
body{margin:0;min-height:100vh;min-height:100svh;display:flex;flex-direction:column;font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:17px;line-height:1.6;color:var(--text);background:radial-gradient(60rem 36rem at 8% -10%,var(--glow),transparent 60%);-webkit-font-smoothing:antialiased;overflow-x:clip}
main{flex:1;width:100%;max-width:40rem;margin:0 auto;padding:clamp(16px,3.5vh,40px) 20px 10px;display:flex;flex-direction:column;justify-content:center;gap:clamp(12px,2.4vh,28px)}
.brand{display:flex;width:fit-content;align-items:center;gap:11px;font-family:'Manrope',sans-serif;font-size:20px;font-weight:750;letter-spacing:-.035em;line-height:1.04;color:var(--ink);text-decoration:none}
.brand-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:var(--mark-bg);color:var(--mark-fg)}
.brand-mark svg{width:26px;height:26px}
.brand small{display:block;font-weight:500;letter-spacing:0;font-size:12px;color:var(--soft)}
.eyebrow{display:flex;width:fit-content;align-items:center;gap:9px;margin:clamp(14px,3.5vh,44px) 0 clamp(8px,1.6vh,18px);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--soft)}
.dot{position:relative;width:9px;height:9px;border-radius:50%;background:var(--lime);box-shadow:0 0 0 3px var(--lime-soft)}
h1{margin:0;font-family:'Manrope',sans-serif;font-size:clamp(27px,min(8.6vw,5.6vh),44px);font-weight:750;line-height:1.06;letter-spacing:-.035em;color:var(--ink);text-wrap:balance}
.when{background:linear-gradient(transparent 64%,var(--lime) 64%);padding:0 .06em;border-radius:3px}
@media (prefers-color-scheme:dark){.when{background:none;color:var(--lime)}}
.lead{margin:clamp(8px,1.6vh,20px) 0 0;font-size:15px;line-height:1.45;color:var(--text);max-width:34rem}
.lead strong{font-weight:650}
.side{display:grid;gap:clamp(10px,1.8vh,22px)}
.facts{list-style:none;margin:0;padding:0;display:grid;gap:clamp(6px,1vh,12px)}
.facts li{display:grid;grid-template-columns:20px 1fr;gap:10px;align-items:start;padding:clamp(7px,1.2vh,14px) 13px;border:1px solid var(--line);border-radius:13px;background:var(--surface);font-size:14px;line-height:1.38}
.facts svg{width:20px;height:20px;color:var(--ink)}
.facts span,.status p{text-wrap:balance}
.status{display:flex;align-items:center;gap:12px;padding:clamp(9px,1.4vh,16px) 13px;border-radius:13px;background:var(--lime-soft);color:var(--ink)}
.status p{margin:0;flex:1 1 0;min-width:0;font-size:14px;line-height:1.38}
.status button{display:none;flex:none;min-height:40px;padding:0 15px;border:0;border-radius:999px;background:var(--mark-bg);color:var(--mark-fg);font:inherit;font-weight:700;font-size:14px;white-space:nowrap;cursor:pointer;transition:transform .15s,opacity .15s}
.js .status button{display:inline-flex;align-items:center}
.status button:hover{transform:translateY(-1px)}
.status button:disabled{opacity:.55;cursor:default;transform:none}
.contact{margin:0;font-size:14px;line-height:1.4;color:var(--soft);overflow-wrap:anywhere}
.contact a{color:var(--ink);font-weight:650;text-decoration:underline;text-decoration-color:var(--lime);text-decoration-thickness:2px;text-underline-offset:3px}
a:focus-visible,button:focus-visible{outline:3px solid var(--focus);outline-offset:4px}
footer{width:100%;max-width:40rem;margin:0 auto;padding:0 20px clamp(8px,1.8vh,24px);display:flex;flex-wrap:wrap;gap:2px 16px;font-size:12px;line-height:1.4;color:var(--soft)}
@media (max-width:859px) and (max-height:680px){.brand small,footer{display:none}.brand-mark{width:32px;height:32px}.brand-mark svg{width:22px;height:22px}.eyebrow{margin-top:10px}.facts li{padding:0;border:0;background:none}.facts{gap:7px}}
@media (max-width:340px){h1{font-size:25px}.lead,.facts li,.status p,.contact{font-size:13px}.status button{padding:0 12px;font-size:13px}}
@media (min-width:860px){
  main{max-width:72rem;padding:clamp(20px,4vh,48px) clamp(28px,4vw,48px) 12px;display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr);align-items:center;gap:clamp(40px,6vw,88px)}
  footer{max-width:72rem;padding-inline:clamp(28px,4vw,48px)}
  h1{font-size:clamp(36px,min(4.6vw,8.6vh),64px)}
  .lead{margin-top:clamp(14px,3vh,26px);font-size:clamp(16px,2.6vh,19px);line-height:1.55}
  .facts li{font-size:15px;line-height:1.45;padding:clamp(9px,1.6vh,14px) 16px}
  .status{padding:clamp(11px,1.8vh,16px) 16px}
  .status p{font-size:15px;line-height:1.45}
  .contact{font-size:15px}
  footer{font-size:13px}
}
.watermark{position:fixed;right:-4vw;bottom:-6vh;width:min(34vw,320px);height:auto;opacity:.045;color:var(--ink);pointer-events:none}
@media (prefers-color-scheme:dark){.watermark{color:var(--lime);opacity:.06}}
@media (max-width:720px){.watermark{width:46vw;right:-10vw;bottom:-4vh}}
@media (prefers-reduced-motion:no-preference){
  .hero>*,.side>*{animation:rise .7s cubic-bezier(.2,.7,.2,1) both}
  .hero>:nth-child(2){animation-delay:.06s}.hero>:nth-child(3){animation-delay:.12s}.hero>:nth-child(4){animation-delay:.18s}.side>:nth-child(1){animation-delay:.24s}.side>:nth-child(2){animation-delay:.3s}.side>:nth-child(3){animation-delay:.36s}
  .dot::after{content:'';position:absolute;inset:-3px;border-radius:50%;border:2px solid var(--lime);animation:pulse 2.4s ease-out infinite}
}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes pulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.2);opacity:0}}
`

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="m8.5 12.3 2.3 2.3 4.8-5"/></svg>'
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/></svg>'
const MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7.5 7.5 5.5 7.5-5.5"/></svg>'

/**
 * The whole page. `until` is the planned end (ISO 8601 with offset); without it the page promises
 * "maksymalnie 24 godziny". After `until` has passed it says so instead of showing a stale time.
 */
export function renderMaintenancePage({ until, now = new Date() } = {}) {
  const at = describeUntil(until, now)
  const headline = !at
    ? 'Chwila przerwy. Wracamy najpóźniej <span class="when">za 24 godziny</span>.'
    : at.late
      ? 'Chwila przerwy. Kończymy <span class="when">tak szybko, jak się da</span>.'
      : `Chwila przerwy. Wracamy najpóźniej <span class="when">${esc(at.weekday)} o ${esc(at.time)}</span>.`
  const lead = !at
    ? 'Włączamy docelowy system płatności. To planowane prace: potrwają <strong>maksymalnie 24 godziny</strong>, a jeśli skończymy wcześniej, strona po prostu zacznie działać.'
    : at.late
      ? `Planowaliśmy skończyć ${esc(at.weekday)}, ${esc(at.date)}, o ${esc(at.time)} czasu polskiego, ale prace trwają trochę dłużej. Przepraszamy. Włączamy docelowy system płatności.`
      : `Dokładniej: ${esc(at.weekday)}, ${esc(at.date)}, <strong>najpóźniej o ${esc(at.time)} czasu polskiego</strong>. Włączamy docelowy system płatności. To planowane prace: potrwają <strong>maksymalnie 24 godziny</strong>.`
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#fafbf7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#132923" media="(prefers-color-scheme: dark)">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>Przerwa techniczna – Ogarnij Maturę</title>
<style>${CSS}</style>
</head>
<body>
<main id="main">
  <div class="hero">
    <a class="brand" href="/" aria-label="Ogarnij Maturę"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="${OM_PATH}" fill="currentColor" fill-rule="evenodd"/></svg></span><span>ogarnij maturę.<small>Mniej stresu. Więcej przyszłości.</small></span></a>
    <p class="eyebrow"><span class="dot" aria-hidden="true"></span>Planowana przerwa techniczna</p>
    <h1>${headline}</h1>
    <p class="lead">${lead}</p>
  </div>
  <div class="side">
    <ul class="facts" aria-label="Co warto wiedzieć">
      <li>${CHECK}<span>Twoje konto i postępy są zapisane. Nie musisz nic robić.</span></li>
      <li>${LOCK}<span>Do końca przerwy nie zalogujesz się ani nic nie kupisz.</span></li>
      <li>${MAIL}<span>Link z e-maila mógł wygasnąć. Po przerwie poproś o nowy.</span></li>
    </ul>
    <div class="status" role="status" aria-live="polite">
      <p id="status">Sprawdzamy co minutę i sami Cię przeniesiemy.</p>
      <button id="check" type="button">Sprawdź teraz</button>
    </div>
    <p class="contact">Coś pilnego? <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
  </div>
</main>
<footer><span>© ${now.getFullYear()} Ogarnij Maturę</span><span>Dzięki za cierpliwość.</span></footer>
<svg class="watermark" viewBox="0 0 64 64" aria-hidden="true"><path d="${OM_PATH}" fill="currentColor" fill-rule="evenodd"/></svg>
<script>${MAINTENANCE_SCRIPT}</script>
</body>
</html>
`
}
