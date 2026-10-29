<script setup>
// Shell of the logged-in app: top navigation (desktop), bottom bar with "Więcej" (phones),
// room for the docked tutor panel (--tutor-w, see styles/app.css).
import { ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { CircleUser, FileText, Layers, LayoutDashboard, LogOut, MessageCircle, MoreHorizontal, NotebookPen, PenLine, Zap } from '@lucide/vue'
import BrandLink from '@/ui/BrandLink.vue'
import AppDialog from '@/ui/AppDialog.vue'
import { ROUTES } from '@/config/routes'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'

const auth = useAuthStore()
const billing = useBillingStore()
const route = useRoute()
const router = useRouter()
const moreOpen = ref(false)

const nav = [
  { to: ROUTES.dashboard, label: 'Panel', icon: LayoutDashboard },
  { to: ROUTES.exams, label: 'Arkusze', icon: FileText },
  { to: ROUTES.essays, label: 'Wypracowania', icon: PenLine },
  { to: ROUTES.tutor, label: 'Tutor', icon: MessageCircle },
  { to: ROUTES.notes, label: 'Notatki', icon: NotebookPen },
  { to: ROUTES.flashcards, label: 'Fiszki', icon: Layers },
]
const bottom = [nav[0], nav[1], { ...nav[2], label: 'Teksty' }, nav[3], nav[5]]
const more = [nav[4], { to: ROUTES.premium, label: 'Premium', icon: Zap }, { to: ROUTES.account, label: 'Konto', icon: CircleUser }]

watch(() => route.fullPath, () => { moreOpen.value = false })

async function signOut() {
  await auth.signOut()
  billing.reset()
  router.push(ROUTES.home)
}
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main">Przejdź do treści</a>
    <header class="app-header">
      <div class="app-header-inner">
        <BrandLink :to="ROUTES.dashboard" />
        <nav class="app-nav" aria-label="Menu aplikacji">
          <RouterLink v-for="item in nav" :key="item.to" :to="item.to"><component :is="item.icon" :size="16" />{{ item.label }}</RouterLink>
          <RouterLink :to="ROUTES.premium" class="nav-premium"><Zap :size="15" fill="currentColor" />Premium</RouterLink>
        </nav>
        <div class="app-header-actions">
          <RouterLink :to="ROUTES.account" class="icon-button" aria-label="Konto" title="Konto"><CircleUser :size="21" /></RouterLink>
          <button type="button" class="icon-button hide-mobile" aria-label="Wyloguj się" title="Wyloguj się" @click="signOut"><LogOut :size="19" /></button>
        </div>
      </div>
    </header>

    <main id="main" tabindex="-1" class="app-main" :class="{ 'is-wide': route.meta.wide }" style="outline: none"><slot /></main>

    <nav class="bottom-nav" aria-label="Menu aplikacji (telefon)">
      <RouterLink v-for="item in bottom" :key="item.to" :to="item.to"><component :is="item.icon" :size="20" />{{ item.label }}</RouterLink>
      <button type="button" :aria-expanded="moreOpen" @click="moreOpen = true"><MoreHorizontal :size="20" />Więcej</button>
    </nav>

    <AppDialog v-model:open="moreOpen" title="Więcej">
      <ul class="list">
        <li v-for="item in more" :key="item.to"><RouterLink :to="item.to" class="list-row"><span class="row"><component :is="item.icon" :size="18" />{{ item.label }}</span></RouterLink></li>
        <li><button type="button" class="list-row" style="width: 100%" @click="signOut"><span class="row"><LogOut :size="18" />Wyloguj się</span></button></li>
      </ul>
    </AppDialog>
  </div>
</template>
