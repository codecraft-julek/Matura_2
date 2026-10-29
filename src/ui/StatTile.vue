<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  sub: { type: String, default: '' },
  /** '' | 'lime' | 'purple' | 'sand' | 'dark' */
  tone: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
})
</script>

<template>
  <div class="stat-tile" :class="tone && `is-${tone}`">
    <span class="stat-label"><component :is="icon" v-if="icon" :size="15" />{{ label }}</span>
    <strong class="tabular">{{ value }}</strong>
    <span v-if="sub" class="stat-sub">{{ sub }}</span>
  </div>
</template>

<style scoped>
.stat-tile { display: flex; flex-direction: column; gap: 6px; padding: 18px; border-radius: var(--radius-lg); background: var(--surface); border: 1px solid var(--line); }
.stat-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; letter-spacing: .4px; color: var(--text-soft); }
strong { font-family: var(--heading); font-size: 30px; letter-spacing: -1px; line-height: 1.1; }
.stat-sub { font-size: 13px; color: var(--text-soft); }
.is-lime { background: #f2fbd9; border-color: #dcef9f; }
.is-purple { background: #efebf5; border-color: #e7e1ef; }
.is-sand { background: #f5f0e5; border-color: #ede5d6; }
.is-dark { background: var(--green); border-color: var(--green); color: white; }
.is-dark .stat-label, .is-dark .stat-sub { color: #c9d8c4; }
</style>
