# Stav projektu — předávka do nového chatu

> Rychlý přehled k 20. 8. 2026 (naposledy: oznámení na telefon a rychlé plánování). Podrobnosti, rozhodnutí a nástrahy jsou
> v **PROJEKT.md** — tenhle soubor je jen rozcestník a seznam toho, co dál.
>
> **Nejdřív si přečti PROJEKT.md**, hlavně sekci 8 (technické nástrahy).

---

## Kde to běží

| Co | Kde |
|---|---|
| Aplikace | https://vorlis08.github.io/masterchef-vorlis/ |
| Repozitář | `vorlis08/masterchef-vorlis` (veřejný, jediná větev `main`) |
| Pracovní klon | `C:\Users\Vorlíci\OneDrive\Plocha\Claude code\masterchef-vorlis` |
| Backend | Cloudflare Worker `vorlis` → https://vorlis.honzavorel0.workers.dev |
| Databáze | Cloudflare D1 `masterchef` (region EEUR) |
| Pošta | Brevo (HTTP API, Worker neumí SMTP) |

**Nasazení:** push do `main` spustí GitHub Actions → Pages. Actions teď
před nasazením pouští **kontrolu kódu a testy** — když neprojdou, nenasadí se
nic. Worker se nasazuje zvlášť: `cd worker && npx.cmd wrangler deploy`.

**Před pushem:** `npm run kontrola` (lint + testy + build). Totéž, co pustí CI.

**Migrace databáze se nasazením NEPOUŠTĚJÍ** — vždycky ještě
`npx.cmd wrangler d1 migrations apply masterchef --remote`. Bez toho
Worker sahá na neexistující sloupce a padá na `Error 1101`.

**Pozor na Windows:** `npx` bez přípony spadne na zákazu skriptů —
používej **`npx.cmd`**.

---

## Jak spolu pracujeme

- **Česky.** Honza dělá vibecoding — vysvětlovat lidsky, ne žargonem.
- **Pushuje se bez ptaní**, když projde build a všech 15 sad testů.
  (Tohle přebíjí sekci 9 v PROJEKT.md, která říká opak — ta je zastaralá.)
- **Přístupové klíče nikdy nechodí chatem.** Vkládají se přes
  `npx.cmd wrangler secret put NAZEV` z Honzova terminálu.
- Honza si rychle všimne nesrovnalostí a dává cílenou zpětnou vazbu.
  Když řekne, že něco „vypadá jako AI", myslí tím vycentrované sloupce,
  tři stejné kartičky s emoji a věty s mašličkou. Chce suchý, lidský
  humor, který nechodí s rozběhem.

---

## Co je hotové

### Refaktoring: „mozek" oddělený od „vzhledu" (sekce 6 a 7)

Veškerá logika je v `src/lib/`, testovatelná bez prohlížeče. **639 testů**
v 15 sadách, pouštějí se `npm test` z kořene.

Navíc `npm run lint`: ESLint nad `src/lib/`, `worker/src/` i nad kódem
uvnitř `index.astro` (ten se pro kontrolu vytáhne — viz
`scripts/lint-astro.mjs`). Hledá jen dvě věci — použitou proměnnou, která
nikde nevznikla, a zbytky po smazaných funkcích. Není to nástroj na styl.

| Soubor | Co dělá |
|---|---|
| `recipe-logic.js` | základní převody, škálování, čas, escapování |
| `filters.js` | které recepty se zobrazí |
| `recipe-view.js` | podklad k vykreslení — **kontrakt pro skiny** |
| `cook-session.js` | krokování receptem |
| `cook-timers.js` | paralelní časovače (engine si sám nespouští hodiny) |
| `pantry.js` | spíž: přesné / přibližné / počítané, kroky množství |
| `catalog.js` | katalog ~95 surovin řazený podle kuchyně |
| `match.js` | porovnávání surovin, „co mi chybí" — **sdílí appka i Worker** |
| `booking.js` | termíny, konflikty, zámky surovin |
| `kalendar.js` | měsíční mřížka |
| `tour.js` | 24 kroků prohlídky aplikace |
| `hodnosti.js` | hodnost podle počtu uvařených jídel |
| `cas.js` | převod mezi UTC a českým časem (letní i zimní) |
| `booking.js` → `rychleTerminy`, `kPripomenuti` | rychlé termíny a výběr, komu pípnout |

### Aplikace

- Brána pro nepřihlášené (editorial layout, „Zase toast?")
- Přihlášení přes Google, **profil ve vlastním okně** (hodnost, fotka
  z knihovny nebo z telefonu, statistiky, rozcestník do spíže a plánu)
- **V nastavení se nic nezapíná** — e-maily, oznámení i kalendář chodí
  od začátku; vypíná se to v e-mailu, v telefonu a v účtu Google (8.22)
- Úvodní okno po registraci + průvodce aplikací (24 kroků)
- Spíž: přehled „mám doma / dochází / došlo", sekce podle kuchyně,
  hledání, stav barevným proužkem, „mám doma standardně" jako pilulka.
  Tlačítko v hlavičce nese barvu značky a odznak, kolik věcí dochází.
- Bookingy „TO UVAŘÍM!" se zámky surovin — tlačítko je nahoře u „Režim
  vaření", tedy **před postupem**, ne až pod ním. Rychlé termíny
  („Dnes večer / Zítra večer / V sobotu") jedním tapem; podrobný
  formulář je schovaný pod „Vybrat jiný den"
- **Oznámení na telefon** (Web Push): připomínka před vařením, uvítací
  hned po zapnutí a připomenutí, když se uživatel týden neukáže
- **Zápis do Google kalendáře** — naplánované vaření se uloží i tam,
  zrušené se odtud zase smaže
- Kalendář vaření + „Chybějící do nákupu" + **plánování rovnou z kalendáře**
  (klik na den → výběr receptu, nahoře to, na co máš doma).
  Propadlé vaření je v mřížce označené `!`
- Nákupní seznam **v databázi** (sdílí se mezi zařízeními)
- Filtry: Chod / Čas / Stav (přepínač) + „Můžu uvařit", zvýraznění, počítadlo `3×`.
  Při filtrování se „Dnešní volba" schová — překážela.
- Režim vaření, chef AI, náhrady surovin, barevná témata

### Backend

- `worker/src/`: `index.js` (routy), `google.js` (OAuth), `session.js`
  (podepsané lístky), `api.js` (profil, spíž, bookingy, nákup, stav receptů),
  `mail.js` (6 druhů zpráv), `digest.js` (Cron)
- 6 migrací, tabulky: `users`, `inventory`, `bookings`, `reservations`,
  `shopping_list`, `recipe_state`, `email_log`, `known_recipes`
- Cron: **každou hodinu (oznámení na telefon)**, denně 7:00 (nákupní
  seznam + připomínka), pondělí (nové recepty + wishlist), 1. v měsíci
  (souhrn)
- `push.js`: VAPID podpis + šifrování obsahu (RFC 8291), bez knihovny.
  Ověřené `test-push.mjs`, který zprávu zase rozšifruje.

### Bezpečnost — vyřešeno

- Uniklý Anthropic klíč z historie repa **zneplatněn**
- Worker byl **otevřená proxy** (kdokoliv mohl utrácet za AI) — zamčeno
  na tři vrstvy: povolený původ, Worker si skládá dotaz sám, limit 20/min
- **XSS** přes názvy receptů — ošetřeno (`esc` / `escAttr`)
- **GitHub token v prohlížeči je pryč** — editace receptů z appky
  vypnutá, tím padá nástraha 8.2

---

## Co čeká na Honzu (nikdo jiný to neudělá)

1. **Přihlásit se a projít appku.** Tohle blokuje ověření všeho, co je
   za přihlášením: uvítací e-mail, úvod, průvodce, ukládání spíže,
   bookingy, zámky, kalendář, nákupní seznam. Napsané a otestované to je,
   ale očima to nikdo neviděl.
2. **Uvařit one-pot verze** tagliatelle a garlic beef pasta — metoda je
   přepsaná podle zásad, ale poměry vody (700 ml / 600 ml) chtějí ověřit
   u sporáku.
3. **Obsah Fáze 1**: 23 uložených YouTube Shorts (chybí seznam),
   Fancy verze u 5 receptů.
4. **Zprovoznit oznámení** — bez tohohle nepípne nic (postup je
   v PROJEKT.md 8.17):
   - `node scripts/vapid-keys.mjs`
   - veřejný klíč do `worker/wrangler.toml`, soukromý přes
     `npx.cmd wrangler secret put VAPID_PRIVATE_KEY`
   - `cd worker && npx.cmd wrangler deploy`
   - `npx.cmd wrangler d1 migrations apply masterchef --remote`
   - na iPhonu appku **přidat na plochu**, jinak oznámení neexistují
5. **Zprovoznit Google kalendář** (PROJEKT.md 8.21) — v Google Cloud
   Console přidat rozsah `calendar.events` a sebe mezi *Test users*,
   pak se v appce odhlásit a přihlásit znovu. Bez toho Google
   přihlášení odmítne.

---

## Co dál — návrhy

**Blízko:**

- **Fancy verze receptů** — chybí u `kremove-kureci-tagliatelle`,
  `kure-na-paprice`, `peceny-bucek`, `creamy-garlic-beef-pasta`,
  `sunko-eidamovy-wrap`. (Pozor: PROJEKT.md dřív tvrdil opak — Basic
  má **každý** recept.)
- **Ověřit oznámení na skutečném telefonu.** Šifrování je otestované
  proti sobě samému, ale že to pípne na iPhonu, nikdo neviděl.

**Dál:**

- **Skiny** (sekce 6): přenést dnešní UI jako skin „Aplikace", pak
  postavit „Knihu". Kontrakt na to čeká hotový v `recipe-view.js` —
  „Kniha" je zároveň jediná zkouška, jestli refaktoring k něčemu byl.
  Honza to zatím odložil.
- **Sign in with Apple** — čeká na placený účet (99 USD/rok).
- **Ruční oprava spíže dvěma tapy** (4.4) přímo z receptu.

---

## Opraveno 22. 8. 2026 (větev `oprava-chyb`)

Po projití celého kódu. Podrobnosti jsou v commitech.

- **Přepínač Basic/Fancy byl rozbitý** — volání `paintWishBtn(slug)`
  s neexistující proměnnou utlo zbytek vykreslování, takže se přepsaly
  ingredience, ale postup a nadpisy zůstaly v Basic. Proti opakování
  je teď lint (`npm run lint`) i test v `test-store.mjs`.
- **Odebrání z oblíbených se po načtení vracelo** — slug bez hodnocení
  vypadl z toho, co se posílá na server, takže se odebrání nikam
  nezapsalo.
- **Oznámení na telefon mohla propadnout** — časovač v režimu vaření si
  sám říkal o povolení a tím umlčel nabídku push oznámení. O povolení
  se teď žádá jen na jednom místě.
- **Okna „Nahradit" a „Nutriční hodnoty"** chyběla v `oknaOdVrchu()`,
  takže je Escape ani tlačítko zpět neuměly zavřít (8.24).
- **Plánování z kalendáře** ukládalo počet porcí posledního otevřeného
  receptu.
- **Zimní čas** — pevné „+2 h" v `digest.js` a `booking.js` znamenalo
  přes zimu e-mail o hodinu dřív a žádnou připomínku na večerní vaření
  mezi 21:00 a 22:00. Nově přes `cas.js`.
- **Rezervace nebyly vázané na majitele spíže** — přihlášený uživatel
  mohl zamknout surovinu v cizí spíži. Doplněn filtr `user_id` a
  kontrola, že položka patří jemu.
- **Denní běh** počítal rezervace špatně, když bylo na jeden den víc
  vaření — druhé vaření vidělo vlastní zámky jako cizí.
- **Odhlašovací odkaz** má konstantní porovnání tokenu a strop na počet
  pokusů.
- **Limit 20 dotazů/min** platil i pro běžné API, takže se do něj dalo
  spadnout normálním klikáním ve spíži. AI a API mají teď stropy zvlášť
  (`API_LIMITER` ve `wrangler.toml` — **při nasazení Workeru je potřeba
  ho vytvořit**).
- Escapování v `index.astro` na osmi místech, úklid mrtvého kódu,
  cache hodnocení místo čtení z localStorage při každém překreslení,
  odmlka u hledání, `email_log` se jednou za měsíc uklidí.

---

## Nástrahy, na které se snadno narazí

Všechny jsou rozepsané v PROJEKT.md sekce 8. Nejčastější:

- **Tlačítko zpět v nainstalované appce** zavírá okna, ne celou
  aplikaci. Nové okno se musí přidat do `oknaOdVrchu()`, jinak ho
  „zpět" přeskočí. (8.24)
- **`index.astro` je jeden velký blok.** Přihlašovací kód běží **mimo**
  blok čekající na načtení stránky, zbytek uvnitř — přímo na sebe nevidí.
  Propojují je `poPrihlaseni` a `branaHook`. (8.13)
- **Pořadí deklarací:** `renderGrid()` se volá hned při startu. Když do
  něj přibude čtení nové proměnné, musí být deklarovaná nad ním. (8.16)
- **Po `wrangler deploy` běží pár minut stará i nová verze zároveň.**
  Testy hned po nasazení vracejí střídavě obojí — testovat opakovaně. (8.10)
- **Na porovnávání surovin nepoužívat `ingredientMatch`** — porovnává
  podřetězce, takže „smetana" a „smetany" mu nesednou. Od toho je
  `match.js`. (8.14)
- **Prohlídku nejde otestovat ve skrytém okně** — animační smyčka se
  nespustí a krokování uvázne. (8.12)
- **`BASE_URL` nemá lomítko na konci.** `base + 'soubor'` dá
  `/masterchef-vorlissoubor`. Takhle byl dlouho rozbitý favicon;
  `Layout.astro` teď lomítko doplňuje. (8.18)
