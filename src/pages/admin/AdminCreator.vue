<script setup>
// /admin/tworcy/:id: one creator. Partnership details, recording a payout made by hand, the password
// link, and the same numbers the creator sees on /creators.
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowLeft, Mail, Pencil } from '@lucide/vue'
import { formatPln, parsePln, payoutSchema } from '@shared/affiliates'
import { ROUTES, adminEditCreatorRoute } from '@/config/routes'
import { useAsync } from '@/composables/useAsync'
import { formatDate, formatDateTime } from '@/lib/format'
import { NoAdminAccess, addPayout, adminAffiliate, deletePayout, sendCreatorInvite } from '@/lib/api/affiliates'
import { useUiStore } from '@/stores/ui'
import { usePageTitle } from '@/composables/usePageTitle'
import AppField from '@/ui/AppField.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'
import ErrorState from '@/ui/ErrorState.vue'
import FormMessage from '@/components/account/FormMessage.vue'
import SubmitButton from '@/components/account/SubmitButton.vue'
import NoAccess from '@/components/admin/NoAccess.vue'
import CreatorNumbers from '@/components/creators/CreatorNumbers.vue'
import { dealText } from '@/components/creators/deal'
import NotFound from '@/pages/NotFound.vue'

const route = useRoute()
const ui = useUiStore()
const { data: c, loading, error, reload } = useAsync(() => adminAffiliate(route.params.id), { watch: () => route.params.id })
usePageTitle(() => c.value?.name)

const deal = computed(() => dealText(c.value, 'Dostaje'))
const day = date => (date ? formatDate(`${date}T12:00:00`) : '')
const period = computed(() => [day(c.value.startsOn), day(c.value.endsOn)].filter(Boolean).join(' – '))
const details = computed(() => [
  ['E-mail do logowania', c.value.email],
  ['Platforma', c.value.platform],
  ['Profil', c.value.profileUrl, 'link'],
  ['Kontakt', c.value.contact],
  ['Współpraca', period.value],
  ['Koszt reklamy', c.value.adFee ? formatPln(c.value.adFee) : ''],
  ['Dane do wypłaty', c.value.payoutDetails],
  ['Notatki', c.value.notes],
  ['Ostatnie logowanie', c.value.lastSignInAt ? formatDateTime(c.value.lastSignInAt) : 'Jeszcze nie'],
].filter(([, value]) => value))

// ---------- The password link ----------
const inviting = ref(false)
async function invite() {
  inviting.value = true
  const res = await sendCreatorInvite(c.value.id)
  inviting.value = false
  ui.toast(res.ok ? `Wysłaliśmy link na ${c.value.email}.` : res.error, res.ok ? 'ok' : 'error')
}

// ---------- Payouts ----------
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' }) // YYYY-MM-DD
const plain = grosze => (grosze / 100).toFixed(2).replace('.', ',')
const payout = reactive({ amount: '', paidOn: today(), note: '' })
const payoutErrors = ref({})
const payoutMessage = ref('')
const paying = ref(false)
// Prefilled with what's due, every time the numbers change.
watch(() => c.value?.due, due => { payout.amount = due ? plain(due) : '' }, { immediate: true })

async function savePayout() {
  payoutMessage.value = ''
  const amount = parsePln(payout.amount)
  const parsed = payoutSchema.safeParse({ affiliateId: c.value.id, amount: amount ?? -1, paidOn: payout.paidOn, note: payout.note })
  if (!parsed.success || amount === null) {
    payoutErrors.value = Object.fromEntries((parsed.error?.issues ?? []).map(i => [i.path[0], i.message]))
    if (amount === null) payoutErrors.value.amount = 'Wpisz kwotę, np. 62,40.'
    return
  }
  payoutErrors.value = {}
  paying.value = true
  const res = await addPayout(parsed.data)
  paying.value = false
  if (!res.ok) {
    payoutErrors.value = res.fieldErrors ?? {}
    payoutMessage.value = res.error
    return
  }
  ui.toast(`Zapisano wypłatę ${formatPln(parsed.data.amount)}.`)
  payout.note = ''
  payout.paidOn = today()
  await reload()
}

async function removePayout(p) {
  const ok = await ui.confirm({
    title: 'Usunąć tę wypłatę?',
    body: `${formatPln(p.amount)} z ${formatDate(p.paidAt)}. Kwota wróci do „Do wypłaty”, a twórca zobaczy to w swoim panelu.`,
    confirmLabel: 'Usuń wypłatę',
    danger: true,
  })
  if (!ok) return
  const res = await deletePayout(p.id)
  if (!res.ok) { ui.toast(res.error, 'error'); return }
  ui.toast('Usunięto wypłatę.')
  await reload()
}
</script>

<template>
  <div class="container admin-page">
    <PageSkeleton v-if="loading && !c" />
    <NoAccess v-else-if="error instanceof NoAdminAccess" />
    <ErrorState v-else-if="error" @retry="reload" />
    <NotFound v-else-if="!c" />
    <template v-else>
      <RouterLink :to="ROUTES.admin" class="back-link"><ArrowLeft :size="15" /> Wszyscy twórcy</RouterLink>
      <header class="page-header">
        <div>
          <span class="page-kicker">{{ c.platform || 'Twórca' }}</span>
          <h1>{{ c.name }}<span class="accent-dot">.</span></h1>
          <p>{{ deal }}</p>
          <div class="badges">
            <span class="badge badge-dark">{{ c.code }}</span>
            <span v-if="!c.active" class="badge">Kod wyłączony</span>
            <span v-if="!c.hasPassword" class="badge badge-warn">Czeka na hasło</span>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="button button-outline" :disabled="inviting" @click="invite"><Mail :size="17" /> {{ inviting ? 'Wysyłam…' : 'Wyślij link do hasła' }}</button>
          <RouterLink :to="adminEditCreatorRoute(c.id)" class="button button-dark"><Pencil :size="16" /> Edytuj</RouterLink>
        </div>
      </header>

      <p v-if="!c.hasPassword" class="alert alert-info" role="status">Hasło do panelu nie jest jeszcze ustawione. Link z maila działa przez godzinę. Jeśli wygasł, wyślij nowy przyciskiem wyżej.</p>

      <div class="admin-grid">
        <section class="card" aria-labelledby="payout-heading">
          <h2 id="payout-heading" class="card-title">Zapisz wypłatę</h2>
          <p class="card-lead">Do wypłaty teraz: <strong class="tabular">{{ formatPln(c.due) }}</strong>. Zapisz dopiero, gdy przelejesz pieniądze.</p>
          <p v-if="c.payoutDetails" class="payout-details">Dane do wypłaty: <strong>{{ c.payoutDetails }}</strong></p>
          <form class="form payout-form" novalidate @submit.prevent="savePayout">
            <div class="grid-2">
              <AppField v-slot="fld" label="Kwota (zł)" :error="payoutErrors.amount">
                <input :id="fld.id" v-model="payout.amount" class="input" inputmode="decimal" autocomplete="off" placeholder="62,40" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
              </AppField>
              <AppField v-slot="fld" label="Data" :error="payoutErrors.paidOn">
                <input :id="fld.id" v-model="payout.paidOn" class="input" type="date" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
              </AppField>
            </div>
            <AppField v-slot="fld" label="Notatka" optional :error="payoutErrors.note">
              <input :id="fld.id" v-model="payout.note" class="input" maxlength="200" placeholder="np. przelew, BLIK" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" />
            </AppField>
            <SubmitButton :pending="paying" pending-text="Zapisuję…">Zapisz wypłatę</SubmitButton>
            <FormMessage :message="payoutMessage" />
          </form>
        </section>

        <section class="card" aria-labelledby="deal-heading">
          <h2 id="deal-heading" class="card-title">Współpraca</h2>
          <dl class="details">
            <div v-for="[label, value, kind] in details" :key="label">
              <dt>{{ label }}</dt>
              <dd><a v-if="kind === 'link'" :href="value" target="_blank" rel="noopener noreferrer" class="link">{{ value }}</a><template v-else>{{ value }}</template></dd>
            </div>
          </dl>
          <div class="result">
            <div><span>Sprzedaż z kodu</span><strong class="tabular">{{ formatPln(c.revenue) }}</strong></div>
            <div><span>Koszt (reklama i prowizja)</span><strong class="tabular">{{ formatPln(c.adFee + c.earned) }}</strong></div>
            <div class="result-total"><span>Zostaje</span><strong class="tabular">{{ formatPln(c.revenue - c.adFee - c.earned) }}</strong></div>
            <p>Przed opłatami Stripe i podatkami.</p>
          </div>
        </section>
      </div>

      <div class="section-gap"><CreatorNumbers :panel="c" admin @delete-payout="removePayout" /></div>
    </template>
  </div>
</template>

<style scoped>
.admin-page { padding-block: 32px 72px; }
.back-link { display: inline-flex; align-items: center; gap: 7px; color: var(--text-soft); font-size: 13px; min-height: 32px; margin-bottom: 12px; }
.back-link:hover { color: var(--green); }
.badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.alert { margin-bottom: 20px; }
.admin-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
.card-lead { margin-top: 6px; font-size: 14px; line-height: 1.6; color: var(--text-soft); }
.card-lead strong { color: var(--text); }
.payout-details { margin-top: 8px; font-size: 13px; color: var(--text-soft); overflow-wrap: anywhere; }
.payout-details strong { color: var(--text); }
.payout-form { margin-top: 18px; }
.details { display: grid; gap: 12px; margin: 16px 0 0; }
.details div { display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: 12px; }
.details dt { font-size: 13px; color: var(--text-soft); }
.details dd { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-line; overflow-wrap: anywhere; }
.result { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); display: grid; gap: 8px; }
.result div { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
.result span { color: var(--text-soft); }
.result-total { padding-top: 8px; border-top: 1px dashed var(--line); }
.result-total strong { font-size: 17px; }
.result p { font-size: 12px; color: var(--text-soft); }
@media (max-width: 860px) {
  .admin-grid { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .details div { grid-template-columns: 1fr; gap: 2px; }
  .grid-2 { grid-template-columns: 1fr; }
}
</style>
