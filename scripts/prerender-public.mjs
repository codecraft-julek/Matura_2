// Runs after `vite build` (npm run build). Crawlers and link previews don't run our JavaScript, so
// this writes a static HTML file for every public page that should be found on Google:
//   /  /arkusze-maturalne  /arkusze-maturalne/<id> (each exam)  /kontakt  /rejestracja
// Each file is dist/index.html with that page's <title>, description, canonical link, OG tags and
// JSON-LD, plus a readable version of the page inside #app (Vue replaces it when it mounts).
// It also writes dist/sitemap.xml, dist/robots.txt and dist/spa.html (the untouched app shell, the
// right target for the SPA rewrite of non-prerendered routes).
//
// Titles, descriptions and JSON-LD come from src/pages/public/seo*.js, the same code the pages use
// in the browser, so the static and the live <head> never drift apart.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { loadPublicExams } from './public-exams-plugin.mjs'
import { PAGE_SEO, fullTitle, headTags, homeJsonLd } from '../src/pages/public/seo.js'
import { examJsonLd, examListJsonLd, examSeo } from '../src/pages/public/seo-exams.js'
import { faqs } from '../src/data.js'
import { PLAN_DETAILS } from '../src/components/premium/planDetails.js'
import { PLANS } from '../src/config/plans.ts'
import { PRODUCT_NAME, SITE } from '../src/config/site.ts'
import { ROUTES, checkoutRoute, examRoutes, publicExamRoute } from '../src/config/routes.ts'
import { SECTION_LABEL, SESSION_LABEL, SUBJECT_LABEL } from '../src/lib/exams/labels.ts'
import { LEVEL_SHORT, SUBJECT_FROM, examHeadline, tasksLabel } from '../src/lib/exams/public.ts'

const DIST = join(import.meta.dirname, '..', 'dist')
const EXAM_DEMO = '/trening/polski-2026'

// Same rule as vite.config.js (on Vercel: the production domain).
const SITE_URL = (process.env.VITE_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:5173')).replace(/\/+$/, '')

// ─── HTML helpers ───────────────────────────────────────────────────────────

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const attrs = obj => Object.entries(obj).map(([k, v]) => ` ${k}="${esc(v)}"`).join('')
const a = (href, text, cls = '') => `<a href="${esc(href)}"${cls ? ` class="${cls}"` : ''}>${esc(text)}</a>`
const ext = (href, text) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" class="link">${esc(text)} ↗</a>`
const ul = (items, cls = '') => `<ul${cls ? ` class="${cls}"` : ''}>${items.map(i => `<li>${i}</li>`).join('')}</ul>`

const BRAND_SVG = '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32.5 5.2C35.3 2.3 40.7 4.1 40.3 8.2L37.8 23.7C43.1 21.3 47.6 17.6 52 17.1C56 16.7 59 21 55.4 24.3L43 33L56 39.4C60.6 41.3 59.2 47.4 54.7 47.7C50.2 48 43.8 44.8 38.7 43L39.5 55.9C39.7 61.2 32.2 62.8 30.2 57.6L25.8 42.9L14.4 52.6C10.4 55.9 5.4 51 8.2 46.8L19.7 34.2L7.2 29.4C2.5 27.4 5.1 20.2 9.9 21.6L23.8 26.1L28.1 10.3C29.2 7.9 30.9 6.5 32.5 5.2Z" fill="currentColor"/></svg>'
const brand = `<a href="/" class="brand" aria-label="${esc(PRODUCT_NAME)} — strona główna"><span class="brand-icon">${BRAND_SVG}</span><span>ogarnij<span class="brand-second">maturę.</span></span></a>`

/** The public site frame (mirrors src/layouts/PublicLayout.vue). */
function publicShell(main) {
  const nav = [['/#narzedzia', 'Narzędzia'], [ROUTES.publicExams, 'Arkusze maturalne'], ['/#cennik', 'Cennik'], ['/#faq', 'FAQ']]
  return `<div class="public-shell">
<header class="site-header"><div class="container header-inner">${brand}<nav class="desktop-navigation" aria-label="Menu główne">${nav.map(([h, t]) => a(h, t)).join('')}</nav><div class="header-actions">${a(ROUTES.login, 'Zaloguj się', 'text-button desktop-demo')}${a(ROUTES.signup, 'Załóż konto', 'button button-dark header-cta')}</div></div></header>
<main id="main" style="flex:1">${main}</main>
<footer class="site-footer container"><div class="footer-top">${brand}<p>Mniej stresu. Więcej przyszłości.</p><nav aria-label="Menu w stopce">${a(ROUTES.publicExams, 'Arkusze maturalne')}${a(ROUTES.contact, 'Kontakt')}${a(ROUTES.terms, 'Regulamin')}${a(ROUTES.privacy, 'Polityka prywatności')}</nav></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(PRODUCT_NAME)}</span><span>Nie jesteśmy powiązani z CKE.</span></div></footer>
</div>`
}

// ─── Page bodies (readable text; the live pages are richer) ─────────────────

function homeBody() {
  const plans = PLANS.map(p => {
    const d = PLAN_DETAILS[p.id]
    const cta = p.id === 'free' ? a(ROUTES.signup, 'Załóż darmowe konto', 'link') : a(checkoutRoute(p.id), p.cta, 'link')
    return `<h3>${esc(p.name)}: ${esc(p.price)} <small>(${esc(p.period)})</small></h3>${p.note ? `<p>${esc(p.note)}</p>` : ''}${ul(d.features.map(esc))}<p>${cta}</p>`
  }).join('')
  return `<div class="public-page prose">
<h1>Matura? Spokojnie, ogarniesz.</h1>
<p>Prawdziwe arkusze CKE sprawdzane od razu, feedback AI do wypracowań, notatki i fiszki. Twój plan na maturę z polskiego i angielskiego. Bez spiny.</p>
<p>${a(ROUTES.signup, 'Załóż darmowe konto', 'button button-lime')} ${a(EXAM_DEMO, 'Wypróbuj bez konta', 'link')} · ${a(ROUTES.login, 'Zaloguj się', 'link')}</p>
<h2>Twój toolkit: 4 narzędzia, jeden cel</h2>
<h3>Arkusze CKE. Bez niespodzianek.</h3><p>Majowe arkusze CKE 2023–2026 z polskiego i angielskiego. W trybie ćwiczeń wiesz po każdym zadaniu, co poszło dobrze według klucza CKE. W trybie egzaminu leci zegar. ${a(ROUTES.publicExams, 'Zobacz wszystkie arkusze', 'link')}</p>
<h3>Feedback AI do wypracowań</h3><p>Uwagi kryterium po kryterium według zasad CKE: co już działa, co poprawić i od czego zacząć. Z angielskiego też.</p>
<h3>Notatki AI</h3><p>Wrzucasz zdjęcie zeszytu, PDF albo prezentację z lekcji. Dostajesz oś czasu, tabelę porównawczą, mapę myśli, fiszki i krótki quiz.</p>
<h3>Fiszki</h3><p>Z PDF-a, Worda, strony albo filmu, z powtórkami, które układają się same. Import z Quizletu i Anki.</p>
<p>I jeszcze: egzamin na czas i tutor AI przy zadaniu, który najpierw podpowiada, a rozwiązanie pokazuje dopiero, gdy poprosisz.</p>
<h2>Jak to działa?</h2>
<ol><li>Załóż darmowe konto. Pół minuty, bez karty płatniczej.</li><li>Poćwicz po swojemu: arkusz, wypracowanie, notatka czy fiszki.</li><li>Sprawdź wynik według klucza CKE i konkretne wskazówki, co dalej.</li></ol>
<h2>Kto za tym stoi?</h2>
<p>Dwójka studentów, którzy dopiero co sami zdawali maturę. Pamiętamy czekanie tydzień na sprawdzone wypracowanie, więc robimy narzędzie, którego nam wtedy brakowało. ${a(ROUTES.contact, 'Napisz do nas', 'link')}.</p>
<h2>Cennik: dobry start kosztuje zero</h2>
<p>Arkusze CKE i fiszki są darmowe bez limitu. Premium daje więcej narzędzi AI, kiedy nauka przyspiesza.</p>
${plans}
<h2>Pytania</h2>
${faqs.map(f => `<h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p>`).join('')}
<p>${a(ROUTES.signup, 'Jasne, zakładam konto', 'button button-dark')}</p>
</div>`
}

function examListBody(exams) {
  const years = [...new Set(exams.map(e => e.year))]
  return `<div class="public-page prose">
<h1>Arkusze maturalne CKE z odpowiedziami</h1>
<p>Prawdziwe arkusze z polskiego i angielskiego. Czytasz oficjalny PDF z CKE, a odpowiedzi wpisujesz u nas: zadania zamknięte sprawdzamy od razu według klucza, a wypracowanie i odpowiedzi otwarte ocenia AI.</p>
${years.map(year => `<h2>Matura ${year}</h2>${ul(exams.filter(e => e.year === year).map(e =>
    `${a(publicExamRoute(e.id), `${SUBJECT_LABEL[e.subject]}, poziom ${LEVEL_SHORT[e.level]} (${SESSION_LABEL[e.session]} ${e.year})`)}: ${e.maxPoints} pkt · ${e.durationMinutes} min · ${esc(tasksLabel(e.taskCount))}`))}`).join('\n')}
<h2>Rozwiązuj z automatycznym sprawdzaniem</h2>
<p>Arkusze i sprawdzanie zadań zamkniętych są darmowe, bez limitu. ${a(ROUTES.signup, 'Załóż darmowe konto', 'link')}</p>
<p><small>Arkusze i zasady oceniania są własnością Centralnej Komisji Egzaminacyjnej i otwieramy je bezpośrednio z cke.gov.pl. Nie jesteśmy powiązani z CKE.</small></p>
</div>`
}

const KIND_LABEL = { choice: 'zamknięte', open: 'otwarte', writing: 'wypowiedź pisemna' }

function examBody(exam, all) {
  const closed = exam.groups.filter(g => g.kind === 'choice').reduce((s, g) => s + g.points, 0)
  const sections = new Map()
  for (const g of exam.groups) sections.set(g.section, (sections.get(g.section) ?? 0) + g.points)
  const s = exam.sources
  const materials = [
    [exam.subject === 'polish' && s.sheet2 ? 'Arkusz 1 (PDF)' : 'Arkusz (PDF)', s.sheet],
    ['Arkusz 2 – wypracowanie (PDF)', s.sheet2],
    ['Zasady oceniania (PDF)', s.key],
    ['Nagrania do rozumienia ze słuchu', s.audio],
  ].filter(([, href]) => href)
  const others = all.filter(e => e.id !== exam.id && e.subject === exam.subject).slice(0, 6)
  const words = g => (g.words ? ` · ${g.words[1] ? `${g.words[0]}–${g.words[1]}` : `min. ${g.words[0]}`} wyrazów` : '')
  return `<article class="public-page prose">
<nav aria-label="Ścieżka">${a(ROUTES.publicExams, 'Arkusze maturalne')} / ${exam.year}</nav>
<h1>${esc(examHeadline(exam))}</h1>
<p>Arkusz CKE z sesji: ${esc(SESSION_LABEL[exam.session])} ${exam.year}, formuła 2023. ${exam.maxPoints} punktów, ${exam.durationMinutes} minut, ${esc(tasksLabel(exam.taskCount))}.</p>
<h2>Rozwiąż ten arkusz online</h2>
${ul([
    closed > 0 && `zadania zamknięte (${closed} pkt) sprawdzamy od razu według klucza CKE`,
    exam.groups.some(g => g.kind === 'open') && `odpowiedzi otwarte porównasz z opisem punktacji${exam.subject === 'polish' ? ', a AI zaproponuje punkty' : ''}`,
    exam.groups.some(g => g.kind === 'writing') && 'wypracowanie oceni AI według kryteriów CKE, z uwagami do poprawy',
    'tryb egzaminu z zegarem albo spokojne ćwiczenia z podpowiedziami tutora AI',
  ].filter(Boolean).map(esc))}
<p>${a(ROUTES.signup, 'Rozwiąż za darmo', 'button button-lime')} ${a(examRoutes.overview(exam.id), 'Mam konto, otwórz arkusz', 'link')}</p>
<h2>Co jest w arkuszu</h2>
${ul([...sections].map(([sec, pts]) => `${esc(SECTION_LABEL[sec] ?? sec)}: <strong>${pts} pkt</strong>`))}
<ol>${exam.groups.map(g => `<li><strong>Zadanie ${g.no}.</strong> ${esc(g.label)} (${KIND_LABEL[g.kind]}${g.items > 1 ? ` · ${g.items} części` : ''}${words(g)}) · ${g.points} pkt</li>`).join('')}</ol>
<h2>Oficjalne materiały CKE</h2>
<p>Treść zadań czytasz w oryginalnym arkuszu. Linki prowadzą prosto na cke.gov.pl.</p>
${ul(materials.map(([label, href]) => ext(href, label)))}
${others.length ? `<h2>Inne arkusze ${SUBJECT_FROM[exam.subject]}</h2>${ul(others.map(e => a(publicExamRoute(e.id), `${e.year}, poziom ${LEVEL_SHORT[e.level]}`)))}<p>${a(ROUTES.publicExams, 'Wszystkie arkusze', 'link')}</p>` : ''}
<p><small>Arkusze i zasady oceniania są własnością Centralnej Komisji Egzaminacyjnej. Nie jesteśmy powiązani z CKE; opisy zadań na tej stronie są nasze.</small></p>
</article>`
}

function contactBody() {
  return `<div class="public-page prose">
<h1>Kontakt</h1>
<p>Pytanie, coś nie działa albo masz pomysł, co dodać? Napisz, czytamy każdą wiadomość. Odpowiadamy zwykle w ciągu 1–2 dni.</p>
<p>Formularz kontaktowy działa po włączeniu JavaScriptu. Możesz też napisać na <a href="mailto:${esc(SITE.contactEmail)}">${esc(SITE.contactEmail)}</a>.</p>
<p>Twoje dane wykorzystamy tylko do odpowiedzi. Więcej w ${a(ROUTES.privacy, 'polityce prywatności')}.</p>
</div>`
}

/** /rejestracja uses the centered auth layout (src/layouts/AuthLayout.vue). */
function signupPage() {
  const free = PLAN_DETAILS.free.features
  return `<div class="auth-shell">${brand}<main id="main" class="auth-card">
<h1>Załóż darmowe konto</h1>
<p class="auth-lead">Arkusze CKE i fiszki bez limitu, narzędzia AI z darmowym limitem. Bez karty płatniczej, zajmie Ci pół minuty.</p>
${ul(free.map(esc), 'prerender-list')}
<p class="auth-foot">Formularz rejestracji działa po włączeniu JavaScriptu. Masz już konto? ${a(ROUTES.login, 'Zaloguj się', 'link')}</p>
</main><nav class="auth-legal" aria-label="Dokumenty">${a(ROUTES.terms, 'Regulamin')}${a(ROUTES.privacy, 'Polityka prywatności')}${a(ROUTES.contact, 'Kontakt')}</nav></div>`
}

// ─── Writing the files ──────────────────────────────────────────────────────

const indexPath = join(DIST, 'index.html')
const spaPath = join(DIST, 'spa.html')
if (!existsSync(indexPath)) {
  console.error('prerender-public: dist/index.html is missing, run `vite build` first.')
  process.exit(1)
}
// Re-running the script without a new build must not stack prerendered content: start from the
// clean shell saved by the previous run when there is one.
const template = existsSync(spaPath) ? readFileSync(spaPath, 'utf8') : readFileSync(indexPath, 'utf8')
if (!template.includes('<div id="app"></div>') || !/<meta name="theme-color"/.test(template)) {
  console.error('prerender-public: dist/index.html must contain <meta name="theme-color"> and <div id="app"></div>.')
  process.exit(1)
}
const shell = template
  .replace(/\s*<meta data-seo[^>]*>/g, '')
  .replace(/\s*<!-- Default link-preview tags[\s\S]*?-->/, '')
  .replace(/\s*<meta name="description"[^>]*>/, '')
  .replace(/\s*<title>[\s\S]*?<\/title>/, '')
writeFileSync(spaPath, template)

function render(page, body) {
  const tags = headTags(page, SITE_URL).map(({ tag, attrs: at, text }) =>
    tag === 'meta' && at.name === 'description' ? `<meta${attrs(at)} />`
      : tag === 'script' ? `<script data-seo${attrs(at)}>${text}</script>`
        : `<${tag} data-seo${attrs(at)} />`)
  const head = `\n    <title>${esc(fullTitle(page.title))}</title>\n    ${tags.join('\n    ')}`
  return shell
    .replace(/(<meta name="theme-color"[^>]*>)/, `$1${head}`)
    .replace('<div id="app"></div>', `<div id="app">${body}</div>`)
}

const written = []
function write(path, html) {
  const file = path === '/' ? indexPath : join(DIST, path, 'index.html')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
  written.push(path)
}

const exams = loadPublicExams()

write(ROUTES.home, render({ ...PAGE_SEO.home, jsonLd: homeJsonLd(faqs, SITE_URL) }, publicShell(homeBody())))
write(ROUTES.publicExams, render({ ...PAGE_SEO.publicExams, jsonLd: examListJsonLd(exams, SITE_URL) }, publicShell(examListBody(exams))))
for (const exam of exams) write(publicExamRoute(exam.id), render({ ...examSeo(exam), jsonLd: examJsonLd(exam, SITE_URL) }, publicShell(examBody(exam, exams))))
write(ROUTES.contact, render(PAGE_SEO.contact, publicShell(contactBody())))
write(ROUTES.signup, render(PAGE_SEO.signup, signupPage()))

// External Stripe returns are full document loads, not client-side navigation. Give these
// entry points their own shell as well as the Vercel fallback; never prerender paid access.
for (const path of [ROUTES.checkout, ROUTES.premiumDone]) {
  write(path, template.replace('</head>', '<meta name="robots" content="noindex, nofollow" /></head>'))
}

// /sitemap.xml: every public page, so Google finds the exam pages quickly. Submit it once in
// Google Search Console. Terms and privacy join once the lawyer review is done (noindex until then).
const sitemapEntries = [
  [ROUTES.home, 1, 'weekly'],
  [ROUTES.publicExams, 0.9, 'monthly'],
  ...exams.map(e => [publicExamRoute(e.id), 0.8, 'yearly']),
  [ROUTES.signup, 0.5, 'yearly'],
  [ROUTES.contact, 0.3, 'yearly'],
]
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(([path, priority, freq]) => `  <url><loc>${esc(`${SITE_URL}${path === '/' ? '' : path}`)}</loc><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`).join('\n')}
</urlset>
`)

// /robots.txt: pages behind the login are useless to search engines (they'd only see the login
// page), so we keep them out.
const privatePages = [
  ROUTES.dashboard, ROUTES.onboarding, ROUTES.account,
  `${ROUTES.exams}/`, // the app's exams; the public /arkusze-maturalne pages stay indexable
  ROUTES.essays, ROUTES.tutor, ROUTES.notes, ROUTES.flashcards, ROUTES.premium, ROUTES.newPassword, ROUTES.goodbye,
  '/auth/',
]
writeFileSync(join(DIST, 'robots.txt'), `User-Agent: *
Allow: /
${privatePages.map(p => `Disallow: ${p}`).join('\n')}

Sitemap: ${SITE_URL}/sitemap.xml
`)

console.log(`prerender-public: ${written.length} pages, sitemap.xml (${sitemapEntries.length} URLs), robots.txt, spa.html · ${SITE_URL}`)
