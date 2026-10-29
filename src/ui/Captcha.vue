<script setup>
// Cloudflare Turnstile widget. Usually passes on its own; the token goes to Supabase with the
// signup/login/reset request. Tokens work once: bump `resetKey` after every attempt.
import { onBeforeUnmount, ref, watch } from 'vue'
import { CAPTCHA_SITE_KEY } from '@/config/site'

const props = defineProps({ resetKey: { type: Number, default: 0 } })
const emit = defineEmits(['token'])
const box = ref(null)
let widgetId = null
let cancelled = false

async function render() {
  if (!CAPTCHA_SITE_KEY) return
  remove()
  cancelled = false
  emit('token', null)
  try {
    await loadTurnstile()
    if (cancelled || !box.value || !window.turnstile) return
    widgetId = window.turnstile.render(box.value, {
      sitekey: CAPTCHA_SITE_KEY,
      language: 'pl',
      size: 'flexible',
      callback: token => emit('token', token),
      'expired-callback': () => emit('token', null),
      'error-callback': () => emit('token', null),
    })
  } catch { emit('token', null) }
}
function remove() {
  cancelled = true
  if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
  widgetId = null
}
watch(() => props.resetKey, render)
watch(box, el => { if (el) render() })
onBeforeUnmount(remove)
</script>

<script>
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise = null
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve()
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { scriptPromise = null; reject(new Error('Turnstile failed to load')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}
/** True when the CAPTCHA is turned on (src/config/site.ts). */
export const captchaEnabled = CAPTCHA_SITE_KEY !== null
</script>

<template>
  <div v-if="CAPTCHA_SITE_KEY" ref="box" style="min-height: 65px"></div>
</template>
