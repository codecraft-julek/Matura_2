<script setup>
import { useRoute } from 'vue-router'
import { privacyChoice } from '@/lib/privacy/analytics'
import { ROUTES } from '@/config/routes'
import AnalyticsChoice from './AnalyticsChoice.vue'
const route = useRoute()
</script>

<template>
  <aside v-if="privacyChoice === null && route.meta.layout === 'public' && route.path !== ROUTES.privacy" class="privacy-choice" aria-label="Wybór opcjonalnych statystyk">
    <AnalyticsChoice compact />
  </aside>
</template>

<style scoped>
.privacy-choice{position:fixed;bottom:20px;left:20px;z-index:45;width:min(450px,calc(100% - 40px));padding:22px;background:var(--paper);border:1px solid var(--line-strong);border-radius:var(--radius);box-shadow:var(--shadow-pop);max-height:70dvh;overflow:auto}
@media(max-width:600px){.privacy-choice{bottom:12px;left:12px;width:calc(100% - 24px);padding:18px}}
</style>
