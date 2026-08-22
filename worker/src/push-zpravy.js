// ==========================================================================
// push-zpravy.js  --  texty oznameni na telefon
//
// Oddelene od odesilani schvalne: text je to jedine, co uzivatel opravdu
// uvidi, a takhle jde otestovat bez sifrovani a bez site.
//
// Pravidla, ktera drzi vsechny tri zpravy:
//   - Titulek do ~30 znaku. Delsi Android i iOS uriznou uprostred slova.
//   - Zadne "Ahoj!" a zadne vykricniky navic. Oznameni prijde v okamziku,
//     kdy clovek dela neco jineho - ma rict vec, ne se rozjizdet.
//   - Text musi davat smysl i sam o sobe, bez titulku. Na zamcene
//     obrazovce se casto ukaze jen jeden z nich.
// ==========================================================================

import { vokativ } from '../../src/lib/osloveni.js';

/** Ustrizne text tak, aby nekoncil pulkou slova. */
function zkrat(text, max) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  const rez = t.slice(0, max - 1);
  const mezera = rez.lastIndexOf(' ');
  return (mezera > max / 2 ? rez.slice(0, mezera) : rez) + '…';
}

/**
 * Pripominka pred varenim.
 * @param {string} nazev  nazev receptu
 * @param {string} cas    'HH:MM'
 */
export function zpravaVareni(nazev, cas, slug) {
  return {
    titul: 'Za chvíli vaříš',
    text: zkrat(nazev, 60) + (cas ? ' — ' + cas : ''),
    slug: slug || null,
  };
}

/**
 * Uvitaci oznameni. Posila se ve chvili, kdy si uzivatel oznameni
 * zapne - je to zaroven jediny zpusob, jak mu ukazat, ze to funguje.
 * Slibovat "pipne to pred varenim" a nechat ho cekat tyden na dukaz je
 * cesta k tomu, ze si to zase vypne.
 */
export function zpravaUvitani(jmeno) {
  // Pátý pád: "Honzo", ne "Honza". Viz osloveni.js.
  const kdo = zkrat(vokativ(String(jmeno || '').split(' ')[0]), 20);
  return {
    titul: 'Oznámení fungují',
    text: (kdo ? kdo + ', takhle' : 'Takhle') +
      ' ti dám vědět, než začneš vařit. Jinak budu zticha.',
    slug: null,
  };
}

/**
 * Pripomenuti po tydnu, co uzivatel appku neotevrel.
 *
 * Kdyz ma neco v "chci vyzkouset", zminime to jmenem - obecne
 * "vrat se do appky" je reklama, konkretni recept je duvod.
 *
 * @param {number} dni      kolik dni se neukazal
 * @param {string} [recept] nazev receptu z wishlistu, ktery jde uvarit
 */
export function zpravaNeaktivita(dni, recept) {
  const kolik = Math.max(7, Math.round(Number(dni) || 7));

  if (recept) {
    return {
      titul: 'Pořád to chceš zkusit?',
      text: zkrat(recept, 50) + ' máš v „chci vyzkoušet“ a suroviny na to doma jsou.',
      slug: null,
    };
  }

  return {
    titul: 'Týden bez vaření',
    text: kolik + ' dní ses tu neukázal. Kuchyň si pořád pamatuje, co v ní máš.',
    slug: null,
  };
}
