// ==========================================================================
// booking.js  --  cast "mozku"
//
// Rezervace vareni ("TO UVAŘÍM!"), sekce 4.1 a 4.2 v PROJEKT.md.
//
// Dve veci, ktere se snadno spletou:
//
// 1. KONFLIKTY. Dva bookingy na stejny CAS se maji ohlasit. Booking na
//    cely den se s nicim nebije - navarit dve veci behem dne je bezne.
//
// 2. ZAMEK, NE ODECET. Booking surovinu z inventare NEODECTE. Zustava
//    tam, jen se zobrazi jako zamcena, a odecte se az po "DOVAŘENO".
//    Duvod: uzivatel musi ve spizi videt, ze tam surovina fyzicky je -
//    jen je slibena ctvrtecnimu jidlu.
// ==========================================================================

const DNY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
const MESICE = ['ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];

/** Datum jako 'YYYY-MM-DD' v mistnim case (ne UTC - to posouva pres pulnoc). */
export function naDatum(d) {
  const rok = d.getFullYear();
  const mesic = String(d.getMonth() + 1).padStart(2, '0');
  const den = String(d.getDate()).padStart(2, '0');
  return rok + '-' + mesic + '-' + den;
}

export function dnes() {
  return naDatum(new Date());
}

export function zitra() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return naDatum(d);
}

/** Rozlozi 'YYYY-MM-DD' na cisla. Nepouziva Date, aby neresilo casova pasma. */
function rozloz(datum) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum || ''));
  if (!m) return null;
  return { rok: +m[1], mesic: +m[2], den: +m[3] };
}

export function jeDatum(datum) {
  const d = rozloz(datum);
  if (!d) return false;
  if (d.mesic < 1 || d.mesic > 12 || d.den < 1 || d.den > 31) return false;
  return true;
}

/** 'HH:MM' ve 24 hodinach. Prazdna hodnota znamena "na cely den". */
export function jeCas(cas) {
  if (cas == null || cas === '') return true;
  const m = /^(\d{2}):(\d{2})$/.exec(String(cas));
  return !!m && +m[1] < 24 && +m[2] < 60;
}

/** Lidsky zapis data: "ve čtvrtek 21. srpna". */
export function popisDatumu(datum, dnesniDatum) {
  const d = rozloz(datum);
  if (!d) return '';

  const dnesni = dnesniDatum || dnes();
  if (datum === dnesni) return 'dnes';

  const z = rozloz(dnesni);
  if (z) {
    const rozdil = Math.round(
      (Date.UTC(d.rok, d.mesic - 1, d.den) - Date.UTC(z.rok, z.mesic - 1, z.den)) / 86400000
    );
    if (rozdil === 1) return 'zítra';
    if (rozdil === 2) return 'pozítří';
    if (rozdil > 2 && rozdil < 7) {
      const den = new Date(Date.UTC(d.rok, d.mesic - 1, d.den)).getUTCDay();
      return 'v ' + DNY[den];
    }
  }
  return d.den + '. ' + MESICE[d.mesic - 1];
}

/** Popisek bookingu: "zítra v 18:30" nebo "zítra, celý den". */
export function popisBookingu(booking, dnesniDatum) {
  const kdy = popisDatumu(booking.cook_date, dnesniDatum);
  return booking.cook_time ? kdy + ' v ' + booking.cook_time : kdy + ', celý den';
}

/**
 * Konflikty (4.1).
 *
 * | kombinace              | chovani  |
 * |------------------------|----------|
 * | casovany x casovany    | ohlasit  |
 * | all-day x cokoliv      | povolit  |
 *
 * Vraci pole bookingu, se kterymi se novy termin bije. Prazdne = v poradku.
 */
export function konflikty(novy, existujici) {
  if (!novy || !novy.cook_time) return [];      // cely den se nebije nikdy
  return (existujici || []).filter(b =>
    b.cook_date === novy.cook_date &&
    b.cook_time === novy.cook_time &&
    b.state !== 'cancelled' &&
    b.id !== novy.id
  );
}

/** Hlaska ke konfliktu. */
export function popisKonfliktu(srazky) {
  if (!srazky || !srazky.length) return '';
  const prvni = srazky[0];
  return 'Na tenhle čas už máš naplánované jiné vaření (' +
    (prvni.recipe_title || prvni.recipe_slug) + '). Chceš ho i tak přidat?';
}

/**
 * Co booking zamkne ve spizi (4.2).
 *
 * Zamyka se jen to, co uzivatel doopravdy ma - u ceho nic nema, neni co
 * zamykat a objevi se to v nakupnim seznamu. Priblizne suroviny se
 * nezamykaji vubec: nevime, kolik jich je, takze by zamek nedaval smysl.
 *
 * @returns {Array<{inventory_id, ingredient, amount, unit}>}
 */
export function coZamknout(recept, spiz, sediFn) {
  const sedi = sediFn;
  const zamky = [];

  ((recept && recept.ingredients) || []).forEach(raw => {
    const polozka = (spiz || []).find(i =>
      i.kind !== 'approx' && !i.staple && sedi(i.name, raw)
    );
    if (!polozka) return;
    if (zamky.some(z => z.inventory_id === polozka.id)) return;   // jednou stači

    zamky.push({
      inventory_id: polozka.id,
      ingredient: polozka.name,
      // Kolik presne, appka z receptu spolehlive nespocita (jednotky se
      // nepotkavaji). Zamyka se tedy jedna jednotka - drzi to smysl
      // "tahle surovina je slibena" bez predstirane presnosti.
      amount: 1,
      unit: polozka.unit || null,
    });
  });

  return zamky;
}

/** Setridi bookingy: nejblizsi termin nahore, v ramci dne podle casu. */
export function serad(bookingy) {
  return [...(bookingy || [])].sort((a, b) => {
    if (a.cook_date !== b.cook_date) return a.cook_date < b.cook_date ? -1 : 1;
    const ca = a.cook_time || '99:99';
    const cb = b.cook_time || '99:99';
    return ca < cb ? -1 : (ca > cb ? 1 : 0);
  });
}

/** Bookingy, ktere jeste nejsou minulostí. */
export function nadchazejici(bookingy, dnesniDatum) {
  const den = dnesniDatum || dnes();
  return serad(bookingy).filter(b => b.state === 'planned' && b.cook_date >= den);
}
