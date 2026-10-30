import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource-variable/manrope'
import '@fontsource-variable/dm-sans'
import './style.css'
import './theme.css'
import './styles/app.css'
import './styles/legal.css'
import { initPrivacyAnalytics } from './lib/privacy/analytics'
import Root from './Root.vue'
import { router } from './router'

// The demo used to live at #/test/polski-2026 (hash routing). Keep old links working.
if (window.location.hash.startsWith('#/test/polski-2026')) window.history.replaceState(null, '', '/trening/polski-2026')
else if (window.location.hash === '#/') window.history.replaceState(null, '', '/')

const app = createApp(Root)
app.use(createPinia())
app.use(router)
app.mount('#app')

initPrivacyAnalytics()
