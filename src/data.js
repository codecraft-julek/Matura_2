// Static copy of the homepage and its demo dialog (also read by scripts/prerender-public.mjs,
// so only relative imports here).
import { PLANS } from './config/plans.ts'

const price = id => PLANS.find(p => p.id === id)?.price

export const faqs = [
  {
    question: 'Czy mogę zacząć za darmo?',
    answer: 'Tak. Arkusze CKE i fiszki są darmowe bez limitu, a narzędzia AI mają darmowy limit. Konto zakładasz bez karty płatniczej, a przykładowy trening wypróbujesz nawet bez konta.',
  },
  {
    question: 'Jakie przedmioty są dostępne?',
    answer: 'Polski i angielski, poziom podstawowy i rozszerzony: majowe arkusze 2023–2026. Matematyka jest w planach.',
  },
  {
    question: 'Jak sprawdzacie otwarte odpowiedzi?',
    answer: 'Z angielskiego porównujemy je z listą odpowiedzi z klucza CKE. Z polskiego możesz poprosić AI o ocenę według zasad oceniania. Jeśli napiszesz coś poprawnego, czego nie ma w kluczu, pokażemy Ci go i to Ty decydujesz, czy zaliczasz. CKE też akceptuje każdą odpowiedź poprawną merytorycznie.',
  },
  {
    question: 'Jak wygląda feedback do wypracowania?',
    answer: 'Dostajesz uwagi kryterium po kryterium według zasad CKE: co już działa, co poprawić i od czego zacząć. Z polskiego i z angielskiego. Wynik jest orientacyjny, ale pokazuje, nad czym pracować.',
  },
  {
    question: 'Ile to kosztuje?',
    answer: `Arkusze CKE i fiszki są darmowe bez limitu, a narzędzia AI mają darmowy limit. Premium za ${price('monthly')} miesięcznie albo Pakiet do matury za ${price('matura')} jednorazowo daje więcej sprawdzeń wypracowań, notatek i rozmów z tutorem.`,
  },
  {
    question: 'Czy to oficjalne narzędzie CKE?',
    answer: 'Nie. Korzystamy z oficjalnych, publicznych arkuszy i zasad oceniania CKE, ale nie jesteśmy z CKE powiązani i nie wystawiamy oficjalnych ocen. Nasz wynik jest orientacyjny.',
  },
]

export const flashcards = [
  { category: 'LALKA · BOHATEROWIE', question: 'Romantyk czy pozytywista?', answer: 'Stanisław Wokulski łączy obie postawy: romantyczną miłość do Izabeli z pozytywistyczną wiarą w naukę i pracę.', hint: 'Pomyśl o Stanisławie Wokulskim.' },
  { category: 'ROMANTYZM · POJĘCIA', question: 'Czym jest prometeizm?', answer: 'To postawa buntu i poświęcenia jednostki w imię dobra ogółu. W literaturze polskiej wiąże się m.in. z Konradem z III części „Dziadów”.', hint: 'Wskazówka: poświęcenie dla innych.' },
  { category: 'LALKA · AUTOR', question: 'Kto napisał „Lalkę”?', answer: 'Bolesław Prus, czyli Aleksander Głowacki. „Lalka” jest jedną z najważniejszych powieści polskiego pozytywizmu.', hint: 'To pseudonim Aleksandra Głowackiego.' },
]

export const exercises = {
  polski: {
    label: 'Język polski',
    category: 'LEKTURY · POZIOM PODSTAWOWY',
    question: 'Która postawa Wokulskiego najlepiej ilustruje ideały pozytywizmu?',
    answers: ['Idealizowanie Izabeli Łęckiej', 'Wiara w naukę i wspieranie ludzi pracy', 'Podporządkowanie życia uczuciom', 'Ucieczka od rzeczywistości w marzenia'],
    correct: 1,
    explanation: 'Pozytywizm stawia na naukę, pracę i rozwój społeczeństwa. Wokulski wspiera m.in. Wysockiego i Węgiełka oraz interesuje się badaniami Geista. Jego miłość do Izabeli reprezentuje natomiast stronę romantyczną.',
  },
  angielski: {
    label: 'Język angielski',
    category: 'GRAMATYKA · POZIOM PODSTAWOWY',
    question: 'Choose the correct answer: If I had more time, I ___ more books.',
    answers: ['will read', 'would read', 'read', 'have read'],
    correct: 1,
    explanation: 'To drugi okres warunkowy: if + Past Simple, would + bezokolicznik. Używamy go, kiedy mówimy o sytuacjach hipotetycznych w teraźniejszości lub przyszłości.',
  },
}
