<script setup>
// "Sprawdź skrzynkę" step after signup or a password-reset request. Takes focus when it appears,
// so keyboard and screen-reader users land on the new content.
import { onMounted, ref } from 'vue'
import { MailCheck } from '@lucide/vue'

defineProps({ title: { type: String, required: true } })
const heading = ref(null)
onMounted(() => heading.value?.focus())
</script>

<template>
  <div class="check-inbox">
    <span class="inbox-icon" aria-hidden="true"><MailCheck :size="26" /></span>
    <h1 ref="heading" tabindex="-1">{{ title }}</h1>
    <div class="auth-lead stack" style="--gap: 10px"><slot /></div>
    <div v-if="$slots.actions" class="form-actions inbox-actions"><slot name="actions" /></div>
  </div>
</template>

<style scoped>
.inbox-icon { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 16px; background: var(--lime); color: var(--green); margin-bottom: 18px; }
h1:focus { outline: none; }
.inbox-actions { margin-top: 22px; }
</style>
