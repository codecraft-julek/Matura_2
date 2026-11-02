import { defineConfig } from 'vitest/config'
import base from './vitest.config.js'

// Integration tests hit the real Supabase project (network, slower). Not run in CI by default.
// Own config on purpose: merging with vitest.config.js would add these files to both of its
// projects (every live test twice, next to all unit tests). One file at a time keeps the
// number of test accounts signing up at once low (Supabase rate-limits signups).
export default defineConfig({
  plugins: base.plugins,
  resolve: base.resolve,
  test: { include: ['tests/integration/**/*.test.ts'], testTimeout: 20_000, hookTimeout: 30_000, fileParallelism: false },
})
