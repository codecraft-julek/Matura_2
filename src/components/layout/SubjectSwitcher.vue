<script setup>
// The subject switcher in the app header: a pill with the active subject that opens a small menu
// of the student's subjects (keyboard: arrows, Home/End, Escape; click outside closes). Only
// rendered when there is more than one subject to choose from (see useSubjectStore.canSwitch).
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Check, ChevronDown } from '@lucide/vue'
import { useSubjectStore } from '@/stores/subject'
import SubjectIcon from './SubjectIcon.vue'

const subject = useSubjectStore()
const uid = useId()
const open = ref(false)
const root = ref(null)
const trigger = ref(null)
const items = ref([])
const options = computed(() => subject.available)

function onDocumentClick(e) {
  if (!root.value?.contains(e.target)) close()
}
watch(open, value => {
  if (value) document.addEventListener('pointerdown', onDocumentClick, true)
  else document.removeEventListener('pointerdown', onDocumentClick, true)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentClick, true))

async function show(focusIndex = null) {
  open.value = true
  await nextTick()
  const index = focusIndex ?? Math.max(0, options.value.findIndex(s => s.id === subject.active))
  items.value[index]?.focus()
}
function close(focusTrigger = false) {
  if (!open.value) return
  open.value = false
  if (focusTrigger) trigger.value?.focus()
}
function choose(id) {
  subject.set(id)
  close(true)
}
function onTriggerKey(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show(e.key === 'ArrowUp' ? options.value.length - 1 : 0) }
}
function onMenuKey(e, index) {
  const last = options.value.length - 1
  const go = n => { e.preventDefault(); items.value[n]?.focus() }
  if (e.key === 'ArrowDown') go(index === last ? 0 : index + 1)
  else if (e.key === 'ArrowUp') go(index === 0 ? last : index - 1)
  else if (e.key === 'Home') go(0)
  else if (e.key === 'End') go(last)
  else if (e.key === 'Escape') { e.preventDefault(); close(true) }
  else if (e.key === 'Tab') close()
}
</script>

<template>
  <div ref="root" class="subject-switcher">
    <button
      ref="trigger" type="button" class="subject-trigger" :aria-expanded="open" aria-haspopup="menu" :aria-controls="`${uid}-menu`"
      :title="`Przedmiot: ${subject.current.label}`" @click="open ? close(true) : show()" @keydown="onTriggerKey"
    >
      <SubjectIcon :subject="subject.current" size="md" />
      <span class="subject-name"><span class="subject-eyebrow">Przedmiot</span>{{ subject.current.short }}</span>
      <ChevronDown :size="15" class="subject-chevron" aria-hidden="true" />
    </button>

    <Transition name="subject-menu">
      <div v-if="open" :id="`${uid}-menu`" class="subject-menu" role="menu" aria-label="Wybierz przedmiot">
        <p class="subject-menu-title" aria-hidden="true">Twoje przedmioty</p>
        <button
          v-for="(s, i) in options" :key="s.id" ref="items" type="button" role="menuitemradio" :aria-checked="s.id === subject.active"
          class="subject-option" :class="{ 'is-active': s.id === subject.active }" @click="choose(s.id)" @keydown="onMenuKey($event, i)"
        >
          <SubjectIcon :subject="s" size="md" />
          <span class="subject-option-label">{{ s.label }}</span>
          <Check v-if="s.id === subject.active" :size="16" aria-hidden="true" class="subject-check" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.subject-switcher { position: relative; }
.subject-trigger { display: inline-flex; align-items: center; gap: 9px; min-height: 42px; padding: 5px 11px 5px 6px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--text); font: inherit; font-size: 14px; font-weight: 650; line-height: 1.1; cursor: pointer; transition: border-color .15s, background .15s, box-shadow .15s; }
.subject-trigger:hover { background: var(--surface-2); border-color: #b9c6b4; }
.subject-trigger[aria-expanded='true'] { background: var(--surface-3); border-color: var(--green); box-shadow: 0 0 0 3px #1c3c3214; }
.subject-trigger:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.subject-name { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; white-space: nowrap; }
.subject-eyebrow { font-size: 9.5px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--text-soft); }
.subject-chevron { color: var(--text-soft); transition: transform .2s; }
.subject-trigger[aria-expanded='true'] .subject-chevron { transform: rotate(180deg); }

.subject-menu { position: absolute; top: calc(100% + 8px); right: 0; z-index: 50; min-width: 228px; padding: 6px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow), 0 0 0 1px #ffffff80 inset; transform-origin: top right; }
.subject-menu-title { padding: 7px 10px 6px; margin: 0; font-size: 11px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--text-soft); }
.subject-option { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 10px 7px 7px; border: 0; border-radius: 9px; background: none; color: var(--text); font: inherit; font-size: 14px; font-weight: 600; text-align: left; cursor: pointer; }
.subject-option:hover, .subject-option:focus-visible { background: var(--surface-2); outline: none; }
.subject-option:focus-visible { box-shadow: inset 0 0 0 2px var(--focus); }
.subject-option.is-active { color: var(--green); background: var(--surface-3); }
.subject-option-label { flex: 1; }
.subject-check { color: var(--green); }

.subject-menu-enter-active { transition: opacity .14s ease, transform .16s cubic-bezier(.2, .8, .3, 1.15); }
.subject-menu-leave-active { transition: opacity .1s ease, transform .1s ease; }
.subject-menu-enter-from, .subject-menu-leave-to { opacity: 0; transform: translateY(-4px) scale(.97); }
@media (prefers-reduced-motion: reduce) { .subject-menu-enter-active, .subject-menu-leave-active, .subject-chevron { transition: none; } }

@media (max-width: 860px) {
  .subject-trigger { min-height: 38px; padding: 4px 9px 4px 5px; font-size: 13px; gap: 7px; }
  .subject-eyebrow { display: none; }
}
</style>
