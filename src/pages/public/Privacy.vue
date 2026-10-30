<script setup>
import LegalPage from '@/components/landing/LegalPage.vue'
import PrivacyControls from '@/components/privacy/PrivacyControls.vue'
import { privacyDocument } from '@/content/legal/documents'
import { PAGE_SEO } from './seo'
import { useSeo } from './useSeo'
useSeo(() => PAGE_SEO.privacy)
</script>

<template>
  <LegalPage :document="privacyDocument">
    <template #after-section="{ section }"><PrivacyControls v-if="section.id === 'pamiec'" /></template>
  </LegalPage>
</template>
