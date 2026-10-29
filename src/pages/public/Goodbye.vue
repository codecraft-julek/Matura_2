<script setup>
// Shown after the account was deleted (Account page signs out locally and comes here).
import { RouterLink } from 'vue-router'
import { ArrowLeft, Heart } from '@lucide/vue'
import { ROUTES } from '@/config/routes'
import { PAGE_SEO } from './seo'
import { useSeo } from './useSeo'

useSeo(() => PAGE_SEO.goodbye)
</script>

<template>
  <section class="public-page goodbye">
    <span class="gb-icon"><Heart :size="28" /></span>
    <span class="page-kicker">Do zobaczenia!</span>
    <h1>Twoje konto zostało usunięte<span class="accent-dot">.</span></h1>
    <p>Usunęliśmy Twoje konto i wszystkie powiązane dane. Trzymamy kciuki za maturę!</p>
    <div class="row gb-actions">
      <RouterLink class="button button-dark" :to="ROUTES.home"><ArrowLeft :size="17" /> Strona główna</RouterLink>
      <RouterLink class="button button-outline" :to="ROUTES.publicExams">Arkusze maturalne</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.goodbye { text-align: center; padding-block: 80px 120px; display: flex; flex-direction: column; align-items: center; }
.gb-icon { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 18px; background: var(--lime); color: var(--green); margin-bottom: 20px; }
h1 { font-size: clamp(30px, 5vw, 44px); letter-spacing: -1.6px; line-height: 1.15; font-weight: 750; }
p { color: var(--text-soft); font-size: 16px; line-height: 1.7; max-width: 44ch; margin: 14px auto 0; }
.gb-actions { justify-content: center; margin-top: 26px; }
</style>
