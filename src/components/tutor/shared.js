// Shared bits of the tutor UI.

import { ref } from 'vue'

export const TASK_SUGGESTIONS = [
  'Daj mi pierwszą podpowiedź',
  'Jak podejść do tego typu zadania?',
  'Sprawdź moją odpowiedź',
  'Pokaż odpowiedź z wyjaśnieniem',
]

// Starters for a general chat, per subject (the active one from the header).
const GENERAL_BY_SUBJECT = {
  polish: [
    'Jak napisać mocną tezę w wypracowaniu?',
    'Jak napisać notatkę syntetyzującą?',
    'Wyjaśnij mi romantyzm w 5 zdaniach',
    'Jakie motywy są w „Lalce”?',
  ],
  english: [
    'Kiedy Present Perfect, a kiedy Past Simple?',
    'Jak napisać rozprawkę za i przeciw?',
    'Jak zdobyć punkty za środki językowe?',
    'Wyjaśnij mi mowę zależną',
  ],
  biology: [
    'Wyjaśnij mi fotosyntezę krok po kroku',
    'Jak rozpisać krzyżówkę genetyczną?',
    'Czym różni się mitoza od mejozy?',
    'Jak sformułować hipotezę w doświadczeniu?',
  ],
  chemistry: [
    'Jak obliczyć pH słabego kwasu?',
    'Jak dobrać współczynniki metodą bilansu elektronowego?',
    'Wyjaśnij mi hybrydyzację sp, sp² i sp³',
    'Jak rozpoznać izomery optyczne?',
  ],
}

/** Suggestions for a general chat about `subject` (polish, english, biology, chemistry). */
export const generalSuggestions = subject => GENERAL_BY_SUBJECT[subject] ?? GENERAL_BY_SUBJECT.polish

/** Which "Zapytaj tutora" panel is open (a per-button key), so only one is open at a time. */
export const openTutorPanel = ref(null)
