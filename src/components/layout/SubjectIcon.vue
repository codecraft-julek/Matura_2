<script setup>
// The icon of a subject (config/subjects) in a small tinted square, so the subjects tell apart at
// a glance everywhere: the header switcher, chips, tags, the dashboard badge.
//   <SubjectIcon :subject="s" />            18 px square (chips, tags)
//   <SubjectIcon :subject="s" size="md" />  28 px square (the switcher, menus)
defineProps({
  /** A subject from config/subjects ({ icon, color, tint }). */
  subject: { type: Object, required: true },
  size: { type: String, default: 'sm' }, // 'sm' | 'md'
})
</script>

<template>
  <span class="subject-icon" :class="`is-${size}`" :style="{ '--subject': subject.color, '--subject-tint': subject.tint }" aria-hidden="true">
    <component :is="subject.icon" :size="size === 'md' ? 16 : 12" :stroke-width="2.25" />
  </span>
</template>

<style scoped>
.subject-icon { display: inline-grid; place-items: center; flex-shrink: 0; border-radius: 6px; background: var(--subject-tint); color: var(--subject); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--subject) 18%, transparent); }
.is-sm { width: 20px; height: 20px; }
.is-md { width: 28px; height: 28px; border-radius: 8px; }
/* On a dark chip (selected) the square turns white so the icon stays readable. */
.chip:has(input:checked) .subject-icon, .chip[aria-pressed='true'] .subject-icon { background: #ffffff; box-shadow: none; }
</style>
