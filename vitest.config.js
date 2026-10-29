import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests: fast, no network. `npm test`.
// Integration tests (tests/integration) talk to the real Supabase project: `npm run test:integration`.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,js}', 'tests/*.test.{ts,js}', 'supabase/functions/_shared/**/*.test.ts'],
  },
})
