// ==========================================================================
// pantry.js  --  cast "mozku"
//
// Spiz. Vychazi ze sekci 4.4, 4.5 a 4.9 v PROJEKT.md:
//
// - PRESNE suroviny (maso, testoviny, syr, smetana) se vazi v gramech.
// - PRIBLIZNE (olej, sul, koreni) maji jen stav mam/dochazi/doslo a
//   mnozstvi se u nich ZAMERNE nevyplnuje - nutit uzivatele odhadovat
//   gramy soli je cesta k tomu, ze to prestane vyplnovat.
// - "Mam doma standardne" (staple) se nikdy nepridava do nakupniho seznamu.
// ==========================================================================

import { fold, splitQty, QTY_UNITS } from './recipe-logic.js';

/**
 * Suroviny, ktere nema smysl vazit. Porovnava se na zaklad slova bez
 * diakritiky, takze "sůl" i "soli" chytne stejne pravidlo.
 */
export const APPROX_WORDS = [
  'sul', 'pepr', 'koreni', 'olej', 'ocet', 'cukr', 'skorice', 'kmin',
  'paprika mleta', 'oregano', 'bazalka', 'tymian', 'rozmaryn', 'majoranka',
  'kurkuma', 'zazvor mlety', 'chilli', 'kajensky', 'cesnekovy prasek',
  'cibulovy prasek', 'bobkovy list', 'muskatovy orisek', 'vegeta', 'bujon',
  'prasek do peciva', 'soda', 'vanilkovy cukr', 'cukr moucka', 'strouhanka',
];

export const STATUSES = ['mam', 'dochazi', 'doslo'];

/** Suroviny, ktere se prirozene pocitaji na kusy. */
export const COUNT_WORDS = [
  'vejce', 'vajec', 'vajicko', 'lusk', 'konzerva', 'konzervy', 'masox',
  'bujon', 'prasek do peciva', 'kypric', 'jogurt', 'chleb', 'tortill',
  'parky', 'klobasa', 'okurka', 'citron', 'paprika', 'cibule', 'mrkev',
];

// Hodnota `doslo` je v databazi, ale uzivateli se rika "Nemam" -
// je to srozumitelnejsi u veci, ktere nikdy nemel.
const STATUS_LABELS = {
  mam: 'M\u00e1m',
  dochazi: 'Doch\u00e1z\u00ed',
  doslo: 'Nemám',
};

/** Popisek stavu pro priblizne suroviny. */
export function statusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.doslo;
}

/**
 * Ocisti surovinu z receptu na holy nazev.
 * "500 g kureciho masa" -> "kureciho masa"
 * Poznamky v zavorce se zahazuji: "cibule (velka)" -> "cibule"
 */
export function cleanName(raw) {
  let name = splitQty(String(raw).trim()).name;
  // "spetka soli" nebo "hrnek mouky" - jednotka na zacatku i bez cisla.
  const prvni = name.split(/\s+/)[0] || '';
  const jednotky = QTY_UNITS.map(u => fold(u));
  if (jednotky.indexOf(fold(prvni).replace(/[^a-z]/g, '')) !== -1) {
    name = name.slice(prvni.length).trim() || name;
  }
  name = name.replace(/\([^)]*\)/g, ' ');       // poznamky v zavorce
  name = name.replace(/\s*[-\u2013]\s*.*$/, ''); // vsechno za pomlckou
  name = name.replace(/\s+/g, ' ').trim();
  return name.toLowerCase();
}

/**
 * Odhadne, jestli se surovina vazi, nebo staci mam/dochazi/doslo.
 * Kdyz si nejsme jisti, hadame 'exact' - u presne suroviny se da
 * mnozstvi nechat prazdne, ale u priblizne by pole na gramy prekazelo.
 */
export function guessKind(name) {
  const n = fold(String(name));
  if (COUNT_WORDS.some(w => n.includes(w))) return 'count';
  return APPROX_WORDS.some(w => n.includes(w)) ? 'approx' : 'exact';
}

/**
 * Ma se u tehle polozky vubec ukazovat pole na mnozstvi?
 *
 * `detail` = uzivatel si nahore zapnul "vypisovat mnozstvi u vseho".
 * Bez nej se ptame jen tam, kde to ma smysl - u vazenych a pocitanych.
 */
export function needsQuantity(item, detail) {
  return detail === true || item.kind !== 'approx';
}

/** Pocita se na kusy (vejce, masox, prasek do peciva)? */
export function isCountable(item) {
  return item.kind === 'count';
}

/** Vychozi jednotka podle druhu. */
export function defaultUnit(item) {
  if (isCountable(item)) return 'ks';
  return item.unit || '';
}

/**
 * Kolik je volne k dispozici. Rezervace surovinu NEODECITAJI, jen ji
 * zamykaji (4.2) - proto se volne mnozstvi pocita az tady.
 */
export function freeQuantity(item, reserved) {
  if (item.kind === 'approx') return null;   // priblizne se nepocita
  const have = Number(item.quantity) || 0;
  return Math.max(0, have - (Number(reserved) || 0));
}

/**
 * Startovni seznam do spize vygenerovany z receptu, ktere uz v appce
 * jsou (4.9). Kazdou surovinu uvede jednou, casteji pouzivane napred -
 * uzivatel tak zaskrtava od nejdulezitejsich.
 */
export function starterList(recipes) {
  const counts = new Map();

  (recipes || []).forEach(r => {
    const seen = new Set();
    (r.ingredients || []).forEach(raw => {
      const name = cleanName(raw);
      if (!name || name.length < 2) return;
      if (seen.has(name)) return;   // v jednom receptu pocitame jednou
      seen.add(name);
      counts.set(name, (counts.get(name) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'cs'))
    .map(([name, count], i) => ({
      name: name,
      kind: guessKind(name),
      count: count,
      sort_order: i,
    }));
}

/**
 * Podklad pro vykresleni spize. Vzhled uz jen kresli - nerozhoduje,
 * jestli ukazat gramy nebo tri tlacitka.
 */
export function pantryView(items, detail) {
  return (items || []).map(item => {
    const ptat = needsQuantity(item, detail);
    return {
      id: item.id,
      name: item.name,
      kind: item.kind,
      staple: !!item.staple,
      showQuantity: ptat,
      countable: isCountable(item),
      quantity: ptat ? (item.quantity == null ? '' : item.quantity) : null,
      unit: ptat ? defaultUnit(item) : null,
      status: ptat ? null : (item.status || 'doslo'),
      statusLabel: ptat ? null : statusLabel(item.status),
    };
  });
}
