<script setup>
// Renders the dialog behind `useUiStore().confirm(...)`. Mounted once in Root.vue.
// The safe choice comes first; the destructive one is second and red.
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import AppDialog from './AppDialog.vue'

const ui = useUiStore()
const req = computed(() => ui.confirmRequest)
</script>

<template>
  <AppDialog :open="Boolean(req)" :title="req?.title ?? ''" @close="ui.settleConfirm(false)">
    <p v-if="req?.body">{{ req.body }}</p>
    <template #actions>
      <button type="button" class="button button-outline button-sm" @click="ui.settleConfirm(false)">{{ req?.cancelLabel }}</button>
      <button type="button" class="button button-sm" :class="req?.danger ? 'button-danger' : 'button-dark'" @click="ui.settleConfirm(true)">{{ req?.confirmLabel }}</button>
    </template>
  </AppDialog>
</template>
