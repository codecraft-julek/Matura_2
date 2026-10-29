// Renders scripts/og-image.svg → public/og.png (1200×630, the link preview image).
// Uses the SVG renderer installed with pdfjs-dist; no browser or macOS image tools needed.
// Run it again after changing the SVG and commit the PNG.
//   node scripts/make-og-image.mjs

import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const src = join(root, 'scripts', 'og-image.svg')
const out = join(root, 'public', 'og.png')
const canvas = createCanvas(1200, 630)
const image = await loadImage(readFileSync(src))
canvas.getContext('2d').drawImage(image, 0, 0, 1200, 630)
writeFileSync(out, canvas.toBuffer('image/png'))
console.log(`OG image written to ${out}`)
