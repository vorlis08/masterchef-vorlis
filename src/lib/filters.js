// ==========================================================================
// filters.js  --  cast "mozku"
//
// Rozhoduje, KTERE recepty se maji zobrazit. Nevi nic o tom, JAK se
// vykresli - to je vec vzhledu (skinu). Diky tomu muze stejne filtrovani
// pouzivat "Aplikace", "Kniha" i "Kucharka".
// ==========================================================================

import { fold, haystack, parseMinutes } from './recipe-logic.js';

/** Casova pasma pouzita ve filtru. */
export const TIME_BUCKETS = [
  { key: '20',  test: m => m <= 20 },
  { key: '45',  test: m => m <= 45 },
  { key: '90',  test: m => m <= 90 },
  { key: '90+', test: m => m > 90  },
];

/**
 * Sedi recept na hledany vyraz?
 * Cestina sklonuje, takze u delsiho dotazu zkusime i tvar bez posledniho
 * pismene - diky tomu "slanina" najde i "se slaninou".
 */
export function matchesSearch(recipe, query) {
  if (!query) return true;
  const q = fold(query);
  if (!q) return true;
  const hay = haystack(recipe);
  return hay.includes(q) || (q.length >= 5 && hay.includes(q.slice(0, -1)));
}

/** Sedi recept na vybranou kategorii? '__fav' znamena oblibene. */
export function matchesCategory(recipe, category, isFavorite) {
  if (!category || category === 'all') return true;
  if (category === '__fav') return !!isFavorite;
  return recipe.category === category;
}

/** Sedi recept na vybrany typ jidla (snidane, obed...)? */
export function matchesMeal(recipe, meal) {
  if (!meal) return true;
  return (recipe.meal_type || []).includes(meal);
}

/** Sedi recept do vybraneho casoveho pasma? */
export function matchesTime(recipe, timeKey) {
  if (!timeKey) return true;
  const mins = parseMinutes(recipe.time);
  if (mins === null) return false;
  const bucket = TIME_BUCKETS.find(b => b.key === timeKey);
  return !!bucket && bucket.test(mins);
}

/**
 * Hlavni funkce: z celeho seznamu receptu vybere ty, ktere odpovidaji
 * vsem zadanym kriteriim.
 *
 * @param {Array}  recipes  vsechny recepty
 * @param {Object} criteria { query, category, meal, time, favorites }
 * @returns {Array} vybrane recepty ve stejnem poradi
 */
export function filterRecipes(recipes, criteria) {
  const c = criteria || {};
  const favorites = c.favorites || [];
  return (recipes || []).filter(r => {
    const isFav = favorites.includes(r.slug);
    return matchesCategory(r, c.category, isFav)
      && matchesSearch(r, c.query)
      && matchesMeal(r, c.meal)
      && matchesTime(r, c.time);
  });
}

/** Nadpis seznamu podle vybrane kategorie. */
export function headingFor(category) {
  if (category === '__fav') return 'Oblíbené';
  if (!category || category === 'all') return 'Rejstřík';
  return category;
}

/** Spravny tvar cisla: "1 recept" / "3 recepty" / "12 receptů". */
export function countLabel(n) {
  if (n === 1) return '1 recept';
  if (n >= 2 && n <= 4) return n + ' recepty';
  return n + ' receptů';
}
