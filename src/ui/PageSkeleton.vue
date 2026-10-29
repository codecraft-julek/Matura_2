<script setup>
// Grey placeholder while a page loads its data. `rows` = how many list rows to sketch.
defineProps({ rows: { type: Number, default: 3 } })
</script>

<template>
  <div aria-busy="true" aria-label="Ładowanie" class="stack" style="--gap: 14px">
    <div class="skeleton" style="height: 40px; width: min(420px, 70%)"></div>
    <div class="skeleton" style="height: 18px; width: min(300px, 50%)"></div>
    <div style="height: 12px"></div>
    <div v-for="n in rows" :key="n" class="skeleton" style="height: 74px"></div>
  </div>
</template>
