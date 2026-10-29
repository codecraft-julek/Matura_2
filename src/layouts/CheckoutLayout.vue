<script setup>
import { RouterLink } from 'vue-router'
import { Lock } from '@lucide/vue'
import BrandLink from '@/ui/BrandLink.vue'
import { ROUTES } from '@/config/routes'
</script>

<template>
  <div class="checkout-shell">
    <a class="skip-link" href="#main">Przejdź do treści</a>
    <header class="checkout-header">
      <div class="checkout-header-inner">
        <BrandLink :to="ROUTES.dashboard" />
        <span class="secure-label"><Lock :size="14" aria-hidden="true" /> Bezpieczna płatność</span>
      </div>
    </header>
    <main id="main" class="checkout-main" tabindex="-1"><slot /></main>
    <footer class="checkout-footer">
      <span>Masz pytanie? <RouterLink :to="ROUTES.contact" class="link">Napisz do nas</RouterLink></span>
      <nav aria-label="Dokumenty">
        <RouterLink :to="ROUTES.terms" target="_blank" rel="noopener">Regulamin</RouterLink>
        <RouterLink :to="ROUTES.privacy" target="_blank" rel="noopener">Prywatność</RouterLink>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
.checkout-shell { min-height: 100dvh; display: flex; flex-direction: column; }
.checkout-header { border-bottom: 1px solid var(--line); background: var(--paper); }
.checkout-header-inner, .checkout-main, .checkout-footer { width: min(1040px, calc(100% - 48px)); margin-inline: auto; }
.checkout-header-inner { min-height: 82px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.checkout-header-inner :deep(.brand) { font-size: 18px; }
.checkout-header-inner :deep(.brand-icon) { width: 36px; height: 38px; }
.secure-label { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-soft); }
.checkout-main { flex: 1; padding-block: 32px 48px; outline: none; }
.checkout-footer { padding-block: 24px; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; font-size: 12px; color: var(--text-soft); }
.checkout-footer nav { display: flex; gap: 20px; }
@media (max-width: 600px) {
  .checkout-header-inner, .checkout-main, .checkout-footer { width: calc(100% - 32px); }
  .checkout-header-inner { min-height: 70px; }
  .checkout-main { padding-top: 24px; }
  .secure-label { max-width: 100px; font-size: 11px; }
}
</style>
