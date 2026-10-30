<script setup>
// /konto: plan and payments, profile, password, data export (GDPR access), account deletion
// (GDPR erasure) and signing out.
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Download, KeyRound, LoaderCircle, LogOut, Trash2, UserRound, Zap, FileJson } from '@lucide/vue'
import ErrorState from '@/ui/ErrorState.vue'
import BillingStatus from '@/components/premium/BillingStatus.vue'
import ChangePasswordForm from '@/components/account/ChangePasswordForm.vue'
import DeleteAccount from '@/components/account/DeleteAccount.vue'
import FormMessage from '@/components/account/FormMessage.vue'
import ProfileForm from '@/components/account/ProfileForm.vue'
import { useAsync } from '@/composables/useAsync'
import { ROUTES } from '@/config/routes'
import { EXPORT_FILENAME, downloadDataExport } from '@/lib/api/account'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'
import { useUiStore } from '@/stores/ui'

const auth = useAuthStore()
const billingStore = useBillingStore()
const ui = useUiStore()
const router = useRouter()

const profile = useAsync(() => auth.ensureProfile())
const billing = useAsync(() => billingStore.loadBilling())

const profileDefaults = computed(() => {
  const p = profile.data.value
  return p ? { displayName: p.display_name ?? '', subjects: p.subjects ?? [], maturaYear: p.matura_year } : null
})

// Data export
const exporting = ref(false)
const exportError = ref('')
async function exportData() {
  exporting.value = true
  exportError.value = ''
  const res = await downloadDataExport()
  exporting.value = false
  if (res.ok) ui.toast('Plik z Twoimi danymi jest gotowy ✓')
  else exportError.value = res.error
}

// Sign out (all devices, like the old app)
const signingOut = ref(false)
async function signOut() {
  signingOut.value = true
  try { await auth.signOut() } catch { /* the local session is cleared anyway */ }
  billingStore.reset()
  router.push(ROUTES.home)
}
</script>

<template>
  <div class="account">
    <header class="page-header">
      <div>
        <span class="page-kicker">Konto</span>
        <h1>Twoje konto<span class="accent-dot">.</span></h1>
        <p>Zalogowano jako <strong class="email">{{ auth.email }}</strong></p>
      </div>
      <button type="button" class="button button-outline button-sm" :disabled="signingOut" :aria-busy="signingOut ? 'true' : undefined" @click="signOut">
        <LoaderCircle v-if="signingOut" class="spin" :size="16" aria-hidden="true" /><LogOut v-else :size="16" aria-hidden="true" />{{ signingOut ? 'Wylogowuję…' : 'Wyloguj się' }}
      </button>
    </header>

    <div class="stack sections" style="--gap: 36px">
      <section aria-labelledby="account-plan">
        <h2 id="account-plan" class="section-title"><Zap :size="18" aria-hidden="true" />Twój plan</h2>
        <div v-if="billing.loading.value && !billing.data.value" class="skeleton" style="height: 132px" aria-busy="true" aria-label="Ładowanie planu"></div>
        <ErrorState v-else-if="billing.error.value" message="Nie udało się wczytać Twojego planu. Sprawdź internet i spróbuj ponownie." @retry="billing.reload" />
        <BillingStatus v-else-if="billing.data.value" :billing="billing.data.value" />
      </section>

      <section aria-labelledby="account-profile">
        <h2 id="account-profile" class="section-title"><UserRound :size="18" aria-hidden="true" />Profil</h2>
        <div v-if="profile.loading.value && !profile.data.value" class="skeleton" style="height: 300px" aria-busy="true" aria-label="Ładowanie profilu"></div>
        <ErrorState v-else-if="profile.error.value || !profileDefaults" @retry="profile.reload" />
        <div v-else class="card">
          <ProfileForm :defaults="profileDefaults" submit-label="Zapisz zmiany" />
        </div>
      </section>

      <section aria-labelledby="account-password">
        <h2 id="account-password" class="section-title"><KeyRound :size="18" aria-hidden="true" />Zmień hasło</h2>
        <div class="card"><ChangePasswordForm /></div>
      </section>

      <section aria-labelledby="account-data">
        <h2 id="account-data" class="section-title"><FileJson :size="18" aria-hidden="true" />Twoje dane</h2>
        <div class="card">
          <p class="muted">Pobierz dane konta i nauki w formacie JSON: profil, podejścia do arkuszy, wypracowania, rozmowy z tutorem, notatki, fiszki i oceny odpowiedzi AI. Eksport nie obejmuje całej korespondencji, dokumentów płatności ani logów infrastruktury.</p>
          <p class="muted" style="margin-top: 12px">Pełną kopię danych możesz uzyskać przez <RouterLink :to="`${ROUTES.contact}?sprawa=dane`" class="link">kontakt</RouterLink>. <RouterLink :to="`${ROUTES.privacy}#pamiec`" class="link">Ustawienia prywatności i lokalnych szkiców</RouterLink>.</p>
          <div class="form-actions" style="margin-top: 18px">
            <button type="button" class="button button-outline button-sm" :disabled="exporting" :aria-busy="exporting ? 'true' : undefined" @click="exportData">
              <LoaderCircle v-if="exporting" class="spin" :size="16" aria-hidden="true" /><Download v-else :size="16" aria-hidden="true" />{{ exporting ? 'Przygotowuję plik…' : 'Pobierz moje dane' }}
            </button>
            <span class="small muted">{{ EXPORT_FILENAME }}</span>
          </div>
          <FormMessage :message="exportError" :style="exportError ? { marginTop: '14px' } : null" />
        </div>
      </section>

      <section aria-labelledby="account-delete">
        <h2 id="account-delete" class="section-title danger-title"><Trash2 :size="18" aria-hidden="true" />Usuń konto</h2>
        <DeleteAccount />
      </section>
    </div>
  </div>
</template>

<style scoped>
.account { max-width: 720px; }
.email { color: var(--text); word-break: break-all; }
.section-title { display: flex; align-items: center; gap: 9px; }
.section-title svg { color: var(--accent); }
.danger-title svg { color: var(--error); }
.muted { line-height: 1.6; }
</style>
