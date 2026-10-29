<script setup>
// Password field with show/hide and (optionally) a live strength hint matching passwordSchema:
// 8+ characters, a letter and a digit.
import { computed, ref } from 'vue'
import { Check, Eye, EyeOff } from '@lucide/vue'

const model = defineModel({ type: String, default: '' })
const props = defineProps({
  id: { type: String, required: true },
  autocomplete: { type: String, default: 'current-password' },
  invalid: { type: String, default: undefined },
  describedby: { type: String, default: undefined },
  strength: { type: Boolean, default: false },
})
defineEmits(['blur'])
const visible = ref(false)
const rules = computed(() => [
  { label: '8+ znaków', ok: model.value.length >= 8 && model.value.length <= 72 },
  { label: 'litera', ok: /[a-zA-Z]/.test(model.value) },
  { label: 'cyfra', ok: /\d/.test(model.value) },
])
</script>

<template>
  <div class="password-input">
    <input :id="id" v-model="model" class="input" :type="visible ? 'text' : 'password'" :autocomplete="autocomplete" :aria-invalid="invalid" :aria-describedby="describedby" maxlength="72" @blur="$emit('blur')" />
    <button type="button" class="icon-button reveal" :aria-label="visible ? 'Ukryj hasło' : 'Pokaż hasło'" :aria-pressed="visible" @click="visible = !visible"><EyeOff v-if="visible" :size="18" /><Eye v-else :size="18" /></button>
  </div>
  <ul v-if="props.strength" class="pw-rules" aria-label="Wymagania hasła">
    <li v-for="r in rules" :key="r.label" :class="{ ok: r.ok }"><Check :size="13" />{{ r.label }}</li>
  </ul>
</template>

<style scoped>
.password-input { position: relative; }
.password-input .input { padding-right: 52px; }
.reveal { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); color: var(--text-soft); }
.pw-rules { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; padding: 0; margin: 0; }
.pw-rules li { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 99px; background: var(--surface-2); color: var(--text-soft); transition: background .15s, color .15s; }
.pw-rules li svg { opacity: .35; }
.pw-rules li.ok { background: var(--ok-bg); color: var(--ok); }
.pw-rules li.ok svg { opacity: 1; }
</style>
