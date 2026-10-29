<script setup>
// Load failed: message + "Spróbuj ponownie".
import { CircleAlert, RotateCw } from '@lucide/vue'

defineProps({ message: { type: String, default: 'Nie udało się wczytać danych. Sprawdź internet i spróbuj ponownie.' } })
defineEmits(['retry'])
</script>

<template>
  <div class="alert alert-error" role="alert">
    <CircleAlert :size="18" />
    <div class="stack" style="--gap: 10px">
      <span>{{ message }}</span>
      <div><button type="button" class="button button-outline button-sm" @click="$emit('retry')"><RotateCw :size="15" /> Spróbuj ponownie</button></div>
    </div>
  </div>
</template>
