<script setup>
// Header + footer of the public site (landing, SEO exam pages, contact, legal pages, 404).
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowUpRight, Menu, X } from '@lucide/vue'
import BrandLink from '@/ui/BrandLink.vue'
import { AUTHOR } from '@/config/site'
import { ROUTES } from '@/config/routes'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const menuOpen = ref(false)
const nav = [
  { to: '/#narzedzia', label: 'Narzędzia' },
  { to: ROUTES.publicExams, label: 'Arkusze maturalne' },
  { to: '/#cennik', label: 'Cennik' },
  { to: '/#faq', label: 'FAQ' },
]
watch(() => route.fullPath, () => { menuOpen.value = false })
const onKey = e => { if (e.key === 'Escape') menuOpen.value = false }
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="public-shell">
    <a class="skip-link" href="#main">Przejdź do treści</a>
    <header class="site-header">
      <div class="container header-inner">
        <BrandLink to="/" />
        <nav class="desktop-navigation" aria-label="Menu główne"><RouterLink v-for="item in nav" :key="item.to" :to="item.to">{{ item.label }}</RouterLink></nav>
        <div class="header-actions">
          <template v-if="auth.isLoggedIn"><RouterLink class="button button-dark header-cta" :to="ROUTES.dashboard">Przejdź do panelu <ArrowUpRight :size="16" /></RouterLink></template>
          <template v-else>
            <RouterLink class="text-button desktop-demo" :to="ROUTES.login">Zaloguj się</RouterLink>
            <RouterLink class="button button-dark header-cta" :to="ROUTES.signup">Załóż konto <ArrowUpRight :size="16" /></RouterLink>
          </template>
          <button class="menu-toggle icon-button" :aria-expanded="menuOpen" aria-controls="mobile-navigation" :aria-label="menuOpen ? 'Zamknij menu' : 'Otwórz menu'" @click="menuOpen = !menuOpen"><X v-if="menuOpen" :size="24" /><Menu v-else :size="24" /></button>
        </div>
      </div>
      <nav v-if="menuOpen" id="mobile-navigation" class="mobile-navigation" aria-label="Menu mobilne">
        <RouterLink v-for="item in nav" :key="item.to" :to="item.to">{{ item.label }} <ArrowUpRight :size="18" /></RouterLink>
        <RouterLink v-if="!auth.isLoggedIn" :to="ROUTES.login">Zaloguj się <ArrowUpRight :size="18" /></RouterLink>
        <RouterLink class="button button-lime" :to="auth.isLoggedIn ? ROUTES.dashboard : ROUTES.signup">{{ auth.isLoggedIn ? 'Przejdź do panelu' : 'Załóż darmowe konto' }} <ArrowUpRight :size="18" /></RouterLink>
      </nav>
    </header>

    <main id="main" tabindex="-1" style="flex: 1; outline: none"><slot /></main>

    <footer class="site-footer container">
      <div class="footer-top">
        <BrandLink to="/" />
        <p>Mniej stresu. Więcej przyszłości.</p>
        <nav aria-label="Menu w stopce">
          <RouterLink :to="ROUTES.publicExams">Arkusze maturalne</RouterLink>
          <RouterLink :to="ROUTES.contact">Kontakt</RouterLink>
          <RouterLink :to="ROUTES.terms">Regulamin</RouterLink>
          <RouterLink :to="ROUTES.privacy">Polityka prywatności</RouterLink>
        </nav>
      </div>
      <div class="footer-bottom"><span>© {{ new Date().getFullYear() }} Ogarnij Maturę</span><span>Nie jesteśmy powiązani z CKE.</span></div>
      <div class="footer-credit">
        <span>Projekt i wykonanie</span>
        <a class="footer-credit-link" :href="`mailto:${AUTHOR.email}`">
          <span class="footer-credit-monogram" aria-hidden="true">JM</span>
          <span class="footer-credit-person"><strong>{{ AUTHOR.name }}</strong><span>{{ AUTHOR.email }}</span></span>
          <span class="footer-credit-arrow" aria-hidden="true">↗</span>
        </a>
      </div>
    </footer>
  </div>
</template>
