<script setup>
import { RouterLink } from 'vue-router'
import BrandMark from '@/components/BrandMark.vue'

defineProps({ to: { type: String, default: '/' } })
</script>

<template>
  <RouterLink :to="to" class="brand" aria-label="Ogarnij Maturę — strona główna"><span class="brand-icon"><BrandMark /></span><span>ogarnij<span class="brand-second">maturę.</span></span></RouterLink>
</template>
