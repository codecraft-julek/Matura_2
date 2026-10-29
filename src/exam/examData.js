export const EXAM_ROUTE = '#/test/polski-2026'

export const officialExam = {
  title: 'Język polski — poziom podstawowy',
  date: '4 maja 2026',
  code: 'MPOP-P1-100-A-2605',
  url: 'https://cke.gov.pl/images/_EGZAMIN_MATURALNY_OD_2023/Arkusze_egzaminacyjne/2026/Jezyk_polski/poziom_podstawowy/MPOP-P1-100-A-2605-arkusz.pdf',
  catalogUrl: 'https://egzaminy.gov.pl/index.php/egzamin-maturalny/materialy-egzaminacyjne?exam_session=2026-maj&formula=F2023',
  legalUrl: 'https://eli.gov.pl/eli/DU/2025/24/ogl',
}

// Autorskie ćwiczenia i objaśnienia. Numery sourceTask wskazują wyłącznie
// powiązane zagadnienie w PDF-ie; nie są numerami zadań w tym treningu.
export const questions = [
  {
    id: 'znaczenie', title: 'Nowe znaczenie', section: 'Język w użyciu', type: 'choice',
    sourceTask: '5', sourcePage: 7, sourceTopic: 'Neologizm znaczeniowy',
    prompt: 'Co stało się ze znaczeniem słowa „mysz”, kiedy zaczęto nim nazywać urządzenie komputerowe?',
    instruction: 'Wybierz jedną odpowiedź. To nasz przykład do zagadnienia z arkusza.',
    options: [
      { id: 'a', text: 'Utworzono nowy wyraz przez dodanie przyrostka.' },
      { id: 'b', text: 'Istniejącemu wyrazowi nadano dodatkowe znaczenie.' },
      { id: 'c', text: 'Zmieniono wyłącznie pisownię istniejącego wyrazu.' },
      { id: 'd', text: 'Dawne znaczenie wyrazu całkowicie zniknęło.' },
    ],
    correct: 'b',
    hint: 'Sprawdź, czy zmieniła się budowa wyrazu, czy sposób jego użycia.',
    explanation: 'Słowo zachowało formę i znaczenie zoologiczne, ale zyskało nowe zastosowanie. To neologizm znaczeniowy — nowość dotyczy sensu, a nie budowy wyrazu.',
  },
  {
    id: 'synteza', title: 'Notatka w pigułce', section: 'Język w użyciu', type: 'choice',
    sourceTask: '6', sourcePage: 8, sourceTopic: 'Notatka syntetyzująca',
    prompt: 'Dwie autorki inaczej oceniają ten sam problem. Który plan pomoże połączyć ich stanowiska w notatce syntetyzującej?',
    instruction: 'Wybierz plan, który pokazuje relację między tekstami.',
    options: [
      { id: 'a', text: 'Szczegółowe streszczenie pierwszego tekstu, potem własna opinia.' },
      { id: 'b', text: 'Lista najbardziej efektownych cytatów z obu tekstów.' },
      { id: 'c', text: 'Wspólny temat, istota obu stanowisk i wskazanie różnicy między nimi.' },
      { id: 'd', text: 'Biografie autorek i omówienie kolejności akapitów.' },
    ],
    correct: 'c',
    hint: 'Synteza łączy stanowiska wokół wspólnego zagadnienia.',
    explanation: 'Notatka syntetyzująca powinna uchwycić wspólny problem i zestawić stanowiska. Dwa osobne streszczenia albo luźny zbiór cytatów nie pokazują tej relacji.',
  },
  {
    id: 'antygona', title: 'Konflikt wartości', section: 'Literatura', type: 'open',
    sourceTask: '7', sourcePage: 9, sourceTopic: 'Sofokles, „Antygona”',
    prompt: 'Przygotuj krótką notatkę dla aktorki grającej Antygonę. Jakie dwa obowiązki zderzają się w decyzji o pochówku brata i dlaczego ten wybór ma swoją cenę?',
    instruction: 'Napisz 2–3 zdania własnymi słowami. Odwołaj się do znajomości tragedii.',
    hint: 'Pomyśl o prawie ustanowionym przez władcę oraz o obowiązkach rodzinnych i religijnych.',
    model: 'Antygona odczuwa obowiązek pochowania brata wynikający z więzi rodzinnej i praw boskich. Sprzeciwia się jednak zakazowi Kreona, który wymaga posłuszeństwa prawu państwowemu. Dokonując pochówku, pozostaje wierna własnym wartościom, ale naraża życie.',
    criteria: ['Nazywam obowiązek wobec rodziny lub praw boskich.', 'Wskazuję zakaz Kreona i wymóg posłuszeństwa władzy.', 'Wyjaśniam konsekwencję wyboru Antygony.'],
  },
  {
    id: 'stoicyzm', title: 'Spokój stoika', section: 'Literatura', type: 'choice',
    sourceTask: '9', sourcePage: 11, sourceTopic: 'Stoicyzm w literaturze',
    prompt: 'Ola po słabszym wyniku spokojnie analizuje błędy i planuje powtórkę. Na czym polega stoicki rys tej postawy?',
    instruction: 'Wybierz najlepsze wyjaśnienie tej autorskiej sytuacji.',
    options: [
      { id: 'a', text: 'Na przekonaniu, że wysiłek i nauka nie mają znaczenia.' },
      { id: 'b', text: 'Na unikaniu każdej sytuacji, która może zakończyć się porażką.' },
      { id: 'c', text: 'Na uzależnieniu własnej wartości od ocen innych ludzi.' },
      { id: 'd', text: 'Na zachowaniu równowagi i skupieniu się na własnym działaniu.' },
    ],
    correct: 'd',
    hint: 'Spokój nie musi oznaczać bierności.',
    explanation: 'Stoicka równowaga pozwala przyjmować zmiany losu bez utraty panowania nad sobą. Ola nie zaprzecza porażce: podejmuje działanie, na które ma wpływ.',
  },
  {
    id: 'rzecki', title: 'Punkt widzenia', section: 'Literatura', type: 'choice',
    sourceTask: '11', sourcePage: 13, sourceTopic: 'Bolesław Prus, „Lalka” — Ignacy Rzecki',
    prompt: 'Co wnosi do „Lalki” oddanie części opowieści Ignacemu Rzeckiemu w jego pamiętniku?',
    instruction: 'Wskaż znaczenie perspektywy tego bohatera dla czytelnika.',
    options: [
      { id: 'a', text: 'Pozwala poznać osobiste wspomnienia i subiektywną ocenę wydarzeń.' },
      { id: 'b', text: 'Gwarantuje całkowicie bezstronny opis wszystkich bohaterów.' },
      { id: 'c', text: 'Usuwa z powieści odniesienia do przeszłości.' },
      { id: 'd', text: 'Zastępuje całą narrację wyłącznie dialogami.' },
    ],
    correct: 'a',
    hint: 'Pamiętnik pokazuje świat widziany oczami konkretnej osoby.',
    explanation: 'Pamiętnik Rzeckiego wprowadza jego wspomnienia, przekonania i emocje. Czytelnik może zestawić tę osobistą perspektywę z innymi partiami opowieści.',
  },
  {
    id: 'personifikacja', title: 'Język poezji', section: 'Literatura', type: 'choice',
    sourceTask: '12.2', sourcePage: 15, sourceTopic: 'Środki stylistyczne',
    excerpt: 'Wieczór usiadł przy oknie i słuchał deszczu.',
    prompt: 'Jaki środek stylistyczny jest najważniejszy w tym zdaniu?',
    instruction: 'To zdanie napisaliśmy na potrzeby ćwiczenia.',
    options: [
      { id: 'a', text: 'Porównanie — zestawiono dwa zjawiska za pomocą słowa „jak”.' },
      { id: 'b', text: 'Personifikacja — wieczór wykonuje czynności człowieka.' },
      { id: 'c', text: 'Onomatopeja — wyraz naśladuje odgłos deszczu.' },
      { id: 'd', text: 'Wyliczenie — uporządkowano wiele równorzędnych elementów.' },
    ],
    correct: 'b',
    hint: 'Kto zwykle siada przy oknie i świadomie słucha?',
    explanation: 'Abstrakcyjne zjawisko zachowuje się jak człowiek: siada i słucha. To personifikacja, czyli uosobienie — szczególny rodzaj metafory.',
  },
  {
    id: 'argument', title: 'Siła argumentu', section: 'Argumentacja', type: 'boolean',
    sourceTask: '13.2', sourcePage: 16, sourceTopic: 'Rozpoznawanie typu argumentu',
    excerpt: 'Nie słuchaj Kasi w dyskusji o ekologii. Przecież ma fatalny gust muzyczny.',
    prompt: 'Oceń sposób argumentowania w tej wypowiedzi.',
    instruction: 'Zaznacz „Prawda” lub „Fałsz” przy obu stwierdzeniach. Sytuacja jest autorska.',
    statements: [
      { id: 'person', text: 'Wypowiedź atakuje osobę zamiast odnieść się do jej poglądów.', correct: true },
      { id: 'proof', text: 'Ocena gustu muzycznego dowodzi błędu w stanowisku dotyczącym ekologii.', correct: false },
    ],
    hint: 'Sprawdź, czy krytyka ma logiczny związek z przedmiotem dyskusji.',
    explanation: 'To atak na osobę (ad personam). Gust muzyczny nie rozstrzyga o trafności stanowiska dotyczącego ekologii. Żeby podważyć pogląd, trzeba odnieść się do jego treści i argumentów.',
  },
  {
    id: 'propaganda', title: 'Słowa a władza', section: 'Interpretacja', type: 'open',
    sourceTask: '16', sourcePage: 18, sourceTopic: 'George Orwell, „Rok 1984” — język propagandy',
    excerpt: 'Fikcyjny urząd „Bezpieczna Pamięć” usuwa z miejskiej kroniki informacje niewygodne dla władzy.',
    prompt: 'Jak nazwa tego urzędu może wpływać na odbiorców? Wyjaśnij mechanizm w 2–3 zdaniach i powiąż go z propagandą w „Roku 1984”.',
    instruction: 'Urząd z przykładu jest wymyślony. Nie cytuj powieści — wyjaśnij mechanizm własnymi słowami.',
    hint: 'Zestaw pozytywne skojarzenia wywoływane przez nazwę z rzeczywistym działaniem instytucji.',
    model: 'Nazwa sugeruje troskę o wspólną przeszłość, chociaż urząd ją zniekształca. Pozytywne słowa mogą osłabiać czujność odbiorców i usprawiedliwiać cenzurę. Podobny rozdźwięk między nazwą a działaniem instytucji występuje w propagandzie opisanej w „Roku 1984”.',
    criteria: ['Wyjaśniam pozytywne skojarzenia z nazwą urzędu.', 'Pokazuję sprzeczność między nazwą a cenzurowaniem kroniki.', 'Łączę ten mechanizm z propagandą w powieści Orwella.'],
  },
]

export function sourceUrl(question) {
  return `${officialExam.url}#page=${question.sourcePage}`
}
