// Generate every SVG from the same geometry as the Vue component.
// Run `npm run brand:build` after changing src/brand/identity.js.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createCanvas, GlobalFonts, SvgExportFlag } from '@napi-rs/canvas'
import { OM_PATH, BRAND_COLORS, markSvg, badgeSvg } from '../src/brand/identity.js'

const root = join(import.meta.dirname, '..')
const output = join(root, 'public')
mkdirSync(join(output, 'brand'), { recursive: true })
const assets = {
  'logo.svg': markSvg(),
  'favicon.svg': badgeSvg({ compact: true }),
  'brand/om-avatar.svg': badgeSvg(),
  'brand/om-lime.svg': markSvg({ color: BRAND_COLORS.lime }),
  'brand/om-black.svg': markSvg({ color: '#000000' }),
  'brand/om-white.svg': markSvg({ color: '#ffffff' }),
}
for (const [name, svg] of Object.entries(assets)) writeFileSync(join(output, name), `${svg}\n`)

const socialSource = join(root, 'scripts/og-image.svg')
const social = readFileSync(socialSource, 'utf8')
if (!social.includes('<!-- BRAND:START -->') || !social.includes('<!-- BRAND:END -->')) throw new Error('Missing brand template boundaries')
// Outline the wordmark so SVG consumers need no installed font and retain Polish glyphs.
for (const subset of ['latin', 'latin-ext']) {
  if (!GlobalFonts.registerFromPath(join(root, `node_modules/@fontsource-variable/manrope/files/manrope-${subset}-wght-normal.woff2`), 'Manrope')) throw new Error(`Cannot load Manrope ${subset}`)
}
const wordmark = createCanvas(1200, 630, SvgExportFlag.ConvertTextToPaths)
const context = wordmark.getContext('2d')
context.font = '750 29px Manrope'
context.fontVariationSettings = '"wght" 750'
context.letterSpacing = '-1px'
context.fillStyle = BRAND_COLORS.ink
context.fillText('ogarnij', 154, 94)
context.fillText('maturę.', 154, 125)
const outlinedName = wordmark.getContent().toString().match(/<svg\b[^>]*>([\s\S]*)<\/svg>/)[1].trim()
writeFileSync(socialSource, social.replace(/<!-- BRAND:START -->[\s\S]*?<!-- BRAND:END -->/, `<!-- BRAND:START -->
  <path d="${OM_PATH}" fill-rule="evenodd" fill="${BRAND_COLORS.ink}" transform="translate(72 62) scale(1.06)"/>
  ${outlinedName}
  <!-- BRAND:END -->`))
console.log('Brand SVGs and social artwork generated from the canonical OM monogram.')
