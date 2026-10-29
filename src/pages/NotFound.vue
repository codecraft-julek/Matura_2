<script setup>
import { RouterLink } from 'vue-router'
import { ArrowLeft, Compass } from '@lucide/vue'
import { ROUTES } from '@/config/routes'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <section class="public-page not-found">
    <span class="nf-icon"><Compass :size="30" /></span>
    <span class="page-kicker">Błąd 404</span>
    <h1>Tej strony tu nie ma<span class="accent-dot">.</span></h1>
    <p>Link mógł się zmienić albo ta treść została usunięta. Wróć do miejsca, które znasz.</p>
    <div class="row" style="justify-content: center; margin-top: 26px">
      <RouterLink class="button button-dark" :to="auth.isLoggedIn ? ROUTES.dashboard : ROUTES.home"><ArrowLeft :size="17" /> {{ auth.isLoggedIn ? 'Wróć do panelu' : 'Strona główna' }}</RouterLink>
      <RouterLink class="button button-outline" :to="ROUTES.publicExams">Arkusze maturalne</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.not-found { text-align: center; padding-block: 90px 120px; }
.nf-icon { display: inline-grid; place-items: center; width: 64px; height: 64px; border-radius: 18px; background: var(--lime); margin-bottom: 20px; }
h1 { font-size: clamp(34px, 5vw, 52px); letter-spacing: -2px; line-height: 1.1; }
p { color: var(--text-soft); font-size: 16px; line-height: 1.7; max-width: 44ch; margin: 16px auto 0; }
</style>
