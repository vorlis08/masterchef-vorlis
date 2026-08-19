// ==========================================================================
// catalog.js  --  cast "mozku"
//
// Dlouhy seznam veci, ktere v kuchyni byvaji - k proklikani pri prvnim
// plneni spize a po velkem nakupu (4.9).
//
// Poradi NENI abecedni. Je serazene podle toho, kde co v kuchyni fyzicky
// lezi: spiz, koreni, lednice, mrazak. Uzivatel stoji u police a jde po
// rade, misto aby skakal od "brambory" k "bazalce".
//
// `kind` rika, jestli se ma ptat na gramy (exact), nebo staci
// mam / dochazi / nemam (approx) - viz 4.4.
// ==========================================================================

import { fold } from './recipe-logic.js';
import { guessKind, cleanName } from './pantry.js';

/** Skupiny v poradi, v jakem se prochazi kuchyne. */
export const GROUPS = [
  'Spíž — základ',
  'Spíž — konzervy a sklenice',
  'Koření a dochucovadla',
  'Oleje, octy a tekutiny',
  'Lednice',
  'Zelenina a ovoce',
  'Mrazák',
  'Pečivo a sladké',
];

/** Zaklad katalogu. Doplnuje se surovinami z receptu, ktere uz v appce jsou. */
export const CATALOG = [
  // -- Spiz zaklad --
  { name: 'mouka hladká',        group: 'Spíž — základ', kind: 'approx' },
  { name: 'mouka polohrubá',     group: 'Spíž — základ', kind: 'approx' },
  { name: 'mouka hrubá',         group: 'Spíž — základ', kind: 'approx' },
  { name: 'rýže',                group: 'Spíž — základ', kind: 'approx' },
  { name: 'těstoviny',           group: 'Spíž — základ', kind: 'exact', units: ['g', 'balení'] },
  { name: 'brambory',            group: 'Spíž — základ', kind: 'exact', units: ['kg', 'ks'] },
  { name: 'čočka',               group: 'Spíž — základ', kind: 'approx' },
  { name: 'fazole sušené',       group: 'Spíž — základ', kind: 'approx' },
  { name: 'kuskus',              group: 'Spíž — základ', kind: 'approx' },
  { name: 'ovesné vločky',       group: 'Spíž — základ', kind: 'approx' },
  { name: 'strouhanka',          group: 'Spíž — základ', kind: 'approx' },
  { name: 'cukr krystal',        group: 'Spíž — základ', kind: 'approx' },
  { name: 'sůl',                 group: 'Spíž — základ', kind: 'approx', alias: ['soli'] },

  // -- Konzervy a sklenice (pocitaji se na kusy) --
  { name: 'rajčata konzerva',    group: 'Spíž — konzervy a sklenice', kind: 'count' },
  { name: 'protlak rajčatový',   group: 'Spíž — konzervy a sklenice', kind: 'count' },
  { name: 'fazole konzerva',     group: 'Spíž — konzervy a sklenice', kind: 'count' },
  { name: 'kukuřice konzerva',   group: 'Spíž — konzervy a sklenice', kind: 'count' },
  { name: 'tuňák konzerva',      group: 'Spíž — konzervy a sklenice', kind: 'count' },
  { name: 'kokosové mléko',      group: 'Spíž — konzervy a sklenice', kind: 'count' },
  { name: 'nakládané okurky',    group: 'Spíž — konzervy a sklenice', kind: 'approx' },
  { name: 'med',                 group: 'Spíž — konzervy a sklenice', kind: 'approx' },

  // -- Koreni: skoro vse jen mam/dochazi/nemam --
  { name: 'pepř mletý',          group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'paprika sladká mletá', group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'paprika pálivá',      group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'česnekový prášek',    group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'cibulový prášek',     group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'oregano',             group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'bazalka sušená',      group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'tymián',              group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'rozmarýn',            group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'majoránka',           group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'kmín',                group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'skořice',             group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'kurkuma',             group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'chilli',              group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'kajenský pepř',       group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'muškátový oříšek',    group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'sójová omáčka',       group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'worcester',           group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'hořčice',             group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'kečup',               group: 'Koření a dochucovadla', kind: 'approx' },
  // Tohle se doopravdy pocita - bujon po kostkach, lusk po kusech.
  { name: 'bujón (masox)',       group: 'Koření a dochucovadla', kind: 'count', alias: ['bujon', 'masox'] },
  { name: 'bobkový list',        group: 'Koření a dochucovadla', kind: 'count' },
  { name: 'vanilkový lusk',      group: 'Koření a dochucovadla', kind: 'count' },

  // -- Oleje a tekutiny --
  { name: 'slunečnicový olej',   group: 'Oleje, octy a tekutiny', kind: 'approx' },
  { name: 'olivový olej',        group: 'Oleje, octy a tekutiny', kind: 'approx' },
  { name: 'sádlo',               group: 'Oleje, octy a tekutiny', kind: 'approx' },
  { name: 'kvasný ocet',         group: 'Oleje, octy a tekutiny', kind: 'approx' },
  { name: 'balzamikový ocet',    group: 'Oleje, octy a tekutiny', kind: 'approx' },
  { name: 'víno na vaření',      group: 'Oleje, octy a tekutiny', kind: 'approx' },

  // -- Lednice: maso a syry se vazi, zbytek se pocita --
  { name: 'kuřecí prsa',         group: 'Lednice', kind: 'exact', units: ['g', 'ks'] },
  { name: 'kuřecí stehna',       group: 'Lednice', kind: 'exact', units: ['g', 'ks'] },
  { name: 'mleté maso',          group: 'Lednice', kind: 'exact' },
  { name: 'vepřová krkovice',    group: 'Lednice', kind: 'exact' },
  { name: 'hovězí',              group: 'Lednice', kind: 'exact' },
  { name: 'slanina',             group: 'Lednice', kind: 'exact' },
  { name: 'šunka',               group: 'Lednice', kind: 'exact' },
  { name: 'klobása',             group: 'Lednice', kind: 'count' },
  { name: 'párky',               group: 'Lednice', kind: 'count' },
  { name: 'vejce',               group: 'Lednice', kind: 'count' },
  { name: 'máslo',               group: 'Lednice', kind: 'exact', units: ['g', 'ks'] },
  { name: 'mléko',               group: 'Lednice', kind: 'exact', units: ['l', 'ks'] },
  { name: 'smetana na vaření 12 %', group: 'Lednice', kind: 'exact', units: ['ml', 'ks'] },
  { name: 'smetana ke šlehání 31 %', group: 'Lednice', kind: 'exact', units: ['ml', 'ks'] },
  { name: 'zakysaná smetana',    group: 'Lednice', kind: 'count' },
  { name: 'krémový sýr',         group: 'Lednice', kind: 'count' },
  { name: 'jogurt',              group: 'Lednice', kind: 'count' },
  { name: 'tvrdý sýr',           group: 'Lednice', kind: 'exact' },
  { name: 'parmazán',            group: 'Lednice', kind: 'exact' },
  { name: 'mozzarella',          group: 'Lednice', kind: 'count' },
  { name: 'niva',                group: 'Lednice', kind: 'exact' },

  // -- Zelenina a ovoce: vetsinou kusy --
  { name: 'cibule',              group: 'Zelenina a ovoce', kind: 'count', units: ['ks', 'kg'] },
  { name: 'česnek',              group: 'Zelenina a ovoce', kind: 'count' },
  { name: 'mrkev',               group: 'Zelenina a ovoce', kind: 'count', units: ['ks', 'kg'] },
  { name: 'paprika',             group: 'Zelenina a ovoce', kind: 'count' },
  { name: 'rajčata',             group: 'Zelenina a ovoce', kind: 'count', units: ['ks', 'kg'] },
  { name: 'cherry rajčata',      group: 'Zelenina a ovoce', kind: 'count', units: ['balení', 'g'] },
  { name: 'okurka',              group: 'Zelenina a ovoce', kind: 'count' },
  { name: 'salát',               group: 'Zelenina a ovoce', kind: 'count' },
  { name: 'citron',              group: 'Zelenina a ovoce', kind: 'count' },
  { name: 'brokolice',           group: 'Zelenina a ovoce', kind: 'count' },
  { name: 'žampiony',            group: 'Zelenina a ovoce', kind: 'exact', units: ['g', 'balení'] },
  { name: 'špenát',              group: 'Zelenina a ovoce', kind: 'approx' },
  { name: 'petržel čerstvá',     group: 'Zelenina a ovoce', kind: 'approx' },
  { name: 'jarní cibulka',       group: 'Zelenina a ovoce', kind: 'approx' },

  // -- Mrazak --
  { name: 'hrášek mražený',      group: 'Mrazák', kind: 'approx' },
  { name: 'zeleninová směs',     group: 'Mrazák', kind: 'approx' },
  { name: 'hranolky',            group: 'Mrazák', kind: 'approx' },
  { name: 'ryba mražená',        group: 'Mrazák', kind: 'count' },

  // -- Pecivo a sladke --
  { name: 'chléb',               group: 'Pečivo a sladké', kind: 'count' },
  { name: 'tortilly',            group: 'Pečivo a sladké', kind: 'count' },
  { name: 'čokoláda',            group: 'Pečivo a sladké', kind: 'count' },
  { name: 'vanilkový cukr',      group: 'Pečivo a sladké', kind: 'count' },
  { name: 'prášek do pečiva',    group: 'Pečivo a sladké', kind: 'count', alias: ['kyprici'] },
  { name: 'jedlá soda',          group: 'Pečivo a sladké', kind: 'approx' },
];

/** Skupina pro suroviny dotazene z receptu, ktere v katalogu nejsou. */
export const FROM_RECIPES = 'Z tvých receptů';

/**
 * Hruby "koren" nazvu: prvni slovo bez diakritiky, zkracene.
 *
 * Cestina sklonuje a recepty pisou procenta, takze "smetany", "smetany 31 %"
 * a "smetana na vareni" jsou pro pocitac tri veci, pro cloveka jedna.
 * Zkraceni na ctyri pismena je srovna na "smet".
 *
 * Zamerne hrube - lepsi jednou spojit dve podobne suroviny nez nabidnout
 * uzivateli seznam, ve kterem je smetana petkrat.
 */
export function stemKey(name) {
  return fold(String(name).trim().split(/\s+/)[0] || '').slice(0, 4);
}

/**
 * Zna katalog nektere ze slov v nazvu?
 *
 * Recepty pisou "hrnek polohrube mouky na zahusteni" - podstatne slovo
 * je uprostred. Kdyz katalog mouku uz zna, nema smysl pridavat cely
 * ten utrzek jako dalsi polozku.
 *
 * Kratka slova (do 4 pismen) se ignoruji, at "na", "dle" nebo "z"
 * nespojuji nesouvisejici veci.
 */
export function wordStems(name) {
  return String(name).trim().split(/\s+/)
    .map(w => fold(w).replace(/[^a-z]/g, ''))
    .filter(w => w.length >= 4)
    .map(w => w.slice(0, 4));
}

export function knownWords(name, stems) {
  return wordStems(name).some(st => stems.has(st));
}

/**
 * Slozi cely seznam k proklikani.
 *
 * Zaklad je katalog; doplni se suroviny z receptu, ktere v nem chybi.
 * Ke kazde polozce se pripoji, co uz o ni spiz vi - aby uzivatel videl
 * svoje hodnoty a jen je upravoval, misto aby zakladal duplicity.
 *
 * @param {Array} recipes      recepty v appce (kvuli doplneni)
 * @param {Array} pantryItems  co uz uzivatel ve spizi ma
 */
export function buildChecklist(recipes, pantryItems) {
  const bySlug = new Map();
  (pantryItems || []).forEach(it => bySlug.set(fold(it.name), it));

  const seen = new Set();
  const stems = new Set();
  const rows = [];

  CATALOG.forEach(entry => {
    const key = fold(entry.name);
    seen.add(key);
    // Koren si bereme z KAZDEHO slova nazvu - diky tomu "slunecnicovy olej"
    // v katalogu umlci i "olej na smazeni" z receptu.
    wordStems(entry.name).forEach(st => stems.add(st));
    // Cestina meni kmen: "sul" vs "soli". Par takovych se doplni rucne.
    (entry.alias || []).forEach(a => wordStems(a).forEach(st => stems.add(st)));
    rows.push(makeRow(entry.name, entry.kind, entry.group, bySlug.get(key), entry.units));
  });

  // Suroviny z receptu, ktere katalog nezna. Sbirame nejdriv vsechny,
  // pak z kazdeho korene nechame jen nejkratsi nazev - "smetany" misto
  // "smetany na vareni 12%".
  const zReceptu = new Map();
  (recipes || []).forEach(r => {
    (r.ingredients || []).forEach(raw => {
      const name = cleanName(raw);
      if (!name || name.length < 3) return;
      if (seen.has(fold(name))) return;
      // Dlouhe utrzky z receptu ("hrnek polohrube mouky na zahusteni")
      // zahazujeme, kdyz uz katalog zna nektere ze slov - podstatne slovo
      // v nich nebyva na zacatku.
      //
      // Kratke nazvy (do dvou slov) si necháváme, i kdyz nejake slovo
      // katalog zna: "sriracha omacky" je vlastni surovina, ne utrzek -
      // spolecne slovo "omacka" jeste neznamena tutez vec.
      const slov = name.trim().split(/\s+/).length;
      if (slov >= 3 && knownWords(name, stems)) return;
      const stem = stemKey(name);
      if (!stem || stems.has(stem)) return;        // uz to zna katalog
      const stavajici = zReceptu.get(stem);
      if (!stavajici || name.length < stavajici.length) zReceptu.set(stem, name);
    });
  });

  [...zReceptu.values()]
    .sort((a, b) => a.localeCompare(b, 'cs'))
    .forEach(name => {
      seen.add(fold(name));
      rows.push(makeRow(name, guessKind(name), FROM_RECIPES, bySlug.get(fold(name))));
    });

  // Polozky, ktere si uzivatel pridal sam a nejsou ani v katalogu,
  // ani v receptech - at o ne pri prochazeni neprijde.
  (pantryItems || []).forEach(it => {
    const key = fold(it.name);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(makeRow(it.name, it.kind, 'Moje vlastní', it));
  });

  return groupRows(rows);
}

function makeRow(name, kind, group, existing, units) {
  return {
    name: name,
    group: group,
    // Kdyz uz polozku ve spizi ma, ridi se jejim nastavenim - uzivatel
    // si ji mohl prepnout a katalog ho nema prepisovat.
    kind: existing ? existing.kind : kind,
    id: existing ? existing.id : null,
    inPantry: !!existing,
    quantity: existing && existing.quantity != null ? existing.quantity : '',
    unit: existing && existing.unit ? existing.unit : '',
    status: existing && existing.status ? existing.status : null,
    staple: !!(existing && existing.staple),
    // Jednotky, mezi kterymi jde prepnout (brambory kg/ks). Prazdne = volny text.
    units: units || null,
  };
}

function groupRows(rows) {
  const order = [...GROUPS, FROM_RECIPES, 'Moje vlastní'];
  const map = new Map();
  rows.forEach(r => {
    if (!map.has(r.group)) map.set(r.group, []);
    map.get(r.group).push(r);
  });
  return order
    .filter(g => map.has(g))
    .map(g => ({ group: g, items: map.get(g) }));
}

/** Kolik polozek uz uzivatel ve spizi ma, z celkoveho poctu v seznamu. */
export function checklistProgress(groups) {
  let total = 0, filled = 0;
  (groups || []).forEach(g => g.items.forEach(it => {
    total++;
    if (it.inPantry) filled++;
  }));
  return { total: total, filled: filled, label: filled + ' z ' + total };
}
