<script setup>
// /creators/logowanie: creators log in here. We make their login in /admin and e-mail a link to set
// the password; "Ustaw albo zmień hasło" sends a fresh one (same answer whether the account exists).
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppField from '@/ui/AppField.vue'
import PasswordInput from '@/ui/PasswordInput.vue'
import Captcha, { captchaEnabled } from '@/ui/Captcha.vue'
import CheckInbox from '@/components/account/CheckInbox.vue'
import FormMessage from '@/components/account/FormMessage.vue'
import SubmitButton from '@/components/account/SubmitButton.vue'
import { focusFirstInvalid, schemaError, useFieldErrors } from '@/components/account/form'
import { ROUTES } from '@/config/routes'
import { supabase } from '@/lib/supabase'
import { NETWORK_ERROR, confirmLink } from '@/lib/api/account'
import { authErrorMessage, emailOnlySchema, loginSchema, toFieldErrors } from '@/lib/validation/auth'
import { useBillingStore } from '@/stores/billing'

const CAPTCHA_WAIT = 'Chwilka, sprawdzamy, czy nie jesteś botem. Spróbuj za moment.'

const router = useRouter()
const billing = useBillingStore()

const mode = ref('login') // 'login' | 'link' | 'sent'
const form = ref(null)
const values = reactive({ email: '', password: '' })
const pending = ref(false)
const message = ref('')
const captchaToken = ref(null)
const captchaReset = ref(0)

const f = useFieldErrors({
  email: v => schemaError(loginSchema.shape.email, v),
  password: v => schemaError(loginSchema.shape.password, v),
})

function switchTo(next) {
  mode.value = next
  message.value = ''
  f.clear()
}

async function onSubmit() {
  message.value = ''
  const parsed = mode.value === 'login' ? loginSchema.safeParse(values) : emailOnlySchema.safeParse({ email: values.email })
  if (!parsed.success) {
    f.set(toFieldErrors(parsed.error))
    focusFirstInvalid(form.value)
    return
  }
  f.clear()
  if (captchaEnabled && !captchaToken.value) {
    message.value = CAPTCHA_WAIT
    return
  }

  pending.value = true
  const captcha = captchaToken.value ?? undefined
  let error
  try {
    ;({ error } = mode.value === 'login'
      ? await supabase.auth.signInWithPassword({ ...parsed.data, options: { captchaToken: captcha } })
      // The link logs the creator in and asks for a password; /nowe-haslo then brings them back here.
      : await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: confirmLink(ROUTES.newPassword), captchaToken: captcha }))
  } catch {
    error = { network: true }
  }
  pending.value = false
  captchaReset.value++ // a token works once

  if (mode.value === 'link') {
    if (error?.network) message.value = NETWORK_ERROR
    else if (['over_email_send_rate_limit', 'over_request_rate_limit', 'captcha_failed'].includes(error?.code)) message.value = authErrorMessage(error.code)
    else mode.value = 'sent' // the same answer either way, so nobody can check who has an account
    return
  }
  if (error) {
    message.value = error.network ? NETWORK_ERROR : authErrorMessage(error.code)
    return
  }
  billing.reset() // someone else may have used this browser before
  router.replace(ROUTES.creators)
}
</script>

<template>
  <CheckInbox v-if="mode === 'sent'" title="Sprawdź skrzynkę">
    <p>Jeśli masz u nas panel twórcy, wysłaliśmy na <strong>{{ values.email }}</strong> link do ustawienia hasła. Link działa przez godzinę.</p>
    <p class="small">Nie widzisz maila? Zajrzyj do spamu.</p>
    <template #actions>
      <button type="button" class="button button-outline" @click="switchTo('login')">Wróć do logowania</button>
    </template>
  </CheckInbox>

  <template v-else>
    <span class="page-kicker">Panel twórcy</span>
    <h1>{{ mode === 'login' ? 'Zaloguj się' : 'Ustaw hasło' }}</h1>
    <p class="auth-lead">{{ mode === 'login' ? 'Zobacz, ile osób użyło Twojego kodu i ile prowizji Ci się należy.' : 'Podaj e-mail, na który założyliśmy Twój panel. Wyślemy link do ustawienia hasła.' }}</p>

    <form ref="form" class="form" novalidate @submit.prevent="onSubmit">
      <AppField v-slot="fld" label="E-mail" :error="f.errors.email">
        <input :id="fld.id" v-model="values.email" class="input" type="email" name="email" inputmode="email" autocomplete="email" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" @blur="f.blur('email', values.email)" @input="f.input('email', values.email)" />
      </AppField>

      <AppField v-if="mode === 'login'" v-slot="fld" label="Hasło" :error="f.errors.password">
        <PasswordInput :id="fld.id" v-model="values.password" autocomplete="current-password" :invalid="fld.invalid" :describedby="fld.describedby" @update:model-value="v => f.input('password', v)" />
      </AppField>

      <Captcha :reset-key="captchaReset" @token="t => (captchaToken = t)" />
      <SubmitButton :pending="pending" :pending-text="mode === 'login' ? 'Loguję…' : 'Wysyłam…'" block class="button-large">{{ mode === 'login' ? 'Zaloguj się' : 'Wyślij link' }}</SubmitButton>
      <FormMessage :message="message" :tone="message === CAPTCHA_WAIT ? 'info' : 'error'" />
    </form>

    <p class="auth-foot">
      <button v-if="mode === 'login'" type="button" class="text-button link" @click="switchTo('link')">Pierwszy raz tutaj? Ustaw albo zmień hasło</button>
      <button v-else type="button" class="text-button link" @click="switchTo('login')">Mam już hasło, zaloguj mnie</button>
    </p>
  </template>
</template>
