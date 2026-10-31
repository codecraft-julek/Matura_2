// Authored, structured copy shared by Vue and static/downloadable documents. No runtime HTML.
import { LEGAL_OPERATOR as operator, LEGAL_VERSION, LEGAL_UPDATED, LEGAL_DRAFT_NOTICE, DATABASE_LOCATION, BACKUP_RETENTION, LOG_RETENTION } from '../../config/legal.js'
import { PLANS } from '../../config/plans.ts'
import { ROUTES } from '../../config/routes.ts'

const p = text => ({ type: 'paragraph', text })
const list = (...items) => ({ type: 'list', items })
const links = (...items) => ({ type: 'links', items: items.map(([label, href]) => ({ label, href })) })
const table = (headers, rows) => ({ type: 'table', headers, rows })
const section = (id, title, ...blocks) => ({ id, title, blocks })
const monthly = PLANS.find(plan => plan.id === 'monthly').price
const pass = PLANS.find(plan => plan.id === 'matura').price
const identity = () => list(
  `Nazwa serwisu: ${operator.brand}.`,
  `Usługodawca i administrator danych: ${operator.fullName}, osoba fizyczna prowadząca działalność nierejestrowaną.`,
  `Adres prowadzenia działalności i do korespondencji: ${operator.address}.`,
  `E-mail: ${operator.email}. Telefon: ${operator.phone}.`,
)
const base = { version: LEGAL_VERSION, updated: LEGAL_UPDATED, notice: LEGAL_DRAFT_NOTICE }

export const withdrawalForm = `FORMULARZ ODSTĄPIENIA OD UMOWY
Formularz jest dobrowolny. Wypełnij go i wyślij tylko wtedy, gdy chcesz odstąpić od umowy.

Adresat: ${operator.fullName}, ${operator.brand}
Adres: ${operator.address}
E-mail: ${operator.email}
Do czasu uzupełnienia adresu e-mail możesz użyć formularza /kontakt.

Oświadczam, że odstępuję od umowy o świadczenie usługi Premium / Pakiet do matury w serwisie Ogarnij Maturę.
Data zawarcia umowy:
Imię i nazwisko konsumenta:
Adres konsumenta:
E-mail powiązany z zakupem:
Numer zamówienia (jeśli go masz; nie jest obowiązkowy):
Data oświadczenia:
Podpis (tylko jeśli wysyłasz formularz w wersji papierowej):

Nie musisz uzasadniać odstąpienia ani podawać danych karty płatniczej.
`

export const termsDocument = {
  ...base, id: 'regulamin', title: 'Regulamin', path: ROUTES.terms,
  summary: 'Zasady korzystania z konta i narzędzi AI, płatności, rezygnacji oraz reklamacji. Uruchomienie Premium nie oznacza automatycznej utraty prawa do odstąpienia.',
  sections: [
    section('uslugodawca', '1. Usługodawca i kontakt', identity(),
      p('Regulamin określa zasady świadczenia usług drogą elektroniczną w serwisie Ogarnij Maturę. Określenia „my” i „usługodawca” oznaczają osobę wskazaną powyżej. Działalność nierejestrowana nie wyłącza praw konsumenta.'),
      links(['Formularz kontaktowy', ROUTES.contact])),
    section('uslugi', '2. Co oferuje serwis',
      p('Serwis służy do samodzielnej nauki do matury z języka polskiego i angielskiego. Udostępnia informacje o arkuszach CKE, ćwiczenia, zapisywanie odpowiedzi i wyników, ocenę prac przez AI, tutora AI, notatki oraz fiszki. Zakres funkcji i dostępne materiały są opisane przy poszczególnych narzędziach.'),
      p('Przeglądanie publicznych stron i udostępnionego treningu nie wymaga konta. Konto i podstawowy plan są bezpłatne. Płatne plany zapewniają dostęp do wyższych limitów narzędzi AI przez określony czas; nie kupujesz oficjalnej oceny egzaminacyjnej.'),
      p('Limity są wskazane w ofercie przed zakupem i przy narzędziach. Niewykorzystane limity nie przechodzą na kolejny okres. Nie zmniejszamy zakresu opłaconej usługi w trakcie jej trwania z pominięciem uprawnień opisanych w punkcie 12.'),
      links(['Plany i aktualne limity', ROUTES.premium])),
    section('wymagania', '3. Wymagania techniczne i bezpieczeństwo',
      p('Potrzebujesz dostępu do internetu, aktualnej przeglądarki z obsługą JavaScript i HTTPS oraz możliwości zapisu niezbędnych danych sesji i szkiców w pamięci przeglądarki. Do konta potrzebny jest działający adres e-mail. Obsługiwane formaty, maksymalny rozmiar pliku i liczba stron są podawane przy imporcie.'),
      p('Koszty urządzenia i internetu ponosisz według umowy z ich dostawcą. Nie musisz zgadzać się na opcjonalne statystyki, aby korzystać z serwisu. Blokowanie niezbędnej pamięci lub zabezpieczeń formularzy może uniemożliwić logowanie albo wysłanie formularza.'),
      p('Chroń hasło, aktualizuj przeglądarkę i uważaj na podszywające się wiadomości. Nie prosimy o przesłanie hasła ani pełnych danych karty w formularzu kontaktowym. Problemy z bezpieczeństwem zgłaszaj przez kontakt.')),
    section('konto', '4. Założenie i zamknięcie konta',
      list(
        'Konto zakładasz przez formularz: podajesz e-mail i hasło, akceptujesz regulamin i potwierdzasz spełnienie warunków wieku. Umowa o konto zostaje zawarta po utworzeniu konta; potwierdzenie e-mail może być wymagane do jego aktywacji. Umowa trwa do jej zakończenia.',
        'Serwis jest przeznaczony dla osób od 13. roku życia. Jeżeli masz mniej niż 18 lat i nie masz pełnej zdolności do czynności prawnych, załóż konto i zawieraj umowy za zgodą rodzica lub opiekuna prawnego. Nie utożsamiamy ukończenia 16 lat z pełną zdolnością do zawarcia każdej umowy.',
        'Podawaj prawidłowe dane wymagane do obsługi konta i zakupu. Nazwa wyświetlana może być pseudonimem. Nie udostępniaj konta innym osobom; odpowiadasz za zabezpieczenie swoich danych logowania w granicach prawa.',
        'Możesz wypowiedzieć umowę o bezpłatne konto w każdej chwili, usuwając je w ustawieniach albo pisząc do nas. Wcześniej możesz pobrać zapisane materiały. Usunięcie konta kończy dostęp do zapisanych w nim prac i wyników.',
        'Przed samodzielnym usunięciem konta z odnawiającym się Premium wyłącz odnawianie w panelu płatności. Jeśli panel nie działa, skontaktuj się z nami w sprawie anulowania i usunięcia konta. Ograniczenie techniczne przycisku nie wyłącza prawa do wypowiedzenia ani żądania usunięcia danych.',
      ), links(['Ustawienia konta', ROUTES.account], ['Polityka prywatności', ROUTES.privacy])),
    section('ai', '5. Jak traktować ocenę i odpowiedzi AI',
      p('Oceny opisowe, odpowiedzi tutora, notatki i fiszki oznaczone jako AI są generowane automatycznie. Mogą być niepełne, niespójne lub błędne, także w ocenie zgodności z kryteriami CKE. Weryfikuj istotne informacje w materiałach źródłowych i z nauczycielem.'),
      p('Nie jesteśmy CKE ani OKE i nie działamy w ich imieniu. Wynik ćwiczenia nie jest wynikiem matury, oceną szkolną ani decyzją o przyjęciu do szkoły lub na studia. Nie gwarantujemy określonego wyniku egzaminu. Te informacje nie wyłączają odpowiedzialności za zgodność naszej usługi z umową ani prawa do reklamacji.'),
      p('Nie przesyłaj danych wrażliwych, danych identyfikujących inne osoby ani materiałów, do których nie masz odpowiednich uprawnień. Korzystaj z narzędzi do nauki zgodnie z zasadami swojej szkoły i egzaminu.')),
    section('zasady', '6. Treści użytkownika i dozwolone korzystanie',
      list(
        'Zachowujesz prawa do swoich prac. Udzielasz nam niewyłącznego upoważnienia do ich przechowywania, przetwarzania i przekazania dostawcom niezbędnym do wykonania wybranej funkcji, wyłącznie w tym celu i przez okres potrzebny do świadczenia usługi. Nie przejmujemy praw do prac ani prawa do ich publicznego publikowania.',
        'Nie przesyłaj treści bezprawnych, naruszających prawa autorskie lub prywatność. Nie obchodź zabezpieczeń i limitów, nie włamuj się na konta i nie zakłócaj działania systemu automatycznym ruchem.',
        'Korzystaj z naszych materiałów i interfejsu do własnej nauki. Publiczna dostępność arkusza CKE nie oznacza, że wszystkie zawarte w nim teksty i ilustracje są pozbawione ochrony. Prawa do takich materiałów pozostają przy właściwych uprawnionych; nie udzielamy szerszych praw niż posiadamy.',
        'W razie naruszenia możemy zastosować proporcjonalne ograniczenie dostępu. Wyjaśnimy powód i umożliwimy kontakt oraz zakwestionowanie decyzji. Zwykle najpierw wezwiemy do zaprzestania naruszeń; pilne zagrożenie bezpieczeństwa lub obowiązek prawny może wymagać natychmiastowej reakcji. Rozliczenie płatnej usługi podlega prawu konsumenckiemu.',
      )),
    section('platnosci', '7. Premium: cena, zakup i odnowienie',
      table(['Plan', 'Cena i czas trwania', 'Odnowienie'], [
        ['Premium miesięczne', `${monthly} za miesięczny okres rozliczeniowy.`, 'Automatyczne co miesiąc do anulowania.'],
        ['Pakiet do matury', `${pass} jednorazowo za dostęp do 31 maja 2027 r.`, 'Nie odnawia się.'],
      ]),
      p('Ceny są cenami końcowymi w złotych, z uwzględnieniem podatków, jeśli mają zastosowanie. Przed zatwierdzeniem płatności widzisz wybrany plan, należność, czas trwania i zasady odnowienia. Cena nie jest indywidualnie ustalana na podstawie automatycznego profilowania.'),
      p('Po wyborze planu otwiera się formularz płatności Stripe, wyświetlany w Serwisie albo na stronie Stripe. Samo otwarcie formularza nie obciąża rachunku. Zamówienie z obowiązkiem zapłaty składasz przez końcowy przycisk potwierdzający płatność u operatora; umowa o Premium zostaje zawarta po przyjęciu zamówienia i potwierdzeniu skutecznej płatności. Dostęp uruchamiamy niezwłocznie po otrzymaniu potwierdzenia od operatora. Przy metodach wymagających potwierdzenia banku może to potrwać dłużej.'),
      p('Dostępne metody płatności zależą od planu, urządzenia i operatora; ich ostateczną listę pokazuje Stripe. Dane karty podajesz u operatora płatności. Nie przechowujemy jej pełnego numeru ani kodu CVC. Potwierdzenie umowy przekazujemy na trwałym nośniku, np. e-mailem. Obejmuje ono wybrany plan, cenę, regulamin, pouczenie o odstąpieniu oraz żądanie wcześniejszego rozpoczęcia świadczenia.'),
      p('Na żądanie wystawiamy dokument sprzedaży zgodnie z obowiązującymi przepisami. Potwierdzenie operacji Stripe nie zastępuje automatycznie dokumentu podatkowego.'),
      p('Odnawianie wyłączysz w ustawieniach konta przez „Zarządzaj subskrypcją”. Anulowanie przed kolejnym odnowieniem zatrzymuje następne obciążenia, a dostęp trwa do końca opłaconego okresu. W razie problemów z panelem możesz zgłosić rezygnację przez kontakt. Samo anulowanie odnowienia jest czym innym niż odstąpienie w ciągu 14 dni lub reklamacja; nie ogranicza tych praw.')),
    section('odstapienie', '8. Odstąpienie od umowy w ciągu 14 dni',
      p('Jeżeli jesteś konsumentem, możesz odstąpić od zawartej na odległość umowy o Premium bez podawania przyczyny w ciągu 14 dni od jej zawarcia. Wystarczy wysłać jednoznaczne oświadczenie przed upływem terminu: e-mailem, przez formularz kontaktowy lub pocztą na adres usługodawcy. Skorzystanie z poniższego wzoru nie jest obowiązkowe.'),
      p('Premium jest dostępem do usługi cyfrowej świadczonej przez czas trwania planu. Żądanie uruchomienia jej od razu nie oznacza, że cała usługa została wykonana ani że automatycznie tracisz prawo do odstąpienia. Nie stosujemy do samego włączenia konta wyjątku dotyczącego jednorazowego dostarczenia treści cyfrowych.'),
      p('Jeżeli wyraźnie zażądasz rozpoczęcia świadczenia przed upływem 14 dni, a potem odstąpisz od umowy, możemy rozliczyć wyłącznie proporcjonalną wartość usługi rzeczywiście wykonanej do chwili odstąpienia, na zasadach art. 35 ustawy o prawach konsumenta. Dla dostępu czasowego punktem wyjścia jest cena planu i część opłaconego okresu, która upłynęła. Nie potrącamy dowolnej opłaty za „aktywację”. Jeżeli nie spełniliśmy ustawowych warunków wcześniejszego świadczenia, nie obciążamy Cię jego kosztem.'),
      p('Zwracamy należną kwotę bez zbędnej zwłoki, najpóźniej w ciągu 14 dni od otrzymania oświadczenia, tą samą metodą płatności, chyba że wyraźnie uzgodnisz inną bez dodatkowych kosztów. Odstąpienie kończy dostęp wynikający z tej umowy. Nie musisz usuwać bezpłatnego konta, aby odstąpić od Premium.'),
      links(['Złóż oświadczenie przez formularz kontaktowy', `${ROUTES.contact}?sprawa=odstapienie`], ['Pobierz wzór odstąpienia (TXT)', '/dokumenty/formularz-odstapienia.txt'])),
    section('reklamacje', '9. Zgodność usługi z umową i reklamacje',
      p('Odpowiadamy za zgodność usługi cyfrowej z umową przez okres jej dostarczania, w tym za uzgodnioną funkcjonalność, dostępność i wymagane aktualizacje, zgodnie z ustawą o prawach konsumenta. Nie wyłączamy tej odpowiedzialności stwierdzeniem, że narzędzie korzysta z AI.'),
      list(
        'Jeśli usługa nie została dostarczona, możesz wezwać nas do jej dostarczenia, a w przypadkach przewidzianych prawem odstąpić od umowy.',
        'Jeśli usługa jest niezgodna z umową, możesz żądać doprowadzenia jej do zgodności bez kosztów, w rozsądnym czasie i bez nadmiernych niedogodności. W ustawowych przypadkach możesz żądać obniżenia ceny albo odstąpić od umowy, np. gdy naprawa jest niemożliwa, nieskuteczna albo niezgodność jest istotna.',
        'Zgłoszenie wyślij przez kontakt, e-mailem albo pocztą. Opisz problem, podaj dane pozwalające znaleźć zakup i sposób kontaktu. Numer zamówienia lub zrzut ekranu mogą pomóc, ale nie uzależniamy reklamacji od konkretnego formularza ani dokumentu, jeśli zakup można ustalić inaczej.',
        'Na reklamację konsumenta odpowiadamy na papierze lub innym trwałym nośniku w ciągu 14 dni od otrzymania. Brak odpowiedzi w ustawowym terminie oznacza uznanie reklamacji, jeżeli przepis szczególny nie stanowi inaczej.',
      ), links(['Zgłoś reklamację', `${ROUTES.contact}?sprawa=reklamacja`])),
    section('pomoc', '10. Pomoc w sporze',
      p('Możesz zwrócić się o bezpłatną pomoc do miejskiego lub powiatowego rzecznika konsumentów oraz skorzystać z właściwych pozasądowych sposobów rozwiązywania sporów. Informacje o dostępnych podmiotach publikuje UOKiK. Po nierozwiązanej reklamacji przekażemy wymagane prawem stanowisko w sprawie udziału w odpowiednim postępowaniu. Prawo do sądu pozostaje zachowane.'),
      links(['UOKiK — pozasądowe rozwiązywanie sporów', 'https://polubowne.uokik.gov.pl/'])),
    section('prywatnosc', '11. Dane osobowe',
      p('Zasady przetwarzania danych, odbiorców i prawa użytkownika opisuje polityka prywatności. Zapoznanie się z nią nie jest zgodą na wszystkie sposoby wykorzystania danych. Tam, gdzie potrzebna jest zgoda, prosimy o nią osobno i można ją wycofać.'),
      links(['Polityka prywatności', ROUTES.privacy])),
    section('zmiany', '12. Zmiany usługi i regulaminu',
      p('Zmiany potrzebne do zachowania zgodności usługi z umową, w tym aktualizacje bezpieczeństwa, wdrażamy zgodnie z prawem. Inne zmiany mogą wynikać z konkretnych przyczyn: zmiany przepisów dotyczących usługi, wymogów bezpieczeństwa, koniecznych zmian kompatybilności przeglądarek lub zastąpienia wycofanego rozwiązania technicznego. Nie jest to uprawnienie do dowolnej zmiany ceny lub ograniczenia zakupionego planu.'),
      p('O zmianie regulaminu trwającej umowy informujemy na trwałym nośniku, np. e-mailem, z wyprzedzeniem co najmniej 14 dni, wskazując powód, zakres, termin i prawa użytkownika. Pilna zmiana wymagana prawem lub bezpieczeństwem może wejść wcześniej tylko w zakresie niezbędnym. Nowe ceny lub warunki nowej oferty nie zmieniają automatycznie istniejącej umowy.'),
      p('Zmiana usługi wykraczająca poza utrzymanie zgodności nie powoduje dodatkowych kosztów. Jeśli istotnie i negatywnie wpływa na dostęp lub korzystanie, otrzymasz odpowiednio wcześniejszą informację na trwałym nośniku i możesz wypowiedzieć umowę bez zachowania terminu w ciągu 30 dni od zmiany albo późniejszego powiadomienia. Wyjątkiem jest zapewnienie możliwości zachowania zgodnej z umową usługi bez zmian i dodatkowych kosztów. Rozliczenie następuje według ustawy.')),
    section('koncowe', '13. Postanowienia końcowe',
      p('Stosujemy prawo polskie. Wybór prawa nie pozbawia konsumenta ochrony wynikającej z bezwzględnie obowiązujących przepisów, które miałyby zastosowanie bez tego wyboru. Nie narzucamy wyłącznej właściwości sądu usługodawcy.'),
      p('Uprawnienia konsumenckie stosujemy również do osób fizycznych zawierających umowę związaną z działalnością gospodarczą, ale niemającą dla nich charakteru zawodowego, w zakresie przewidzianym przez przepisy. Regulamin nie ogranicza ustawowych praw użytkownika.'),
      p('Regulamin możesz nieodpłatnie odczytać, pobrać i wydrukować przed zawarciem umowy. Do zawartej umowy stosuje się wersję przyjętą przy jej zawarciu, z uwzględnieniem zmian wprowadzonych zgodnie z prawem.')),
  ],
}

export const privacyDocument = {
  ...base, id: 'polityka-prywatnosci', title: 'Polityka prywatności', path: ROUTES.privacy,
  summary: 'Opisujemy, jakie dane są potrzebne do nauki, co trafia do AI i operatora płatności oraz jak pobrać lub usunąć dane. Opcjonalne statystyki uruchamiamy dopiero po zgodzie.',
  sections: [
    section('administrator', '1. Administrator i kontakt', identity(),
      p('W sprawie swoich danych możesz skontaktować się z administratorem przez podane kanały lub formularz kontaktowy. Ta polityka dotyczy serwisu Ogarnij Maturę. Linki do stron zewnętrznych prowadzą do usług objętych także politykami ich operatorów.'),
      links(['Formularz kontaktowy', ROUTES.contact])),
    section('dane', '2. Jakie dane przetwarzamy',
      list(
        'Konto: adres e-mail, identyfikator konta, zabezpieczony skrót hasła obsługiwany przez system logowania, daty utworzenia i logowania oraz zapis wersji regulaminu i potwierdzenia warunków wieku. Nie przechowujemy hasła w postaci jawnej.',
        'Profil: imię lub pseudonim, wybrane przedmioty i rok matury.',
        'Nauka: odpowiedzi, wyniki, czas rozwiązywania i postęp; przesłane wypracowania, uwagi AI, rozmowy z tutorem, notatki, źródłowy tekst, fiszki i historia ich powtórek. Zachowujemy też dane techniczne wykonania zadań AI i liczniki limitów.',
        'Materiały do przetworzenia: tekst, zdjęcia, tekst odczytany z dokumentów, obrazy stron skanów oraz wskazane adresy stron i filmów. Nie musisz przesyłać materiałów, jeśli nie korzystasz z danej funkcji.',
        'Płatności: identyfikatory klienta i subskrypcji Stripe, wybrany plan, status płatności, daty dostępu oraz potwierdzenia oświadczeń zakupowych. Pełne dane karty i CVC otrzymuje operator płatności, nie nasza baza danych.',
        'Kontakt i oceny AI: e-mail, opcjonalne imię, temat i treść wiadomości; przy kontakcie po zalogowaniu także identyfikator konta. Dobrowolne oceny odpowiedzi AI i komentarze służą obsłudze zgłoszeń i analizie jakości.',
        'Bezpieczeństwo: informacje techniczne żądania i logowania, np. IP, czas, przeglądarka, komunikaty błędów oraz token CAPTCHA. W licznikach ochrony formularzy zapisujemy skrót IP. Skrót nie oznacza, że dane automatycznie przestają być danymi osobowymi.',
        'Dawna lista oczekujących, jeżeli się na nią zapisałeś: e-mail, przedmioty, rok matury, zapis zgody oraz parametry źródła wejścia z linku. Nie traktujemy takiego zapisu jako zgody na dowolny marketing.',
      )),
    section('cele', '3. Cele i podstawy prawne',
      table(['Cel', 'Podstawa'], [
        ['Utworzenie konta, zapis postępów, wykonanie funkcji AI, zakup i obsługa planu; odpowiedź na pytania przed zawarciem umowy.', 'Art. 6 ust. 1 lit. b RODO — wykonanie umowy lub działania na Twoje żądanie przed jej zawarciem.'],
        ['Obowiązki podatkowe, obsługa ustawowych uprawnień konsumenta i realizacja praw dotyczących danych.', 'Art. 6 ust. 1 lit. c RODO — obowiązek prawny.'],
        ['Ochrona kont, zapobieganie nadużyciom, diagnozowanie awarii, pozostała korespondencja i dochodzenie lub obrona roszczeń.', 'Art. 6 ust. 1 lit. f RODO — uzasadniony interes polegający na bezpieczeństwie, obsłudze spraw i ochronie praw.'],
        ['Analiza dobrowolnych ocen AI i komentarzy w celu poprawy jakości usługi, bez automatycznego przekazywania ich do treningu modeli.', 'Art. 6 ust. 1 lit. f RODO — uzasadniony interes polegający na ocenie jakości narzędzi; możesz wnieść sprzeciw.'],
        ['Opcjonalne statystyki odwiedzin; powiadomienie, na które osobno się zapisałeś.', 'Art. 6 ust. 1 lit. a RODO — zgoda; w zakresie urządzenia lub komunikacji także właściwe przepisy Prawa komunikacji elektronicznej.'],
      ]),
      p('E-mail i dane potrzebne do logowania są niezbędne do założenia konta. Bez treści pracy nie wykonamy jej oceny; bez danych wymaganych do płatności nie zrealizujemy zakupu. Pozostałe dane podajesz dobrowolnie. Odmowa opcjonalnych statystyk nie blokuje konta, nauki ani płatności.')),
    section('ai', '4. Co trafia do AI',
      p('Do OpenAI wysyłamy treść potrzebną do wybranej funkcji: pracę, odpowiedź i kontekst zadania, wiadomości i odpowiedni fragment rozmowy, tekst źródłowy albo obrazy. Nie dodajemy do zapytania Twojego e-maila ani nazwy profilu. Jeżeli sam umieścisz dane osobowe w treści lub na zdjęciu, mogą one zostać przesłane razem z materiałem.'),
      p('W żądaniach API wyłączamy zapisywanie odpowiedzi do późniejszego pobrania. Nie oznacza to zerowej retencji: według dokumentacji OpenAI standardowe logi bezpieczeństwa mogą zawierać treść i być przechowywane do 30 dni, z wyjątkami związanymi z obowiązkami prawnymi lub bezpieczeństwem. Dane API domyślnie nie są używane przez OpenAI do treningu modeli; osobne ustawienia organizacji wymagają weryfikacji.'),
      p('Zdjęcia notatek są zmniejszane i ponownie kodowane w przeglądarce, a potem przekazywane do przetworzenia. Nasza baza zachowuje odczytany tekst i wynik, nie plik zdjęcia. Dokumenty są odczytywane w przeglądarce; do analizy może trafić ich tekst albo obrazy wybranych stron. Ograniczenie zapisu w naszej bazie nie jest gwarancją braku retencji u dostawcy AI.'),
      p('Ocena AI jest pomocą w nauce. Nie podejmujemy na jej podstawie decyzji wywołujących skutki prawne ani podobnie istotnie wpływających na użytkownika w rozumieniu art. 22 RODO. Nie jest to ocena szkolna, wynik egzaminu ani decyzja rekrutacyjna. Wątpliwości możesz zgłosić człowiekowi przez kontakt.'),
      links(['OpenAI — zasady przetwarzania danych API', 'https://developers.openai.com/api/docs/guides/your-data'])),
    section('odbiorcy', '5. Odbiorcy i dostawcy usług',
      table(['Dostawca lub kategoria', 'Zakres i rola'], [
        ['Supabase', `Logowanie, baza danych i funkcje serwerowe. Główna lokalizacja bazy: ${DATABASE_LOCATION}. Przetwarza dane potrzebne do działania konta i funkcji na nasze zlecenie.`],
        ['Vercel', 'Hosting i dostarczanie strony, obsługa ruchu i logów technicznych; po osobnej zgodzie także Web Analytics.'],
        ['OpenAI', 'Przetwarzanie treści i obrazów potrzebnych do funkcji AI. Zasady retencji opisano powyżej.'],
        ['Stripe', 'Obsługa zakupu i subskrypcji. Przekazujemy m.in. e-mail i identyfikator konta. W zależności od czynności Stripe działa jako podmiot przetwarzający lub odrębny administrator, m.in. dla własnych obowiązków prawnych i przeciwdziałania oszustwom.'],
        ['Google — Gmail', 'Poczta kontaktowa: e-mail, dane podane w wiadomości, załączniki i odpowiedzi. Przetwarzanie przez Google zależy także od warunków używanego konta pocztowego.'],
        ['Cloudflare Turnstile', 'Weryfikacja formularzy: dane techniczne urządzenia i połączenia, w tym IP, oraz wynik sprawdzenia.'],
        ['ScrapeCreators', 'Pobranie napisów filmu po wskazaniu linku do YouTube. Usługa otrzymuje adres filmu i dane techniczne żądania naszego serwera, bez dodanego profilu lub e-maila ucznia.'],
        ['Dostawcy wysyłki wiadomości', 'Wiadomości uwierzytelniające są wysyłane przez infrastrukturę logowania. Integracja Resend, jeżeli jest włączona, przesyła powiadomienie o formularzu kontaktowym zawierające jego treść i dane nadawcy.'],
        ['Uprawnione osoby i organy', 'Osoby obsługujące zgłoszenia, dostawcy usług rozliczeniowych lub prawnych, jeżeli są potrzebni, oraz organy publiczne, gdy istnieje obowiązek prawny. Dostęp ograniczamy do właściwego celu.'],
      ]),
      p('Nie sprzedajemy danych użytkowników. Materiały zapisane na prywatnym koncie nie są publikowane przez nas jako publiczne prace. Gdy zlecasz pobranie zewnętrznej strony lub filmu, jej operator otrzymuje żądanie dostępu; nie podawaj linków zawierających poufne tokeny lub prywatne dane.'),
      links(['Stripe — prywatność', 'https://stripe.com/privacy'], ['Supabase — przetwarzanie danych', 'https://supabase.com/legal/dpa'], ['Google — prywatność', 'https://policies.google.com/privacy?hl=pl'], ['Cloudflare — prywatność', 'https://www.cloudflare.com/privacypolicy/'], ['ScrapeCreators — prywatność', 'https://scrapecreators.com/privacy'], ['Resend — prywatność', 'https://resend.com/legal/privacy-policy'])),
    section('transfery', '6. Przetwarzanie poza EOG',
      p('Baza danych we Frankfurcie nie oznacza, że cała obsługa przez wszystkich dostawców odbywa się wyłącznie w Europejskim Obszarze Gospodarczym. Dostawcy i ich podwykonawcy mogą przetwarzać dane m.in. w USA, także w ramach wsparcia technicznego.'),
      p('Transfer wymaga podstawy przewidzianej w rozdziale V RODO: np. decyzji stwierdzającej odpowiedni stopień ochrony dla objętego nią odbiorcy albo standardowych klauzul umownych wraz z wymaganą oceną i zabezpieczeniami. Program EU–US Data Privacy Framework ma znaczenie tylko dla odbiorcy z ważnym wpisem i objętego nim zakresu danych. Nie zakładamy, że obejmuje każdą firmę z USA.'),
      p('Informację o właściwym zabezpieczeniu konkretnego transferu i jego kopię możesz otrzymać od administratora, z ochroną praw innych osób. Przed ostateczną publikacją tej wersji wymagane jest potwierdzenie zawartych umów i mechanizmów transferu dla używanych kont dostawców.')),
    section('retencja', '7. Jak długo przechowujemy dane',
      table(['Dane', 'Okres lub kryterium'], [
        ['Konto i materiały do nauki', 'Do usunięcia materiału lub konta. Usunięcie konta usuwa powiązane prace i postępy z aktywnej bazy; nie kasuje automatycznie korespondencji, danych rozliczeniowych u operatorów ani kopii zapasowych.'],
        ['Kontakt i reklamacje', 'Do zakończenia sprawy, następnie przez okres niezbędny do udokumentowania jej obsługi lub roszczeń. Docelowy okres zwykłej korespondencji: [OKRES DO USTALENIA W PROCEDURZE RETENCJI]. Sprawy sporne przechowujemy w zakresie opisanym w wierszu dotyczącym roszczeń.'],
        ['Dokumentacja podatkowa i sprzedażowa', 'Przez okres wymagany prawem, co do zasady do upływu 5 lat od końca roku, w którym upłynął termin płatności właściwego podatku; przepisy mogą wymagać dłuższego okresu, np. wskutek zawieszenia biegu przedawnienia. Nie dotyczy to automatycznie wszystkich prac ucznia.'],
        ['Dokumenty potrzebne do roszczeń', 'Do upływu właściwego terminu przedawnienia — zasadniczo 3 lata dla roszczeń związanych z działalnością lub świadczeń okresowych, a w pozostałych przypadkach 6 lat, z ustawowymi regułami liczenia i wyjątkami. Jeżeli trwa postępowanie, do jego prawomocnego zakończenia i wykonania.'],
        ['Liczniki ochrony formularzy', 'Starsze niż 24 godziny wpisy skrótów IP są usuwane przy następnym uruchomieniu mechanizmu limitowania. Nie jest to gwarancja automatycznego usunięcia dokładnie po 24 godzinach ani retencja logów hostingu.'],
        ['Logi hostingu i uwierzytelniania', LOG_RETENTION],
        ['Kopie zapasowe', `${BACKUP_RETENTION}. Do czasu wygaśnięcia kopii usunięte dane mogą pozostawać w kopiach służących odtworzeniu systemu. Przy odtworzeniu należy ponownie wykonać wcześniejsze żądania usunięcia.`],
        ['Dawna lista oczekujących', 'Do wysłania zamówionego powiadomienia albo wcześniejszego wycofania zgody. Zachowanie minimalnego dowodu zgody lub obsługi żądania może wynikać z obrony roszczeń.'],
        ['Wybór opcjonalnych statystyk', 'Na urządzeniu przez 180 dni, do zmiany wyboru albo wyczyszczenia pamięci. Identyfikator odwiedzającego w Web Analytics według Vercel wygasa po 24 godzinach; to nie jest termin usunięcia wszystkich zbiorczych statystyk.'],
      ]),
      p('Usunięcie konta nie oznacza natychmiastowego skasowania każdej informacji u każdego dostawcy. Nie zachowujemy wszystkich danych „na wszelki wypadek”; dłuższy okres dotyczy tylko informacji potrzebnych do konkretnego obowiązku lub sprawy.')),
    section('pamiec', '8. Pamięć urządzenia i opcjonalne statystyki',
      list(
        'Sesja logowania: pamięć localStorage, aby utrzymać zalogowanie. Wylogowanie usuwa lokalną sesję. Niezbędne operacje wykonujemy dla usługi, o którą prosisz, na zasadach art. 399 ust. 3 Prawa komunikacji elektronicznej.',
        'Szkice, odpowiedzi w trakcie pracy, ustawienia widoku PDF i postęp treningu bez konta: lokalna pamięć przeglądarki, aby zachować pracę po odświeżeniu. Sam zapis szkicu nie wysyła jego treści do AI; przesłanie następuje przy użyciu odpowiedniej funkcji. Wylogowanie nie usuwa wszystkich szkiców. Na wspólnym urządzeniu usuń dane witryny lub skorzystaj z przycisku poniżej.',
        'Cloudflare Turnstile i operator płatności mogą korzystać z danych technicznych oraz pamięci niezbędnej do ochrony formularza lub wykonania zleconej płatności. Te funkcje nie są zgodą na statystyki odwiedzin.',
        'Vercel Web Analytics uruchamiamy wyłącznie po osobnej zgodzie. Odmowa jest równie dostępna jak zgoda; wybór możesz zmienić w tej polityce. Nie przesyłamy zdarzeń analitycznych z prywatnych stron konta, prac ani płatności i usuwamy parametry zapytania oraz fragment adresu z przesyłanej lokalizacji strony.',
        'Vercel opisuje tę usługę jako statystyki bez cookies, z identyfikatorem odwiedzającego wyliczanym z żądania. Może ona przetwarzać adres odwiedzanej publicznej strony, źródło wejścia, dane przeglądarki, urządzenia i przybliżonej lokalizacji. Brak cookies nie jest sam w sobie wyłączeniem przepisów o prywatności.',
      ),
      links(['Vercel Web Analytics — prywatność', 'https://vercel.com/docs/analytics/privacy-policy'])),
    section('prawa', '9. Twoje prawa i sposób ich wykonania',
      list(
        'Dostęp do danych i ich kopia, sprostowanie, usunięcie oraz ograniczenie przetwarzania — w granicach przewidzianych przez RODO.',
        'Przenoszenie danych przetwarzanych automatycznie na podstawie zgody lub umowy, gdy spełnione są ustawowe warunki.',
        'Sprzeciw wobec przetwarzania opartego na uzasadnionym interesie, z przyczyn związanych z Twoją szczególną sytuacją. W przypadku marketingu bezpośredniego sprzeciw przysługuje bez takiego uzasadnienia.',
        'Wycofanie zgody w dowolnym momencie, bez wpływu na zgodność wcześniejszego przetwarzania z prawem. Zmiana zgody na statystyki działa w ustawieniach tej polityki; w innych sprawach napisz do administratora.',
        'Skarga do Prezesa Urzędu Ochrony Danych Osobowych, jeżeli uważasz, że przetwarzanie narusza przepisy. Nie musisz najpierw wyczerpać kontaktu z nami.',
      ),
      p('W ustawieniach konta możesz poprawić profil, pobrać podstawowe dane konta i nauki w JSON oraz zlecić usunięcie konta. Samodzielny eksport nie obejmuje całej korespondencji, dokumentacji operatora płatności ani logów infrastruktury. Pełnego dostępu do danych możesz zażądać przez kontakt; przycisk nie ogranicza zakresu Twoich praw.'),
      p('Odpowiadamy bez zbędnej zwłoki, zasadniczo w ciągu miesiąca od otrzymania żądania. W przypadkach przewidzianych RODO termin może zostać wydłużony o dwa miesiące; o przyczynie poinformujemy w pierwszym miesiącu. Działania co do zasady są bezpłatne. Możemy poprosić o proporcjonalne potwierdzenie tożsamości, jeśli istnieją uzasadnione wątpliwości; nie żądamy rutynowo kopii dowodu osobistego.'),
      links(['Ustawienia konta', ROUTES.account], ['Kontakt w sprawie danych', `${ROUTES.contact}?sprawa=dane`], ['UODO — prawa i skargi', 'https://uodo.gov.pl/'])),
    section('wiek', '10. Osoby niepełnoletnie',
      p('Serwis jest przeznaczony dla osób od 13. roku życia; zasady udziału rodzica lub opiekuna przy zawieraniu umów określa regulamin. Nie opieramy niezbędnej obsługi konta na ogólnej „zgodzie na politykę prywatności”. Wiek 16 lat z art. 8 RODO dotyczy określonego przetwarzania na podstawie zgody przy usługach społeczeństwa informacyjnego, a nie pełnoletności.'),
      p('Opcjonalną zgodę na statystyki można udzielić samodzielnie od 16. roku życia; młodsza osoba powinna pozostawić je wyłączone. Jeżeli dowiesz się, że dziecko korzysta z serwisu niezgodnie z tymi zasadami, skontaktuj się z nami.')),
    section('aktualizacje', '11. Aktualizacje polityki',
      p('Aktualizujemy tę informację, gdy zmieniają się faktyczne sposoby przetwarzania lub prawo. Istotne zmiany wyjaśnimy użytkownikom odpowiednio wcześniej. Publikacja nowej polityki nie zastępuje wymaganej zgody ani nie tworzy nowej podstawy prawnej. Datę i wersję dokumentu podajemy na początku; możesz zachować jego kopię.')),
  ],
}

export const legalDocuments = [termsDocument, privacyDocument]
