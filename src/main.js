import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { inject } from '@vercel/analytics'
import '@fontsource-variable/manrope'
import '@fontsource-variable/dm-sans'
import './style.css'
import './theme.css'
import './styles/app.css'
import Root from './Root.vue'
import { router } from './router'

// The demo used to live at #/test/polski-2026 (hash routing). Keep old links working.
if (window.location.hash.startsWith('#/test/polski-2026')) window.history.replaceState(null, '', '/trening/polski-2026')
else if (window.location.hash === '#/') window.history.replaceState(null, '', '/')

const app = createApp(Root)
app.use(createPinia())
app.use(router)
app.mount('#app')

// Cookieless analytics: no cookie banner needed. Only reports when deployed on Vercel.
inject({ mode: import.meta.env.PROD ? 'production' : 'development' })
