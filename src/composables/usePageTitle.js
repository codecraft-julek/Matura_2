// Sets document.title for pages whose title depends on loaded data ("Lalka · Fiszki").
// Static titles come from route meta.title (router/index.js).

import { watchEffect } from 'vue'
import { PRODUCT_NAME } from '@/config/site'

export const fullTitle = title => (title ? `${title} · ${PRODUCT_NAME}` : `${PRODUCT_NAME} — małe kroki, duży progres.`)

export function usePageTitle(getTitle) {
  watchEffect(() => {
    const title = getTitle()
    if (title) document.title = fullTitle(title)
  })
}
