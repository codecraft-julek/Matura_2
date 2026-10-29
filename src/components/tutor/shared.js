// Shared bits of the tutor UI.

import { ref } from 'vue'

export const TASK_SUGGESTIONS = [
  'Daj mi pierwszą podpowiedź',
  'Jak podejść do tego typu zadania?',
  'Sprawdź moją odpowiedź',
  'Pokaż odpowiedź z wyjaśnieniem',
]

export const GENERAL_SUGGESTIONS = [
  'Jak napisać mocną tezę w wypracowaniu?',
  'Jak napisać notatkę syntetyzującą?',
  'Kiedy Present Perfect, a kiedy Past Simple?',
  'Wyjaśnij mi romantyzm w 5 zdaniach',
]

/** Which "Zapytaj tutora" panel is open (a per-button key), so only one is open at a time. */
export const openTutorPanel = ref(null)
