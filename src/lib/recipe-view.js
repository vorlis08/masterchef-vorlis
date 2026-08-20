// ==========================================================================
// recipe-view.js  --  cast "mozku"
//
// Prevadi recept na "podklad k vykresleni" - hotova data, ne HTML.
// Rozhoduje CO se ma o receptu ukazat; jak to bude vypadat je vec skinu.
//
// Tohle je kontrakt mezi mozkem a vzhledem: skin dostane objekt z
// cardView / rowView a smi z nej vyrobit libovolne HTML. Kdyz pribude
// "Kniha" nebo "Kucharka", nemeni se nic tady - jen se napise jine
// vykreslovani nad stejnymi daty.
// ==========================================================================

/** Cislo poradi v seznamu jako "01", "02"... */
export function orderNumber(n) {
  return String(n).padStart(2, '0');
}

/** Kolik porci - text pod nazvem. */
export function servingsLabel(servings) {
  return (servings || '?') + ' porc\u00ed';
}

/** Prvni pismeno nazvu - zastupuje chybejici fotku. */
export function initialOf(title) {
  return String(title || '?').charAt(0);
}

/**
 * Podklad pro dlazdici.
 *
 * @param {Object} recipe
 * @param {Object} [opts] { favorite, rating }
 */
export function cardView(recipe, opts) {
  const o = opts || {};
  return {
    slug: recipe.slug,
    title: recipe.title || '',
    category: recipe.category || '',
    time: recipe.time || '',
    servingsLabel: servingsLabel(recipe.servings),
    stars: o.rating || 0,
    image: recipe.image || '',
    blur: recipe.blur || '',
    initial: initialOf(recipe.title),
    favorite: !!o.favorite,
    // Nakolik jde uvarit z toho, co mam doma (4.3). Prazdne = nevime.
    pripravenost: o.pripravenost || null,
    stav: o.stav || 'neuvareno',
    uvareno: o.uvareno || 0,
    zvyraznit: !!o.zvyraznit,
  };
}

/**
 * Podklad pro radek v seznamu.
 *
 * @param {Object} recipe
 * @param {Object} [opts] { favorite, rating, number }
 */
export function rowView(recipe, opts) {
  const o = opts || {};
  return {
    slug: recipe.slug,
    number: orderNumber(o.number || 0),
    title: recipe.title || '',
    time: recipe.time || '',
    subtitle: [recipe.category, recipe.difficulty, servingsLabel(recipe.servings)]
      .filter(Boolean).join(' \u00b7 '),
    stars: o.rating || 0,
    image: recipe.image || '',
    blur: recipe.blur || '',
    favorite: !!o.favorite,
    pripravenost: o.pripravenost || null,
    stav: o.stav || 'neuvareno',
    uvareno: o.uvareno || 0,
    zvyraznit: !!o.zvyraznit,
  };
}

/**
 * Podklad pro cely seznam receptu.
 *
 * Dostane uz vyfiltrovane recepty (viz filters.js) a doplni pro kazdy
 * jeho podklad podle zvoleneho rezimu zobrazeni.
 *
 * @param {Array}  recipes  vyfiltrovane recepty
 * @param {Object} opts     { mode: 'grid'|'list', isFavorite, ratingOf }
 */
export function gridView(recipes, opts) {
  const o = opts || {};
  const mode = o.mode === 'list' ? 'list' : 'grid';
  const isFavorite = o.isFavorite || (() => false);
  const ratingOf = o.ratingOf || (() => 0);

  const pripravenostOf = o.pripravenostOf || (() => null);
  const stavOf = o.stavOf || (() => 'neuvareno');
  const uvarenoOf = o.uvarenoOf || (() => 0);
  // Kdyz je zapnuty filtr podle stavu, odpovidajici recepty se zvyrazni -
  // at je na prvni pohled videt, PROC jsou v seznamu.
  const zvyraznitStav = o.zvyraznitStav || '';

  const items = recipes.map((recipe, i) => {
    const stav = stavOf(recipe.slug);
    const shared = {
      favorite: !!isFavorite(recipe.slug),
      rating: ratingOf(recipe.slug),
      pripravenost: pripravenostOf(recipe),
      stav: stav,
      uvareno: uvarenoOf(recipe.slug),
      zvyraznit: !!zvyraznitStav && zvyraznitStav === stav,
    };
    return mode === 'grid'
      ? cardView(recipe, shared)
      : rowView(recipe, { ...shared, number: i + 1 });
  });

  return { mode: mode, items: items, count: items.length, empty: items.length === 0 };
}
