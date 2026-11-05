<script setup>
// /admin for an account that isn't in app_admins.
import { useRouter } from 'vue-router'
import { Lock } from '@lucide/vue'
import { ROUTES } from '@/config/routes'
import { useAuthStore } from '@/stores/auth'
import EmptyState from '@/ui/EmptyState.vue'

const auth = useAuthStore()
const router = useRouter()
async function switchAccount() {
  await auth.signOut('local')
  router.replace({ path: ROUTES.login, query: { next: ROUTES.admin } })
}
</script>

<template>
  <EmptyState :icon="Lock" title="Brak dostępu" :text="`Konto ${auth.email} nie jest adminem.`">
    <button type="button" class="button button-dark" @click="switchAccount">Zaloguj się innym kontem</button>
  </EmptyState>
</template>
