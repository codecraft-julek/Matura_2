// Canonical OM artwork: a shared 10-unit upright joins the O and M on a 64-unit grid.
// The O counter is deliberately wide (12 units); there are no overlapping strokes.
export const OM_PATH = 'M17 8H35L43 26L51 8H61V56H51V29L46 41H40L35 29V42C35 49.732 28.732 56 21 56H17C9.268 56 3 49.732 3 42V22C3 14.268 9.268 8 17 8ZM17 18C14.791 18 13 19.791 13 22V42C13 44.209 14.791 46 17 46H21C23.209 46 25 44.209 25 42V22C25 19.791 23.209 18 21 18Z'
export const BRAND_COLORS = Object.freeze({ ink: '#1c3c32', lime: '#d7f781', paper: '#fafbf7' })
export const BRAND_METRICS = Object.freeze({ grid: 64, stroke: 10, counter: 12, clearSpace: 10, minimumMark: 16 })

// These helpers are for our build scripts and static prerenderer, using trusted brand constants.
export function markSvg({ color = BRAND_COLORS.ink, decorative = false } = {}) {
  const accessibility = decorative ? 'aria-hidden="true"' : 'role="img" aria-label="Ogarnij Maturę — monogram OM"'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" ${accessibility}><path d="${OM_PATH}" fill="${color}" fill-rule="evenodd"/></svg>`
}

export function badgeSvg({ compact = false } = {}) {
  // The favicon gets larger artwork, not the padding intended for a large social avatar.
  const scale = compact ? 0.96 : 0.82
  const offset = (64 - 64 * scale) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${BRAND_COLORS.ink}"/><path d="${OM_PATH}" fill="${BRAND_COLORS.lime}" fill-rule="evenodd" transform="translate(${offset} ${offset}) scale(${scale})"/></svg>`
}
