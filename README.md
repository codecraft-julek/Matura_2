# Ogarnij Maturę 2.0

Aplikacja do nauki do matury (polski i angielski): arkusze CKE ze sprawdzaniem, feedback AI do wypracowań, tutor AI, notatki AI i fiszki z powtórkami. Wersja 2.0 to nowy interfejs w **Vue 3 + Vite** na **tym samym backendzie Supabase** co poprzednia aplikacja Next.js (`~/Documents/Web-Projects/Matura`). Zakres i decyzje migracji: [`docs/MIGRATION-PLAN.md`](docs/MIGRATION-PLAN.md), konwencje kodu: [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).

**Stos:** Vue 3.5 · vue-router 4 (history) · Pinia · supabase-js · zod 4 · Lucide · pdf.js · Vite 8 · Supabase (Postgres + RLS + Edge Functions + pg_cron) · Vercel

## Jak to działa

- **Vercel hostuje tylko statyczną stronę** (`dist/`). Bez zmiennych środowiskowych i sekretów.
- **Cała logika danych jest w Supabase:** RLS decyduje, co widzi uczeń; ocenianie arkuszy w funkcjach Postgresa (klucze odpowiedzi są niedostępne przez API); AI i płatności w Edge Functions (`supabase/functions/*`). Przeglądarka rozmawia z Supabase bezpośrednio, z tokenem ucznia.
- **Sesja** jest w `localStorage` (supabase-js, PKCE). Guard tras w `src/router/index.js` czeka na odtworzenie sesji, przekierowuje niezalogowanych na `/logowanie?next=…`, a nowe konta na `/witaj`.
- **Linki z maili** (reset hasła, potwierdzenie) trafiają na `/auth/potwierdz` (`src/pages/auth/AuthConfirm.vue`).
- **SEO:** po `vite build` skrypt `scripts/prerender-public.mjs` zapisuje statyczny HTML (tytuł, opis, canonical, OG, JSON-LD, treść) dla `/`, `/arkusze-maturalne`, każdego arkusza, `/kontakt`, `/rejestracja`, a także `sitemap.xml` i `robots.txt`. Pozostałe adresy dostają `spa.html` (rewrite w `vercel.json`).
- Publiczne wartości (URL Supabase, klucz publishable, klucz Turnstile) są w `src/config/site.ts`.

## Uruchomienie

Wymagania: Node.js **22.18+ lub 24.12+**.

```bash
npm install
npm run dev        # http://localhost:5173 — korzysta z PRAWDZIWEGO projektu Supabase
npm run build      # vite build + prerender stron publicznych → dist/
npm run preview
```

Żeby logowanie i linki z maili działały lokalnie, w Supabase → Authentication → URL Configuration musi być `http://localhost:5173/**` (patrz „Przełączenie” niżej).

## Struktura

```text
src/
  main.js, Root.vue          # start aplikacji, wybór layoutu wg route.meta.layout
  router/index.js            # wszystkie trasy (polskie slugi jak w starej apce) + guard
  stores/                    # auth (sesja, profil), billing (plan, limity AI), ui (toasty, confirm, tutor)
  lib/supabase.js            # jedyny klient Supabase
  lib/edge.js, lib/ai.js     # wywołania Edge Functions (JSON i SSE)
  lib/api/*.js               # funkcje danych per moduł (dawne queries.ts + Server Actions)
  lib/**/*.ts                # kod przeniesiony 1:1 (srs, format tutora, ekstrakcja plików, walidacja, typy bazy)
  config/                    # routes.ts, site.ts, plans.ts
  ui/                        # kit komponentów (pola, dialog, toasty, skeleton, oceny AI, limity, captcha)
  layouts/                   # PublicLayout, AuthLayout, AppLayout (z dolnym paskiem na telefonie)
  pages/                     # public, auth, app, exams, essays, tutor, notes, flashcards, premium
  components/<moduł>/        # komponenty funkcji
  styles/app.css             # tokeny i klasy aplikacji (na bazie style.css / theme.css z landingu)
  exam/                      # publiczne demo „Polski 2026” (/trening/polski-2026)
content/exams/*.json         # struktura arkuszy + klucze (synchronizowane do bazy)
supabase/                    # migracje, Edge Functions, szablony maili, config.toml — źródło prawdy backendu
scripts/                     # sync-exams.mts, prerender-public.mjs, public-exams-plugin.mjs, make-og-image.mjs
tests/                       # testy jednostkowe + integration/ (przeciw prawdziwej bazie)
```

Kolory i typografia: tokeny w `:root` w `src/style.css` i `src/styles/app.css`. Role kolorów: AI = fiolet, fiszki = piasek, arkusze = zieleń; poprawne / do porównania / błędne = `--ok` / `--warn` / `--error`.

## Moduły

| Obszar | Trasy | Najważniejsze pliki |
|---|---|---|
| Konto | `/rejestracja`, `/logowanie`, `/nie-pamietam-hasla`, `/nowe-haslo`, `/auth/potwierdz`, `/witaj`, `/konto` | `pages/auth/*`, `pages/app/{Welcome,Account}.vue`, `lib/api/account.js` (eksport danych JSON, usunięcie konta) |
| Pulpit | `/panel` | `pages/app/Dashboard.vue`, `lib/api/dashboard.js` |
| Arkusze | `/arkusze`, `/arkusze/:id`, `/cwiczenia`, `/egzamin`, `/wynik/:attemptId` | `pages/exams/*`, `components/exams/*` (TaskInput, ExamPdfViewer, QuestionMap, SelfCheck, AiGradeOpenAnswers), `lib/api/exams.js` |
| Wypracowania | `/wypracowania`, `/nowe`, `/:id` | `pages/essays/*`, `components/essays/*` (AnalyzingPanel, FeedbackView, ExamWritingFeedback) |
| Tutor | `/tutor`, `/tutor/:chatId`, panel „Zapytaj tutora” | `pages/tutor/*`, `components/tutor/*` (AskTutor dokowany ≥1024px, TutorChat) |
| Notatki | `/notatki`, `/nowa`, `/:id` | `pages/notes/*`, `components/notes/*` (8 typów bloków, quiz, zapis jako talia) |
| Fiszki | `/fiszki`, `/nowa`, `/:deckId`, `/:deckId/nauka` | `pages/flashcards/*`, `components/flashcards/*`, `lib/flashcards/srs.ts` |
| Premium | `/premium`, `/premium/platnosc?plan=`, `/premium/gotowe` | `pages/premium/*`, `components/premium/*` |
| Publiczne | `/`, `/arkusze-maturalne(/:id)`, `/kontakt`, `/regulamin`, `/polityka-prywatnosci`, `/do-zobaczenia`, `/trening/polski-2026` | `pages/public/*`, `src/exam/*` |

Szczegóły działania backendu (AI, limity, Stripe, ScrapeCreators, pg_cron, zapytania SQL do monitorowania) są bez zmian — opisuje je README starej aplikacji; dotyczą tych samych funkcji w `supabase/`.

## Supabase

Projekt **Matura**, ref `mwtqlqbzsxeakqrjyxwg` (Frankfurt). Zawsze podawaj `--project-ref mwtqlqbzsxeakqrjyxwg`.

```bash
npx supabase@latest db push --password "$SUPABASE_DB_PASSWORD"                      # nowa migracja
npx supabase@latest functions deploy <nazwa> --project-ref mwtqlqbzsxeakqrjyxwg --use-api --no-verify-jwt
npx supabase@latest secrets set --project-ref mwtqlqbzsxeakqrjyxwg NAZWA=wartość
npm run db:types                                                                     # typy po migracji
npm run content:check / content:sync                                                 # arkusze z content/exams
```

Hasło do bazy: `.env.local` (wzór w `.env.example`, ignorowany przez git).

## Testy

```bash
npm test                  # testy jednostkowe (walidacja, trasy, SRS, format tutora, treść arkuszy, _shared, demo)
npm run test:integration  # RLS, ukryte klucze, ocenianie — przeciw PRAWDZIWEJ bazie (zakłada i usuwa konta testowe)
npm run content:check
npm run build
```

CI (`.github/workflows/ci.yml`): testy, `content:check`, build.

## Przełączenie z poprzedniej aplikacji (ręcznie, poza kodem)

1. **Supabase → Authentication → URL Configuration:** dodaj `http://localhost:5173/**` i adres nowej aplikacji na Vercelu do Redirect URLs; po przepięciu domeny Site URL = domena. Bez tego reset hasła i potwierdzenia nie zadziałają.
2. **Sekret Edge Functions `SITE_URL`** = adres nowej aplikacji (powroty ze Stripe na `/premium/gotowe` i `/premium/platnosc`).
3. Szablony maili korzystają z `{{ .SiteURL }}/auth/potwierdz…`, więc po zmianie Site URL działają bez edycji.
4. **Vercel:** nowy projekt z tego repo (bez zmiennych), włącz Web Analytics; po weryfikacji przepnij domenę. Po wdrożeniu sprawdź, że `/kontakt` i `/arkusze-maturalne/<id>` serwują prerenderowany HTML (źródło strony), a np. `/panel` — `spa.html`.
5. Po przełączeniu zostaw starą aplikację jako archiwum (notka w jej README) i zgłoś `sitemap.xml` w Google Search Console.

Lista „przed startem” (domena, SMTP, Turnstile, Stripe live, przegląd prawny) jest w README starej aplikacji i nadal obowiązuje.

## Lista kontrolna po wdrożeniu

- [ ] Rejestracja → `/witaj` → `/panel` wita po imieniu; `/panel` bez logowania → logowanie → z powrotem na `/panel`
- [ ] Złe hasło: „Nieprawidłowy e-mail lub hasło.”; reset hasła z maila otwiera `/nowe-haslo`
- [ ] `/konto`: zmiana profilu i hasła, „Pobierz moje dane” (JSON), „Usuń konto” z `USUŃ` → `/do-zobaczenia`
- [ ] Arkusz w trybie ćwiczeń: wczytanie PDF-u CKE obok, „Sprawdź to zadanie”, odświeżenie zachowuje odpowiedzi, „Zapytaj tutora”
- [ ] Egzamin na czas: odliczanie, oddanie, wynik z samooceną i „Oceń z AI” (polski)
- [ ] Wypracowanie: podgląd kryteriów na żywo, wynik, 👍/👎
- [ ] Notatka ze zdjęcia i z PDF-u, druk, „Zapisz jako talię”; talia z pliku / YouTube / importu, sesja nauki (Spacja, 1–4)
- [ ] Premium: płatność testową kartą `4242 4242 4242 4242`, `/premium/gotowe`, portal Stripe z `/konto`
- [ ] Telefon (także przeglądarka w TikToku/Instagramie): dolny pasek, tutor pełnoekranowy, brak przewijania w bok

## Demo „Polski 2026”

Publiczny trening bez konta pod `/trening/polski-2026` (stary adres `/#/test/polski-2026` przekierowuje). 8 autorskich ćwiczeń do zagadnień z arkusza CKE z 4 maja 2026, PDF wczytywany lokalnie z urządzenia ucznia (pdf.js), postęp w `localStorage`. Ćwiczenia i objaśnienia są autorskie; nie kopiujemy treści arkusza, a odnośniki do stron i zadań wskazują tylko powiązany temat. Pliki: `src/exam/*`, testy: `tests/exam-session.test.js`.
