<script setup>
// "Usuń konto": refuses while a Premium subscription still renews (it would keep charging the card),
// otherwise asks for USUŃ in a dialog, calls rpc delete_my_account, clears the session on this
// device and says goodbye. Port of deleteAccount() from the old src/lib/auth/actions.ts.
import { computed, ref, useId } from 'vue'
import { useRouter } from 'vue-router'
import { Trash2, TriangleAlert } from '@lucide/vue'
import AppDialog from '@/ui/AppDialog.vue'
import AppField from '@/ui/AppField.vue'
import { ROUTES } from '@/config/routes'
import { DELETE_WORD, NETWORK_ERROR, RENEWING_SUBSCRIPTION_ERROR, deleteMyAccount, isDeleteConfirmed, subscriptionStillRenews } from '@/lib/api/account'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'
import FormMessage from './FormMessage.vue'
import SubmitButton from './SubmitButton.vue'

const auth = useAuthStore()
const billing = useBillingStore()
const router = useRouter()
const formId = useId()

const open = ref(false)
const confirmText = ref('')
const fieldError = ref('')
const error = ref('')
const pending = ref(false)
const renews = computed(() => subscriptionStillRenews(billing.billing))

function start() {
  confirmText.value = ''
  fieldError.value = ''
  error.value = ''
  open.value = true
}

async function onSubmit() {
  error.value = ''
  if (!isDeleteConfirmed(confirmText.value)) {
    fieldError.value = `Wpisz ${DELETE_WORD}, żeby potwierdzić.`
    return
  }
  fieldError.value = ''
  pending.value = true

  // Fresh check: the subscription might have changed in another tab (or in the Stripe portal).
  let current
  try {
    current = await billing.loadBilling(true)
  } catch {
    pending.value = false
    error.value = NETWORK_ERROR
    return
  }
  if (subscriptionStillRenews(current)) {
    pending.value = false
    error.value = RENEWING_SUBSCRIPTION_ERROR
    return
  }

  const res = await deleteMyAccount()
  if (!res.ok) {
    pending.value = false
    error.value = res.error
    return
  }
  // The user no longer exists, so only the session on this device has to go.
  try { await auth.signOut('local') } catch { /* already gone */ }
  billing.reset()
  open.value = false
  router.replace(ROUTES.goodbye)
}
</script>

<template>
  <div class="card danger-card">
    <p class="muted">Usuniemy Twoje konto i wszystkie powiązane dane. <strong class="strong">Tego nie da się cofnąć.</strong></p>
    <p v-if="renews" class="alert alert-warn" style="margin-top: 14px">
      <TriangleAlert :size="18" aria-hidden="true" />
      <span>{{ RENEWING_SUBSCRIPTION_ERROR }}</span>
    </p>
    <div class="form-actions" style="margin-top: 18px">
      <button type="button" class="button button-danger button-sm" :disabled="renews" @click="start"><Trash2 :size="16" aria-hidden="true" />Usuń konto…</button>
    </div>
  </div>

  <AppDialog v-model:open="open" title="Usunąć konto na zawsze?" :dismissible="!pending">
    <form :id="formId" class="form delete-form" novalidate @submit.prevent="onSubmit">
      <p>Znikną Twoje podejścia do arkuszy, wypracowania, rozmowy z tutorem, notatki, fiszki i ustawienia. Jeśli chcesz coś zachować, najpierw pobierz swoje dane.</p>
      <AppField v-slot="fld" :label="`Wpisz ${DELETE_WORD}, żeby potwierdzić`" :error="fieldError">
        <input :id="fld.id" v-model="confirmText" class="input" name="confirm" autocomplete="off" autocapitalize="characters" spellcheck="false" autofocus :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" @input="fieldError = ''" />
      </AppField>
      <FormMessage :message="error" />
    </form>
    <template #actions>
      <button type="button" class="button button-outline button-sm" :disabled="pending" @click="open = false">Anuluj</button>
      <SubmitButton :form="formId" :pending="pending" pending-text="Usuwam…" variant="danger" small>Usuń konto na zawsze</SubmitButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.danger-card { border-color: var(--error-line); }
.strong { color: var(--text); }
.delete-form { margin-top: 0; }
.delete-form p { color: var(--text-soft); }
</style>
