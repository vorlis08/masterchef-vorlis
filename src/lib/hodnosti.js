// ==========================================================================
// hodnosti.js  --  cast "mozku"
//
// Hodnost se udeluje podle CELKOVEHO poctu uvarenych jidel, ne podle
// poctu ruznych receptu. Kdo si desetkrat udela tutez omacku, vari
// desetkrat - tohle neni sbiratelska hra.
//
// Prahy jsou zamerne husté na zacatku a ridke pozdeji: prvni tri
// uvarena jidla maji dat pocit pohybu, po padesatem uz to nikdo
// nepocita.
//
// Nazvy jsou suche. Zadne "Mistr kuchyne III" ani hvezdicky.
// ==========================================================================

/** Od kolika uvarenych jidel plati. Serazeno vzestupne. */
export const HODNOSTI = [
  { od: 0,   nazev: 'Zase toast' },
  { od: 1,   nazev: 'První pokus' },
  { od: 3,   nazev: 'Nedělní kuchař' },
  { od: 8,   nazev: 'Vaří pravidelně' },
  { od: 15,  nazev: 'Stálice u sporáku' },
  { od: 30,  nazev: 'Šéf vlastní kuchyně' },
  { od: 50,  nazev: 'Ví, co dělá' },
  { od: 80,  nazev: 'Legenda plotny' },
  { od: 120, nazev: 'MasterChef Vorlis' },
];

/**
 * Hodnost a postup k dalsi.
 *
 * @param {number} uvareno  celkovy pocet uvarenych jidel
 * @returns {{nazev: string, dalsi: ?string, doDalsi: number, podil: number}}
 *   `podil` je 0-1 pro proužek postupu. U nejvyssi hodnosti je 1
 *   a `dalsi` je null - nema smysl predstirat, ze se da jit dal.
 */
export function hodnost(uvareno) {
  const kolik = Math.max(0, Math.floor(Number(uvareno) || 0));

  let index = 0;
  for (let i = 0; i < HODNOSTI.length; i++) {
    if (kolik >= HODNOSTI[i].od) index = i;
  }

  const tato = HODNOSTI[index];
  const dalsi = HODNOSTI[index + 1] || null;

  if (!dalsi) {
    return { nazev: tato.nazev, dalsi: null, doDalsi: 0, podil: 1 };
  }

  const rozpeti = dalsi.od - tato.od;
  return {
    nazev: tato.nazev,
    dalsi: dalsi.nazev,
    doDalsi: dalsi.od - kolik,
    podil: rozpeti > 0 ? Math.min(1, (kolik - tato.od) / rozpeti) : 1,
  };
}

/**
 * Secte, kolikrat uzivatel vubec varil.
 *
 * Bere hodnoty z `Store.getReview` - tedy `{ cooked: number }` na kazdy
 * recept. Recepty, ktere uz v appce nejsou, se pocitaji taky: uvaril je,
 * i kdyz jsme je mezitim smazali.
 *
 * @param {Array<{cooked: ?number}>} hodnoceni
 */
export function celkemUvareno(hodnoceni) {
  return (hodnoceni || []).reduce((soucet, h) => {
    const n = Number(h && h.cooked) || 0;
    return soucet + (n > 0 ? n : 0);
  }, 0);
}
