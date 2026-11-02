# Przerwa techniczna

Dopóki w `middleware.js` jest `MAINTENANCE_ON = true`, każda strona pokazuje stronę przerwy (`page.js`) z kodem **503** i nagłówkiem `Retry-After`, więc Google nie wyrzuca stron z indeksu, a przeglądarki niczego nie zapamiętują. Pliki statyczne (`/assets`, `/fonts`, `/dokumenty`, `robots.txt`, `sitemap.xml`) działają normalnie. Webhooki Stripe i funkcje Supabase to inny serwer, przerwa ich nie dotyczy.

## Wejście na prawdziwą stronę

Otwórz `https://www.ogarnijmature.com/wejscie-ekipa`. Ta przeglądarka widzi normalny serwis przez 30 dni, także po zakończeniu przerwy nic się w niej nie zmienia. W innej przeglądarce lub na telefonie otwórz ten adres jeszcze raz.

## Podgląd strony przerwy

`https://www.ogarnijmature.com/?podglad=przerwa` działa w każdej przeglądarce (kod 200, `noindex`).

## Wyłączenie

W `middleware.js` ustaw `MAINTENANCE_ON = false` i wypchnij na `main`. Po około minucie serwis działa, a otwarte karty ze stroną przerwy same przeładują się w ciągu kilku minut.

## Godzina powrotu

Bez niej strona mówi „najpóźniej za 24 godziny”. Żeby podać konkretną, ustaw w `middleware.js` np. `MAINTENANCE_UNTIL = '2026-11-08T09:00:00+01:00'` (strona pokaże „w niedzielę o 9:00”).

## Po zmianie skryptu na stronie

Test `tests/maintenance.test.js` pilnuje, żeby hash skryptu w `vercel.json` (`script-src`) zgadzał się z `MAINTENANCE_SCRIPT`. Nowy hash wypisze: `node -e "import('./maintenance/page.js').then(m => console.log(m.MAINTENANCE_SCRIPT_HASH))"`.
