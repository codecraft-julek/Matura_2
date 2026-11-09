<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ROUTES } from '@/config/routes'
import { privacyChoice, setPrivacyChoice } from '@/lib/privacy/analytics'

defineProps({ compact: Boolean })
const age16 = ref(false)
const error = ref('')
const notice = ref('')
function choose(allow) {
  if (allow && !age16.value) { error.value = 'Aby włączyć statystyki, potwierdź ukończenie 16 lat. Możesz też pozostawić je wyłączone.'; return }
  error.value = ''
  const saved = setPrivacyChoice(allow, age16.value)
  notice.value = saved ? 'Zapisano wybór.' : 'Wybór działa teraz, ale przeglądarka nie pozwala go zapamiętać.'
}
</script>

<template>
  <div class="analytics-choice">
    <h3>Opcjonalne statystyki</h3>
    <p>Za Twoją zgodą Vercel zliczy odwiedziny publicznych stron. Odmowa nie ograniczy nauki. Wybór zmienisz w <RouterLink :to="`${ROUTES.privacy}#pamiec`">polityce prywatności</RouterLink>.</p>
    <p v-if="!compact" class="choice-status" role="status">Statystyki: <strong>{{ privacyChoice?.analytics ? 'włączone' : 'wyłączone' }}</strong>.</p>
    <label class="check-row"><input v-model="age16" type="checkbox" :aria-invalid="Boolean(error)" /><span>Mam ukończone 16 lat i mogę samodzielnie wyrazić opcjonalną zgodę.</span></label>
    <div class="choice-actions">
      <button type="button" class="button button-outline" @click="choose(false)">{{ privacyChoice?.analytics ? 'Wycofaj zgodę' : 'Tylko niezbędne' }}</button>
      <button type="button" class="button button-outline" @click="choose(true)">Zezwól na statystyki</button>
    </div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="notice && !compact" role="status">{{ notice }}</p>
  </div>
</template>

<style scoped>
h3{font:750 17px/1.4 var(--heading);letter-spacing:-.3px}
p{font-size:13px;line-height:1.65;margin:8px 0 12px;color:var(--text-soft)}
a{text-decoration:underline;text-underline-offset:3px}
.check-row{font-size:12px;line-height:1.6;margin:12px 0;align-items:flex-start}
input{accent-color:var(--green);margin-top:4px;flex-shrink:0}
.choice-actions{display:flex;gap:10px;flex-wrap:wrap}.choice-actions button{flex:1;white-space:nowrap;min-height:44px;font-size:12px;padding:10px 12px}
.field-error{color:var(--error)}
</style>
