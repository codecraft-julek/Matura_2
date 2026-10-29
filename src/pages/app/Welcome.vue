<script setup>
// /witaj: first screen after signup. A few quick questions so the app shows the right content,
// then onboarded_at is set and the student goes on (?next= or the dashboard).
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Sparkles } from '@lucide/vue'
import ErrorState from '@/ui/ErrorState.vue'
import ProfileForm from '@/components/account/ProfileForm.vue'
import { ROUTES, safeNextPath } from '@/config/routes'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const state = ref(auth.profile && !auth.onboarded ? 'ready' : 'loading') // 'loading' | 'ready' | 'error'

const DEFAULTS = { displayName: '', subjects: ['polish', 'english'], maturaYear: null }
const nextPath = () => safeNextPath(typeof route.query.next === 'string' ? route.query.next : null)

async function load() {
  state.value = 'loading'
  try {
    const profile = await auth.ensureProfile()
    if (profile?.onboarded_at) return router.replace(ROUTES.dashboard)
    state.value = profile ? 'ready' : 'error'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
</script>

<template>
  <div v-if="state === 'loading'" aria-busy="true" aria-label="Ładowanie" class="stack" style="--gap: 14px">
    <div class="skeleton" style="height: 34px; width: 70%"></div>
    <div class="skeleton" style="height: 18px; width: 90%"></div>
    <div class="skeleton" style="height: 220px; margin-top: 10px"></div>
  </div>
  <ErrorState v-else-if="state === 'error'" @retry="load" />
  <template v-else>
    <span class="page-kicker"><Sparkles :size="14" aria-hidden="true" />Witaj na pokładzie!</span>
    <h1>Powiedz nam coś o sobie</h1>
    <p class="auth-lead">Dzięki temu pokażemy Ci arkusze i materiały, które Ci się przydadzą.</p>
    <!-- .auth-card .form already has the top margin. -->
    <ProfileForm :defaults="DEFAULTS" submit-label="Gotowe, lecimy!" onboard block @saved="router.replace(nextPath())" />
  </template>
</template>
