<script setup>
// Native <dialog> (focus trap, Escape, top layer) with our look. Controlled with v-model:open.
//   <AppDialog v-model:open="show" title="Usunąć talię?"> …body… <template #actions>…</template></AppDialog>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X } from '@lucide/vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  wide: { type: Boolean, default: false },
  /** false = clicking the backdrop does not close it (e.g. unsaved form). */
  dismissible: { type: Boolean, default: true },
})
const emit = defineEmits(['update:open', 'close'])
const dialog = ref(null)
let opener = null

watch(() => props.open, async value => {
  await nextTick()
  if (!dialog.value) return
  if (value && !dialog.value.open) {
    opener = document.activeElement
    dialog.value.showModal()
    document.body.classList.add('modal-open')
  } else if (!value && dialog.value.open) dialog.value.close()
}, { immediate: true })

function onClose() {
  document.body.classList.remove('modal-open')
  emit('update:open', false)
  emit('close')
  if (opener?.isConnected) opener.focus()
}
function onBackdrop(event) {
  if (!props.dismissible || event.target !== dialog.value) return
  const r = dialog.value.getBoundingClientRect()
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.value.close()
}
onBeforeUnmount(() => document.body.classList.remove('modal-open'))
</script>

<template>
  <dialog ref="dialog" class="app-dialog" :style="wide ? { width: 'min(720px, calc(100% - 32px))' } : null" :aria-label="title" @close="onClose" @click="onBackdrop">
    <template v-if="open">
      <button type="button" class="icon-button dialog-close" aria-label="Zamknij okno" @click="dialog.close()"><X :size="20" /></button>
      <h2>{{ title }}</h2>
      <div class="dialog-body"><slot /></div>
      <div v-if="$slots.actions" class="dialog-actions"><slot name="actions" /></div>
    </template>
  </dialog>
</template>
