// ==========================================================================
// recepty.js  --  nacteni receptu ze zdroje pravdy
//
// Recepty si Worker stahuje z GitHubu, ne z vlastni kopie. Kdyby mel
// svoji, rozesla by se s aplikaci do tydne (viz 8.14).
//
// Vytazeno zvlast, protoze to potrebuje digest (e-maily, oznameni)
// i api (nazev vareni do kalendare).
// ==========================================================================

const RECIPES_URL =
  'https://raw.githubusercontent.com/vorlis08/masterchef-vorlis/main/src/data/recipes.json';

export async function nactiRecepty() {
  // Petiminutova cache na okraji Cloudflare. Bez ni sahal Worker na
  // GitHub pri KAZDEM bookingu i kazdem behu Cronu - a recepty se
  // meni jednou za tyden, ne kazdou vterinu.
  const res = await fetch(RECIPES_URL, {
    headers: { 'User-Agent': 'masterchef-worker' },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!res.ok) throw new Error('recipes.json ' + res.status);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
