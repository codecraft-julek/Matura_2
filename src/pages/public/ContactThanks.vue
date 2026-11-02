<script setup>
// Shown after the contact form was sent (Contact page comes here).
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, MailCheck } from '@lucide/vue'
import { ROUTES } from '@/config/routes'
import { useAuthStore } from '@/stores/auth'
import { PAGE_SEO } from './seo'
import { useSeo } from './useSeo'

useSeo(() => PAGE_SEO.contactThanks)

const auth = useAuthStore()
const heading = ref(null)
onMounted(() => heading.value?.focus())
</script>

<template>
  <section class="public-page thanks">
    <span class="thanks-icon"><MailCheck :size="28" /></span>
    <span class="page-kicker">Wiadomość wysłana</span>
    <h1 ref="heading" tabindex="-1">Dzięki, dostaliśmy<span class="accent-dot">!</span></h1>
    <p>Odpiszemy na podany adres e-mail, zwykle w ciągu 1–2 dni. Jeśli nie widzisz odpowiedzi, zajrzyj do spamu.</p>
    <div class="row thanks-actions">
      <RouterLink v-if="auth.isLoggedIn" class="button button-dark" :to="ROUTES.dashboard"><ArrowLeft :size="17" /> Wróć do nauki</RouterLink>
      <RouterLink v-else class="button button-dark" :to="ROUTES.home"><ArrowLeft :size="17" /> Strona główna</RouterLink>
      <RouterLink class="button button-outline" :to="ROUTES.publicExams">Arkusze maturalne</RouterLink>
    </div>
    <RouterLink class="link thanks-more" :to="ROUTES.contact">Napisz kolejną wiadomość</RouterLink>
  </section>
</template>

<style scoped>
.thanks { text-align: center; padding-block: 80px 120px; display: flex; flex-direction: column; align-items: center; }
.thanks-icon { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 18px; background: var(--lime); color: var(--green); margin-bottom: 20px; }
h1 { font-size: clamp(30px, 5vw, 44px); letter-spacing: -1.6px; line-height: 1.15; font-weight: 750; outline: none; }
p { color: var(--text-soft); font-size: 16px; line-height: 1.7; max-width: 44ch; margin: 14px auto 0; }
.thanks-actions { justify-content: center; margin-top: 26px; }
.thanks-more { margin-top: 20px; font-size: 14px; }
</style>
