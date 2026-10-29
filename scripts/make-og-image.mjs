// Renders scripts/og-image.svg → public/og.png (1200×630, the link preview image).
// macOS only (uses the built-in `sips`); run it again after changing the SVG and commit the PNG.
//   node scripts/make-og-image.mjs

import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const src = join(root, 'scripts', 'og-image.svg')
const out = join(root, 'public', 'og.png')
execFileSync('sips', ['-s', 'format', 'png', src, '--out', out], { stdio: 'inherit' })
console.log(`OG image written to ${out}`)
