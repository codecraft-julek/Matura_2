# Feedback wypracowania: limit długości i przypisanie błędów

## Zakres

Poprawka dotyczy prezentacji skutków zasad CKE i wielokrotnego przypisania tego samego błędu. Model, rubryka CKE, progi punktowe i funkcja licząca wyrazy pozostają bez zmian. Do odpowiedzi dla polskiego na poziomie podstawowym dodano rejestr błędów już wykrytych przez analizę. Jedyna dodatkowa instrukcja dotycząca komunikatów przekazuje aplikacji odpowiedzialność za informowanie o limicie długości.

## Sprawdzone źródło CKE

Sprawdzono 29.10.2026 dokument podlinkowany przez aktualny [wykaz informatorów CKE](https://bip.cke.gov.pl/artykul/211/1659/egzamin-maturalny-w-formule-2024): [Informator o egzaminie maturalnym z języka polskiego jako przedmiotu obowiązkowego od roku szkolnego 2024/2025](https://bip.cke.gov.pl/attachments/download/10092).

- Strona 34, punkt 11: poniżej 300 wyrazów oceniane są tylko warunki formalne oraz kompetencje literackie i kulturowe; pozostałe kryteria otrzymują 0 pkt.
- Strona 35, „Język, ortografia i interpunkcja”, punkt 1: uwzględnia się wszystkie napisane wyrazy, również dwa elementy zapisane osobno zamiast poprawnie łącznie. Liczba zapisana cyframi liczy się jako jeden wyraz. Punkt 2 włącza tytuły i śródtytuły do sumy.
- W sprawdzonym informatorze polskim nie znaleziono osobnych rozstrzygnięć dla cyfr rzymskich, skrótów ani nazwisk z łącznikiem. Nie przenosimy szczegółowych reguł z informatorów języków obcych na polski. Zachowano dotychczasowe rozdzielanie białymi znakami; test dokumentuje istniejące zachowanie, nie nową interpretację CKE.

Przesłany tekst znajduje się w `tests/fixtures/polish-essay-299.txt` i ma **299 wyrazów** przy niezmienionym liczniku. Test nie poprawia błędnej pisowni przed liczeniem.

## Przetwarzanie

1. Dotychczasowa analiza nadal wykrywa błędy i wstępnie ocenia tekst. Dodatkowe pole `errors` zapisuje ich kategorię, dokładny cytat, numer wystąpienia, znaną poprawkę i opis. Pusta lista jest poprawnym wynikiem dla tekstu bez błędów; nie wymuszamy minimalnej liczby błędów.
2. `essay-issues.ts` porządkuje przypisania na podstawie lokalizacji i poprawki. Jeden błąd otrzymuje jednego właściciela; identyfikatory źródłowych wpisów pozostają w `sourceIds`. Osobne wystąpienia i różne poprawki w tym samym fragmencie nie są automatycznie scalane. Ortografia ma pierwszeństwo przed powtórnym zarzutem stylistycznym, chyba że osobne uzasadnienie wskazuje problem pozostający po poprawieniu pisowni.
3. `essay-reconciliation.ts` sprawdza też cytaty we wstępnych komentarzach: poprawny rejestr nie wystarczy, jeżeli komentarz do innego kryterium nadal przytacza cudzy błąd. Dopiero po deduplikacji następuje ponowne wyznaczenie punktów i komentarzy **wyłącznie dla dotkniętych kryteriów**. Nie uruchamiamy ponownie wykrywania błędów; ten etap otrzymuje rejestr i wcześniejsze obserwacje, nie pełne wypracowanie do nowej analizy.
4. Gdy trzeba poprawić komentarz/punktację, wykonywane jest jedno dodatkowe żądanie AI. Odpowiedź nie może dodać kryteriów, obniżyć punktów wskutek usunięcia błędu ani ponownie cytować usuniętego błędu. Niepoprawna odpowiedź kończy analizę istniejącą ścieżką błędu i zwrotu limitu, zamiast publikować sprzeczny wynik. Oba żądania dzielą dotychczasowy limit czasu 110 sekund, a użycie tokenów jest sumowane.
5. Następnie kod stosuje deterministyczne reguły CKE. Zera mają jawny powód (`scoreReason`) i wyjaśnienie. Status wynika wyłącznie z wyniku i powodu, nie z osobnej deklaracji modelu. `assessed` nadal decyduje o mianowniku wyniku — zera za długość pozostają częścią wyniku na 35 pkt.
6. Widok pokazuje ostrzeżenie z licznikiem jako pierwszą pozycję „Najważniejsze do poprawy”, przed kryteriami. Informuje o zerach w sześciu kryteriach obejmujących łącznie 18 możliwych punktów. Nie przedstawia tych 18 pkt jako punktów gwarantowanych po dopisaniu słowa. Komentarze jakościowe przy wymuszonych zerach są wyraźnie informacyjne. Nie wyświetlamy hipotetycznego wyniku.

Wstępne punkty i komentarze polskiego podstawowego nie są wyświetlane podczas strumieniowania przed zakończeniem uzgadniania. Pozostaje wskaźnik postępu i liczba wyrazów.

## Istniejące wyniki

Dla zapisanych wcześniej wyników polskiego podstawowego widok korzysta z `essay.word_count`, aby poprawić statusy i wyjaśnienia zer za długość, bez zmiany zapisanych punktów. Nie modyfikujemy historycznych danych w bazie. Starsze wyniki bez rejestru `errors` wymagają ponownego sprawdzenia tekstu, aby otrzymać nowe przypisania błędów i uzgodnione komentarze.

## Weryfikacja

Testy `essay-reconciliation.test.ts` i `FeedbackView.test.js` obejmują wszystkie cztery kryteria akceptacji, a także tekst bez błędów, zachowanie niezależnego problemu stylistycznego, różne wystąpienia, różne błędy w tym samym fragmencie, nieistniejący cytat oraz odrzucenie niedozwolonych zmian w uzgodnieniu.

Test wejścia użytkownika opiera się na dokładnym przesłanym tekście i reprezentatywnej, zamrożonej odpowiedzi detektora z 1 pkt za warunki formalne oraz 6 pkt za kompetencje literackie. Potwierdza zachowanie wyniku **7/35** po przetworzeniu. Nie jest dowodem, że nowe wywołanie modelu zwróci identyczną ocenę literacką. Pełny zapis pierwotnej odpowiedzi AI nie został dostarczony.

Sprawdzenia: `npm test`, `npm run build`, `deno check --no-lock --cached-only --config supabase/functions/essay-feedback/deno.json supabase/functions/essay-feedback/index.ts` oraz kontrola typów współdzielonych plików. Testy widoku renderują rzeczywisty komponent Vue do HTML; nie zastępują oceny wizualnej w przeglądarce.

Nie wykonano nowego płatnego wywołania AI ani wdrożenia. Zmiana wymaga wdrożenia frontendu i funkcji Supabase `essay-feedback`; migracja bazy nie jest potrzebna. Dodatkowy etap może wydłużyć analizę i zwiększyć jej koszt wyłącznie wtedy, gdy znaleziono duplikaty lub sprzeczne przypisania w komentarzach.
