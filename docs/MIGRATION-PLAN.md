# Ogarnij Maturę 2.0 — plan migracji funkcji ze starej aplikacji

Status: **iteracja 1 wdrożona w kodzie** (29.10.2026): etapy 0–10 zrobione, build i testy jednostkowe przechodzą. Do zrobienia ręcznie: sekcja 8 (konfiguracja Supabase i Vercela) oraz testy na prawdziwej bazie i urządzeniach. Decyzje z sekcji 10 przyjęte zgodnie z propozycjami planu.

Źródło: `~/Documents/Web-Projects/Matura` (Next.js 16 + React 19 + Tailwind 4 + Supabase, produkcja na Vercel, projekt Supabase `mwtqlqbzsxeakqrjyxwg`).
Cel: ten repozytorium (`Matura 2.0`, Vue 3 + Vite, nowy design: jasne tło, ciemna zieleń, limonka, Manrope/DM Sans, ikony Lucide).

Zasada iteracji 1: **przenosimy 100% funkcji frontendu i backendu, zachowujemy backend bez zmian, a cały interfejs budujemy od nowa w obecnym designie Vue, z poprawkami UX.**

---

## 1. Najważniejsze wnioski z analizy

1. **Backend jest już gotowy do SPA.** Cała logika danych siedzi w Supabase: RLS, funkcje `security definer` nadane roli `authenticated`, 10 Edge Functions (AI, płatności, kontakt, waitlist), pg_cron. Next.js prawie nigdzie nie jest warstwą pośrednią. Stare Server Actions to cienkie opakowania na pojedyncze wywołania `supabase.from(...)` / `supabase.rpc(...)`, dozwolone przez RLS. Wszystkie wywołania AI (essay-feedback, tutor-chat, notes-generate, flashcards-generate, grade-open-answers) i płatności (billing-checkout, billing-portal) **już dziś lecą z przeglądarki** przez `fetch` z tokenem użytkownika.
2. **Backend zostaje w tym samym projekcie Supabase.** Nie tworzymy nowej bazy. Przenosimy katalog `supabase/` (migracje, funkcje, szablony maili, config) do tego repo jako źródło prawdy. Konfiguracja wymaga tylko 3 ręcznych zmian w panelu Supabase (sekcja 8).
3. **Lista rzeczy „tylko serwerowych”, które trzeba zastąpić w przeglądarce, jest krótka** (sekcja 5): guard tras, onboarding, `/auth/potwierdz`, eksport danych, strony publiczne SEO, nagłówki bezpieczeństwa, OG image, sitemap/robots.
4. **Obecny projekt Vue to landing + 1 trening demo.** Ma dobry system wizualny (`style.css`, `theme.css`, `exam.css`), natywny `<dialog>`, dostępność, reduced motion, układ PDF-po-lewej/zadanie-po-prawej. To zostaje jako fundament designu i jako wzorzec komponentów.
5. **Wspólny kod ze starego repo jest przenośny bez zmian:** `supabase/functions/_shared/*.ts` (zod, rubryki, limity, parsery), `src/lib/flashcards/srs.ts`, `src/lib/tutor/format.ts`, `src/lib/flashcards/extract.ts` (pdf.js + fflate), `src/lib/notes/image.ts`, `src/lib/validation/auth.ts`, `src/config/routes.ts`, `src/config/plans.ts`, `content/exams/*.json`, `scripts/sync-exams.mts`, testy jednostkowe i integracyjne.

Uwaga techniczna: połączenie Supabase MCP w tej sesji wskazuje na inny projekt (aplikacja z przepisami), więc weryfikację stanu bazy zrobiłem na podstawie migracji i kodu, nie żywej bazy.

---

## 2. Docelowy stos i struktura repo

| Warstwa | Decyzja | Uzasadnienie |
|---|---|---|
| Framework | Vue 3.5 `<script setup>`, Vite 8 | kontynuacja obecnego projektu |
| Język | JS w komponentach (jak dziś) + **TS dozwolony** dla kodu przenoszonego 1:1 (`_shared`, `srs.ts`, `format.ts`, `extract.ts`, typy bazy) | Vite kompiluje oba bez konfiguracji; nie przepisujemy sprawdzonego kodu |
| Routing | `vue-router` 4, **tryb history**, polskie slugi identyczne ze starą apką | adresy powrotne Stripe, linki w mailach Supabase, linki SEO i stare zakładki użytkowników działają bez zmian |
| Stan | `pinia` z 3 store’ami: `auth` (sesja + profil), `billing` (plan, allowance), `ui` (toasty, docked tutor) | małe, jawne, testowalne |
| Dane | `@supabase/supabase-js` (sesja w localStorage, `flowType: 'pkce'`), zod 4 do walidacji formularzy | to samo API co dziś, bez `@supabase/ssr` |
| PDF/pliki | `pdfjs-dist` (już jest), `fflate` | bez zmian |
| Fonty/ikony | `@fontsource-variable/manrope`, `dm-sans` (dodać subset `latin-ext`), `@lucide/vue` | obecny design |
| Hosting | Vercel (SPA rewrite + nagłówki w `vercel.json`) | bez zmian w infrastrukturze, brak zmiennych środowiskowych |
| Testy | `vitest` (jednostkowe) + istniejące testy integracyjne przeciw prawdziwej bazie | przenosimy 100% starych testów |
| Analityka | `@vercel/analytics` (`inject()`) | bez ciasteczek, jak dziś |

Proponowana struktura `src/`:

```
src/
  main.js                 # createApp + router + pinia + fonty + style
  router/index.js         # trasy + guard (sesja, onboarding, next=)
  config/{site,routes,plans}.js
  lib/supabase.js         # jeden klient
  lib/api/                # cienkie funkcje danych (dawne queries.ts + actions.ts)
    exams.js essays.js tutor.js notes.js flashcards.js billing.js ratings.js account.js
  lib/ai/stream.js        # wspólny parser SSE
  lib/{srs,tutorFormat,extractFile,shrinkPhoto,validation}.*
  shared/ -> ../supabase/functions/_shared (alias @shared)
  stores/{auth,billing,ui}.js
  ui/                     # kit komponentów w obecnym designie
    AppButton AppInput AppTextarea AppField AppChip AppCard AppDialog
    AppToast PageSkeleton EmptyState StatTile ConfirmDialog AiRating AllowanceNote
  layouts/{PublicLayout,AppLayout,AuthLayout}.vue
  pages/
    public/   Landing Contact Terms Privacy PublicExams PublicExam Goodbye Demo(trening 2026)
    auth/     Login Signup ForgotPassword NewPassword AuthConfirm
    app/      Welcome Dashboard Account
    exams/    ExamList ExamOverview Solve(cwiczenia+egzamin) Result
    essays/   EssayList NewEssay Essay
    tutor/    TutorHome TutorChat
    notes/    NoteList NewNote Note
    flashcards/ DeckList NewDeck Deck Study
    premium/  Premium Checkout PaymentDone
  components/  (feature-specific: AnswerSheet, Countdown, SelfCheck, AskTutor, NoteBlocks, DeckEditor, …)
content/exams/*.json
supabase/  (migracje, funkcje, szablony, config.toml — skopiowane 1:1)
scripts/   sync-exams.mts, prerender-public.mjs
tests/     unit + integration
docs/      ten plan
```

---

## 3. Mapa funkcji do przeniesienia (iteracja 1 = wszystko)

Legenda kolumny „Co zmieniamy”: **P** = przeniesienie 1:1 logiki, **UX** = planowana poprawka doświadczenia (lista w sekcji 6).

### 3.1 Strony publiczne

| Trasa | Funkcja | Źródło danych | Co zmieniamy |
|---|---|---|---|
| `/` | Landing (hero, narzędzia, jak to działa, cennik, FAQ, CTA) | statyczne (`data.js`) | zostaje **obecny landing Vue**; podmieniamy przyciski demo na `Załóż konto` / `Zaloguj się`; cennik linkuje do `/rejestracja` lub `/premium/platnosc?plan=`; zalogowany trafia na `/panel` |
| `/arkusze-maturalne`, `/arkusze-maturalne/:id` | publiczne strony SEO arkuszy (opis struktury, materiały CKE, CTA) | `content/exams/*.json` zsanityzowane w buildzie | P + prerender HTML w buildzie (sekcja 5) |
| `/kontakt` | formularz kontaktowy (imię, e-mail, temat, wiadomość, honeypot, Turnstile) | Edge `contact-submit` | P |
| `/regulamin`, `/polityka-prywatnosci` | strony prawne z banerem „wersja robocza” | statyczne | P; akapit o ciasteczkach do zmiany (sesja w localStorage) |
| `/do-zobaczenia` | po usunięciu konta | – | P |
| `/trening/polski-2026` (dziś `#/test/polski-2026`) | obecny trening demo z lokalnym PDF | localStorage | zostaje jako publiczne demo bez konta; przekierowanie ze starego hasha |

### 3.2 Konto i autoryzacja

| Trasa | Funkcja | Wywołania | Co zmieniamy |
|---|---|---|---|
| `/rejestracja` | e-mail, hasło (8+, litera, cyfra), zgoda na regulamin, wiek 16+, Turnstile | `auth.signUp({ data: { terms_version, age_confirmed }, captchaToken })` | P + UX (siła hasła na żywo) |
| `/logowanie` | logowanie, `?next=`, `?blad=link` | `auth.signInWithPassword` | P |
| `/nie-pamietam-hasla` | link resetu, brak enumeracji kont | `auth.resetPasswordForEmail(redirectTo /auth/potwierdz?next=/nowe-haslo)` | P |
| `/nowe-haslo` | nowe hasło + powtórzenie | `auth.updateUser({password})` | P |
| `/auth/potwierdz` | wymiana `code` (PKCE) lub `token_hash`+`type` | `exchangeCodeForSession` / `verifyOtp` | **nowy widok kliencki** zamiast route handlera |
| `/witaj` | onboarding: imię (40), przedmioty, rok matury | `profiles.update({..., onboarded_at})` | P |
| `/panel` | pulpit | `profiles` | **UX: realny pulpit** (ostatnie podejścia, fiszki do powtórki, limity AI, szybkie akcje) zamiast 5 statycznych kart |
| `/konto` | plan, profil, zmiana hasła, eksport danych, usuń konto (`USUŃ`) | `billing_accounts`, `profiles.update`, `auth.updateUser`, `rpc delete_my_account`, `auth.signOut({scope:'local'})` | P; eksport JSON budowany w przeglądarce (Blob) |
| wylogowanie | w nagłówku | `auth.signOut()` → `/` | P |

Guard tras (zamiast `proxy.ts` + `dal.ts`): `PROTECTED_PREFIXES` → brak sesji ⇒ `/logowanie?next=…`; sesja na `/`, `/logowanie`, `/rejestracja` ⇒ `/panel`; brak `onboarded_at` ⇒ `/witaj`; `safeNextPath` bez zmian. Guard czeka na odtworzenie sesji (`onAuthStateChange` INITIAL_SESSION), żeby nie migać loginem.

### 3.3 Arkusze (największy moduł)

| Trasa | Funkcja | Wywołania | Co zmieniamy |
|---|---|---|---|
| `/arkusze` | lista wg przedmiotu (przedmioty ucznia najpierw), ostatni wynik | `exams`, `exam_attempts` | P + UX (filtry rok/poziom, karty w stylu `tool-card`) |
| `/arkusze/:id` | przegląd: 2 tryby, materiały CKE (PDF 1/2, MP3, transkrypcja, klucz), sekcje z punktami, historia podejść | `exams`, `exam_tasks`, `exam_attempts` | P |
| `/arkusze/:id/cwiczenia` | tryb ćwiczeń: autosave do localStorage, bloki zadań, „Sprawdź to zadanie”, „Zapytaj tutora”, odtwarzacz MP3, link „Pokaż w arkuszu” (popup na desktopie) | `rpc grade_exam_answers(p_exam_id, p_answers, p_group)` | P + UX: **podgląd PDF w układzie split-view z obecnego `ExamPage`** (uczeń wczytuje pobrany plik; automatyczne przewijanie do strony zadania), zamiast samego popupu |
| `/arkusze/:id/egzamin` | egzamin na czas: odliczanie z zapamiętanym startem, auto-submit przy 0, ostrzeżenie `beforeunload`, bez sprawdzania i tutora | `rpc submit_exam_attempt(p_exam_id, p_mode, p_answers, p_started_at)` | P + UX (pauza niedozwolona, ale czytelny pasek postępu i mapa zadań) |
| `/arkusze/:id/wynik/:attemptId` | wynik, kafelki sekcji, lista odpowiedzi z kluczem, samoocena (Tak/Nie lub 0..max), „Oceń z AI” (polski), tutor przy zadaniu, wypowiedź pisemna z „Sprawdź z AI”, ocena 👍/👎 | `exam_attempts`, `essays`, `rpc self_check_answer`, `rpc self_grade_answer`, Edge `grade-open-answers`, `ai_ratings` | P; po samoocenie odświeżamy lokalnie zamiast przeładowania strony |

Typy zadań do odwzorowania w `TaskInput`: pojedynczy wybór (litery), wielowierszowy P/F i dopasowanie (`meta.rows`, odpowiedź jako ciąg znaków z `_`), otwarte krótkie (angielski, input 200 zn.), otwarte dłuższe (polski, textarea 3000), wypowiedź pisemna (textarea, licznik słów z zakresem `meta.words`, `meta.rules`, `meta.criteria`). Statusy wyników i etykiety z `labels.ts` przenosimy bez zmian.

### 3.4 Wypracowania (feedback AI)

| Trasa | Funkcja | Wywołania | Co zmieniamy |
|---|---|---|---|
| `/wypracowania` | lista, limit (`AllowanceNote`), stany done/error/pending | `essays`, `rpc my_ai_allowance` | P |
| `/wypracowania/nowe` | poziom, temat, tekst (20 000), szkic w localStorage, licznik słów, min. 30 słów | Edge `essay-feedback` (SSE: start/delta/done/error) | P; `AnalyzingPanel` z podglądem kryteriów na żywo przenosimy 1:1 (parser `parsePartialFeedback`) |
| `/wypracowania/:id` | wynik: punkty/35 lub /12 /13, podsumowanie, kryteria z paskami, najważniejsza wskazówka, tekst z zaznaczeniami (good/issue), 👍/👎 | `essays`, `ai_ratings` | P + UX: status `pending` odpytujemy co kilka sekund zamiast „odśwież stronę” |
| w wyniku arkusza | „Sprawdź z AI” dla zadania pisemnego (`mode: exam`, opcjonalny temat) | Edge `essay-feedback` | P |

### 3.5 Tutor AI

| Trasa | Funkcja | Wywołania | Co zmieniamy |
|---|---|---|---|
| `/tutor` | nowa rozmowa + podpowiedzi + lista rozmów | `tutor_chats`, `rpc my_ai_allowance`, Edge `tutor-chat` (SSE) | P |
| `/tutor/:chatId` | historia, usuwanie, link do arkusza, oceny odpowiedzi | `tutor_messages`, `ai_ratings`, `tutor_chats.delete` | P |
| panel „Zapytaj tutora” | dokowany po prawej ≥1024px (`--tutor-w: 28rem`), modal na tablecie, pełny ekran na telefonie; kontynuacja ostatniej rozmowy o zadaniu; wysyła aktualne odpowiedzi ucznia | jw. | P; renderowanie odpowiedzi przez `parseTutorText` → elementy Vue (bez `v-html`) |

Limity: 2000 zn./wiadomość, 25 wiadomości ucznia/rozmowę, Enter wysyła, Shift+Enter nowa linia.

### 3.6 Notatki AI

| Trasa | Funkcja | Wywołania | Co zmieniamy |
|---|---|---|---|
| `/notatki` | lista z źródłem i statusem („przerwane” po 5 min) | `notes`, `rpc my_ai_allowance` | P |
| `/notatki/nowa` | przedmiot, do 4 zdjęć (zmniejszane w przeglądarce do 1600 px JPEG), plik PDF/DOCX/PPTX (tekst wyciągany lokalnie; skan → 4 strony jako obrazy), tekst 30 000, ekran postępu | Edge `notes-generate` (SSE: start/progress/done/error) | P |
| `/notatki/:id` | 8 typów bloków (text, list, definition, timeline, compare, mindmap, cause_effect, remember), oznaczenie „dodane przez AI”, fiszki z notatki, quiz, „Zapisz jako talię”, drukuj/PDF, usuń, 👍/👎 | `notes`, `flashcard_decks`+`flashcards` insert, `ai_ratings` | P; każdy blok = komponent Vue w obecnej palecie; styl druku |

### 3.7 Fiszki

| Trasa | Funkcja | Wywołania | Co zmieniamy |
|---|---|---|---|
| `/fiszki` | talie, liczba fiszek, „do powtórki dziś” | `flashcard_decks` + `flashcards(count)`, `flashcards.due_at` | P |
| `/fiszki/nowa` | 7 zakładek: plik, zdjęcia, strona www, YouTube (+ręczna transkrypcja), tekst, import Quizlet/Anki, ręcznie; liczba 10/20/30; styl auto/qa/vocab | Edge `flashcards-generate` (SSE), insert bez AI dla import/manual | P |
| `/fiszki/:deckId` | statystyki, dodaj/edytuj/usuń fiszkę, usuń talię, eksport TSV, 👍/👎 dla talii z AI | CRUD na `flashcards`/`flashcard_decks` | P + UX (zmiana nazwy talii, której stary UI nie miał mimo gotowej akcji) |
| `/fiszki/:deckId/nauka` | sesja SRS (SM-2: 10 min / 1 d / 3 d / ×ease, ease 1.3–3.5, max 365 d), klawisze Spacja i 1–4, wymowa EN, powtórka „Nie wiem” po 4 kartach, ekran końcowy | `flashcards.update` w tle | P; `srs.ts` + testy 1:1 |

### 3.8 Premium i płatności

| Trasa | Funkcja | Wywołania | Co zmieniamy |
|---|---|---|---|
| `/premium` | 3 plany, tabela funkcji, FAQ płatności, status planu | `billing_accounts`, `plans.js` | P (karty w stylu obecnego cennika) |
| `/premium/platnosc?plan=` | wybór planu, 3 zgody, metody płatności, podsumowanie, `?anulowano=1` | Edge `billing-checkout` → Stripe Checkout | P |
| `/premium/gotowe` | odpytywanie `billing_accounts` co 2 s przez 30 s, ekran sukcesu | `billing_accounts` | P |
| `/konto` | „Zarządzaj subskrypcją” / „Płatności i paragony” | Edge `billing-portal` | P |
| limity AI | `AllowanceNote` (dzień/tydzień, link do Premium), komunikaty 429 z funkcji | `rpc my_ai_allowance` | P; dodatkowo store `billing` cache’uje allowance i odświeża po każdym zużyciu |

### 3.9 Elementy wspólne

`AiRating` (👍/👎 + komentarz, upsert `ai_ratings` z `onConflict user_id,target_kind,target_id`), `AllowanceNote`, `PageSkeleton`, 404, obsługa błędów sieci („Brak połączenia…”), komunikaty błędów auth (`authErrorMessage`), Turnstile (`Captcha.vue` ładujący skrypt raz, `resetKey`), wspólny parser SSE (`stream.js`: `: ping`, `data:` JSON, 413 → komunikat o zbyt dużych danych, przerwanie strumienia).

---

## 4. Design i UX: jak stara funkcja wygląda w nowym interfejsie

Zasady:

1. **Tokeny z `style.css` są jedynym źródłem kolorów i typografii.** Dodajemy brakujące tokeny semantyczne: `--ok` (zielony dla poprawnych), `--warn` (bursztyn dla „do porównania”/częściowych), `--error` (czerwony dla błędnych, ale stonowany względem palety), `--surface`, `--surface-2`, promienie i cienie. Stary design (papier/granat/czerwony długopis/zakreślacz) **nie wraca**; jego rolę „ręcznie pisanych” akcentów przejmują `eyebrow`, `BrandMark` i `cta-handwriting`.
2. **Kit UI powstaje raz** (`src/ui/`) na bazie istniejących klas `.button`, `.button-dark`, `.button-lime`, `.button-outline`, `.icon-button`, `.text-button`, `.tool-card`, `.pricing-card`, `.faq-item`, `.demo-dialog`. Formularze (`AppField`) dziedziczą styl selectu i przycisków z `DemoDialog`/`ExamPage` (16px na mobile, żeby iOS nie powiększał).
3. **Trzy layouty:** `PublicLayout` (obecny header/footer), `AuthLayout` (karta na środku, brand, stopka), `AppLayout` (nagłówek z nawigacją: Panel, Arkusze, Wypracowania, Tutor, Notatki, Fiszki, Premium, Konto; na telefonie dolny pasek 5 ikon + „więcej”; miejsce na dokowany tutor przez `--tutor-w`).
4. **Dialogi natywne** (`<dialog>` jak w `DemoDialog`/`ExamPage`) zastępują wszystkie `window.confirm` (usuń rozmowę, notatkę, fiszkę, talię, konto, zakończ egzamin bez odpowiedzi).
5. **Toasty** (`AppToast`) dla operacji w tle: zapis odpowiedzi w sesji SRS, zapis oceny, błąd sieci.
6. **Stany:** każda lista ma skeleton, empty state z CTA i stan błędu z „Spróbuj ponownie”.
7. **Dostępność jak dziś:** `aria-live` na komunikatach, fokus po nawigacji między zadaniami, `prefers-reduced-motion`, skip-link, kontrast AA na limonce (tekst zawsze ciemnozielony).

---

## 5. Zastąpienie rzeczy „tylko serwerowych”

| Next.js | Zamiennik w SPA |
|---|---|
| `proxy.ts` (cookies, redirecty) | `router.beforeEach` + store `auth` (sekcja 3.2) |
| `getCurrentUser` / `getOnboardedUser` | `authStore.ensureProfile()` w guardzie, profil cache’owany |
| Server Actions (profil, wylogowanie, usunięcie konta, oceny, CRUD fiszek, usuwanie notatek/rozmów, samoocena, zgłoszenie podejścia) | bezpośrednie wywołania supabase-js; po zapisie aktualizacja stanu lokalnego lub refetch |
| `revalidatePath`, `router.refresh()` | refetch zapytania danego widoku |
| `notFound()` | widok 404 w aplikacji |
| `/auth/potwierdz` (route handler) | widok Vue: `exchangeCodeForSession(code)` lub `verifyOtp({token_hash,type})` → `safeNextPath(next)` lub `/logowanie?blad=link` |
| `/konto/eksport` (route handler) | te same 9 zapytań w przeglądarce → `Blob` → pobranie `ogarnij-mature-moje-dane.json` |
| `src/lib/exams/public.ts` (`node:fs`, `"use cache"`) | skrypt buildowy `scripts/build-public-exams.mjs`: z `content/exams/*.json` robi `src/generated/public-exams.json` **bez odpowiedzi, `accepted`, `hint`** |
| `generateStaticParams`, `generateMetadata`, JSON-LD, `sitemap.ts`, `robots.ts`, `opengraph-image.tsx` | `scripts/prerender-public.mjs` po `vite build`: renderuje statyczny HTML dla `/`, `/arkusze-maturalne`, `/arkusze-maturalne/*`, `/kontakt`, `/rejestracja` (meta + JSON-LD + treść), generuje `sitemap.xml`, `robots.txt`; OG image jako statyczny PNG w `public/` |
| nagłówki CSP/HSTS z `next.config.ts` | `vercel.json` (`headers` + `rewrites` do `index.html`); CSP bez `unsafe-eval`, z `challenges.cloudflare.com`, `cke.gov.pl` (media), hostem Supabase |
| `next/font`, `next/image`, `@vercel/analytics/next` | `@fontsource` (latin-ext), `<img>`, `@vercel/analytics` `inject()` |
| alias `@shared/*` | alias Vite `@shared` → `supabase/functions/_shared` |

Elementy backendu, które **nie zmieniają się wcale**: wszystkie tabele, RLS, RPC, Edge Functions, pg_cron, Stripe webhook, limity planów w `plan_limits`.

---

## 6. Lista poprawek UX (ponad parytet)

Poprawki, które proponuję wdrożyć w iteracji 1, bo nie zmieniają backendu:

1. **Pulpit z treścią:** ostatnie 3 podejścia z wynikiem, liczba fiszek do powtórki, pozostałe limity AI, ostatnia notatka, szybkie przyciski.
2. **Arkusz obok zadania:** split-view z obecnego treningu (PDF po lewej, arkusz odpowiedzi po prawej, przewijanie do strony zadania z `meta.page`), z fallbackiem „otwórz PDF CKE w nowej karcie”. Plik wczytuje uczeń (CKE blokuje osadzanie), stan „PDF wczytany” pamiętamy w sesji przeglądarki.
3. **Mapa zadań** w trybie ćwiczeń i egzaminu (siatka numerów: odpowiedziane / oznaczone / sprawdzone), jak w obecnym `ExamPage`.
4. **Potwierdzenia w dialogach**, nie `window.confirm`; przycisk destrukcyjny zawsze drugi.
5. **Status „w trakcie” odświeżany automatycznie** dla wypracowań i notatek (polling co 3 s do 10 min).
6. **Allowance w jednym miejscu**: pasek limitów w nagłówku strefy AI (np. „Tutor: 7/10 dziś”), odświeżany po każdym użyciu.
7. **Formularze:** walidacja przy opuszczeniu pola, siła hasła, licznik znaków tam, gdzie są limity, zachowanie szkiców (wypracowanie, notatka, nowa talia) w localStorage.
8. **Nawigacja mobilna** dolnym paskiem w strefie zalogowanej; tutor jako pełnoekranowy arkusz z gestem zamknięcia.
9. **Fiszki:** zmiana nazwy talii, filtr „tylko trudne”, animacja odwracania z obecnego demo, skrót klawiszowy widoczny w UI.
10. **Komunikaty błędów** w jednym tonie (po polsku, bez żargonu), z akcją („Spróbuj ponownie”, „Wklej tekst”).

Poza zakresem iteracji 1 (wymagałyby backendu): nowe przedmioty, współdzielenie talii, powiadomienia e-mail o powtórkach.

---

## 7. Kolejność prac (iteracja 1)

| Etap | Zakres | Wynik etapu |
|---|---|---|
| 0. Fundament | router history, pinia, klient Supabase, aliasy, `vercel.json`, kopia `supabase/`, `content/`, `_shared`, kit UI, 3 layouty, 404, toasty, dialog | pusta aplikacja z nawigacją i guardami, build działa |
| 1. Konto | rejestracja, logowanie, reset hasła, `/auth/potwierdz`, onboarding, konto, eksport, usunięcie, Turnstile | pełny cykl życia konta na prawdziwej bazie |
| 2. Arkusze | lista, przegląd, ćwiczenia, egzamin, wynik, samoocena, ocena AI, split-view PDF | parytet z największym modułem |
| 3. Wypracowania | lista, nowe (SSE + podgląd na żywo), widok, „Sprawdź z AI” w wyniku | |
| 4. Tutor | strona, rozmowa, panel dokowany w ćwiczeniach i wyniku | |
| 5. Notatki | formularz (zdjęcia, pliki, tekst), 8 bloków, quiz, fiszki, zapis talii, druk | |
| 6. Fiszki | lista, 7 źródeł, edytor, sesja SRS, import/eksport | |
| 7. Premium | plany, checkout, gotowe, portal, allowance w całej apce | |
| 8. Publiczne | landing z realnymi CTA, strony SEO + prerender, sitemap/robots, kontakt, prawne, pożegnanie, demo treningu | |
| 9. Pulpit i UX | pulpit z danymi, poprawki z sekcji 6, przegląd dostępności, stany ładowania | |
| 10. Jakość | przeniesienie testów (routes, validation, srs, format, content, session), testy integracyjne RLS, `npm run content:check`, build, ręczna lista kontrolna ze starego README | gotowe do wdrożenia |

Każdy etap kończy się działającą aplikacją (feature po feature), więc stary serwis może działać równolegle aż do przełączenia domeny.

---

## 8. Co trzeba zrobić ręcznie poza kodem

1. **Supabase → Authentication → URL Configuration:** dodać origin nowej aplikacji (lokalnie `http://localhost:5173/**`, produkcyjnie nowa domena/URL Vercel) do Site URL i Redirect URLs. Bez tego linki resetu hasła i potwierdzenia nie zadziałają.
2. **Sekret Edge Functions `SITE_URL`** = adres nowej aplikacji (adresy powrotne Stripe: `/premium/gotowe`, `/premium/platnosc`).
3. **Szablony maili** w Supabase korzystają z `{{ .SiteURL }}/auth/potwierdz…`, więc po zmianie Site URL działają bez edycji.
4. Vercel: nowy projekt z tego repo (bez zmiennych środowiskowych), później przepięcie domeny.
5. Decyzja: czy stare repo zostaje tylko jako archiwum (proponuję: tak, po przełączeniu domeny dodajemy tam notkę w README).

---

## 9. Ryzyka i jak je ograniczamy

| Ryzyko | Ograniczenie |
|---|---|
| Reset hasła przez PKCE wymaga tej samej przeglądarki | używamy własnych szablonów z `token_hash` (działa między urządzeniami); `code` obsługujemy jako fallback |
| SEO stron `/arkusze-maturalne/*` w SPA | prerender HTML w buildzie + sitemap; sprawdzenie w Search Console po wdrożeniu |
| `max_rows = 1000` w API Supabase | eksport danych i lista fiszek do nauki ograniczone jak dziś; paginacja list |
| Sesja w localStorage zamiast cookies | brak SSR, więc brak wycieku przez cookies; zapis o tym w polityce prywatności |
| Rozjazd kopii `_shared` między repo | od etapu 0 jedynym źródłem jest `supabase/functions/_shared` w tym repo |
| Dwa fonty bez `latin-ext` psują polskie znaki | import `@fontsource-variable/*/latin-ext` (do weryfikacji w etapie 0) |
| Duże strumienie SSE na słabym łączu | wspólny parser z buforem i komunikatem o przerwaniu, jak dziś |

---

## 10. Pytania do decyzji przed startem

1. Czy nowa aplikacja ma od razu zastąpić starą pod tą samą domeną po zakończeniu iteracji 1, czy przez jakiś czas działać pod osobnym adresem (np. `beta.`)?
2. Czy obecny trening demo (`polski-2026`, 8 autorskich ćwiczeń) ma zostać jako publiczny „spróbuj bez konta”? Proponuję tak, pod `/trening/polski-2026`.
3. Czy landing zostaje w obecnej formie (hero, 3 narzędzia, cennik, FAQ), czy ma dostać sekcje ze starego (Notatki AI jako czwarte narzędzie, „kto za tym stoi”)? Proponuję: dodać kartę „Notatki AI” i sekcję „kto za tym stoi”, resztę zostawić.
4. Zgoda na TypeScript dla kodu przenoszonego 1:1 (bez przepisywania na JS)?
