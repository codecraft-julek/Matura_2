<script setup>
// /rejestracja: e-mail, password (live strength), terms + age consent, Turnstile.
// terms_version + age_confirmed go into user metadata; a database trigger copies them into the
// profile and refuses to create the account without them.
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppField from '@/ui/AppField.vue'
import PasswordInput from '@/ui/PasswordInput.vue'
import Captcha, { captchaEnabled } from '@/ui/Captcha.vue'
import CheckInbox from '@/components/account/CheckInbox.vue'
import FormMessage from '@/components/account/FormMessage.vue'
import SubmitButton from '@/components/account/SubmitButton.vue'
import { focusFirstInvalid, schemaError, useFieldErrors } from '@/components/account/form'
import { ROUTES } from '@/config/routes'
import { TERMS_VERSION } from '@/config/site'
import { supabase } from '@/lib/supabase'
import { NETWORK_ERROR, confirmLink } from '@/lib/api/account'
import { authErrorMessage, passwordSchema, signupSchema, toFieldErrors } from '@/lib/validation/auth'
import { useBillingStore } from '@/stores/billing'

const CAPTCHA_WAIT = 'Chwilka, sprawdzamy, czy nie jesteś botem. Spróbuj za moment.'

const route = useRoute()
const router = useRouter()
const billing = useBillingStore()

const form = ref(null)
const values = reactive({ email: '', password: '', acceptTerms: false, ageConfirmed: false })
const pending = ref(false)
const message = ref('')
const sentTo = ref('') // set = "check your inbox" step
const captchaToken = ref(null)
const captchaReset = ref(0)

// ?next= (e.g. from /logowanie?next=/premium/platnosc?plan=matura) survives onboarding.
const next = computed(() => (typeof route.query.next === 'string' ? route.query.next : null))
const onboardingPath = computed(() => (next.value ? `${ROUTES.onboarding}?next=${encodeURIComponent(next.value)}` : ROUTES.onboarding))
const loginLink = computed(() => (next.value ? { path: ROUTES.login, query: { next: next.value } } : ROUTES.login))

const f = useFieldErrors({
  email: v => schemaError(signupSchema.shape.email, v),
  password: v => schemaError(passwordSchema, v),
  acceptTerms: v => schemaError(signupSchema.shape.acceptTerms, v),
  ageConfirmed: v => schemaError(signupSchema.shape.ageConfirmed, v),
})
watch(() => values.acceptTerms, v => f.input('acceptTerms', v))
watch(() => values.ageConfirmed, v => f.input('ageConfirmed', v))

async function onSubmit() {
  message.value = ''
  const parsed = signupSchema.safeParse(values)
  if (!parsed.success) {
    f.set(toFieldErrors(parsed.error))
    message.value = 'Popraw zaznaczone pola.'
    focusFirstInvalid(form.value)
    return
  }
  f.clear()
  if (captchaEnabled && !captchaToken.value) {
    message.value = CAPTCHA_WAIT
    return
  }

  pending.value = true
  // Runs in the browser on purpose: Supabase rate-limits signups per IP (the student's own).
  let data, error
  try {
    ;({ data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { terms_version: TERMS_VERSION, age_confirmed: true },
        captchaToken: captchaToken.value ?? undefined,
        // Used by Supabase's default e-mail template; our own template (supabase/templates/confirmation.html)
        // links to {{ .SiteURL }}/auth/potwierdz?…&next=/witaj by itself.
        emailRedirectTo: confirmLink(onboardingPath.value),
      },
    }))
  } catch {
    error = { network: true }
  }
  pending.value = false
  captchaReset.value++ // a token works once

  if (error) {
    message.value = error.network ? NETWORK_ERROR : authErrorMessage(error.code)
    return
  }
  if (!data.session) {
    // E-mail confirmation is on: the account starts working after clicking the link.
    sentTo.value = parsed.data.email
    return
  }
  billing.reset()
  router.replace(onboardingPath.value)
}

function startOver() {
  sentTo.value = ''
  values.password = ''
}
</script>

<template>
  <CheckInbox v-if="sentTo" title="Prawie gotowe!">
    <p>Wysłaliśmy maila na <strong class="strong">{{ sentTo }}</strong>. Kliknij link w środku, żeby aktywować konto.</p>
    <p class="small">Nie widzisz maila? Zajrzyj do spamu.</p>
    <template #actions>
      <button type="button" class="button button-outline button-sm" @click="startOver">Pomyłka w adresie? Popraw go</button>
    </template>
  </CheckInbox>

  <template v-else>
    <h1>Załóż konto</h1>
    <p class="auth-lead">Zajmie Ci to pół minuty. Za darmo, bez karty.</p>

    <form ref="form" class="form" novalidate @submit.prevent="onSubmit">
      <AppField v-slot="fld" label="E-mail" :error="f.errors.email">
        <input :id="fld.id" v-model="values.email" class="input" type="email" name="email" inputmode="email" autocomplete="email" placeholder="ty@gmail.com" :aria-invalid="fld.invalid" :aria-describedby="fld.describedby" @blur="f.blur('email', values.email)" @input="f.input('email', values.email)" />
      </AppField>

      <AppField v-slot="fld" label="Hasło" :error="f.errors.password">
        <PasswordInput :id="fld.id" v-model="values.password" autocomplete="new-password" strength :invalid="fld.invalid" :describedby="fld.describedby" @blur="f.blur('password', values.password)" @update:model-value="v => f.input('password', v)" />
      </AppField>

      <div class="stack consents" style="--gap: 12px">
        <div>
          <label class="check-row">
            <input v-model="values.acceptTerms" type="checkbox" name="acceptTerms" :aria-invalid="f.errors.acceptTerms ? 'true' : undefined" :aria-describedby="f.errors.acceptTerms ? 'signup-terms-error' : undefined" />
            <span>Akceptuję <RouterLink :to="ROUTES.terms" target="_blank" rel="noopener" class="link">regulamin</RouterLink> i <RouterLink :to="ROUTES.privacy" target="_blank" rel="noopener" class="link">politykę prywatności</RouterLink>.</span>
          </label>
          <p v-if="f.errors.acceptTerms" id="signup-terms-error" class="field-error consent-error" role="alert">{{ f.errors.acceptTerms }}</p>
        </div>
        <div>
          <label class="check-row">
            <input v-model="values.ageConfirmed" type="checkbox" name="ageConfirmed" :aria-invalid="f.errors.ageConfirmed ? 'true' : undefined" :aria-describedby="f.errors.ageConfirmed ? 'signup-age-error' : undefined" />
            <span>Mam co najmniej 16 lat albo zgodę rodzica/opiekuna.</span>
          </label>
          <p v-if="f.errors.ageConfirmed" id="signup-age-error" class="field-error consent-error" role="alert">{{ f.errors.ageConfirmed }}</p>
        </div>
      </div>

      <Captcha :reset-key="captchaReset" @token="t => (captchaToken = t)" />
      <SubmitButton :pending="pending" pending-text="Zakładam konto…" block class="button-large">Załóż konto</SubmitButton>
      <FormMessage :message="message" :tone="message === CAPTCHA_WAIT ? 'info' : 'error'" />
    </form>

    <p class="auth-foot">Masz już konto? <RouterLink :to="loginLink" class="link">Zaloguj się</RouterLink></p>
  </template>
</template>

<style scoped>
.strong { color: var(--text); }
.consent-error { margin: 6px 0 0 30px; }
</style>
