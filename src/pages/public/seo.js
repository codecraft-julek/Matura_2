// SEO facts of the public pages (titles, descriptions, canonical paths, JSON-LD), shared by:
//   - the pages themselves (applyHead() keeps <head> right while the SPA navigates),
//   - scripts/prerender-public.mjs (writes the same tags into static HTML for crawlers).
// Only relative imports with file extensions here: Node runs this file directly in the build.

// Exam pages live in seo-exams.js (it pulls in the exam content schema, which the other pages
// don't need).

import { ROUTES } from '../../config/routes.ts'
import { PRODUCT_NAME } from '../../config/site.ts'

/** Same rule as usePageTitle's fullTitle (kept here because Node can't resolve "@/"). */
export const fullTitle = title => (title ? `${title} · ${PRODUCT_NAME}` : `${PRODUCT_NAME} — małe kroki, duży progres.`)

export const OG_IMAGE = { path: '/og.png', width: 1200, height: 630, alt: `${PRODUCT_NAME} – arkusze maturalne ze sprawdzaniem, feedback AI i fiszki` }

export const PAGE_SEO = {
  home: {
    path: ROUTES.home,
    title: 'Arkusze maturalne CKE, feedback AI i fiszki',
    description: 'Prawdziwe arkusze maturalne CKE z polskiego i angielskiego sprawdzane od razu według klucza, feedback AI do wypracowań, notatki AI i fiszki. Darmowe konto na start.',
  },
  publicExams: {
    path: ROUTES.publicExams,
    title: 'Arkusze maturalne CKE z odpowiedziami – polski i angielski',
    description: 'Wszystkie arkusze maturalne CKE w formule 2023 z polskiego i angielskiego (poziom podstawowy i rozszerzony). Rozwiązuj online i od razu sprawdzaj odpowiedzi.',
  },
  contact: {
    path: ROUTES.contact,
    title: 'Kontakt',
    description: 'Napisz do nas: pytanie, błąd w aplikacji, pomysł albo współpraca. Czytamy każdą wiadomość.',
  },
  signup: {
    path: ROUTES.signup,
    title: 'Załóż konto',
    description: 'Załóż darmowe konto w Ogarnij Maturę: arkusze CKE i fiszki bez limitu, narzędzia AI z darmowym limitem. Bez karty płatniczej.',
  },
  terms: { path: ROUTES.terms, title: 'Regulamin', description: `Regulamin serwisu ${PRODUCT_NAME}.`, noindex: true },
  privacy: { path: ROUTES.privacy, title: 'Polityka prywatności', description: `Jak ${PRODUCT_NAME} przetwarza Twoje dane.`, noindex: true },
  goodbye: { path: ROUTES.goodbye, title: 'Konto usunięte', description: 'Twoje konto zostało usunięte.', noindex: true },
}

// ─── JSON-LD ────────────────────────────────────────────────────────────────

export const crumb = (position, name, item) => ({ '@type': 'ListItem', position, name, item })

export function homeJsonLd(faqs, siteUrl) {
  return [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: PRODUCT_NAME, url: siteUrl, inLanguage: 'pl-PL' },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    },
  ]
}

/** JSON for a <script type="application/ld+json">: "<" escaped so it can never close the tag. */
export const jsonLdText = data => JSON.stringify(data).replace(/</g, '\\u003c')

// ─── <head> tags ────────────────────────────────────────────────────────────

/**
 * Every SEO tag of one page as plain descriptors, so the browser (applyHead) and the prerender
 * script (string output) produce exactly the same set.
 */
export function headTags({ title, description, path, jsonLd, noindex = false, ogType = 'website' }, siteUrl) {
  const url = `${siteUrl}${path === '/' ? '' : path}` || siteUrl
  const image = `${siteUrl}${OG_IMAGE.path}`
  const tags = [
    { tag: 'meta', attrs: { name: 'description', content: description } },
    { tag: 'link', attrs: { rel: 'canonical', href: url } },
    { tag: 'meta', attrs: { property: 'og:type', content: ogType } },
    { tag: 'meta', attrs: { property: 'og:site_name', content: PRODUCT_NAME } },
    { tag: 'meta', attrs: { property: 'og:locale', content: 'pl_PL' } },
    { tag: 'meta', attrs: { property: 'og:title', content: fullTitle(title) } },
    { tag: 'meta', attrs: { property: 'og:description', content: description } },
    { tag: 'meta', attrs: { property: 'og:url', content: url } },
    { tag: 'meta', attrs: { property: 'og:image', content: image } },
    { tag: 'meta', attrs: { property: 'og:image:width', content: String(OG_IMAGE.width) } },
    { tag: 'meta', attrs: { property: 'og:image:height', content: String(OG_IMAGE.height) } },
    { tag: 'meta', attrs: { property: 'og:image:alt', content: OG_IMAGE.alt } },
    { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
  ]
  if (noindex) tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex' } })
  for (const data of [jsonLd ?? []].flat()) tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, text: jsonLdText(data) })
  return tags
}

/**
 * Browser only: puts the page's SEO tags into <head> (replacing the prerendered ones, which carry
 * data-seo too) and sets the title. Returns a cleanup that removes them again, so pages behind the
 * login never inherit a public page's canonical link or JSON-LD.
 */
export function applyHead(page, siteUrl) {
  document.title = fullTitle(page.title)
  for (const el of document.head.querySelectorAll('[data-seo]')) el.remove()
  const description = document.head.querySelector('meta[name="description"]:not([data-seo])')
  const created = headTags(page, siteUrl).map(({ tag, attrs, text }) => {
    if (tag === 'meta' && attrs.name === 'description' && description) {
      description.setAttribute('content', attrs.content)
      return null
    }
    const el = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    if (text) el.textContent = text
    el.setAttribute('data-seo', '')
    document.head.appendChild(el)
    return el
  }).filter(Boolean)
  return () => {
    for (const el of created) el.remove()
    if (description && description.getAttribute('content') === page.description) description.setAttribute('content', PAGE_SEO.home.description)
  }
}
