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
  { name: 'rýže',                group: 'Spíž — základ', kind: 'exact' },
  { name: 'těstoviny',           group: 'Spíž — základ', kind: 'exact' },
  { name: 'brambory',            group: 'Spíž — základ', kind: 'exact' },
  { name: 'čočka',               group: 'Spíž — základ', kind: 'exact' },
  { name: 'fazole sušené',       group: 'Spíž — základ', kind: 'exact' },
  { name: 'kuskus',              group: 'Spíž — základ', kind: 'exact' },
  { name: 'ovesné vločky',       group: 'Spíž — základ', kind: 'exact' },
  { name: 'strouhanka',          group: 'Spíž — základ', kind: 'approx' },
  { name: 'cukr krystal',        group: 'Spíž — základ', kind: 'approx' },
  { name: 'sůl',                 group: 'Spíž — základ', kind: 'approx' },

  // -- Konzervy a sklenice --
  { name: 'rajčata konzerva',    group: 'Spíž — konzervy a sklenice', kind: 'exact' },
  { name: 'protlak rajčatový',   group: 'Spíž — konzervy a sklenice', kind: 'approx' },
  { name: 'fazole konzerva',     group: 'Spíž — konzervy a sklenice', kind: 'exact' },
  { name: 'kukuřice konzerva',   group: 'Spíž — konzervy a sklenice', kind: 'exact' },
  { name: 'tuňák konzerva',      group: 'Spíž — konzervy a sklenice', kind: 'exact' },
  { name: 'kokosové mléko',      group: 'Spíž — konzervy a sklenice', kind: 'exact' },
  { name: 'nakládané okurky',    group: 'Spíž — konzervy a sklenice', kind: 'approx' },
  { name: 'med',                 group: 'Spíž — konzervy a sklenice', kind: 'approx' },

  // -- Koreni --
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
  { name: 'bobkový list',        group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'muškátový oříšek',    group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'bujón',               group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'sójová omáčka',       group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'worcester',           group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'hořčice',             group: 'Koření a dochucovadla', kind: 'approx' },
  { name: 'kečup',               group: 'Koření a dochucovadla', kind: 'approx' },

  // -- Oleje a tekutiny --
  { name: 'slunečnicový olej',   group: 'Oleje, octy a tekutiny', kind: 'approx' },
  { name: 'olivový olej',        group: 'Oleje, octy a tekutiny', kind: 'approx' },
  { name: 'sádlo',               group: 'Oleje, octy a tekutiny', kind: 'approx' },
  { name: 'kvasný ocet',         group: 'Oleje, octy a tekutiny', kind: 'approx' },
  { name: 'balzamikový ocet',    group: 'Oleje, octy a tekutiny', kind: 'approx' },
  { name: 'víno na vaření',      group: 'Oleje, octy a tekutiny', kind: 'approx' },

  // -- Lednice --
  { name: 'máslo',               group: 'Lednice', kind: 'exact' },
  { name: 'mléko',               group: 'Lednice', kind: 'exact' },
  { name: 'smetana ke šlehání',  group: 'Lednice', kind: 'exact' },
  { name: 'smetana na vaření',   group: 'Lednice', kind: 'exact' },
  { name: 'zakysaná smetana',    group: 'Lednice', kind: 'exact' },
  { name: 'jogurt',              group: 'Lednice', kind: 'exact' },
  { name: 'vejce',               group: 'Lednice', kind: 'exact' },
  { name: 'tvrdý sýr',           group: 'Lednice', kind: 'exact' },
  { name: 'parmazán',            group: 'Lednice', kind: 'exact' },
  { name: 'mozzarella',          group: 'Lednice', kind: 'exact' },
  { name: 'niva',                group: 'Lednice', kind: 'exact' },
  { name: 'šunka',               group: 'Lednice', kind: 'exact' },
  { name: 'slanina',             group: 'Lednice', kind: 'exact' },
  { name: 'klobása',             group: 'Lednice', kind: 'exact' },
  { name: 'kuřecí prsa',         group: 'Lednice', kind: 'exact' },
  { name: 'kuřecí stehna',       group: 'Lednice', kind: 'exact' },
  { name: 'mleté maso',          group: 'Lednice', kind: 'exact' },
  { name: 'vepřová krkovice',    group: 'Lednice', kind: 'exact' },
  { name: 'hovězí',              group: 'Lednice', kind: 'exact' },

  // -- Zelenina a ovoce --
  { name: 'cibule',              group: 'Zelenina a ovoce', kind: 'exact' },
  { name: 'česnek',              group: 'Zelenina a ovoce', kind: 'approx' },
  { name: 'mrkev',               group: 'Zelenina a ovoce', kind: 'exact' },
  { name: 'paprika',             group: 'Zelenina a ovoce', kind: 'exact' },
  { name: 'rajčata',             group: 'Zelenina a ovoce', kind: 'exact' },
  { name: 'cherry rajčata',      group: 'Zelenina a ovoce', kind: 'exact' },
  { name: 'okurka',              group: 'Zelenina a ovoce', kind: 'exact' },
  { name: 'salát',               group: 'Zelenina a ovoce', kind: 'exact' },
  { name: 'žampiony',            group: 'Zelenina a ovoce', kind: 'exact' },
  { name: 'brokolice',           group: 'Zelenina a ovoce', kind: 'exact' },
  { name: 'špenát',              group: 'Zelenina a ovoce', kind: 'exact' },
  { name: 'citron',              group: 'Zelenina a ovoce', kind: 'exact' },
  { name: 'petržel čerstvá',     group: 'Zelenina a ovoce', kind: 'approx' },
  { name: 'jarní cibulka',       group: 'Zelenina a ovoce', kind: 'approx' },

  // -- Mrazak --
  { name: 'hrášek mražený',      group: 'Mrazák', kind: 'exact' },
  { name: 'zeleninová směs',     group: 'Mrazák', kind: 'exact' },
  { name: 'hranolky',            group: 'Mrazák', kind: 'exact' },
  { name: 'ryba mražená',        group: 'Mrazák', kind: 'exact' },

  // -- Pecivo a sladke --
  { name: 'chléb',               group: 'Pečivo a sladké', kind: 'exact' },
  { name: 'tortilly',            group: 'Pečivo a sladké', kind: 'exact' },
  { name: 'čokoláda',            group: 'Pečivo a sladké', kind: 'exact' },
  { name: 'vanilkový cukr',      group: 'Pečivo a sladké', kind: 'approx' },
  { name: 'prášek do pečiva',    group: 'Pečivo a sladké', kind: 'approx' },
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
    stems.add(stemKey(entry.name));
    rows.push(makeRow(entry.name, entry.kind, entry.group, bySlug.get(key)));
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

function makeRow(name, kind, group, existing) {
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
