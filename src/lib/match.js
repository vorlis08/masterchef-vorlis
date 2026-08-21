// ==========================================================================
// match.js  --  cast "mozku"
//
// Porovnavani surovin ze spize se surovinami z receptu a odpoved na
// otazku "kolik mi toho chybi".
//
// Pouziva to APPKA (odznak u receptu) i WORKER (e-maily), proto to lezi
// tady a ne v jednom z nich.
//
// Klicove pravidlo 4.3: odpoved NENI ano/ne, ale cislo. Inventar se vzdy
// rozejde s realitou - neco snis mimo recept, neco se zkazi, olej nikdo
// nevazi. Tvrdy filtr nad nepresnymi daty ukazuje nesmysly a uzivatel mu
// prestane verit. Skala je uzitecna i pri nepresnych datech.
// ==========================================================================

import { fold } from './recipe-logic.js';
import { cleanName } from './pantry.js';

/**
 * Hrube koreny slov. Cestina sklonuje, takze "smetana" a "smetany" jsou
 * pro pocitac dve veci - zkraceni na ctyri pismena je srovna.
 *
 * Slova od TRI pismen, jinak by propadla "sul" nebo "med".
 */
export function koreny(text) {
  return String(text).trim().split(/\s+/)
    .map(w => fold(w).replace(/[^a-z]/g, ''))
    .filter(w => w.length >= 3)
    .map(w => w.slice(0, 4));
}

/**
 * Sedi surovina ze spize na surovinu z receptu?
 *
 * Zamerne se nepouziva ingredientMatch z recipe-logic.js - to porovnava
 * podretezce, takze "smetana" a "smetany" mu nesednou.
 */
export function sediSurovina(mamNazev, potreba) {
  const a = new Set(koreny(mamNazev));
  if (!a.size) return false;
  return koreny(potreba).some(k => a.has(k));
}

/**
 * Ktere polozky spize jsou skutecne k dispozici.
 *
 * - "mam doma standardne" plati vzdy (4.5)
 * - u priblizne suroviny staci stav mam nebo dochazi (4.4)
 * - u vazene a pocitane se odectou REZERVACE, protoze booking surovinu
 *   nesnedl, jen ji zamkl (4.2)
 */
export function dostupne(spiz) {
  return (spiz || [])
    .filter(i => {
      if (i.staple) return true;
      if (i.kind === 'approx') return i.status === 'mam' || i.status === 'dochazi';
      const volne = (Number(i.quantity) || 0) - (Number(i.reserved) || 0);
      return volne > 0;
    })
    .map(i => cleanName(i.name));
}

/** Suroviny receptu ocistene na holy nazev. */
export function potrebaReceptu(recept) {
  return ((recept && recept.ingredients) || []).map(cleanName).filter(Boolean);
}

/**
 * Kolik surovin receptu uzivateli chybi a ktere to jsou.
 *
 * @returns {{chybi: Array<string>, pocet: number, celkem: number}}
 */
export function chybejici(recept, spiz) {
  const mam = dostupne(spiz);
  const potreba = potrebaReceptu(recept);
  const chybi = potreba.filter(sur => !mam.some(m => sediSurovina(m, sur)));
  return { chybi: chybi, pocet: chybi.length, celkem: potreba.length };
}

/**
 * Nakolik je recept "uvaritelny". Skala, ne ano/ne (4.3).
 *
 * stav:
 *   'vse'    - nechybi nic
 *   'skoro'  - chybi nejvyse dve veci (doskocis do vecerky)
 *   'daleko' - chybi vic
 *   'nevim'  - spiz je prazdna, takze nemame z ceho soudit
 */
export function pripravenost(recept, spiz) {
  const m = chybejici(recept, spiz);

  if (!spiz || spiz.length === 0) {
    return { stav: 'nevim', chybi: m.pocet, celkem: m.celkem, popisek: '', chybiCo: [] };
  }
  if (m.celkem === 0) {
    return { stav: 'nevim', chybi: 0, celkem: 0, popisek: '', chybiCo: [] };
  }

  const stav = m.pocet === 0 ? 'vse' : (m.pocet <= 2 ? 'skoro' : 'daleko');
  return {
    stav: stav,
    chybi: m.pocet,
    celkem: m.celkem,
    chybiCo: m.chybi,
    popisek: popisekPripravenosti(stav, m.pocet),
  };
}

/**
 * Kratky popisek na odznak u receptu.
 *
 * Drive tu stalo jen "Chybí 3" - z toho nikdo nepozna, jestli chybi tri
 * suroviny, tri kroky nebo tri porce. Podstatne jmeno tam proto musi
 * byt vzdycky, i kdyz je odznak o pismenko sirsi.
 */
export function popisekPripravenosti(stav, chybi) {
  if (stav === 'vse') return 'Máš všechny suroviny';
  if (stav === 'skoro' || stav === 'daleko') {
    if (chybi === 1) return 'Chybí 1 surovina';
    if (chybi < 5) return 'Chybí ' + chybi + ' suroviny';
    return 'Chybí ' + chybi + ' surovin';
  }
  return '';
}

/**
 * Seradi recepty od nejlepe uvaritelnych. Poradi uvnitr stejne skupiny
 * se nemeni, aby seznam nepreskakoval.
 */
export function podlePripravenosti(recepty, spiz) {
  const vaha = { vse: 0, skoro: 1, daleko: 2, nevim: 3 };
  return (recepty || [])
    .map((r, i) => ({ r: r, i: i, p: pripravenost(r, spiz) }))
    .sort((a, b) => (vaha[a.p.stav] - vaha[b.p.stav]) || (a.p.chybi - b.p.chybi) || (a.i - b.i))
    .map(x => x.r);
}
