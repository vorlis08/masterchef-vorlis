// ==========================================================================
// pagination.js  --  cast "mozku"
//
// Stránkování: rozhoduje, KTERE polozky patri na kterou stranu.
// Vzniklo kvuli skinu "Kniha", ale nevi o nem nic - stejne stránkování
// muze pouzit cokoli jineho.
// ==========================================================================

/** Kolik stran zabere tolik polozek. Prazdny seznam ma porad jednu stranu. */
export function pageCount(total, perPage) {
  const per = perPage > 0 ? perPage : 1;
  return Math.max(1, Math.ceil(total / per));
}

/** Srovna cislo strany do platneho rozsahu (strany se cislují od 0). */
export function clampPage(page, total, perPage) {
  const last = pageCount(total, perPage) - 1;
  if (!(page > 0)) return 0;
  return page > last ? last : page;
}

/**
 * Vrati polozky patrici na danou stranu.
 *
 * @param {Array}  items
 * @param {number} page     cislovano od 0
 * @param {number} perPage
 */
export function pageItems(items, page, perPage) {
  const per = perPage > 0 ? perPage : 1;
  const p = clampPage(page, items.length, per);
  return items.slice(p * per, p * per + per);
}

/**
 * Kompletni podklad pro jednu stranu - vcetne toho, jestli se da
 * listovat dopredu a dozadu. Vzhled uz nic nedopocitava.
 */
export function pageView(items, page, perPage) {
  const per = perPage > 0 ? perPage : 1;
  const total = pageCount(items.length, per);
  const p = clampPage(page, items.length, per);
  return {
    page: p,
    pages: total,
    items: pageItems(items, p, per),
    first: p === 0,
    last: p === total - 1,
    label: (p + 1) + ' / ' + total,
  };
}
