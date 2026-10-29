<script setup>
// ⚠️ DRAFT. This text has NOT been reviewed by a lawyer.
// TODO(legal): have it reviewed before launch. Fill in every [PLACEHOLDER].
// Update it whenever you start collecting new data.
import { RouterLink } from 'vue-router'
import { ROUTES } from '@/config/routes'
import { SITE } from '@/config/site'
import LegalPage from '@/components/landing/LegalPage.vue'
import { PAGE_SEO } from './seo'
import { useSeo } from './useSeo'

useSeo(() => PAGE_SEO.privacy)
</script>

<template>
  <LegalPage title="Polityka prywatności" updated="29 października 2026">
    <section>
      <h2>Krótko i po ludzku</h2>
      <p>Zbieramy tylko to, czego potrzebujemy, żeby {{ SITE.name }} działało. Nie sprzedajemy Twoich danych i nie pokazujemy reklam. Swoje dane możesz w każdej chwili pobrać albo usunąć razem z kontem w ustawieniach konta.</p>
    </section>

    <section>
      <h2>Kto odpowiada za Twoje dane</h2>
      <p>Administratorem danych jest [IMIĘ I NAZWISKO / NAZWA FIRMY], [ADRES]. Kontakt: <a :href="`mailto:${SITE.contactEmail}`">{{ SITE.contactEmail }}</a>.</p>
    </section>

    <section>
      <h2>Jakie dane zbieramy</h2>
      <p><strong>Jeśli zakładasz konto:</strong></p>
      <ul>
        <li>adres e-mail i hasło (hasło przechowujemy wyłącznie w zaszyfrowanej postaci, nikt go nie widzi),</li>
        <li>imię lub ksywkę, przedmioty, które zdajesz, i rok matury,</li>
        <li>potwierdzenie akceptacji regulaminu i wieku, z datą,</li>
        <li>techniczne informacje o logowaniu (np. data ostatniego logowania),</li>
        <li>Twoje rozwiązania arkuszy: odpowiedzi, wpisane teksty (np. wypowiedzi pisemne), wyniki i czas rozwiązywania,</li>
        <li>wypracowania i wypowiedzi, które wysyłasz do sprawdzenia przez AI, razem z feedbackiem,</li>
        <li>Twoje rozmowy z tutorem AI (pytania i odpowiedzi),</li>
        <li>notatki AI: tekst, który wklejasz albo który AI odczytało z Twoich zdjęć, i gotowe notatki,</li>
        <li>Twoje fiszki i postęp ich powtórek (kiedy i jak dobrze odpowiadałeś),</li>
        <li>Twoje oceny odpowiedzi AI (👍/👎) i komentarz, jeśli go dopiszesz (żeby poprawiać AI),</li>
        <li>wiadomości z formularza kontaktowego: imię (jeśli je podasz), e-mail, temat i treść, a jeśli jesteś zalogowany, powiązanie z kontem,</li>
        <li>liczbę sprawdzeń AI, wiadomości do tutora, notatek i fiszek AI w danym dniu (żeby pilnować dziennego limitu).</li>
      </ul>
      <p><strong>Jeśli zapisujesz się na listę oczekujących:</strong> adres e-mail, przedmioty, rok matury, potwierdzenie zgody i wieku oraz źródło wejścia na stronę, jeśli było w linku (parametry utm_source, utm_medium, utm_campaign, ref).</p>
      <p>Żeby chronić formularze przed botami, przez maksymalnie 24 godziny przechowujemy jednokierunkowy skrót (hash) adresu IP. Nie da się z niego odczytać Twojego IP.</p>
    </section>

    <section>
      <h2>Po co i na jakiej podstawie</h2>
      <ul>
        <li><strong>Konto:</strong> żeby świadczyć Ci usługę opisaną w <RouterLink :to="ROUTES.terms">regulaminie</RouterLink> (art. 6 ust. 1 lit. b RODO).</li>
        <li><strong>Lista oczekujących:</strong> żeby wysłać Ci informację o starcie, na podstawie Twojej zgody (art. 6 ust. 1 lit. a RODO). Zgodę możesz wycofać w każdej chwili.</li>
        <li><strong>Ochrona przed nadużyciami:</strong> nasz uzasadniony interes (art. 6 ust. 1 lit. f RODO).</li>
      </ul>
    </section>

    <section>
      <h2>Jak długo</h2>
      <ul>
        <li>Dane konta: dopóki masz konto. Po usunięciu konta kasujemy je od razu.</li>
        <li>Wiadomości z formularza kontaktowego: do [12 MIESIĘCY] od odpowiedzi, chyba że poprosisz o wcześniejsze usunięcie.</li>
        <li>Lista oczekujących: do startu serwisu i wysłania powiadomienia, ale nie dłużej niż [12 MIESIĘCY] od zapisu, albo do wycofania zgody.</li>
        <li>Kopie zapasowe bazy danych mogą przechowywać dane jeszcze do [7] dni. [DO WERYFIKACJI]</li>
      </ul>
    </section>

    <section>
      <h2>Komu je powierzamy</h2>
      <ul>
        <li>Supabase: baza danych i logowanie (serwery w UE, Frankfurt),</li>
        <li>Vercel: hosting strony i anonimowe statystyki odwiedzin,</li>
        <li>ScrapeCreators: pobiera napisy filmów z YouTube, z których robisz fiszki (dostaje tylko link do filmu),</li>
        <li>Cloudflare: zabezpieczenie formularzy przed botami (Turnstile),</li>
        <li>Stripe: płatności za Premium. Stripe dostaje Twój e-mail i dane płatności (np. kartę), my dostajemy tylko informację, czy i do kiedy masz Premium. [DO WERYFIKACJI: Stripe jako odrębny administrator danych płatności]</li>
        <li>Resend: wysyłka e-maili (np. reset hasła i powiadomienia o wiadomościach z formularza kontaktowego),</li>
        <li>OpenAI: model AI, który przygotowuje feedback do wypracowań, ocenia odpowiedzi otwarte, odpowiada jako tutor, robi notatki i fiszki. Wysyłamy mu tylko to, co jest potrzebne (tekst wypracowania, odpowiedzi, wiadomości do tutora, tekst i zdjęcia notatek, tekst plików), bez Twojego maila i imienia, i prosimy, żeby nie przechowywał rozmów. [DO WERYFIKACJI: warunki przetwarzania danych przez OpenAI, okres przechowywania]</li>
      </ul>
      <p>Część tych firm ma siedzibę w USA. Przekazywanie danych odbywa się na podstawie standardowych klauzul umownych lub programu EU-US Data Privacy Framework. [DO WERYFIKACJI]</p>
    </section>

    <section>
      <h2>Feedback AI</h2>
      <p>Gdy klikasz „Sprawdź z AI”, tekst Twojego wypracowania trafia do modelu AI, który przygotowuje uwagi według kryteriów CKE. Nie wpisuj w wypracowaniu danych osobowych (swoich ani innych osób). Feedback jest orientacyjny i może zawierać błędy. Swoje wypracowania możesz usunąć razem z kontem.</p>
    </section>

    <section>
      <h2>Tutor AI</h2>
      <p>Wiadomości, które piszesz do tutora, trafiają do modelu AI razem z opisem zadania z arkusza i Twoimi odpowiedziami do tego zadania. Zapisujemy rozmowy, żebyś mógł do nich wrócić. Każdą rozmowę możesz usunąć w zakładce Tutor, a wszystkie znikają razem z kontem. Nie podawaj w rozmowie danych osobowych. Tutor to AI i może się mylić.</p>
    </section>

    <section>
      <h2>Notatki AI</h2>
      <p>Gdy robisz notatkę, Twój tekst albo zdjęcia trafiają do modelu AI. Zdjęć nie zapisujemy: przeglądarka je zmniejsza (i usuwa z nich dane takie jak lokalizacja), AI je odczytuje, a my zachowujemy tylko odczytany tekst i gotową notatkę. Nie fotografuj danych osobowych ani cudzych prac. Notatki z podręczników są tylko do Twojej prywatnej nauki. Każdą notatkę możesz usunąć, a wszystkie znikają razem z kontem.</p>
    </section>

    <section>
      <h2>Fiszki</h2>
      <p>Pliki PDF, Word i PowerPoint czytamy w Twojej przeglądarce: do AI trafia tylko ich tekst (a ze skanów kilka pierwszych stron jako obrazy), a samych plików nie zapisujemy. Gdy podasz link do strony, nasz serwer pobiera ją i wyciąga z niej tekst. Przy filmach z YouTube pobieramy tytuł i napisy filmu (przez usługę ScrapeCreators, której wysyłamy tylko link do filmu), chyba że wkleisz transkrypcję sam. Zapisujemy gotowe fiszki i postęp powtórek. Fiszki z cudzych materiałów są do Twojej prywatnej nauki. Talie możesz usuwać, a wszystkie znikają razem z kontem.</p>
    </section>

    <section>
      <h2>Pamięć przeglądarki, ciasteczka i statystyki</h2>
      <p>Gdy się logujesz, zapisujemy Twoją sesję logowania w pamięci przeglądarki (localStorage), a nie w ciasteczkach. Jest niezbędna, żeby logowanie działało, więc nie wymaga osobnej zgody. Znika po wylogowaniu. W tej samej pamięci przeglądarka trzyma też szkice, których jeszcze nie wysłałeś (np. wypracowanie albo notatkę), i postęp w treningu bez konta, żeby odświeżenie strony nic nie kasowało. Te dane zostają na Twoim urządzeniu i do nas nie trafiają, dopóki ich nie wyślesz.</p>
      <p>Nie używamy ciasteczek reklamowych ani śledzących. Zabezpieczenie przed botami (Cloudflare Turnstile) może zapisać w przeglądarce dane techniczne potrzebne do sprawdzenia, czy jesteś człowiekiem. [DO WERYFIKACJI]</p>
      <p>Odwiedziny liczymy przez Vercel Web Analytics, które działa bez ciasteczek i nie zapisuje nic na Twoim urządzeniu. Widzimy tylko zbiorcze liczby, np. ile osób weszło na stronę.</p>
    </section>

    <section>
      <h2>Twoje prawa</h2>
      <p>Masz prawo do:</p>
      <ul>
        <li>wglądu w swoje dane i otrzymania ich kopii (przycisk „Pobierz moje dane” w <RouterLink :to="ROUTES.account">ustawieniach konta</RouterLink>),</li>
        <li>poprawienia ich (w ustawieniach konta),</li>
        <li>usunięcia ich razem z kontem (przycisk „Usuń konto” w ustawieniach konta),</li>
        <li>wycofania zgody w każdej chwili,</li>
        <li>sprzeciwu i ograniczenia przetwarzania,</li>
        <li>złożenia skargi do Prezesa Urzędu Ochrony Danych Osobowych (uodo.gov.pl), jeśli uznasz, że coś robimy źle.</li>
      </ul>
      <p>W innych sprawach napisz na <a :href="`mailto:${SITE.contactEmail}`">{{ SITE.contactEmail }}</a> z adresu, na który masz konto.</p>
    </section>

    <section>
      <h2>Osoby niepełnoletnie</h2>
      <p>Z serwisu mogą korzystać osoby, które mają co najmniej 16 lat, albo młodsze za zgodą rodzica lub opiekuna. [DO WERYFIKACJI PRAWNEJ]</p>
    </section>
  </LegalPage>
</template>
