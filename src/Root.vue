<script setup>
// Picks the layout from route.meta.layout and mounts the app-wide toasts and confirm dialog.
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import PublicLayout from '@/layouts/PublicLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import ToastHost from '@/ui/ToastHost.vue'
import ConfirmHost from '@/ui/ConfirmHost.vue'

const route = useRoute()
const layouts = { public: PublicLayout, auth: AuthLayout, app: AppLayout }
const layout = computed(() => layouts[route.meta.layout] ?? null)
</script>

<template>
  <component :is="layout" v-if="layout"><RouterView /></component>
  <RouterView v-else />
  <ToastHost />
  <ConfirmHost />
</template>
