// Vite plugin: `import publicExams from 'virtual:public-exams'` gives the sanitized exam list
// (structure only, no answers) built from content/exams/*.json at build time.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sortPublicExams, toPublicExam } from '../src/lib/exams/public.ts'

const ID = 'virtual:public-exams'
const RESOLVED = '\0' + ID
export const CONTENT_DIR = join(import.meta.dirname, '..', 'content', 'exams')

export function loadPublicExams() {
  const files = readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'))
  return sortPublicExams(files.map(f => toPublicExam(JSON.parse(readFileSync(join(CONTENT_DIR, f), 'utf8')))))
}

export function publicExamsPlugin() {
  return {
    name: 'public-exams',
    resolveId(id) { return id === ID ? RESOLVED : null },
    load(id) {
      if (id !== RESOLVED) return null
      for (const f of readdirSync(CONTENT_DIR)) this.addWatchFile(join(CONTENT_DIR, f))
      return `export default ${JSON.stringify(loadPublicExams())}`
    },
  }
}
