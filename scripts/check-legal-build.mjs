// Verify actual deployment artifacts: policy pages must be readable without JavaScript and
// document downloads must survive Vercel's clean-URL redirect without becoming the SPA shell.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { legalDocuments } from '../src/content/legal/documents.js'
import { documentDownloadPath } from '../src/content/legal/render.js'

const root = join(import.meta.dirname, '..')
const dist = join(root, 'dist')
const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
const fallback = new RegExp(`^${config.rewrites.find(rule => rule.destination.startsWith('/spa')).source}$`)
for (const doc of legalDocuments) {
  const page = readFileSync(join(dist, doc.path, 'index.html'), 'utf8')
  assert(page.includes('<h1>') && page.includes(doc.title), `${doc.path}: missing readable document`)
  assert(!page.includes('<div id="app"></div>'), `${doc.path}: cannot be an empty SPA shell`)
  for (const section of doc.sections) assert(page.includes(`id="${section.id}"`), `${doc.path}: missing section ${section.id}`)
  const path = documentDownloadPath(doc)
  const copy = readFileSync(join(dist, path), 'utf8')
  assert(copy.includes(doc.version) && copy.includes('lang="pl"'), `${path}: missing version or language`)
  assert(!copy.includes('<script'), `${path}: downloadable copy must be independent of JavaScript`)
  assert(!fallback.test(path.replace(/\.html$/, '')), `${path}: clean URL must not be rewritten to SPA`)
}
assert(existsSync(join(dist, 'dokumenty/formularz-odstapienia.txt')), 'Missing withdrawal form')
console.log('Legal build verified: readable policy pages, versioned downloads, withdrawal form, and hosting routes.')
