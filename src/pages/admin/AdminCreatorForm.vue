<script setup>
// /admin/tworcy/nowy and /admin/tworcy/:id/edytuj: everything about one partnership. A new creator
// (or a new e-mail) gets a login and an e-mail with a link to set the password.
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import { PLATFORMS, affiliateSchema, checkoutCoupon, firstPayment, formatPln, parsePln } from '@shared/affiliates'
import { BILLING_PLANS } from '@shared/billing'
import { ROUTES, adminCreatorRoute } from '@/config/routes'
import { useAsync } from '@/composables/useAsync'
import { NoAdminAccess, adminAffiliate, adminAffiliates, saveAffiliate } from '@/lib/api/affiliates'
import { useUiStore } from '@/stores/ui'
import AppField from '@/ui/AppField.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'
import ErrorState from '@/ui/ErrorState.vue'
import FormMessage from '@/components/account/FormMessage.vue'
import SubmitButton from '@/components/account/SubmitButton.vue'
import NoAccess from '@/components/admin/NoAccess.vue'
import NotFound from '@/pages/NotFound.vue'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const id = computed(() => route.params.id ?? null)

// A new creator: still check admin access first, so nobody fills in a form that can't be saved.
const { data: existing, loading, error, reload } = useAsync(() => (id.value ? adminAffiliate(id.value) : adminAffiliates().then(() => null)), { watch: () => id.value })

const values = reactive({
  name: '', email: '', code: '', active: true, commissionPercent: 10, discountPercent: 10, commissionMonths: '',
  platform: '', profileUrl: '', contact: '', adFee: '', startsOn: '', endsOn: '', payoutDetails: '', notes: '',
})
watch(existing, c => {
  if (!c) return
  Object.assign(values, {
    name: c.name, email: c.email, code: c.code, active: c.active, commissionPercent: c.commissionPercent, discountPercent: c.discountPercent,
    commissionMonths: c.commissionMonths ?? '', platform: c.platform ?? '', profileUrl: c.profileUrl ?? '', contact: c.contact ?? '',
    adFee: c.adFee ? (c.adFee / 100).toFixed(2).replace('.', ',').replace(',00', '') : '', startsOn: c.startsOn ?? '', endsOn: c.endsOn ?? '',
    payoutDetails: c.payoutDetails ?? '', notes: c.notes ?? '',
  })
})

const toNumber = v => (v === '' || v === null ? Number.NaN : Number(v))
function toInput() {
  const adFee = values.adFee.trim() ? parsePln(values.adFee) : 0
  return {
    ...values,
    commissionPercent: toNumber(values.commissionPercent),
    discountPercent: toNumber(values.discountPercent),
    commissionMonths: values.commissionMonths === '' ? null : toNumber(values.commissionMonths),
    adFee: adFee ?? -1,
  }
}

// What the buyer pays and what the creator earns, so the numbers are easy to sanity-check.
const preview = computed(() => {
  const discount = Number(values.discountPercent)
  const commission = Number(values.commissionPercent)
  if (!(discount >= 0 && discount <= 90 && commission >= 0 && commission <= 100)) return null
  const pay = plan => firstPayment(plan, checkoutCoupon(plan, discount))
  const earn = amount => formatPln(Math.round((amount * commission) / 100))
  const months = values.commissionMonths === '' ? null : Number(values.commissionMonths)
  return { monthly: pay('monthly'), matura: pay('matura'), renewal: BILLING_PLANS.monthly.amount, months, earn }
})

const errors = ref({})
const message = ref('')
const saving = ref(false)
async function onSubmit() {
  message.value = ''
  const input = toInput()
  const parsed = affiliateSchema.safeParse(input)
  if (!parsed.success) {
    errors.value = {}
    for (const issue of parsed.error.issues) errors.value[issue.path[0]] ??= issue.message
    if (input.adFee === -1) errors.value.adFee = 'Wpisz kwotę, np. 300 albo 299,99.'
    message.value = 'Popraw zaznaczone pola.'
    return
  }
  errors.value = {}
  saving.value = true
  const res = await saveAffiliate(id.value, input)
  saving.value = false
  if (!res.ok) {
    errors.value = res.fieldErrors ?? {}
    message.value = res.error
    return
  }
  ui.toast(res.inviteSent ? `Zapisano. Na ${parsed.data.email} poszedł link do ustawienia hasła.` : 'Zapisano.')
  router.replace(adminCreatorRoute(res.id))
}
</script>

<template>
  <div class="container admin-page">
    <PageSkeleton v-if="loading" />
    <NoAccess v-else-if="error instanceof NoAdminAccess" />
    <ErrorState v-else-if="error" @retry="reload" />
    <NotFound v-else-if="id && !existing" />
    <template v-else>
      <RouterLink :to="id ? adminCreatorRoute(id) : ROUTES.admin" class="back-link"><ArrowLeft :size="15" /> {{ id ? 'Wróć do twórcy' : 'Wszyscy twórcy' }}</RouterLink>
      <header class="page-header">
        <div>
          <span class="page-kicker">Admin</span>
          <h1>{{ id ? `Edytuj: ${existing.name}` : 'Nowy twórca' }}<span class="accent-dot">.</span></h1>
          <p v-if="!id">Na podany e-mail wyślemy link do ustawienia hasła. Jeśli ktoś ma już u nas konto, loguje się swoim hasłem.</p>
        </div>
      </header>

      <form class="creator-form" novalidate @submit.prevent="onSubmit">
        <fieldset class="card">
          <legend class="card-title">Login i kod</legend>
          <div class="grid-2">
            <AppField v-slot="fld" label="Imię albo nick" :error="errors.name">
              <input :id="fld.id" v-model="values.name" class="input" maxlength="80" autocomplete="off" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
            <AppField v-slot="fld" label="E-mail do logowania" :error="errors.email" :hint="id ? 'Zmiana adresu przenosi panel na konto z nowym adresem.' : ''">
              <input :id="fld.id" v-model="values.email" class="input" type="email" inputmode="email" autocomplete="off" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
            <AppField v-slot="fld" label="Kod" :error="errors.code" hint="3–20 znaków: litery bez polskich znaków, cyfry, - albo _.">
              <input :id="fld.id" v-model="values.code" class="input code-input" maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
            <label class="check-row active-row"><input v-model="values.active" type="checkbox" /> <span><strong>Kod działa</strong><br />Wyłączony kod nie da już zniżki. Prowizja od trwających subskrypcji dalej się liczy.</span></label>
          </div>
        </fieldset>

        <fieldset class="card">
          <legend class="card-title">Warunki</legend>
          <div class="grid-3">
            <AppField v-slot="fld" label="Prowizja (%)" :error="errors.commissionPercent">
              <input :id="fld.id" v-model="values.commissionPercent" class="input" type="number" min="0" max="100" step="1" inputmode="numeric" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
            <AppField v-slot="fld" label="Zniżka dla kupującego (%)" :error="errors.discountPercent" hint="Na pierwszy miesiąc albo Pakiet.">
              <input :id="fld.id" v-model="values.discountPercent" class="input" type="number" min="0" max="90" step="1" inputmode="numeric" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
            <AppField v-slot="fld" label="Prowizja od ilu miesięcy subskrypcji" :error="errors.commissionMonths" hint="Puste = od każdej płatności.">
              <input :id="fld.id" v-model="values.commissionMonths" class="input" type="number" min="1" max="120" step="1" inputmode="numeric" placeholder="każdej" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
          </div>
          <div v-if="preview" class="preview" aria-live="polite">
            <p>Kupujący z kodem płaci <strong>{{ formatPln(preview.monthly) }}</strong> za pierwszy miesiąc (potem {{ formatPln(preview.renewal) }}) albo <strong>{{ formatPln(preview.matura) }}</strong> za Pakiet.</p>
            <p>Twórca dostaje od tego <strong>{{ preview.earn(preview.monthly) }}</strong>, <template v-if="preview.months !== 1"><strong>{{ preview.earn(preview.renewal) }}</strong> {{ preview.months ? `od miesięcy 2–${preview.months}` : 'od każdego kolejnego miesiąca' }}</template><template v-else>nic od kolejnych miesięcy</template> albo <strong>{{ preview.earn(preview.matura) }}</strong> od Pakietu.</p>
          </div>
        </fieldset>

        <fieldset class="card">
          <legend class="card-title">Współpraca <span class="legend-note">(widzisz tylko Ty)</span></legend>
          <div class="grid-2">
            <AppField v-slot="fld" label="Platforma" optional :error="errors.platform">
              <select :id="fld.id" v-model="values.platform" class="input select" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby">
                <option value="">Wybierz</option>
                <option v-for="p in PLATFORMS" :key="p" :value="p">{{ p }}</option>
              </select>
            </AppField>
            <AppField v-slot="fld" label="Link do profilu" optional :error="errors.profileUrl">
              <input :id="fld.id" v-model="values.profileUrl" class="input" type="url" inputmode="url" placeholder="https://www.tiktok.com/@…" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
            <AppField v-slot="fld" label="Kontakt" optional :error="errors.contact" hint="Telefon, Instagram, menedżer…">
              <input :id="fld.id" v-model="values.contact" class="input" maxlength="200" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
            <AppField v-slot="fld" label="Koszt reklamy (zł)" optional :error="errors.adFee" hint="Ile płacisz za samą reklamę, poza prowizją.">
              <input :id="fld.id" v-model="values.adFee" class="input" inputmode="decimal" placeholder="0" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
            <AppField v-slot="fld" label="Początek współpracy" optional :error="errors.startsOn">
              <input :id="fld.id" v-model="values.startsOn" class="input" type="date" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
            <AppField v-slot="fld" label="Koniec współpracy" optional :error="errors.endsOn" hint="Tylko dla Ciebie. Kod wyłączasz wyżej.">
              <input :id="fld.id" v-model="values.endsOn" class="input" type="date" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
          </div>
          <div class="stack-fields">
            <AppField v-slot="fld" label="Dane do wypłaty" optional :error="errors.payoutDetails" hint="Numer konta albo telefon do BLIK.">
              <input :id="fld.id" v-model="values.payoutDetails" class="input" maxlength="300" autocomplete="off" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
            <AppField v-slot="fld" label="Notatki" optional :error="errors.notes" :counter="{ value: values.notes.length, max: 2000 }">
              <textarea :id="fld.id" v-model="values.notes" class="input textarea" maxlength="2000" placeholder="Co ustaliliście: ile filmików, kiedy, za ile…" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
          </div>
        </fieldset>

        <div class="form-actions">
          <SubmitButton :pending="saving" pending-text="Zapisuję…" class="button-large">{{ id ? 'Zapisz zmiany' : 'Dodaj twórcę' }}</SubmitButton>
          <RouterLink :to="id ? adminCreatorRoute(id) : ROUTES.admin" class="button button-ghost">Anuluj</RouterLink>
        </div>
        <FormMessage :message="message" />
      </form>
    </template>
  </div>
</template>

<style scoped>
.admin-page { padding-block: 32px 72px; max-width: 920px; }
.back-link { display: inline-flex; align-items: center; gap: 7px; color: var(--text-soft); font-size: 13px; min-height: 32px; margin-bottom: 12px; }
.back-link:hover { color: var(--green); }
.creator-form { display: flex; flex-direction: column; gap: 18px; }
fieldset.card { margin: 0; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
legend.card-title { float: left; width: 100%; margin-bottom: 2px; }
legend.card-title + * { clear: both; }
.legend-note { font-size: 13px; font-weight: 400; color: var(--text-soft); }
.grid-2, .grid-3 { align-items: start; }
.grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.code-input { text-transform: uppercase; }
.active-row { align-self: center; }
.active-row strong { color: var(--text); }
.stack-fields { display: flex; flex-direction: column; gap: 18px; }
.preview { padding: 14px 16px; border-radius: var(--radius); background: var(--surface-2); font-size: 14px; line-height: 1.6; color: var(--text-soft); display: grid; gap: 6px; }
.preview strong { color: var(--text); }
@media (max-width: 720px) {
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
}
</style>
