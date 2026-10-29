// SEO facts of the public exam pages (/arkusze-maturalne and /arkusze-maturalne/:id), shared by the
// pages and scripts/prerender-public.mjs. Only relative imports with extensions (Node runs it).

import { ROUTES, publicExamRoute } from '../../config/routes.ts'
import { PRODUCT_NAME } from '../../config/site.ts'
import { SESSION_LABEL, SUBJECT_LABEL } from '../../lib/exams/labels.ts'
import { LEVEL_SHORT, examHeadline, tasksLabel } from '../../lib/exams/public.ts'
import { crumb } from './seo.js'

/** Title + description of one public exam page (e.g. /arkusze-maturalne/2025-maj-angielski-pp). */
export function examSeo(exam) {
  return {
    path: publicExamRoute(exam.id),
    title: `${examHeadline(exam)} – arkusz z odpowiedziami online`,
    description: `Arkusz CKE: ${SUBJECT_LABEL[exam.subject].toLowerCase()}, poziom ${LEVEL_SHORT[exam.level]}, ${SESSION_LABEL[exam.session]} ${exam.year}. ${tasksLabel(exam.taskCount)}, ${exam.maxPoints} pkt, ${exam.durationMinutes} min. Rozwiąż online i sprawdź odpowiedzi według klucza.`,
  }
}

export function examJsonLd(exam, siteUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      crumb(1, PRODUCT_NAME, siteUrl),
      crumb(2, 'Arkusze maturalne', `${siteUrl}${ROUTES.publicExams}`),
      crumb(3, examHeadline(exam), `${siteUrl}${publicExamRoute(exam.id)}`),
    ],
  }
}

export function examListJsonLd(exams, siteUrl) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [crumb(1, PRODUCT_NAME, siteUrl), crumb(2, 'Arkusze maturalne', `${siteUrl}${ROUTES.publicExams}`)],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: exams.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: examHeadline(e), url: `${siteUrl}${publicExamRoute(e.id)}` })),
    },
  ]
}
