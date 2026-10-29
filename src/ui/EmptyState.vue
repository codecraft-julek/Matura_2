<script setup>
// "Nothing here yet" with a call to action.
//   <EmptyState :icon="Layers" title="Nie masz jeszcze talii" text="…"><RouterLink …>Nowa talia</RouterLink></EmptyState>
defineProps({ icon: { type: [Object, Function], default: null }, title: { type: String, required: true }, text: { type: String, default: '' } })
</script>

<template>
  <div class="empty-state card card-tinted">
    <span v-if="icon" class="empty-icon"><component :is="icon" :size="24" /></span>
    <h2>{{ title }}</h2>
    <p v-if="text">{{ text }}</p>
    <div v-if="$slots.default" class="row" style="justify-content: center; margin-top: 18px"><slot /></div>
  </div>
</template>

<style scoped>
.empty-state { text-align: center; padding: 40px 24px; }
.empty-icon { display: inline-grid; place-items: center; width: 52px; height: 52px; border-radius: 14px; background: #e4edda; color: #607b48; border: 1px solid #d1ddc0; margin-bottom: 14px; }
h2 { font-size: 20px; letter-spacing: -.5px; }
p { margin: 8px auto 0; max-width: 46ch; color: var(--text-soft); font-size: 15px; line-height: 1.6; }
</style>
