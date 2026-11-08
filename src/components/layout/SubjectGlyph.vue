<script setup>
// Our own pictogram for each subject, drawn to read at 12 px on a tinted square (SubjectIcon):
// polski — an open book with a ribbon bookmark, angielski — two speech bubbles in conversation,
// biologia — a leaf with its veins, chemia — an Erlenmeyer flask with liquid.
// One stroke weight, round joins, same optical size, so the four look like a family.
defineProps({
  /** 'polish' | 'english' | 'biology' | 'chemistry' */
  id: { type: String, required: true },
  size: { type: Number, default: 12 },
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <template v-if="id === 'polish'">
      <path d="M12 7C10 5.3 7.5 4.5 3.5 4.5v13c4 0 6.5.8 8.5 2.5 2-1.7 4.5-2.5 8.5-2.5v-13c-4 0-6.5.8-8.5 2.5Z" />
      <path d="M12 7v13" />
      <path d="M15.5 5.2v5.3l1.75-1.3L19 10.5V5" />
    </template>
    <template v-else-if="id === 'english'">
      <path d="M5.5 3.5h7A2.5 2.5 0 0 1 15 6v3a2.5 2.5 0 0 1-2.5 2.5H8.5L5 14v-2.6A2.5 2.5 0 0 1 3 9V6a2.5 2.5 0 0 1 2.5-2.5Z" />
      <path d="M13.5 13h5A2.5 2.5 0 0 1 21 15.5v2.5a2.5 2.5 0 0 1-2.5 2.5H18l-3 2.5v-2.5h-1.5A2.5 2.5 0 0 1 11 18v-2.5a2.5 2.5 0 0 1 2.5-2.5Z" />
    </template>
    <template v-else-if="id === 'chemistry'">
      <path d="M9.5 3h5" />
      <path d="M10 3v6.2L4.6 18.4A2 2 0 0 0 6.3 21.5h11.4a2 2 0 0 0 1.7-3.1L14 9.2V3" />
      <path d="M7.2 15.5h9.6" />
    </template>
    <template v-else>
      <path d="M4.5 19.5C4.5 10 10.5 4.5 20 4.5c0 9.5-5.5 15.5-15.5 15Z" />
      <path d="M4.5 19.5 14.5 9.5" />
      <path d="M8.3 15.7 7.5 12.3M11 13l-.6-3.2" />
    </template>
  </svg>
</template>
