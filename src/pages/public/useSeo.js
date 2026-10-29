// Keeps the SEO tags of a public page in <head> while it is shown (see seo.js).
//   useSeo(() => PAGE_SEO.contact)  or  useSeo(() => exam.value && { ...examSeo(exam.value), jsonLd })

import { onBeforeUnmount, watchEffect } from 'vue'
import { SITE } from '@/config/site'
import { applyHead } from './seo'

export function useSeo(getPage) {
  let cleanup = null
  watchEffect(() => {
    cleanup?.()
    const page = getPage()
    cleanup = page ? applyHead(page, SITE.url) : null
  })
  onBeforeUnmount(() => cleanup?.())
}
