# Przerwa techniczna

Strona przerwy (`page.js`) jest serwowana przez `middleware.js` z kodem **503** i nagłówkiem `Retry-After`, więc Google nie wyrzuca stron z indeksu, a przeglądarki niczego nie zapamiętują. Pliki statyczne (`/assets`, `/fonts`, `/dokumenty`, `robots.txt`, `sitemap.xml`) działają normalnie. Webhooki Stripe i funkcje Supabase to inny serwer, przerwa ich nie dotyczy.

## Włączenie (Vercel → projekt → Settings → Environment Variables, środowisko Production)

| Zmienna | Wartość |
| --- | --- |
| `MAINTENANCE_MODE` | `on` |
| `MAINTENANCE_UNTIL` | planowany koniec, np. `2026-11-08T09:00:00+01:00` (strona pokaże „w niedzielę o 9:00”) |
| `MAINTENANCE_BYPASS_TOKEN` | długi losowy ciąg, np. z `openssl rand -hex 24` |

Zmiana zmiennych działa dopiero w nowym wdrożeniu: Deployments → ostatnie wdrożenie → **⋯ → Redeploy**. Po około minucie strona odpowiada 503. Sprawdzenie:

```bash
curl -sI https://www.ogarnijmature.com/ | grep -i -E "^(HTTP|retry-after|cache-control)"
```

## Wejście dla właściciela

Otwórz `https://www.ogarnijmature.com/przerwa-wejscie?klucz=<MAINTENANCE_BYPASS_TOKEN>`. Ciasteczko na 4 godziny wpuszcza tylko tę przeglądarkę. `https://www.ogarnijmature.com/przerwa-wejscie` bez klucza usuwa ciasteczko (żeby zobaczyć stronę przerwy).

## Podgląd bez włączania przerwy

`https://www.ogarnijmature.com/?podglad=przerwa` pokazuje stronę (kod 200, `noindex`), z datą z `MAINTENANCE_UNTIL`, jeśli jest ustawiona.

## Wyłączenie

Usuń `MAINTENANCE_MODE` (albo ustaw inną wartość niż `on`) i zrób Redeploy. Otwarte karty ze stroną przerwy same przeładują się w ciągu kilku minut.

## Po zmianie skryptu na stronie

Test `tests/maintenance.test.js` pilnuje, żeby hash skryptu w `vercel.json` (`script-src`) zgadzał się z `MAINTENANCE_SCRIPT`. Nowy hash wypisze: `node -e "import('./maintenance/page.js').then(m => console.log(m.MAINTENANCE_SCRIPT_HASH))"`.
