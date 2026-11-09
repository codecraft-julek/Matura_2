<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ROUTES } from '@/config/routes'
import { privacyChoice, setPrivacyChoice } from '@/lib/privacy/analytics'

defineProps({ compact: Boolean })
const analytics = ref(false)
const marketing = ref(false)
const age16 = ref(false)
const error = ref('')
const notice = ref('')
const anyOn = computed(() => Boolean(privacyChoice.value?.analytics || privacyChoice.value?.marketing))

// The choice is read after the first render, and can change in another tab.
watch(privacyChoice, current => {
  if (!current) return
  analytics.value = current.analytics
  marketing.value = current.marketing
  age16.value = current.age16
}, { immediate: true })

function save(allowAnalytics, allowMarketing) {
  if ((allowAnalytics || allowMarketing) && !age16.value) { error.value = 'Aby włączyć statystyki lub reklamy, potwierdź ukończenie 16 lat. Możesz też pozostawić je wyłączone.'; return }
  error.value = ''
  const saved = setPrivacyChoice(allowAnalytics, age16.value, allowMarketing)
  notice.value = saved ? 'Zapisano wybór.' : 'Wybór działa teraz, ale przeglądarka nie pozwala go zapamiętać.'
}
</script>

<template>
  <div class="analytics-choice">
    <h3>Statystyki i reklamy</h3>
    <p>Oba są opcjonalne, a odmowa nie ograniczy nauki. Dotyczą tylko publicznych stron, nie Twojego konta ani prac. Wybór zmienisz w <RouterLink :to="`${ROUTES.privacy}#pamiec`">polityce prywatności</RouterLink>.</p>
    <p v-if="!compact" class="choice-status" role="status">Statystyki: <strong>{{ privacyChoice?.analytics ? 'włączone' : 'wyłączone' }}</strong>. Reklamy: <strong>{{ privacyChoice?.marketing ? 'włączone' : 'wyłączone' }}</strong>.</p>
    <label class="check-row"><input v-model="analytics" type="checkbox" /><span><strong>Statystyki.</strong> Vercel zlicza odwiedziny stron.</span></label>
    <label class="check-row"><input v-model="marketing" type="checkbox" /><span><strong>Reklamy.</strong> Meta (Facebook) mierzy wejścia z reklam i może dopasowywać reklamy w swoich serwisach.</span></label>
    <label class="check-row"><input v-model="age16" type="checkbox" :aria-invalid="Boolean(error)" /><span>Mam ukończone 16 lat i mogę samodzielnie wyrazić opcjonalną zgodę.</span></label>
    <div class="choice-actions">
      <button type="button" class="button button-outline" @click="save(false, false)">{{ anyOn ? 'Wycofaj zgody' : 'Tylko niezbędne' }}</button>
      <button type="button" class="button button-outline" @click="save(analytics, marketing)">Zapisz wybór</button>
      <button type="button" class="button button-outline" @click="save(true, true)">Zezwól na oba</button>
    </div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="notice && !compact" role="status">{{ notice }}</p>
  </div>
</template>

<style scoped>
h3{font:750 17px/1.4 var(--heading);letter-spacing:-.3px}
p{font-size:13px;line-height:1.65;margin:8px 0 12px;color:var(--text-soft)}
a{text-decoration:underline;text-underline-offset:3px}
.check-row{font-size:12px;line-height:1.6;margin:10px 0;align-items:flex-start}
.check-row strong{color:var(--text)}
input{accent-color:var(--green);margin-top:4px;flex-shrink:0}
.choice-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.choice-actions button{flex:1;white-space:nowrap;min-height:44px;font-size:12px;padding:10px 12px}
.field-error{color:var(--error)}
</style>
