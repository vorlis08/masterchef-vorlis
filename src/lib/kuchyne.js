// ==========================================================================
// kuchyne.js  --  cast "mozku"
//
// Kuchyn JE spiz. Neni to zadna nova vrstva uvnitr ni - jen jich muze
// byt vic a kazda ma jmeno. Kdo vari na jednom miste, o zadnou zmenu
// nezakopne: dostane jednu kuchyn s nazvem "Moje kuchyň" a nikdy se
// o ni nemusi starat.
//
// Duvod, proc jich jde mit vic: chata a byt maji kazda jinou vybavu.
// Jedna spolecna spiz na obojí je horsi nez zadna - "mas doma smetanu"
// je k nicemu, kdyz je smetana o sto kilometru dal.
//
// Co je tady a ne ve Workeru: pravidla pro nazvy. Plati stejne
// v prohlizeci (at uzivatel vidi chybu hned) i na serveru (at se na
// prohlizec nespolehame).
// ==========================================================================

/** Nazev, ktery dostane kuchyn zalozena za uzivatele. */
export const VYCHOZI_NAZEV = 'Moje kuchyň';

/** Delsi nazev se do prepinace v hlavicce nevejde. */
export const MAX_DELKA = 30;

/** Kolik kuchyni si smi clovek zalozit. Strop proti pokusum o nesmysly. */
export const MAX_POCET = 12;

/**
 * Srovna nazev do podoby, ve ktere se uklada.
 * Mezery na krajich pryc, vic mezer uprostred na jednu.
 */
export function upravNazev(nazev) {
  return String(nazev == null ? '' : nazev).replace(/\s+/g, ' ').trim().slice(0, MAX_DELKA);
}

/**
 * Da se tenhle nazev pouzit?
 *
 * @param {string} nazev
 * @param {Array<{id: *, name: string}>} [stavajici]  uz zalozene kuchyne
 * @param {*} [krome]  id kuchyne, ktera se prave prejmenovava
 * @returns {{ok: boolean, chyba: string, nazev: string}}
 */
export function zkontrolujNazev(nazev, stavajici, krome) {
  const n = upravNazev(nazev);

  if (!n) return { ok: false, chyba: 'Kuchyň musí mít jméno.', nazev: n };

  const kolize = (stavajici || []).some(k =>
    String(k.id) !== String(krome) && stejnyNazev(k.name, n));
  if (kolize) return { ok: false, chyba: 'Takovou kuchyň už máš.', nazev: n };

  return { ok: true, chyba: '', nazev: n };
}

/** Porovnani nazvu bez ohledu na velikost pismen. */
export function stejnyNazev(a, b) {
  return String(a || '').toLocaleLowerCase('cs') === String(b || '').toLocaleLowerCase('cs');
}

/**
 * Ktera kuchyn je aktivni.
 *
 * Vraci vzdy nejakou, pokud jsou vubec jake - ulozena volba muze
 * ukazovat na kuchyn, kterou uzivatel mezitim smazal (treba na druhem
 * telefonu), a nechat ho pak koukat do prazdna by bylo horsi nez ho
 * tise prehodit na prvni.
 *
 * @param {Array<{id: *}>} kuchyne
 * @param {*} ulozene  id z posledni volby
 */
export function aktivniKuchyn(kuchyne, ulozene) {
  const list = kuchyne || [];
  if (!list.length) return null;
  return list.find(k => String(k.id) === String(ulozene)) || list[0];
}

/**
 * Jde tuhle kuchyn smazat?
 *
 * Posledni ne: appka bez jedine kuchyne nema kam ukladat suroviny a
 * uzivatel by se dostal do stavu, ze si musi neco zalozit, nez smi
 * cokoliv delat.
 */
export function jdeSmazat(kuchyne) {
  return (kuchyne || []).length > 1;
}

/** Da se zalozit dalsi? */
export function jdePridat(kuchyne) {
  return (kuchyne || []).length < MAX_POCET;
}

/**
 * Navrh jmena pro dalsi kuchyn. Cisluje se, dokud je volno - druha
 * kuchyn se nema jmenovat stejne jako prvni.
 */
export function navrhniNazev(kuchyne, zaklad) {
  const z = upravNazev(zaklad) || 'Nová kuchyň';
  if (!(kuchyne || []).some(k => stejnyNazev(k.name, z))) return z;
  for (let i = 2; i <= MAX_POCET + 1; i++) {
    const pokus = upravNazev(z + ' ' + i);
    if (!kuchyne.some(k => stejnyNazev(k.name, pokus))) return pokus;
  }
  return z;
}
