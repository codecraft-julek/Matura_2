// Validate the deployed artifacts, not just Vite's dev-server history fallback.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROUTES } from '../src/config/routes.ts'

const root = join(import.meta.dirname, '..')
const dist = join(root, 'dist')
const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
const rewrite = config.rewrites.find(rule => rule.destination.startsWith('/spa'))
assert(rewrite, 'Missing SPA fallback')
assert(!config.cleanUrls || !rewrite.destination.endsWith('.html'), 'cleanUrls requires an extensionless rewrite destination')
const fallback = join(dist, `${rewrite.destination}${config.cleanUrls ? '.html' : ''}`)
assert(existsSync(fallback), 'The deployed SPA rewrite target must exist')
for (const path of [ROUTES.checkout, ROUTES.premiumDone]) {
  const html = readFileSync(join(dist, path, 'index.html'), 'utf8')
  assert(html.includes('<div id="app"></div>'), `${path} must boot the app, never prerender account data`)
  assert(html.includes('noindex'), `${path} must not be indexed`)
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match => match[1])
  assert(scripts.length > 0, `${path} needs a script entry point`)
  for (const script of scripts) assert(existsSync(join(dist, script)), `${path}: missing script ${script}`)
}
console.log('Checkout build verified: Vercel fallback, direct payment entry pages, and script assets.')
