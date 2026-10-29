import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Unit tests: fast, no network. `npm test`.
// Integration tests (tests/integration) talk to the real Supabase project: `npm run test:integration`.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    projects: [
      { extends: true, test: {
        name: 'unit',
        include: ['src/**/*.test.{ts,js}', 'tests/*.test.{ts,js}', 'supabase/functions/_shared/**/*.test.ts'],
        exclude: ['src/components/exams/ExamPdfViewer.test.js'],
      } },
      { extends: true, test: {
        name: 'pdf-viewers',
        include: ['src/components/exams/ExamPdfViewer.test.js'],
        environment: './tests/vue-host-environment.js',
      } },
    ],
  },
})
