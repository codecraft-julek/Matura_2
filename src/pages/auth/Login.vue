<script setup>
// /logowanie: e-mail + password (+ Turnstile). ?next= brings the student back where they were
// (only our own pages, see safeNextPath); ?blad=link means an e-mail link expired or was used.
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { CircleAlert } from '@lucide/vue'
import AppField from '@/ui/AppField.vue'
import PasswordInput from '@/ui/PasswordInput.vue'
import Captcha, { captchaEnabled } from '@/ui/Captcha.vue'
import FormMessage from '@/components/account/FormMessage.vue'
import SubmitButton from '@/components/account/SubmitButton.vue'
import { focusFirstInvalid, schemaError, useFieldErrors } from '@/components/account/form'
import { ROUTES, safeNextPath } from '@/config/routes'
import { supabase } from '@/lib/supabase'
import { NETWORK_ERROR } from '@/lib/api/account'
import { authErrorMessage, loginSchema, toFieldErrors } from '@/lib/validation/auth'
import { useBillingStore } from '@/stores/billing'

const CAPTCHA_WAIT = 'Chwilka, sprawdzamy, czy nie jesteś botem. Spróbuj za moment.'

const route = useRoute()
const router = useRouter()
const billing = useBillingStore()

const form = ref(null)
const values = reactive({ email: '', password: '' })
const pending = ref(false)
const message = ref('')
const captchaToken = ref(null)
const captchaReset = ref(0)

const linkExpired = computed(() => route.query.blad === 'link')
const next = computed(() => (typeof route.query.next === 'string' ? route.query.next : null))
const signupLink = computed(() => (next.value ? { path: ROUTES.signup, query: { next: next.value } } : ROUTES.signup))

const f = useFieldErrors({
  email: v => schemaError(loginSchema.shape.email, v),
  password: v => schemaError(loginSchema.shape.password, v),
})

async function onSubmit() {
  message.value = ''
  const parsed = loginSchema.safeParse(values)
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
  // Runs in the browser on purpose: Supabase rate-limits logins per IP (the student's own).
  let error
  try {
    ;({ error } = await supabase.auth.signInWithPassword({ ...parsed.data, options: { captchaToken: captchaToken.value ?? undefined } }))
  } catch {
    error = { network: true }
  }
  if (error) {
    captchaReset.value++ // a token works once
    pending.value = false
    message.value = error.network ? NETWORK_ERROR : authErrorMessage(error.code)
    return
  }
  billing.reset() // a different student may have used this browser before
  router.replace(safeNextPath(next.value))
}
</script>

<template>
  <p v-if="linkExpired" class="alert alert-error link-expired" role="alert">
    <CircleAlert :size="18" aria-hidden="true" />
    <span>Ten link wygasł albo był już użyty. <RouterLink :to="ROUTES.forgotPassword" class="link">Wyślij nowy</RouterLink>.</span>
  </p>

  <h1>Hej, wracasz?</h1>
  <p class="auth-lead">Zaloguj się i lecimy dalej.</p>

  <form ref="form" class="form" novalidate @submit.prevent="onSubmit">
    <AppField v-slot="fld" label="E-mail" :error="f.errors.email">
      <input :id="fld.id" v-model="values.email" class="input" type="email" name="email" inputmode="email" autocomplete="email" placeholder="ty@gmail.com" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" @blur="f.blur('email', values.email)" @input="f.input('email', values.email)" />
    </AppField>

    <div class="stack" style="--gap: 8px">
      <AppField v-slot="fld" label="Hasło" :error="f.errors.password">
        <PasswordInput :id="fld.id" v-model="values.password" autocomplete="current-password" :invalid="fld.invalid" :describedby="fld.describedby" @update:model-value="v => f.input('password', v)" />
      </AppField>
      <RouterLink :to="ROUTES.forgotPassword" class="forgot link small">Nie pamiętasz hasła?</RouterLink>
    </div>

    <Captcha :reset-key="captchaReset" @token="t => (captchaToken = t)" />
    <SubmitButton :pending="pending" pending-text="Loguję…" block class="button-large">Zaloguj się</SubmitButton>
    <FormMessage :message="message" :tone="message === CAPTCHA_WAIT ? 'info' : 'error'" />
  </form>

  <p class="auth-foot">Nie masz konta? <RouterLink :to="signupLink" class="link">Załóż je za darmo</RouterLink></p>
</template>

<style scoped>
.link-expired { margin-bottom: 22px; }
.forgot { align-self: flex-end; }
</style>
