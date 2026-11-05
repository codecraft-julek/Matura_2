<script setup>
// /creators: how many people used the creator's code and how much we owe them. We pay by hand on the
// 15th and record it in /admin. No student data reaches this page.
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Check, Copy, Users } from '@lucide/vue'
import { ROUTES } from '@/config/routes'
import { useAsync } from '@/composables/useAsync'
import { loadAffiliatePanel } from '@/lib/api/affiliates'
import { useAuthStore } from '@/stores/auth'
import PageSkeleton from '@/ui/PageSkeleton.vue'
import ErrorState from '@/ui/ErrorState.vue'
import EmptyState from '@/ui/EmptyState.vue'
import CreatorNumbers from '@/components/creators/CreatorNumbers.vue'
import { dealText } from '@/components/creators/deal'

const auth = useAuthStore()
const router = useRouter()
const { data: panel, loading, error, reload } = useAsync(() => loadAffiliatePanel())
const deal = computed(() => dealText(panel.value, 'Dostajesz'))

async function switchAccount() {
  await auth.signOut('local')
  router.replace(ROUTES.creatorsLogin)
}

const copied = ref(false)
let copiedTimer
async function copyCode() {
  try {
    await navigator.clipboard.writeText(panel.value.code)
  } catch {
    return // no clipboard access: the code is on the screen anyway
  }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <div class="container creator-page">
    <PageSkeleton v-if="loading" />
    <ErrorState v-else-if="error" @retry="reload" />
    <EmptyState v-else-if="!panel" :icon="Users" title="To konto nie ma panelu twórcy" :text="`Jesteś zalogowany jako ${auth.email}. Zaloguj się adresem, na który przyszedł mail od nas, albo napisz do nas.`">
      <button type="button" class="button button-dark" @click="switchAccount">Zaloguj się innym kontem</button>
      <RouterLink :to="ROUTES.contact" class="button button-outline">Napisz do nas</RouterLink>
    </EmptyState>
    <template v-else>
      <header class="page-header">
        <div>
          <span class="page-kicker">Panel twórcy</span>
          <h1>Cześć, {{ panel.name }}<span class="accent-dot">.</span></h1>
          <p>{{ deal }}</p>
        </div>
      </header>

      <section class="card code-card" aria-label="Twój kod">
        <div>
          <span class="code-label">Twój kod</span>
          <strong class="code-value">{{ panel.code }}</strong>
          <span v-if="!panel.active" class="badge badge-warn">Kod wyłączony</span>
        </div>
        <button type="button" class="button button-outline button-sm" @click="copyCode">
          <Check v-if="copied" :size="16" /><Copy v-else :size="16" /> {{ copied ? 'Skopiowano' : 'Kopiuj' }}
        </button>
      </section>

      <div class="section-gap"><CreatorNumbers :panel="panel" /></div>
    </template>
  </div>
</template>

<style scoped>
.creator-page { padding-block: 40px 72px; }
.code-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.code-label { display: block; font-size: 12px; font-weight: 700; color: var(--text-soft); margin-bottom: 4px; }
.code-value { font: 750 26px/1.2 var(--heading); letter-spacing: .5px; margin-right: 10px; overflow-wrap: anywhere; }
</style>
