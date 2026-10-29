<script setup>
// Account page: set a new password while logged in (auth.updateUser).
import { ref, watch } from 'vue'
import AppField from '@/ui/AppField.vue'
import PasswordInput from '@/ui/PasswordInput.vue'
import { supabase } from '@/lib/supabase'
import { authErrorMessage, newPasswordSchema, passwordSchema, toFieldErrors } from '@/lib/validation/auth'
import { NETWORK_ERROR } from '@/lib/api/account'
import { useAuthStore } from '@/stores/auth'
import FormMessage from './FormMessage.vue'
import SubmitButton from './SubmitButton.vue'
import { focusFirstInvalid, schemaError, useFieldErrors } from './form'

const auth = useAuthStore()
const form = ref(null)
const password = ref('')
const confirm = ref('')
const pending = ref(false)
const result = ref(null) // { ok, text }

const f = useFieldErrors({
  password: v => schemaError(passwordSchema, v),
  confirm: v => (v && v !== password.value ? 'Hasła się różnią.' : ''),
})
watch(password, v => { f.input('password', v); f.input('confirm', confirm.value) })
watch(confirm, v => f.input('confirm', v))

async function onSubmit() {
  result.value = null
  const parsed = newPasswordSchema.safeParse({ password: password.value, confirm: confirm.value })
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
  pending.value = false
  if (error) {
    result.value = { ok: false, text: error.network ? NETWORK_ERROR : authErrorMessage(error.code) }
    return
  }
  password.value = ''
  confirm.value = ''
  result.value = { ok: true, text: 'Hasło zmienione ✓' }
}
</script>

<template>
  <form ref="form" class="form" novalidate @submit.prevent="onSubmit">
    <!-- Lets password managers know which account the new password belongs to. -->
    <input type="email" name="username" autocomplete="username" :value="auth.email" readonly hidden />
    <AppField v-slot="fld" label="Nowe hasło" :error="f.errors.password">
      <PasswordInput :id="fld.id" v-model="password" autocomplete="new-password" strength :invalid="fld.invalid" :describedby="fld.describedby" @blur="f.blur('password', password)" />
    </AppField>
    <AppField v-slot="fld" label="Powtórz nowe hasło" :error="f.errors.confirm">
      <PasswordInput :id="fld.id" v-model="confirm" autocomplete="new-password" :invalid="fld.invalid" :describedby="fld.describedby" @blur="f.blur('confirm', confirm)" />
    </AppField>
    <div class="form-actions">
      <SubmitButton :pending="pending" pending-text="Zmieniam…" variant="outline">Zmień hasło</SubmitButton>
    </div>
    <FormMessage :message="result?.text ?? ''" :tone="result?.ok ? 'ok' : 'error'" />
  </form>
</template>
