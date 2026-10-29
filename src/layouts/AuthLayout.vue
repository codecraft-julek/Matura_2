<script setup>
// Centered card for login, signup, password reset, e-mail confirmation and onboarding.
import { RouterLink } from 'vue-router'
import BrandLink from '@/ui/BrandLink.vue'
import { ROUTES } from '@/config/routes'
</script>

<template>
  <div class="auth-shell">
    <BrandLink to="/" />
    <main id="main" class="auth-card"><slot /></main>
    <nav class="auth-legal" aria-label="Informacje"><RouterLink :to="ROUTES.terms">Regulamin</RouterLink><RouterLink :to="ROUTES.privacy">Prywatność</RouterLink><RouterLink :to="ROUTES.contact">Kontakt</RouterLink></nav>
  </div>
</template>
