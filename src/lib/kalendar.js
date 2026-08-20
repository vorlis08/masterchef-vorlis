// ==========================================================================
// kalendar.js  --  cast "mozku"
//
// Mesicni mrizka pro plan vareni. Pocita, ktery den patri do ktereho
// tydne a co je na nem naplanovane. O vzhledu nevi nic.
//
// Tyden zacina PONDELIM - cesky zvyk, ne americky.
//
// Datumy se drzi jako 'YYYY-MM-DD' a pocitaji pres Date.UTC, aby letni
// cas neposunul den pres pulnoc.
// ==========================================================================

import { naDatum, dnes } from './booking.js';

export const DNY_ZKRATKY = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

export const MESICE = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

/** "srpen 2026" */
export function nazevMesice(rok, mesic) {
  return MESICE[mesic - 1] + ' ' + rok;
}

/** Posun o mesic. Prelom roku resi sam. */
export function posunMesic(rok, mesic, o) {
  const celkem = (rok * 12) + (mesic - 1) + o;
  return { rok: Math.floor(celkem / 12), mesic: (celkem % 12) + 1 };
}

/** Kolik dni ma mesic. */
export function dniVMesici(rok, mesic) {
  return new Date(Date.UTC(rok, mesic, 0)).getUTCDate();
}

/**
 * Kolikaty den v tydnu je prvni den mesice, pocitano od pondeli (0 = Po).
 * getUTCDay vraci nedeli jako 0, proto ten prepocet.
 */
function odsazeni(rok, mesic) {
  const den = new Date(Date.UTC(rok, mesic - 1, 1)).getUTCDay();
  return (den + 6) % 7;
}

/** Bookingy, ktere pripadaji na dany den. Zrusene se nepocitaji. */
export function bookingyDne(bookingy, datum) {
  return (bookingy || [])
    .filter(b => b.cook_date === datum && b.state !== 'cancelled')
    .sort((a, b) => (a.cook_time || '99:99') < (b.cook_time || '99:99') ? -1 : 1);
}

/**
 * Cela mrizka mesice, vcetne dobehu z okolnich mesicu, aby kazdy tyden
 * mel sedm bunek.
 *
 * @returns {{rok, mesic, nazev, tydny: Array<Array<Object>>}}
 */
export function mesicniMrizka(rok, mesic, bookingy, dnesniDatum) {
  const dnesni = dnesniDatum || dnes();
  const pred = odsazeni(rok, mesic);
  const pocet = dniVMesici(rok, mesic);

  // Zacneme tolik dni pred prvnim, aby mrizka zacinala pondelim.
  const start = new Date(Date.UTC(rok, mesic - 1, 1 - pred));

  const tydny = [];
  let tyden = [];

  // Sest radku pokryje kazdy mesic vcetne toho, ktery zacina v nedeli.
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const datum = naDatum(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

    tyden.push({
      datum: datum,
      den: d.getUTCDate(),
      jinyMesic: (d.getUTCMonth() + 1) !== mesic,
      dnes: datum === dnesni,
      minulost: datum < dnesni,
      bookingy: bookingyDne(bookingy, datum),
    });

    if (tyden.length === 7) { tydny.push(tyden); tyden = []; }
  }

  // Posledni radek zahodime, kdyz je cely z dalsiho mesice - jinak
  // by kalendar mel prazdny tyden navic.
  while (tydny.length > 4 && tydny[tydny.length - 1].every(d => d.jinyMesic)) {
    tydny.pop();
  }

  return { rok: rok, mesic: mesic, nazev: nazevMesice(rok, mesic), tydny: tydny, pocetDni: pocet };
}

/** Kolik vareni je v mesici naplanovano. */
export function pocetVMesici(mrizka) {
  let n = 0;
  mrizka.tydny.forEach(t => t.forEach(d => {
    if (!d.jinyMesic) n += d.bookingy.length;
  }));
  return n;
}

/** Nejblizsi den s naplanovanym varenim, od dnesniho dne dal. */
export function nejblizsiDen(bookingy, dnesniDatum) {
  const den = dnesniDatum || dnes();
  const budouci = (bookingy || [])
    .filter(b => b.state === 'planned' && b.cook_date >= den)
    .sort((a, b) => a.cook_date < b.cook_date ? -1 : 1);
  return budouci.length ? budouci[0].cook_date : null;
}
