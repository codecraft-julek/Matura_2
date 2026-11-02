<script setup>
// /odstapienie: "Odstąp od umowy tutaj". Public, so the link in the footer always works: a logged-out
// visitor is asked to log in, or can use the contact form. The student checks the prefilled form and
// confirms; billing-withdrawal saves the statement, ends Premium from that purchase and sends the
// confirmation e-mail. The refund is made by hand in Stripe.
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { CircleCheck, Undo2 } from '@lucide/vue'
import FormMessage from '@/components/account/FormMessage.vue'
import SubmitButton from '@/components/account/SubmitButton.vue'
import { planById } from '@/config/plans'
import { ROUTES } from '@/config/routes'
import { SITE } from '@/config/site'
import { confirmWithdrawal, loadWithdrawalStatus } from '@/lib/ai'
import { formatDate, formatDateTime } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'
import AppField from '@/ui/AppField.vue'
import ErrorState from '@/ui/ErrorState.vue'
import { PAGE_SEO } from './seo'
import { useSeo } from './useSeo'

useSeo(() => PAGE_SEO.withdrawal)

const auth = useAuthStore()
const billing = useBillingStore()

const loading = ref(auth.isLoggedIn)
const loadError = ref('')
const contract = ref(null)
const receipt = ref(null) // the statement just confirmed, or the latest earlier one
const justConfirmed = ref(false)

const form = reactive({ name: '', email: auth.email || '' })
const errors = ref({})
const message = ref('')
const pending = ref(false)

const planLabel = plan => (plan === 'matura' ? 'Pakiet do matury' : planById('monthly')?.name ?? 'Premium')
const formatPln = grosze => `${(grosze / 100).toFixed(2).replace('.', ',')} zł`
const loginTarget = computed(() => ({ path: ROUTES.login, query: { next: ROUTES.withdrawal } }))
const contactLink = `${ROUTES.contact}?sprawa=odstapienie`

async function load() {
  loading.value = true
  loadError.value = ''
  const res = await loadWithdrawalStatus()
  loading.value = false
  if (!res.ok) {
    loadError.value = res.error
    return
  }
  contract.value = res.contract
  receipt.value = res.done[0] ?? null
}

onMounted(async () => {
  if (!auth.isLoggedIn) return
  auth.ensureProfile().then(p => { form.name ||= p?.display_name ?? '' }).catch(() => {})
  await load()
})

async function submit() {
  errors.value = {}
  message.value = ''
  pending.value = true
  const res = await confirmWithdrawal({ sessionId: contract.value.sessionId, name: form.name, email: form.email })
  pending.value = false
  if (!res.ok) {
    errors.value = res.fieldErrors ?? {}
    message.value = res.error
    return
  }
  receipt.value = res.withdrawal
  contract.value = null
  justConfirmed.value = true
  billing.reset()
  window.scrollTo?.({ top: 0 })
}
</script>

<template>
  <div class="public-page withdrawal-page">
    <header class="page-header">
      <div>
        <span class="page-kicker">Masz na to 14 dni</span>
        <h1>Odstąp od umowy tutaj<span class="accent-dot">.</span></h1>
        <p>Nie musisz podawać powodu. Oddamy pieniądze pomniejszone tylko o proporcjonalną część za czas korzystania z Premium.</p>
      </div>
    </header>

    <div v-if="!auth.isLoggedIn" class="card stack-card">
      <h2 class="card-title">Zaloguj się na konto z zakupem</h2>
      <p class="muted">Po zalogowaniu pokażemy Twój zakup, więc nie musisz szukać numeru zamówienia.</p>
      <div class="row"><RouterLink :to="loginTarget" class="button button-dark">Zaloguj się</RouterLink></div>
      <p class="small muted">Nie możesz się zalogować? <RouterLink :to="contactLink" class="link">Wyślij oświadczenie przez formularz kontaktowy</RouterLink> albo napisz na <a :href="`mailto:${SITE.contactEmail}`" class="link">{{ SITE.contactEmail }}</a>.</p>
    </div>

    <div v-else-if="loading" class="skeleton" style="height: 320px" aria-busy="true" aria-label="Ładowanie zakupu"></div>

    <template v-else-if="loadError">
      <ErrorState :message="loadError" @retry="load" />
      <p class="small muted contact-fallback">Możesz też <RouterLink :to="contactLink" class="link">wysłać oświadczenie przez formularz kontaktowy</RouterLink>.</p>
    </template>

    <template v-else>
      <section v-if="receipt && (justConfirmed || !contract)" class="card stack-card receipt" role="status">
        <h2 class="card-title"><CircleCheck :size="20" aria-hidden="true" />Otrzymaliśmy Twoje oświadczenie</h2>
        <dl class="details">
          <div><dt>Otrzymano</dt><dd>{{ formatDateTime(receipt.receivedAt) }}</dd></div>
          <div><dt>Umowa</dt><dd>{{ planLabel(receipt.plan) }}</dd></div>
        </dl>
        <p v-if="receipt.ackSent" class="muted">Potwierdzenie wysłaliśmy na <strong>{{ receipt.email }}</strong>. Nie widzisz go? Zajrzyj do spamu.</p>
        <p v-else class="alert alert-warn">Oświadczenie jest zapisane, ale nie udało się wysłać potwierdzenia na {{ receipt.email }}. Zrób zrzut ekranu tej strony i napisz do nas: {{ SITE.contactEmail }}.</p>
        <p v-if="receipt.amountPaid > 0" class="muted">Zwrócimy należną kwotę tą samą metodą płatności, najpóźniej w ciągu 14 dni.</p>
        <p v-else class="muted">Ten zakup nie był płatny, więc nie ma kwoty do zwrotu.</p>
        <p v-if="receipt.accessEnded" class="muted">Premium z tego zakupu jest wyłączone. Twoje konto i materiały zostają.</p>
        <p v-else class="muted">Premium z tego zakupu wyłączymy wkrótce. Subskrypcja nie odnowi się.</p>
      </section>

      <form v-if="contract" class="card form" novalidate @submit.prevent="submit">
        <h2 class="card-title"><Undo2 :size="20" aria-hidden="true" />Sprawdź dane i potwierdź</h2>
        <dl class="details">
          <div><dt>Umowa</dt><dd>{{ planLabel(contract.plan) }}</dd></div>
          <div><dt>Data zakupu</dt><dd>{{ formatDate(contract.purchasedAt) }}</dd></div>
          <div><dt>Zapłacono</dt><dd>{{ formatPln(contract.amountPaid) }}</dd></div>
          <div><dt>Możesz odstąpić do</dt><dd>{{ formatDate(contract.deadline) }}</dd></div>
        </dl>
        <AppField v-slot="f" label="Imię i nazwisko" :error="errors.name">
          <input :id="f.id" v-model="form.name" name="name" class="input" autocomplete="name" maxlength="120" :aria-invalid="f.invalid" :aria-describedby="f.describedby" />
        </AppField>
        <AppField v-slot="f" label="E-mail do potwierdzenia" :error="errors.email">
          <input :id="f.id" v-model="form.email" name="email" type="email" inputmode="email" autocomplete="email" class="input" :aria-invalid="f.invalid" :aria-describedby="f.describedby" />
        </AppField>
        <p class="alert alert-warn"><span><strong>Po potwierdzeniu Premium z tego zakupu wyłączy się od razu.</strong><template v-if="contract.plan === 'monthly'"> Subskrypcja zostanie anulowana i nie pobierzemy kolejnych opłat.</template> Twoje konto i materiały zostają.</span></p>
        <FormMessage :message="message" />
        <div class="form-actions">
          <SubmitButton :pending="pending" pending-text="Wysyłam…" variant="danger">Potwierdź odstąpienie</SubmitButton>
        </div>
      </form>

      <div v-if="!contract && !receipt" class="card stack-card">
        <h2 class="card-title">Nie widzimy zakupu, od którego można tu odstąpić</h2>
        <p class="muted">Tu pojawia się zakup przez 14 dni od zawarcia umowy, dopóki daje Premium. Chcesz tylko wyłączyć odnawianie? Zrobisz to na <RouterLink :to="ROUTES.account" class="link">swoim koncie</RouterLink>.</p>
        <p class="small muted">Uważasz, że powinien tu być? <RouterLink :to="contactLink" class="link">Wyślij oświadczenie przez formularz kontaktowy</RouterLink>, sprawdzimy to.</p>
      </div>
    </template>

    <p class="small muted legal-note">Szczegóły znajdziesz w <RouterLink :to="`${ROUTES.terms}#odstapienie`" class="link">regulaminie</RouterLink>. Oświadczenie możesz też wysłać e-mailem albo pocztą.</p>
  </div>
</template>

<style scoped>
.withdrawal-page { width: min(720px, calc(100% - 48px)); }
.stack-card { display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
.receipt { margin-bottom: 18px; background: #f6fbe9; border-color: #dcef9f; }
.card-title { display: flex; align-items: center; gap: 10px; }
.details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; margin: 0; width: 100%; }
.details dt { font-size: 13px; color: var(--text-soft); }
.details dd { margin: 2px 0 0; font-weight: 600; color: var(--text); }
.contact-fallback { margin-top: 14px; }
.legal-note { margin-top: 24px; line-height: 1.6; }
@media (max-width: 680px) {
  .withdrawal-page { width: calc(100% - 32px); }
  .details { grid-template-columns: 1fr; }
}
</style>
