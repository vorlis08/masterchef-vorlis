# MasterChef Vorlis — kontext projektu

> Tenhle soubor je pro Claude Code (a pro budoucího mě). Obsahuje **záměr, rozhodnutí
> a nástrahy**, které z kódu samotného nejsou poznat. Kód si přečti sám — tady je to,
> co v něm není napsané.
>
> Poslední aktualizace: 18. 8. 2026 — po kroku 3 refaktoringu a po bezpečnostní revizi
> (viz 8.10, 8.11).

---

## 1. Co to je a proč to existuje

**MasterChef Vorlis** je osobní kuchařka Honzy Vorla. Běží na
`vorlis08.github.io/masterchef-vorlis`.

**Dlouhodobý cíl není kuchařka.** Cílem je **kompletní systém řízení kuchyně**:

1. Evidence úplně všeho, co je v kuchyni (suroviny, koření, vybavení)
2. Vyhledávání „co můžu právě teď uvařit"
3. Plánování jídel dopředu jako v kalendáři
4. Automatické doplňování chybějících surovin do nákupního seznamu

Honza se brzy stěhuje do vlastní kuchyně — to je moment, kdy má systém začít reálně
sloužit. Do té doby se staví základy a testuje se to v provizorní kuchyni.

**Kuchařka je tedy podvozek, ne cíl.** Rozhodnutí v kódu by měla směřovat k tomu, aby
na to šlo postavit inventář a plánování, ne aby to byl hezký seznam receptů.

---

## 2. Aktuální stav

### Co funguje dnes

- Recepty ze statického `src/data/recipes.json`, vkládané do stránky při buildu
- Dva režimy zobrazení receptu: **Basic** (přímočaré) a **Fancy** (rozšířené)
- Cook mode — krokování receptem s časovači a wake lock (displej nezhasne)
- Hledání, filtry (kategorie, typ jídla, čas), oblíbené
- Škálování porcí
- Hodnocení hvězdičkami, poznámky, počítadlo „kolikrát uvařeno"
- Nákupní seznam
- Dvě AI asistence („chef AI"): doporučení receptů a náhrada surovin
- Přepínání barevných témat
- Import/export receptů, editace a ukládání přes GitHub API přímo z prohlížeče

### Stack

| Vrstva | Technologie |
|---|---|
| Frontend | Astro + Tailwind CSS |
| Hosting | GitHub Pages (deploy automaticky při pushi do `main`) |
| Backend | Cloudflare Worker na `vorlis.honzavorel0.workers.dev` (proxy pro AI volání) |
| Databáze | **zatím žádná** — plánuje se Cloudflare D1 (SQLite) |
| Data | `src/data/recipes.json` + localStorage v prohlížeči |
| Repo | `vorlis08/masterchef-vorlis` |

---

## 3. Rozdělané a nedodělané (Fáze 1 — obsah kuchařky)

Tohle jsou úkoly na obsahu, ne na kódu. Vyžadují Honzovo rozhodnutí, protože jde
o recepty, které sám vaří a ověřuje.

- [ ] **Basic verze pro 2 recepty**, které mají zatím jen Fancy:
  *pečený bůček* a *karamelizovaná cibulková pasta*
- [ ] **Oprava metody u tagliatelle a garlic beef pasta** — obojí má stejnou chybu:
  těstoviny se míchají do hotové omáčky místo aby se v ní dovařily. Má se přepsat
  na **one-pot metodu**
- [ ] **Přidat recept** *Creamy Sausage Pasta se slaninou a cherry rajčaty* — je hotový
  a ověřený, čeká jen na nahrání do `recipes.json`
- [ ] **Zpracovat seznam uložených YouTube Shorts** (23 videí) — postup je vždycky:
  uvařit → ověřit → sepsat → přidat do `recipes.json`

---

## 4. Fáze 2/3 — inventář a plánování

> **Stav k 20. 8. 2026:** postavené je 4.1 (bookingy), 4.2 (zámky),
> 4.3 (škála „co můžu uvařit"), 4.4 a 4.5 (spíž), 4.6 (nákupní seznam
> z Cronu), 4.7 (stavy receptů), 4.8 (Google OAuth) a 4.9 (dlouhý seznam).
> Zbývá jen Sign in with Apple, který čeká na placený účet.

Tohle je jádro celého projektu. Všechno níže je **odsouhlasené**, ne návrh k diskusi.

### 4.1 Bookingy („TO UVAŘÍM!")

- U každého receptu je tlačítko **„TO UVAŘÍM!"**, které vytvoří rezervaci v kalendáři
- Dvě varianty:
  - **Na konkrétní čas** → spustí **notifikaci** (ne budík — viz technická poznámka níže)
  - **Na celý den (all-day)** → bez notifikace
- Uživatel může naplánovat libovolně daleko dopředu a termíny měnit

**Konflikty:**

| Kombinace | Chování |
|---|---|
| časovaný × časovaný | varovat / nepovolit |
| all-day × cokoliv | povolit |

### 4.2 Rezervace surovin — zámek, ne odečet

Tohle je klíčové a snadno se to splete:

- **Booking surovinu NEODEČTE.** Zůstává v inventáři, jen se zobrazí jako **zamčená**
- Zámek vzniká **okamžitě při bookingu**, ne den předem
  (jinak bys kolizi objevil, až když už je pozdě nakoupit)
- Skutečné odečtení nastane až po stisku **„DOVAŘENO"** v receptu
- Funkce „co můžu uvařit" počítá **jen s nezamčenými** surovinami

**Proč zámek a ne odečet:** uživatel musí ve spíži vidět, že tam ta surovina fyzicky
je — jen je slíbená čtvrtečnímu jídlu.

### 4.3 „Co můžu uvařit" — škála, ne ano/ne

**Nesmí to být binární filtr.** Musí ukazovat míru: „tohle máš celé", „tomuhle chybí
2 věci".

**Důvod:** inventář se **vždycky** rozejde s realitou — něco sníš mimo recept, něco se
zkazí, olej nikdo neváží. Tvrdý filtr nad nepřesnými daty ukazuje nesmysly a uživatel
mu přestane věřit. Škála je užitečná i při nepřesných datech.

### 4.4 Granularita inventáře

| Typ | Příklady | Jak se sleduje |
|---|---|---|
| **Přesné** | maso, těstoviny, sýr, smetana | v gramech / ml, automatický odečet |
| **Přibližné** | olej, sůl, koření | jen **mám / dochází / došlo** |

U přibližných se **nezobrazuje pole na množství vůbec** — nutit uživatele odhadovat
gramy soli je cesta k tomu, že to přestane vyplňovat.

**Ruční oprava musí být triviální:** tap na surovinu ve spíži → uprav množství.
Dva tapy, ne formulář.

### 4.5 „Mám doma standardně"

Uživatel jednorázově zaškrtne stálice (olej, sůl, koření, mouka, česnek).
**Ty se pak nikdy nepřidávají do nákupního seznamu.**

**Tohle je záměrně levná náhrada plného inventáře** — pokryje ~80 % užitku za ~10 %
práce. Zbytek (maso, smetana, zelenina) se kazí rychle a uživatel to stejně kontroluje
pohledem do lednice.

### 4.6 Nákupní seznam

- **Cloudflare Cron Trigger** běží každý den
- Projde bookingy na zítřek (interval má být nastavitelný)
- Porovná s inventářem
- Chybějící suroviny přidá do nákupního seznamu
- Položky označené „mám doma standardně" přeskočí

Musí běžet i když je appka zavřená — proto Cron ve Workeru, ne kód v prohlížeči.

### 4.7 Stavy receptů

Tři stavy: **neuvařeno / wishlist (chci vyzkoušet) / uvařeno**

- Navazuje na už existující počítadlo uvaření a hvězdičkové hodnocení
- V seznamu vizuálně odlišené podle aktuálního tématu
- **Barva nesmí být jediný signál** — přidat i ikonu nebo odznak
- Do filtrů přidat **„Neuvařeno"**

**Proč to vzniklo:** umožňuje nahrávat recepty **dopředu, před vyzkoušením** — dosud se
nahrávaly až po ověření. Wishlist je vlastně cennější než „už jsem vařil".

### 4.8 Přihlašování a rozdělení dat

- **Google OAuth** — zdarma, funguje i na iOS. Dělá se první.
- **Sign in with Apple** — vyžaduje placený Apple Developer účet (99 USD/rok).
  Může se doplnit později, není blokující.

| Data | Rozsah |
|---|---|
| **Recepty** | sdílené pro všechny; nahrává je **výhradně Honza** (role admin) |
| **Per uživatel** | inventář, bookingy, rezervace, nákupní seznam, wishlist, uvařeno, hodnocení, poznámky, „mám doma standardně" |

**Žádné domácnosti ani sdílený inventář** — vědomé rozhodnutí nekomplikovat.
Inventář je vždy per uživatel.

### 4.9 Onboarding inventáře

Při prvním naplnění (a taky po každém velkém nákupu):

- **Checklist** s možností upravit množství
- **Řazený podle fyzického uspořádání spíže**, ne abecedně — uživatel stojí u police
  a jde po řadě, neskáče
- U přibližných surovin jen tři tlačítka mám/dochází/došlo
- Možnost přidat vlastní položku
- Startovní seznam se dá vygenerovat z ingrediencí receptů, které už v appce jsou

### 4.10 Plánovaná struktura D1

```
users          -- uživatelé a role (admin / běžný)
inventory      -- co má uživatel doma
bookings       -- recept + datum + čas/all-day + stav
reservations   -- které suroviny drží který booking
shopping_list  -- co chybí (plní Cron)
```

---

## 5. Co bylo zamítnuto a proč

**Neotvírat znovu bez nového důvodu.**

| Nástroj | Proč ne |
|---|---|
| Excel / Google Sheets | křehké u relačních dat; špatné mobilní UI do kuchyně |
| Microsoft Access | mrtvá platforma, žádné mobilní rozhraní |
| Airtable | dvojí systém, synchronizace přes API, limity free tieru |
| Externí CRM | totéž — appka i CRM zvlášť se do týdne rozejdou |
| Hotové appky (Notion, Paprika, AnyList…) | neumí propojení inventář → co uvařím → nákup; ztráta customizace, kterou appka už má |
| **Make jako jádro** | zamítnuto **jako jádro**; případně později jen jako vrstva na notifikace |

**Společný důvod:** dva oddělené systémy propojené přes API = víc míst, kde se to
rozbije, bez reálného přínosu, protože appka i rozhraní už existují a fungují.

---

## 6. Skiny — plánovaná přestavba vzhledu

Oddělit **„mozek"** od **„vzhledu"**:

- **Mozek** = bezstavový engine: recepty, filtry, cook mode, časovače, AI volání.
  Komunikuje událostmi. O vzhledu neví nic.
- **Vzhled (skin)** = UI implementující definovaný kontrakt

**Plánované skiny:** „Aplikace" (dnešní styl), „Kniha" (listování jako v knize),
„Kuchařka"

**Pořadí:**
1. Vytáhnout engine ← *probíhá, viz sekce 7*
2. Přenést dnešní UI jako skin „Aplikace"
3. Postavit „Knihu" jako zkoušku, že kontrakt drží

**Poznámky:**
- U nových skinů se mění přístup k Tailwindu → preferovat **sémantické CSS**
- Výkon: skiny načítat líně, „Aplikaci" předgenerovat Astrem; **měřit po každé fázi**

---

## 7. Refaktoring — kde to stojí

> **Stav k 18. 8. 2026:** mozek je vytažený celý (kroky 1–5). Zbývá přenést
> dnešní UI jako skin „Aplikace" a postavit „Knihu" jako zkoušku kontraktu.

### Hotovo

**Krok 1 — vrstva `Store`**
Všech 15 míst, která sahala přímo do localStorage, teď volá jednotný `Store` na začátku
skriptu. Chování je stejné. **Až přijde D1, mění se jen tělo `Store`.**

Klíče: `favorites`, `viewMode`, `recipeMode`, `theme`, `gh_token`, `shopping_list`,
`review_<slug>`

Vedlejší zlepšení: poškozená data v localStorage dřív mohla appku shodit
(`JSON.parse` bez ochrany), teď se chovají jako prázdná.

**Krok 2 — `src/lib/recipe-logic.js`**
14 čistých funkcí: `fold`, `normalizeWord`, `slugify`, `parseMinutes`, `esc`,
`formatNum`, `splitQty`, `scaleIngredient`, `roman`, `haystack`, `parseDurations`,
`fmtClock`, `parseIngredients`, `ingredientMatch` + `QTY_UNITS`.

Nesahají na DOM ani na uložená data.

**Krok 3 — `src/lib/filters.js`**
Rozhodování, **které** recepty se zobrazí, oddělené od toho, **jak** se vykreslí.
`filterRecipes`, `matchesSearch`, `matchesCategory`, `matchesMeal`, `matchesTime`,
`headingFor`, `countLabel`, `TIME_BUCKETS`.

**Krok 3 — `src/lib/filters.js`** je od 18. 8. 2026 opravdu v repu včetně testů.
Do té doby existoval jen lokálně a `main` ho neměl — pozor na tenhle rozpor,
sekce 7 tvrdila hotovo dřív, než to bylo nahrané.

**Krok 4 — `src/lib/cook-session.js` + `src/lib/cook-timers.js`**
Cook mode byl slepenec dvou nesouvisejících věcí. Rozdělen na krokování
receptem a časovače (`test-cook.mjs`, 46 testů).

Dvě rozhodnutí, která stojí za zapamatování:
- **Stav je neměnný** — každá funkce vrací nový stav místo aby přepsala starý.
  Díky tomu jde kterýkoli krok v testu zopakovat.
- **Engine si sám nespouští hodiny.** Nemá v sobě `setInterval`, má `tick()`,
  který volá vzhled. Test tak „přetočí" pět minut okamžitě, místo aby čekal.

Ve vzhledu záměrně zůstalo: pípání, vibrace, notifikace, wake lock, konfety,
animace přechodu, gesta a zásuvka s ingrediencemi.

**Krok 5 — `src/lib/recipe-view.js`**
`cardMarkup` a `rowMarkup` už nedostanou recept, ale **hotový podklad** —
data, ne HTML (`test-view.mjs`, 32 testů).

**Tím vznikl kontrakt pro skiny.** Mozek řekne *co* se o receptu ukáže
(název, kategorie, „01", „4 porcí", počet hvězdiček, oblíbenost); skin
rozhodne *jak* to vypadá. Nový skin nahradí `cardMarkup`/`rowMarkup`
a mozku se nedotkne.

### Zbývá
- [ ] **Token do Workeru** (viz 8.2) — AI část Workeru už hotová, viz 8.10
- [x] ~~**Zrcadlení stavu receptů do D1**~~ — hotové 20. 8. 2026. Oblíbené,
      hodnocení, poznámky a „chci vyzkoušet" se nově ukládají i do D1
      (tabulka `recipe_state`). localStorage zůstává, takže aplikace funguje
      i bez přihlášení. Tím padá nástraha 8.5.
- [x] ~~**Přihlašování + D1**~~ — hotové 19. 8. 2026. D1 `masterchef` (EEUR),
      Google OAuth přes Worker, spíž a profil. `Store` zatím zůstává na
      localStorage pro vzhled a oblíbené; přesun zbytku do D1 je další krok.
- [ ] Přenést UI jako skin „Aplikace", pak „Kniha"

---

## 8. Technické nástrahy (draze zjištěné)

### 8.1 `define:vars` blokoval rozdělení kódu

**Původní příčina, proč byla celá appka jeden blok 2400 řádků:**
`<script define:vars={{ recipesData }}>` způsobí, že Astro skript nechá inline
a **vůbec ho nezpracuje** → **importy nefungují** → kód nejde rozdělit do souborů.

**Řešeno takto:**
```astro
<script type="application/json" id="recipes-data"
        set:html={JSON.stringify(recipesData).replace(/</g, '\u003c')}></script>
<script>
  import { ... } from '../lib/recipe-logic.js';
  const recipesData = JSON.parse(document.getElementById('recipes-data').textContent);
</script>
```

`.replace(/</g, '\u003c')` je nutný — jinak by `</script>` v datech rozbil stránku.

**Důsledek:** skript už není inline, ale samostatný soubor v `dist/_astro/`.
Na GitHub Pages funguje stejně, ale načítá se jinak.

### 8.2 GitHub token je v prohlížeči — musí pryč

Dnes je token v localStorage pod klíčem `gh_token` a appka s ním **z prohlížeče
zapisuje přímo do repozitáře**. Dokud je tam Honza sám, funguje to.

**S přihlašováním to musí skončit** — kdokoliv by si ho mohl vytáhnout z nástrojů
prohlížeče.

**Stav k 18. 8. 2026:** stále neuděláno. Riziko je zatím nízké (token je jen
v Honzově prohlížeči), ale **je to blokující věc pro přihlašování** — jakmile
do appky pustíš druhého člověka, token musí být pryč. Do té doby ať je token
fine-grained a má přístup **jen k tomuhle jednomu repu**.

**Cíl:** token přesunout do Cloudflare Workeru jako **secret**. Appka pak volá Worker
(„ulož tenhle recept"), Worker ověří identitu a zapíše sám. Token se do prohlížeče
nikdy nedostane.

**Pozor na pořadí:** dokud Worker tuhle část neumí, **appka nemůže ukládat recepty**.
Nedělat jako „smazat teď", ale jako „přesunout, až bude Worker připravený".

### 8.3 `Layout.astro` čte téma napřímo — schválně

Nepřevedeno na `Store` záměrně: ten skript musí běžet **dřív, než se stránka vykreslí**,
jinak blikne špatná barva. S D1 to bude výjimka — téma se bude muset držet i lokálně
kvůli rychlosti.

### 8.4 `recipeMode` se ukládá, ale nečte — schválně

Řádek `let fancyMode = false;` — appka **vždycky startuje v Basic režimu**.
Honza to potvrdil jako správné chování. **Není to chyba, neopravovat.**

### 8.5 Hodnocení jsou po jednom klíči na recept

`review_<slug>`, ne jedno pole. **Při migraci na D1** bude potřeba projít celý
localStorage a klíče s tímhle prefixem posbírat.

### 8.6 Notifikace, ne budík

Původní nápad byl budík. **Web nemůže spolehlivě vytvořit nativní budík**, zvlášť
na iOS.

Řešení: **Web Push přes service worker**. Na iOS to vyžaduje appku **přidanou na plochu
jako PWA**. Případná záloha: export do kalendáře (.ics), který zvoní nativně.

### 8.7 Deploy a GitHub API

- Push do `main` spustí deploy sám (GitHub Actions); stav přes `/actions/runs`
- Při zápisu přes GitHub API **vždy nejdřív GET pro aktuální SHA** — zastaralé SHA
  způsobí 409/422
- Velké soubory: Python `urllib.request` (obchází limit délky argumentů)
- Binární soubory: spolehlivější `git clone` než base64 přes API

### 8.8 Testování

Testy se pouští z kořene projektu:

```bash
npm run build          # musí projít
node test-logic.mjs    # čistá logika, bez prohlížeče
node test-filters.mjs  # filtrování, bez prohlížeče
npm install jsdom --no-save
node test-store.mjs    # celá appka v jsdom
```

**Nástrahy v `test-store.mjs`:**
- Skript je od kroku 2 samostatný soubor → test si ho musí do stránky **vložit ručně**
- Při vkládání **použít funkci jako náhradu**, ne řetězec — minifikovaný kód obsahuje
  `$` sekvence a `$&` by se interpretovalo jako speciální znak a rozsekalo soubor
- Nutné stubovat `window.matchMedia`, jinak `setRecipeMode` skončí předčasně
- Selektory omezovat na `#recipe-list` / `#recipe-grid` — hero je v DOM první
- Srdíčka existují **jen v režimu dlaždic**; v režimu seznamu je oblíbenost ♥ v názvu
- První barevný čtvereček je „Teplá (výchozí)" s prázdnou hodnotou — klik **maže** téma

### 8.10 AI proxy — Worker nesmí brát hotový dotaz

**Draze zjištěno 18. 8. 2026.** Worker původně vzal cokoliv, co dostal, a poslal
to Anthropicu s klíčem z secrets. Model, délku i **celý text dotazu** určoval
prohlížeč.

Důsledek: kdokoliv si našel adresu Workeru ve vývojářských nástrojích, měl
Claude zdarma na Honzův účet. Ověřeno zvenku — fungovalo to.

**Pravidlo:** Worker **nikdy nepřebírá hotový dotaz**. Appka posílá jen
`action` + data, text skládá Worker (`worker/src/index.js`). Jinak je to
otevřená proxy, ať se jmenuje jakkoliv.

Tři vrstvy, žádná sama nestačí:

| Vrstva | Co řeší | Čím se dá obejít |
|---|---|---|
| `ALLOWED_ORIGINS` | volání z cizí stránky | `curl` si hlavičku napíše jakoukoliv |
| Worker skládá dotaz sám | zneužití jako AI zdarma | jde poslat vlastní „recepty" |
| `RATE_LIMITER` 20/min na IP | strop škod | víc IP adres |

**Nástrahy:**
- Po `wrangler deploy` chvíli běží **stará i nová verze zároveň** (pozorováno
  ~5 min). Test hned po nasazení dává střídavě staré a nové odpovědi —
  neznamená to, že nasazení selhalo. Testovat opakovaně, ne jednou.
- Limit se počítá **per klíč** předaný do `limit({ key })`. Test s vlastním
  klíčem nevyčerpá limit produkčního klíče (IP) a naopak.
- Kód Workeru je nově v `worker/`. Dřív existoval **jen v Cloudflare** — nešel
  revidovat ani obnovit.

### 8.11 Texty receptů se musí ošetřit před vložením do stránky

Názvy, kategorie a odkazy na obrázky se vkládaly do HTML neošetřené. Protože
appka umí **import receptu z JSON**, stačilo podstrčit soubor se škodlivým
názvem a spustil se cizí kód — a ten by měl přístup ke `gh_token` v localStorage.

- `esc()` **neošetřuje uvozovky** → do atributů (`src=`, `alt=`, `data-`)
  patří `escAttr()`, ne `esc()`
- Do HTML se nikdy nepíše `onclick="..."` s vloženým textem — použít
  `data-slug` a posluchač

### 8.12 Cook mode nejde otestovat ve skrytém okně

Přechod mezi kroky používá `requestAnimationFrame`. Ve **skrytém** okně
prohlížeče (`document.visibilityState === 'hidden'`) se rAF **vůbec nespustí**
→ `cookAnimating` zůstane `true` a krokování se zasekne po prvním kroku.

**Není to chyba v appce** — u skutečného uživatele je okno vidět, a když appku
odloží na pozadí, rAF se po návratu dožene. Ale při automatickém testování
to vypadá jako rozbité krokování.

**Jak testovat cook mode bez okna:** vybrat recept, který má odpočet
**hned v prvním kroku** (`caramelised-onion-pasta`) — časovače na rAF nezávisí.
Logika krokování je pokrytá v `test-cook.mjs`, bez prohlížeče.

### 8.13 Chybějící `Authorization` v CORS vypadá jako rozbité přihlašování

Přihlášení projde, uživatel se vrátí do appky — a appka se tváří, že je
odhlášený. Příčina není v přihlašování, ale v tom, že prohlížeč se **před**
dotazem s hlavičkou `Authorization` ptá Workeru, jestli ji smí poslat.
Když Worker vrátí seznam bez ní, dotaz **vůbec neodejde** a `fetch` skončí
chybou — tedy stejně, jako by uživatel přihlášený nebyl.

`Access-Control-Allow-Headers` musí obsahovat `Authorization`,
`Access-Control-Allow-Methods` musí obsahovat `GET`.

**Jak to poznat rychle:** podívej se do databáze, jestli se uživatel založil
nebo změnil. Když ano, server je v pořádku a chyba je na straně prohlížeče.

### 8.14 E-maily: co, komu a jak často

Rozesílá je **Cron ve Workeru** (`worker/src/digest.js`), aby to fungovalo
i při zavřené aplikaci — stejný důvod jako u nákupního seznamu v 4.6.

| Zpráva | Kdy | Komu |
|---|---|---|
| Uvítání | první přihlášení | novému uživateli |
| Nové recepty | pondělí 7:00 | kdo je chce |
| Z wishlistu jde uvařit | pondělí 7:00, max. 1× za 14 dní | kdo je chce |
| Měsíční souhrn | 1. v měsíci 7:00 | kdo je chce |
| Nový uživatel | hned | jen adminovi |
| Chyba v Cronu | při chybě | jen adminovi |

**Pravidla, která nesmí zmizet:**

- **Nejvýš 1 zpráva denně a 3 týdně** na člověka. Radši vynechat.
- **V noci (22–7 českého času) se neposílá nic.** Cron běží v UTC —
  `jeVhodnaDoba()` to přepočítává.
- Každá pravidelná zpráva má **odhlašovací odkaz** chráněný tokenem
  (`users.unsub_token`). Bez tokenu by šlo odhlásit kohokoliv.
- Odeslané zprávy se zapisují do `email_log` — brání to duplicitám.

**Nástrahy:**

- **Recepty si Worker stahuje z GitHubu** (`raw.githubusercontent.com`),
  ne z vlastní kopie. Jinak by se rozešly s aplikací.
- **Při prvním běhu se recepty jen zapamatují** a nikomu nic nechodí —
  jinak by první e-mail obsahoval celou kuchařku. Tabulka `known_recipes`.
- **Na porovnávání surovin se NEPOUŽÍVÁ `ingredientMatch`** z `recipe-logic.js`.
  Porovnává podřetězce, takže „smetana" a „smetany" mu nesednou. Digest
  porovnává kořeny slov, a bere i slova od tří písmen — jinak propadne „sůl".
- Worker si **půjčuje mozek aplikace** (`../../src/lib/*.js`). Wrangler to
  zabalí bez problémů a logika porovnávání se nepíše dvakrát.

### 8.15 Sdílený mozek mezi aplikací a Workerem

Porovnávání surovin (`src/lib/match.js`) a termíny (`src/lib/booking.js`)
používá **aplikace i Worker**. Wrangler si poradí s `import` přes hranici
složky (`../../src/lib/…`) a zabalí to bez potíží.

**Proč to tak je:** logika „co mi chybí" se počítá na dvou místech — v appce
kvůli odznaku u receptu a ve Workeru kvůli e-mailům. Kdyby existovala
dvakrát, do týdne se rozejde a e-mail bude tvrdit něco jiného než obrazovka.

### 8.16 Pozor na pořadí deklarací v `index.astro`

Skript je jeden velký blok a `renderGrid()` se volá hned při startu.
Když do něj přibude čtení nové proměnné (spíž, wishlist), **musí být
deklarovaná nad ním** — jinak spadne na `Cannot access before
initialization` ještě před prvním vykreslením.

Stejný druh pasti jako 8.13: build i testy projdou, protože syntakticky
je všechno v pořádku.

### 8.9 Obrázky

`scripts/optimize-images.mjs` (`npm run images`) — z `photos-raw/[slug].png` udělá
900px WebP, spočítá blur hash a obojí zapíše do `recipes.json`.

---

## 9. Jak s Honzou pracovat

- **Pushuje se bez ptaní** (změna z 18. 8. 2026 — dřív platil opak).
  Podmínka: musí projít `npm run build` a všechny tři testy. Když test spadne,
  **nepushovat** a ozvat se.
- **Komunikace česky.**
- Honza dělá **vibecoding** — technické pojmy vysvětlovat lidsky, ne žargonem.
  Když se ptá „co mám udělat", chce **konkrétní kroky**, ne architekturu.
- Rychle si všimne nesrovnalostí a dává cílenou zpětnou vazbu.
- Preferuje **přesné, proveditelné instrukce**. Vágní pojmy jako „minimální teplota"
  je potřeba převést na čísla (stupnice indukce).
- **Přístupové klíče nikdy neposílat chatem.** Token patří do Cloudflare secrets.
- Postup u receptů: naškálovat → nakoupit → uvařit → doladit → uložit → push (se schválením)

### Tón AI asistentů v appce

Obě chef AI (doporučování i náhrady surovin): **neformální, přátelský, lehce škádlivý
čeština, emoji, tykání**.

### Když Honza pošle odkaz na YouTube Shorts

Uložit **jen název + URL** do seznamu. Nestahovat detaily, negenerovat soubory.
Nejdřív zkontrolovat duplicity. Když se název nedá zjistit, uložit bez názvu — neptat se.

---

## 10. Znalosti o vaření, které se osvědčily

- **Nutriční hodnoty se nikdy nepřepočítávají s porcemi** — vždy na jednu porci
- **One-pot metoda není zkratka** — škrob uvolněný z těstovin **dělá** omáčku,
  stejně jako u rizota. Zkratka byl bujón, ne metoda.
- **Karamelizace cibule:** 1–2 lžíce cukru na 2 cibule, 15–20 min na střední teplotu.
  Ocet uvádět výslovně jako **kvasný ocet**.
- **Škálování těstovin:** ~80 g suchých na porci je spodní hranice, ale s vydatnou
  bílkovinou to sedí. Conchiglie nabobtná ~2–2,5×.
- **Cajun koření nemá český ekvivalent** — nahrazovat kajenským pepřem / chilli,
  protože základní složky už v receptu obvykle jsou.
- **Přesnost inventáře degraduje** vždy, když se jí mimo recept (svačiny, improvizace,
  zkažené jídlo). Proto sekce 4.3.
- **Bookingy a nákupní seznam mají hodnotu i bez inventáře** — inventář je nejnáročnější
  na udržování a má nejmenší okamžitý přínos. Proto „mám doma standardně" jako mezikrok.
