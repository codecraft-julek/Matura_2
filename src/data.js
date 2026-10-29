export const plans = [
  {
    name: 'Dobry start',
    label: 'DARMOWY',
    price: '0',
    period: 'na zawsze',
    description: 'Wchodzisz i robisz swoje. Bez zobowiązań.',
    features: ['Arkusze i fiszki bez limitu', '2 oceny wypracowania / tydzień', 'Tutor: 10 wiadomości / dzień'],
    button: 'Zaczynam za darmo',
  },
  {
    name: 'Więcej możliwości',
    label: 'PREMIUM',
    price: '24,99',
    period: '/ miesiąc',
    description: 'Więcej wsparcia, kiedy łapiesz rytm.',
    features: ['Wszystko z planu darmowego', '2 oceny dziennie + notatki AI', 'Tutor: 50 wiadomości / dzień'],
    button: 'Wybieram Premium',
    featured: true,
  },
  {
    name: 'Do samej matury',
    label: 'PAKIET DO MATURY',
    price: '129',
    period: 'jednorazowo',
    description: 'Jeden zakup. Dostęp do 31 maja 2027.',
    features: ['Wszystkie korzyści Premium', 'Dostęp do 31 maja 2027', 'Jedna płatność, bez subskrypcji'],
    button: 'Wybieram pakiet',
  },
]

export const faqs = [
  {
    question: 'Czy mogę zacząć za darmo?',
    answer: 'Tak. Arkusze i fiszki są darmowe bez limitu. Interaktywne demo wypróbujesz od razu, bez konta i karty płatniczej.',
  },
  {
    question: 'Jakie przedmioty mogę ogarniać?',
    answer: 'Język polski i angielski. W demo czekają przykładowe zadania z obu przedmiotów oraz fiszki z lektur.',
  },
  {
    question: 'Jak wygląda feedback do wypracowania?',
    answer: 'Dostajesz wskazówki dotyczące tezy, argumentów i języka. W demo zobaczysz gotowy przykład oceny fragmentu wypracowania.',
  },
  {
    question: 'Czy to oficjalna strona CKE?',
    answer: 'Nie. Ogarnij Maturę to niezależny projekt. Korzysta z materiałów CKE, ale nie jest powiązany z Komisją.',
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
