import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { publicExamsPlugin } from './scripts/public-exams-plugin.mjs'
import { CKE_SHEETS_PATH, PDF_PROXY_PATH } from './src/lib/exams/pdf.js'

// Canonical address of the site (sitemap, canonical links, OG tags). On Vercel it comes from the
// built-in VERCEL_PROJECT_PRODUCTION_URL, so nothing has to be configured there.
process.env.VITE_SITE_URL ??= process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:5173'

export default defineConfig({
  plugins: [vue(), publicExamsPlugin()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      [PDF_PROXY_PATH]: {
        target: 'https://cke.gov.pl',
        changeOrigin: true,
        rewrite: path => `${CKE_SHEETS_PATH}${path.slice(PDF_PROXY_PATH.length)}`,
      },
    },
  },
})
