<script setup>
// /nie-pamietam-hasla: sends a password-reset link. Always shows the same answer, so nobody can
// check who has an account (only rate limits are worth telling).
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppField from '@/ui/AppField.vue'
import Captcha, { captchaEnabled } from '@/ui/Captcha.vue'
import CheckInbox from '@/components/account/CheckInbox.vue'
import FormMessage from '@/components/account/FormMessage.vue'
import SubmitButton from '@/components/account/SubmitButton.vue'
import { focusFirstInvalid, schemaError, useFieldErrors } from '@/components/account/form'
import { ROUTES } from '@/config/routes'
import { supabase } from '@/lib/supabase'
import { NETWORK_ERROR, confirmLink } from '@/lib/api/account'
import { authErrorMessage, emailOnlySchema } from '@/lib/validation/auth'

const CAPTCHA_WAIT = 'Chwilka, sprawdzamy, czy nie jesteś botem. Spróbuj za moment.'

const form = ref(null)
const email = ref('')
const pending = ref(false)
const message = ref('')
const sent = ref(false)
const captchaToken = ref(null)
const captchaReset = ref(0)

const f = useFieldErrors({ email: v => schemaError(emailOnlySchema.shape.email, v) })

async function onSubmit() {
  message.value = ''
  const parsed = emailOnlySchema.safeParse({ email: email.value })
  if (!parsed.success) {
    f.set({ email: parsed.error.issues[0]?.message ?? 'Sprawdź adres e-mail.' })
    focusFirstInvalid(form.value)
    return
  }
  f.clear()
  if (captchaEnabled && !captchaToken.value) {
    message.value = CAPTCHA_WAIT
    return
  }

  pending.value = true
  let error
  try {
    // The link brings the student back logged in, straight to the "new password" page.
    ;({ error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: confirmLink(ROUTES.newPassword),
      captchaToken: captchaToken.value ?? undefined,
    }))
  } catch {
    error = { network: true }
  }
  pending.value = false
  captchaReset.value++ // a token works once

  if (error?.network) { message.value = NETWORK_ERROR; return }
  if (error?.code === 'over_email_send_rate_limit' || error?.code === 'over_request_rate_limit' || error?.code === 'captcha_failed') {
    message.value = authErrorMessage(error.code)
    return
  }
  sent.value = true
}
</script>

<template>
  <CheckInbox v-if="sent" title="Sprawdź skrzynkę">
    <p>Jeśli mamy konto na ten adres, wysłaliśmy na niego link do ustawienia nowego hasła. Link działa przez godzinę.</p>
    <p class="small">Nie widzisz maila? Zajrzyj do spamu.</p>
    <template #actions>
      <RouterLink :to="ROUTES.login" class="button button-dark button-sm">Wróć do logowania</RouterLink>
      <button type="button" class="button button-outline button-sm" @click="sent = false">Wyślij na inny adres</button>
    </template>
  </CheckInbox>

  <template v-else>
    <h1>Nie pamiętasz hasła?</h1>
    <p class="auth-lead">Podaj e-mail, a wyślemy Ci link do ustawienia nowego.</p>

    <form ref="form" class="form" novalidate @submit.prevent="onSubmit">
      <AppField v-slot="fld" label="E-mail" hint="Ten, na który zakładałeś konto." :error="f.errors.email">
        <input :id="fld.id" v-model="email" class="input" type="email" name="email" inputmode="email" autocomplete="email" placeholder="ty@gmail.com" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" @blur="f.blur('email', email)" @input="f.input('email', email)" />
      </AppField>
      <Captcha :reset-key="captchaReset" @token="t => (captchaToken = t)" />
      <SubmitButton :pending="pending" pending-text="Wysyłam…" block class="button-large">Wyślij link</SubmitButton>
      <FormMessage :message="message" :tone="message === CAPTCHA_WAIT ? 'info' : 'error'" />
    </form>

    <p class="auth-foot">Jednak pamiętasz? <RouterLink :to="ROUTES.login" class="link">Zaloguj się</RouterLink></p>
  </template>
</template>
