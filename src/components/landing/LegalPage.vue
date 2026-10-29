<script setup>
// Shared frame for the privacy policy and the terms: draft warning, title, date, typography.
import { TriangleAlert } from '@lucide/vue'

defineProps({ title: { type: String, required: true }, updated: { type: String, required: true } })
</script>

<template>
  <article class="public-page legal-page">
    <!-- TODO(legal): remove this banner once a lawyer has reviewed the text. -->
    <p class="alert alert-warn draft" role="note"><TriangleAlert :size="18" /> <span><strong>Wersja robocza.</strong> Ten dokument czeka na weryfikację prawną i może się jeszcze zmienić.</span></p>
    <header class="legal-head">
      <h1>{{ title }}<span class="accent-dot">.</span></h1>
      <p>Ostatnia aktualizacja: {{ updated }}</p>
    </header>
    <div class="prose"><slot /></div>
  </article>
</template>

<style scoped>
.legal-page { width: min(760px, calc(100% - 48px)); }
.draft { margin-bottom: 32px; }
.legal-head h1 { font-size: clamp(32px, 5vw, 44px); letter-spacing: -1.6px; line-height: 1.15; font-weight: 750; }
.legal-head p { margin-top: 8px; font-size: 14px; color: var(--text-soft); }
.prose { margin-top: 12px; }
.prose :deep(section) { margin-top: 8px; }
@media (max-width: 680px) { .legal-page { width: calc(100% - 32px); } }
</style>
