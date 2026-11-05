<script setup>
// /admin: every creator, what to pay this month, and how the codes sell.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, Clock, Megaphone, Plus, ShoppingBag, Wallet } from '@lucide/vue'
import { formatPln } from '@shared/affiliates'
import { ROUTES, adminCreatorRoute } from '@/config/routes'
import { useAsync } from '@/composables/useAsync'
import { count } from '@/lib/format'
import { NoAdminAccess, adminAffiliates } from '@/lib/api/affiliates'
import PageSkeleton from '@/ui/PageSkeleton.vue'
import ErrorState from '@/ui/ErrorState.vue'
import EmptyState from '@/ui/EmptyState.vue'
import StatTile from '@/ui/StatTile.vue'
import NoAccess from '@/components/admin/NoAccess.vue'

const { data: creators, loading, error, reload } = useAsync(() => adminAffiliates())
const sum = key => (creators.value ?? []).reduce((total, c) => total + c[key], 0)
const toPay = computed(() => (creators.value ?? []).filter(c => c.due > 0).length)
const PAYMENTS = ['płatność', 'płatności', 'płatności']
const PEOPLE = ['osoba', 'osoby', 'osób']
</script>

<template>
  <div class="container admin-page">
    <PageSkeleton v-if="loading" />
    <NoAccess v-else-if="error instanceof NoAdminAccess" />
    <ErrorState v-else-if="error" @retry="reload" />
    <template v-else>
      <header class="page-header">
        <div>
          <span class="page-kicker">Admin</span>
          <h1>Twórcy<span class="accent-dot">.</span></h1>
          <p>Kody, prowizje i wypłaty. Prowizję za miesiąc wypłacasz 15. dnia kolejnego miesiąca.</p>
        </div>
        <RouterLink :to="ROUTES.adminNewCreator" class="button button-dark"><Plus :size="17" /> Dodaj twórcę</RouterLink>
      </header>

      <EmptyState v-if="!creators.length" :icon="Megaphone" title="Nie masz jeszcze twórców" text="Dodaj pierwszego: dostanie kod, a na e-mail link do swojego panelu.">
        <RouterLink :to="ROUTES.adminNewCreator" class="button button-dark"><Plus :size="17" /> Dodaj twórcę</RouterLink>
      </EmptyState>
      <template v-else>
        <div class="stat-grid">
          <StatTile :icon="Wallet" tone="lime" label="Do wypłaty teraz" :value="formatPln(sum('due'))" :sub="toPay ? `Dla ${count(toPay, ['twórcy', 'twórców', 'twórców'])}` : 'Wszystko wypłacone'" />
          <StatTile :icon="Clock" label="Czeka na termin" :value="formatPln(sum('waiting'))" sub="Sprzedaż z ostatnich tygodni" />
          <StatTile :icon="ShoppingBag" label="Sprzedaż z kodów" :value="formatPln(sum('revenue'))" :sub="count(sum('payments'), PAYMENTS)" />
          <StatTile :icon="Megaphone" label="Koszt twórców" :value="formatPln(sum('adFee') + sum('earned'))" sub="Reklamy i prowizje" />
        </div>

        <ul class="list creator-list">
          <li v-for="c in creators" :key="c.id">
            <RouterLink :to="adminCreatorRoute(c.id)" class="list-row creator-row" :class="{ 'is-off': !c.active }">
              <div class="creator-main">
                <div class="creator-name">
                  <strong>{{ c.name }}</strong>
                  <span class="badge badge-dark">{{ c.code }}</span>
                  <span v-if="!c.active" class="badge">Wyłączony</span>
                  <span v-if="!c.hasPassword" class="badge badge-warn">Czeka na hasło</span>
                </div>
                <span class="creator-meta">{{ [c.platform, `${c.commissionPercent}% prowizji`, c.discountPercent ? `−${c.discountPercent}% dla kupujących` : null, count(c.buyers, PEOPLE)].filter(Boolean).join(' · ') }}</span>
              </div>
              <div class="creator-due">
                <strong class="tabular">{{ formatPln(c.due) }}</strong>
                <span>do wypłaty</span>
              </div>
              <ChevronRight :size="18" class="chevron" aria-hidden="true" />
            </RouterLink>
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>

<style scoped>
.admin-page { padding-block: 40px 72px; }
.creator-list { margin-top: 24px; }
.creator-row { color: inherit; }
.creator-row.is-off { opacity: .7; }
.creator-main { min-width: 0; flex: 1; }
.creator-name { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.creator-name strong { font-size: 16px; }
.creator-meta { display: block; margin-top: 5px; font-size: 13px; line-height: 1.5; color: var(--text-soft); }
.creator-due { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
.creator-due strong { font-size: 17px; white-space: nowrap; }
.creator-due span { font-size: 12px; color: var(--text-soft); }
.chevron { flex-shrink: 0; color: var(--text-soft); }
</style>
