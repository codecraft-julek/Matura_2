<script setup>
// ⚠️ DRAFT. Polish law (ustawa o świadczeniu usług drogą elektroniczną, art. 8) requires terms of
// service for online services. This text has NOT been reviewed by a lawyer.
// TODO(legal): have it reviewed before launch, fill in every [PLACEHOLDER], and if you change it in a
// way users must re-accept, bump TERMS_VERSION in src/config/site.ts.
import { RouterLink } from 'vue-router'
import { ROUTES } from '@/config/routes'
import { SITE } from '@/config/site'
import { PLANS } from '@/config/plans'
import LegalPage from '@/components/landing/LegalPage.vue'
import { PAGE_SEO } from './seo'
import { useSeo } from './useSeo'

useSeo(() => PAGE_SEO.terms)
const price = id => PLANS.find(p => p.id === id)?.price
</script>

<template>
  <LegalPage title="Regulamin" updated="29 października 2026">
    <section>
      <h2>1. Kto prowadzi serwis</h2>
      <p>Serwis {{ SITE.name }} prowadzi [IMIĘ I NAZWISKO / NAZWA FIRMY], [ADRES], [NIP, jeśli jest] (dalej: „my”). Kontakt: <a :href="`mailto:${SITE.contactEmail}`">{{ SITE.contactEmail }}</a>.</p>
    </section>

    <section>
      <h2>2. Co oferujemy</h2>
      <p>{{ SITE.name }} to serwis do nauki do matury z języka polskiego i angielskiego. Po założeniu konta możesz korzystać z materiałów i narzędzi, które udostępniamy, w tym z narzędzi opartych na sztucznej inteligencji (AI). Podstawowe korzystanie jest bezpłatne. Większe limity narzędzi AI dają płatne plany opisane w punkcie 7.</p>
    </section>

    <section>
      <h2>3. Czego nie obiecujemy</h2>
      <ul>
        <li>Nie jesteśmy powiązani z Centralną Komisją Egzaminacyjną (CKE). Nasze oceny i uwagi nie są oficjalną oceną egzaminacyjną.</li>
        <li>Odpowiedzi i uwagi generowane przez AI mogą zawierać błędy. Traktuj je jako pomoc w nauce, a nie ostateczne rozstrzygnięcie.</li>
        <li>Nie gwarantujemy żadnego konkretnego wyniku na maturze.</li>
      </ul>
    </section>

    <section>
      <h2>4. Konto</h2>
      <ol>
        <li>Konto może założyć osoba, która ma co najmniej 16 lat, albo młodsza za zgodą rodzica lub opiekuna. [DO WERYFIKACJI PRAWNEJ]</li>
        <li>Podajesz prawdziwy adres e-mail i dbasz o to, żeby nikt poza Tobą nie znał Twojego hasła.</li>
        <li>Konto możesz w każdej chwili usunąć w <RouterLink :to="ROUTES.account">ustawieniach konta</RouterLink>. Usunięcie jest natychmiastowe i nieodwracalne.</li>
      </ol>
    </section>

    <section>
      <h2>5. Zasady korzystania</h2>
      <p>Korzystając z serwisu, nie wolno Ci:</p>
      <ul>
        <li>próbować obejść zabezpieczeń, limitów ani dostać się do cudzych kont,</li>
        <li>automatycznie masowo pobierać treści ani obciążać serwisu (np. botami),</li>
        <li>wprowadzać treści bezprawnych, obraźliwych albo naruszających prawa innych osób,</li>
        <li>udostępniać swojego konta innym osobom.</li>
      </ul>
      <p>Jeśli ktoś łamie te zasady, możemy ograniczyć mu dostęp albo usunąć konto. Wcześniej, o ile to możliwe, napiszemy do tej osoby z wyjaśnieniem.</p>
    </section>

    <section>
      <h2>6. Limity korzystania z AI</h2>
      <p>Narzędzia AI kosztują nas za każde użycie, dlatego mają limity na konto (dzienne albo tygodniowe), zależne od planu. Aktualne limity są na stronie Premium, a to, ile Ci zostało, widzisz przy każdym narzędziu.</p>
    </section>

    <section>
      <h2>7. Płatne plany (Premium)</h2>
      <ul>
        <li>Premium miesięczne kosztuje {{ price('monthly') }} i odnawia się automatycznie co miesiąc, dopóki go nie anulujesz. Anulujesz w każdej chwili na stronie konta („Zarządzaj subskrypcją”); Premium działa wtedy do końca opłaconego okresu.</li>
        <li>Pakiet do matury kosztuje {{ price('matura') }}, płacisz raz, działa do 31 maja 2027 i się nie odnawia.</li>
        <li>Płatności obsługuje Stripe (BLIK, karta, Przelewy24). Nie widzimy ani nie przechowujemy danych Twojej karty. Potwierdzenie płatności dostajesz e-mailem. [DO WERYFIKACJI: paragon / faktura, VAT]</li>
        <li>Premium włącza się od razu po płatności. Przed zapłatą prosimy Cię o zgodę na rozpoczęcie świadczenia przed upływem 14 dni od zawarcia umowy; z tą chwilą tracisz prawo do odstąpienia od umowy (art. 38 pkt 13 ustawy o prawach konsumenta). [DO WERYFIKACJI]</li>
        <li>Jeśli masz mniej niż 18 lat, możesz kupić plan tylko za zgodą rodzica lub opiekuna.</li>
      </ul>
    </section>

    <section>
      <h2>8. Treści i prawa autorskie</h2>
      <p>Materiały przygotowane przez nas (np. fiszki, opisy, interfejs) są chronione prawem autorskim. Możesz z nich korzystać do własnej nauki. Arkusze egzaminacyjne pochodzą z publicznie dostępnych materiałów CKE. [DO WERYFIKACJI: zasady wykorzystania arkuszy i zawartych w nich tekstów]</p>
      <p>Teksty, które wpisujesz (np. wypracowania), pozostają Twoje.</p>
    </section>

    <section>
      <h2>9. Wymagania techniczne</h2>
      <p>Potrzebujesz urządzenia z dostępem do internetu, aktualnej przeglądarki internetowej z włączoną obsługą JavaScript i zapisu danych w pamięci przeglądarki (localStorage, w którym trzymamy Twoją sesję logowania) oraz adresu e-mail.</p>
    </section>

    <section>
      <h2>10. Reklamacje</h2>
      <p>Jeśli coś nie działa, jak powinno, napisz na <a :href="`mailto:${SITE.contactEmail}`">{{ SITE.contactEmail }}</a>. Odpowiemy w ciągu 14 dni. Jeśli jesteś konsumentem, możesz też skorzystać z pozasądowych sposobów rozwiązywania sporów, np. przez rzecznika konsumentów.</p>
    </section>

    <section>
      <h2>11. Prywatność</h2>
      <p>Zasady przetwarzania danych opisuje <RouterLink :to="ROUTES.privacy">polityka prywatności</RouterLink>.</p>
    </section>

    <section>
      <h2>12. Zmiany regulaminu</h2>
      <p>Możemy zmienić regulamin z ważnych powodów (np. nowe funkcje, zmiana prawa). O zmianach poinformujemy co najmniej 14 dni wcześniej. Jeśli się nie zgadzasz, możesz usunąć konto.</p>
    </section>

    <section>
      <h2>13. Postanowienia końcowe</h2>
      <p>Regulamin podlega prawu polskiemu. Nie ogranicza on Twoich praw jako konsumenta, które wynikają z obowiązujących przepisów.</p>
    </section>
  </LegalPage>
</template>
