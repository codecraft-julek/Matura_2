// The active subject (polish / english / biology): what the dashboard, the sheet list, the note
// and deck lists and the tutor are about right now, so content of different subjects never mixes.
// It is one of the student's subjects from the profile and is remembered per student in
// localStorage, so a reload or a new tab keeps it. With a single subject there is nothing to switch.

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { SUBJECTS, isSubjectId } from '@/config/subjects'
import { useAuthStore } from '@/stores/auth'

export const SUBJECT_STORAGE_PREFIX = 'om:subject:'

export const useSubjectStore = defineStore('subject', () => {
  const auth = useAuthStore()
  /** Chosen in this tab; null until the student picks one (then localStorage or the first subject). */
  const chosen = ref(null)
  // "<prefix><userId>:active", the per-student shape removeOtherStudentsData expects.
  const storageKey = computed(() => `${SUBJECT_STORAGE_PREFIX}${auth.user?.id ?? 'anon'}:active`)

  function remembered() {
    try { return window.localStorage.getItem(storageKey.value) } catch { return null }
  }

  /** The student's subjects in config order; every subject while the profile has none yet. */
  const available = computed(() => {
    const mine = SUBJECTS.filter(s => auth.profile?.subjects?.includes(s.id))
    return mine.length ? mine : SUBJECTS
  })
  const canSwitch = computed(() => available.value.length > 1)

  /** The id of the active subject: always one of `available`. */
  const active = computed(() => {
    const ids = available.value.map(s => s.id)
    const wanted = chosen.value ?? remembered()
    return ids.includes(wanted) ? wanted : ids[0]
  })
  const current = computed(() => available.value.find(s => s.id === active.value) ?? SUBJECTS[0])

  function set(id) {
    if (!isSubjectId(id)) return
    chosen.value = id
    try { window.localStorage.setItem(storageKey.value, id) } catch { /* storage blocked */ }
  }

  // Another student in the same tab starts from their own remembered subject.
  watch(() => auth.user?.id, () => { chosen.value = null })

  return { active, current, available, canSwitch, set }
})
