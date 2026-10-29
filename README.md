# Ogarnij Maturę — nowy design

Responsywna aplikacja **Vue 3 + Vite**, przygotowana na podstawie https://matura-theta.vercel.app/. Projekt skupia się na wyglądzie i interakcjach w przeglądarce. Nie wymaga backendu, bazy danych, kluczy API ani konta.

Design: jasne tło, ciemna zieleń, limonkowy akcent, większe litery i krótkie opisy. Dodatkowe informacje są dostępne w rozwijanym FAQ i oknie demo.

## Uruchomienie

Wymagania: Node.js **22.18+ lub 24.12+** oraz npm. Projekt został przygotowany na Node.js 24.13.1.

Otwórz PowerShell w katalogu projektu i uruchom:

```powershell
cd "C:\Users\flamm\Desktop\test Julek"
npm install
npm run dev
```

Otwórz adres pokazany w terminalu — domyślnie **http://localhost:5173**. Jeśli port jest zajęty, Vite wybierze kolejny i poda aktualny adres. Zatrzymanie serwera: `Ctrl+C`.

Gdyby PowerShell blokował plik `npm.ps1`, użyj `npm.cmd install` i `npm.cmd run dev`.

## Wersja produkcyjna

```powershell
npm run build
npm run preview
```

Build zapisuje gotową statyczną stronę w `dist/`. Podgląd domyślnie działa pod **http://localhost:4173**. Na hosting statyczny wgrywasz zawartość `dist/`. Nie otwieraj pliku `index.html` dwuklikiem — korzystaj z serwera Vite lub hostingu.

## Co działa

- Responsywny layout na telefonie, tablecie i komputerze.
- Mobilne menu, nawigacja do sekcji i rozwijane FAQ.
- Przełączanie narzędzi w podglądzie na pierwszym ekranie.
- Okno demo z przykładowym zadaniem z polskiego lub angielskiego, sprawdzeniem odpowiedzi i wyjaśnieniem.
- Przykładowy feedback do wypracowania.
- Odwracanie i przewijanie fiszek.
- Podgląd planów z cennika bez realizacji zakupu.
- Obsługa klawiatury, zamykanie okna klawiszem Escape i ograniczenie animacji zgodnie z ustawieniami systemu.

Demo używa wyłącznie gotowych danych. Nie wysyła tekstów do AI, nie rejestruje kont i nie pobiera płatności. Okno demo na stronie głównej resetuje się po odświeżeniu; osobna strona treningu zapisuje postęp lokalnie. Zadania demonstracyjne są autorskie i nie stanowią oficjalnego arkusza CKE. Opis produktu i ceny pochodzą ze strony źródłowej, odczytanej 29.10.2026.

Fonty Manrope i DM Sans oraz ikony Lucide są dostarczane lokalnie z zależnościami npm. Strona nie wymaga zewnętrznych usług do wyświetlania interfejsu.

## Najważniejsze pliki

```text
src/
  App.vue                        # sekcje strony i nawigacja
  style.css                      # kolory, typografia, layout i responsywność
  theme.css                      # większa typografia i zwarty układ
  data.js                        # cennik, FAQ, zadania i fiszki
  main.js                        # punkt wejścia i fonty
  components/
    BrandMark.vue                # znak marki
    ProductPreview.vue           # interaktywny podgląd na pierwszym ekranie
    DemoDialog.vue               # okno demo z zadaniami i fiszkami
```

Kolory zmienisz w zmiennych `:root` na początku `src/style.css`. Większa typografia i zwarty układ są w `src/theme.css`. Treści i ceny edytujesz w `src/data.js` i `src/App.vue`.

## Trening z arkuszem CKE 2026

Adres: `/#/test/polski-2026` (lokalnie np. `http://localhost:5173/#/test/polski-2026`). Na stronie głównej prowadzą do niego link „Arkusz 2026” i przyciski rozpoczęcia nauki.

- 8 autorskich ćwiczeń do zagadnień z arkusza: 5 pytań jednokrotnego wyboru, 1 zestaw P/F oraz 2 odpowiedzi otwarte.
- 7 punktów za pytania zamknięte; odpowiedzi otwarte wymagają samooceny i nie zwiększają automatycznej punktacji.
- Wyjaśnienia, podpowiedzi, zaznaczanie pytań do powrotu, licznik czasu i podsumowanie.
- Odpowiedzi są zapisywane w `localStorage`, wyłącznie w bieżącej przeglądarce. „Zacznij od nowa” wymaga potwierdzenia i resetuje tylko ten trening.
- Można pobrać własne odpowiedzi jako plik TXT. Aplikacja nie przesyła odpowiedzi do serwera ani AI.
- Nawigacja oparta na fragmencie adresu działa także na hostingu statycznym, bez reguł przekierowania ścieżek.

Pliki: `src/exam/ExamPage.vue` (widok), `src/exam/exam.css` (layout), `src/exam/examData.js` (autorskie pytania i źródła), `src/exam/session.js` (punktacja i zapis), `src/Root.vue` (wybór strony).

### Źródła i sposób korzystania z materiałów

Oficjalny materiał: [CKE — język polski, poziom podstawowy, 4 maja 2026, arkusz 1](https://cke.gov.pl/images/_EGZAMIN_MATURALNY_OD_2023/Arkusze_egzaminacyjne/2026/Jezyk_polski/poziom_podstawowy/MPOP-P1-100-A-2605-arkusz.pdf). [Katalog materiałów CKE](https://egzaminy.gov.pl/index.php/egzamin-maturalny/materialy-egzaminacyjne?exam_session=2026-maj&formula=F2023).

PDF pozostaje na serwerze CKE i otwiera się w osobnej karcie. Zweryfikowana odpowiedź serwera zawiera `X-Frame-Options: SAMEORIGIN`, dlatego aplikacja nie próbuje osadzać dokumentu w ramce ani obchodzić tej blokady. Nie kopiujemy PDF-u, jego tekstów, ilustracji, układu graficznego ani oficjalnych poleceń do aplikacji czy paczki publikacyjnej. Materiały odczytane lokalnie do weryfikacji są w ignorowanym katalogu `tmp/`.

Zadania i objaśnienia aplikacji zostały napisane samodzielnie. Numery stron i zadań w odnośnikach oznaczają powiązany temat, nie tożsamość z pytaniem CKE. Przykłady „myszy”, sytuacji Oli, zdania o wieczorze, wypowiedzi o Kasi oraz urzędu „Bezpieczna Pamięć” są własne. Punktacja jest punktacją treningu, nie przeliczeniem wyniku matury. Nie używamy logo CKE i nie sugerujemy afiliacji.

Przy wyborze sposobu prezentacji uwzględniono rozróżnienie między ideą a sposobem jej wyrażenia, opracowaniem i inspiracją oraz prawami do materiałów osób trzecich. Podstawa do dalszej weryfikacji: [ustawa o prawie autorskim i prawach pokrewnych, art. 1 ust. 2¹, art. 2, art. 4](https://eli.gov.pl/eli/DU/2025/24/ogl). Sama publiczna dostępność PDF-u nie została potraktowana jako licencja na ponowną publikację jego zawartości.

### Sprawdzenie

```powershell
npm test
npm run build
```

Testy obejmują punktację, niekompletne odpowiedzi P/F, brak automatycznej oceny tekstów otwartych i odtwarzanie poprawnych oraz uszkodzonych zapisów.
