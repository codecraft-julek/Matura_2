<script setup>
// /nowe-haslo: reached from the reset link (via /auth/potwierdz, which logs the student in).
// The router guard sends anyone without a session to the login page.
import { reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppField from '@/ui/AppField.vue'
import PasswordInput from '@/ui/PasswordInput.vue'
import FormMessage from '@/components/account/FormMessage.vue'
import SubmitButton from '@/components/account/SubmitButton.vue'
import { focusFirstInvalid, schemaError, useFieldErrors } from '@/components/account/form'
import { ROUTES } from '@/config/routes'
import { supabase } from '@/lib/supabase'
import { NETWORK_ERROR } from '@/lib/api/account'
import { authErrorMessage, newPasswordSchema, passwordSchema, toFieldErrors } from '@/lib/validation/auth'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const form = ref(null)
const values = reactive({ password: '', confirm: '' })
const pending = ref(false)
const message = ref('')

const f = useFieldErrors({
  password: v => schemaError(passwordSchema, v),
  confirm: v => (v && v !== values.password ? 'Hasła się różnią.' : ''),
})
watch(() => values.password, v => { f.input('password', v); f.input('confirm', values.confirm) })
watch(() => values.confirm, v => f.input('confirm', v))

async function onSubmit() {
  message.value = ''
  const parsed = newPasswordSchema.safeParse(values)
  if (!parsed.success) {
    f.set(toFieldErrors(parsed.error))
    focusFirstInvalid(form.value)
    return
  }
  f.clear()
  pending.value = true
  let error
  try {
    ;({ error } = await supabase.auth.updateUser({ password: parsed.data.password }))
  } catch {
    error = { network: true }
  }
  if (error) {
    pending.value = false
    message.value = error.network ? NETWORK_ERROR : authErrorMessage(error.code)
    return
  }
  ui.toast('Nowe hasło ustawione ✓')
  router.replace(ROUTES.dashboard)
}
</script>

<template>
  <h1>Ustaw nowe hasło</h1>
  <p class="auth-lead">Wymyśl nowe hasło. Stare przestanie działać.</p>

  <form ref="form" class="form" novalidate @submit.prevent="onSubmit">
    <!-- Lets password managers save the new password for the right account. -->
    <input type="email" name="username" autocomplete="username" :value="auth.email" readonly hidden />
    <AppField v-slot="fld" label="Nowe hasło" :error="f.errors.password">
      <PasswordInput :id="fld.id" v-model="values.password" autocomplete="new-password" strength :invalid="fld.invalid" :describedby="fld.describedby" @blur="f.blur('password', values.password)" />
    </AppField>
    <AppField v-slot="fld" label="Powtórz hasło" :error="f.errors.confirm">
      <PasswordInput :id="fld.id" v-model="values.confirm" autocomplete="new-password" :invalid="fld.invalid" :describedby="fld.describedby" @blur="f.blur('confirm', values.confirm)" />
    </AppField>
    <SubmitButton :pending="pending" pending-text="Zapisuję…" block class="button-large">Ustaw nowe hasło</SubmitButton>
    <FormMessage :message="message" />
  </form>
</template>
