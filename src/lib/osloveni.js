// ==========================================================================
// osloveni.js  --  cast "mozku"
//
// Pátý pád. Google vraci jmeno v prvnim ("Honza"), ale cesky se oslovuje
// patym ("Honzo"). Appka to dlouho lepila rovnou do e-mailu a vzniklo
// z toho "Ahoj Honza," - nejrychleji rozpoznatelna znamka strojoveho
// textu v cestine, a to hned ve tretim radku uvitaciho e-mailu.
//
// ZASADA: kdyz si nejsme jisti, jmeno NECHAME BYT. Spatne sklonovane
// jmeno ("Ahoj Dagmare") urazi vic nez nesklonovane. Prvni pad je horsi
// cestina, ale nikoho neprejmenuje.
//
// Rod z jmena poznat nejde - "Ester" i "Ivan" konci souhlaskou. Zenska
// jmena na souhlasku se proto drzi v seznamu nize; jinych by pribylo
// malo a chyba u nich je vic videt nez uzitek.
// ==========================================================================

/**
 * Zenska jmena zakoncena souhlaskou. V patem pade se nemeni, ale
 * pravidlo pro souhlasky by z nich udelalo "Dagmare" nebo "Karine".
 */
const ZENSKA_NA_SOUHLASKU = [
  'dagmar', 'miriam', 'ester', 'karin', 'ingrid', 'nikol', 'rút', 'rut',
  'sarah', 'deborah', 'rachel', 'abigail', 'jasmin', 'lilien', 'madlen',
];

/** Jmena, ktera se v patem pade nemeni, i kdyz by pravidlo reklo jinak. */
const BEZE_ZMENY = ['jiří', 'jiri', 'ivo', 'oto', 'otto', 'hugo', 'bruno', 'marko'];

const SAMOHLASKY = 'aeiouyáéíóúůýě';

/**
 * Pátý pád křestního jména.
 *
 * Nezname tvary vraci beze zmeny - viz zasada v hlavicce souboru.
 *
 * @param {string} jmeno  krestni jmeno v prvnim pade
 * @returns {string}
 */
export function vokativ(jmeno) {
  const j = String(jmeno == null ? '' : jmeno).trim();
  if (!j) return '';

  const male = j.toLocaleLowerCase('cs');

  // Vic slov ("Jan Novák") sem nepatri - oslovuje se krestnim jmenem.
  if (/\s/.test(j)) return vokativ(j.split(/\s+/)[0]);

  // Zkratky a inicialy ("J.", "TOM") nechavame byt.
  if (j.length < 3 || /[.@0-9]/.test(j)) return j;

  if (BEZE_ZMENY.includes(male)) return j;
  if (ZENSKA_NA_SOUHLASKU.includes(male)) return j;

  // -ie / -ia: Marie, Lucie, Julie, Sofia. Nemeni se.
  if (/(ie|ia)$/i.test(j)) return j;

  // -a -> -o. Plati pro obe pohlavi: Honza->Honzo, Jana->Jano,
  // Jirka->Jirko, Petra->Petro.
  if (/a$/i.test(j)) return nahrad(j, 1, 'o');

  // Konci samohlaskou (Jiří, Rudy, Ivo, Tomi) - nechavame.
  if (SAMOHLASKY.includes(male.slice(-1))) return j;

  // Mekke souhlasky -> -i. Tomáš->Tomáši, Ondřej->Ondřeji, Lukáš->Lukáši.
  if (/[šžčřjďťň]$/i.test(j)) return j + 'i';

  // -k -> -ku. Patrik->Patriku, Dominik->Dominiku.
  // U -ek vypadava "e" (Marek->Marku, Radek->Radku) a u -něk se navic
  // meni n na ň (Zdeněk->Zdeňku). Tomu se rika pohybne e.
  if (/něk$/i.test(j)) return nahrad(j, 3, 'ňku');
  if (/ek$/i.test(j)) return nahrad(j, 2, 'ku');
  if (/k$/i.test(j)) return j + 'u';

  // -h, -ch, -g -> -u. Vojtěch->Vojtěchu, Oleg->Olegu.
  if (/(ch|h|g)$/i.test(j)) return j + 'u';

  // -c -> -ci. Vavřinec->Vavřinci resi az pravidlo -ec nize.
  if (/ec$/i.test(j)) return nahrad(j, 2, 'če');
  if (/c$/i.test(j)) return j + 'i';

  // -el -> -le. Pavel->Pavle, Karel->Karle. Vypadava e.
  // Daniel je vyjimka (Danieli), proto se resi zvlast.
  if (/daniel$/i.test(j)) return j + 'i';
  if (/el$/i.test(j)) return nahrad(j, 2, 'le');

  // -r -> -ře. Petr->Petře, Alexandr->Alexandře.
  // Jmena na -ar/-or (Otakar, Viktor) maji -e: Otakare, Viktore.
  if (/[aáeéioó]r$/i.test(j)) return j + 'e';
  if (/r$/i.test(j)) return nahrad(j, 1, 'ře');

  // Ostatni tvrde souhlasky -> -e. David->Davide, Martin->Martine,
  // Filip->Filipe, Michal->Michale, Tomas->Tomase.
  if (/[bdflmnpstvzwx]$/i.test(j)) return j + 'e';

  return j;
}

/**
 * Zamení konec slova a zachova velikost prvniho pismene zbytku.
 * Pracuje s malymi pismeny, protoze jmena chodi ve tvaru "Honza".
 */
function nahrad(jmeno, kolik, konec) {
  return jmeno.slice(0, jmeno.length - kolik) + konec;
}

/**
 * Oslovení do e-mailu a oznameni: "Ahoj Honzo" / "Ahoj" bez jmena.
 *
 * @param {{name: ?string}|string} kdo  uzivatel nebo rovnou jmeno
 * @param {string} [pozdrav]
 */
export function osloveni(kdo, pozdrav) {
  const zaklad = pozdrav || 'Ahoj';
  const jmeno = typeof kdo === 'string' ? kdo : (kdo && kdo.name) || '';
  const v = vokativ(jmeno);
  return v ? zaklad + ' ' + v : zaklad;
}
