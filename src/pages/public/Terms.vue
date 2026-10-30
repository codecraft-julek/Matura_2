<script setup>
import LegalPage from '@/components/landing/LegalPage.vue'
import { termsDocument } from '@/content/legal/documents'
import { PAGE_SEO } from './seo'
import { useSeo } from './useSeo'
useSeo(() => PAGE_SEO.terms)
</script>

<template><LegalPage :document="termsDocument" /></template>
