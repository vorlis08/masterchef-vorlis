// ==========================================================================
// recipe-logic.js  --  cast "mozku"
//
// Ciste funkce: pocitaji, prevadeji, hledaji. Nesahaji na stranku ani na
// ulozena data. Diky tomu je lze pouzit z jakehokoli vzhledu (skinu) a lze
// je samostatne testovat.
// ==========================================================================

export const QTY_UNITS = ['g', 'kg', 'mg', 'ml', 'l', 'dl', 'cl', 'ks', 'kus', 'kusy', 'kusů', 'lžíce', 'lžíci', 'lžic', 'lžička', 'lžičky', 'lžiček', 'stroužek', 'stroužky', 'stroužku', 'stroužků', 'balení', 'plátek', 'plátky', 'plátků', 'špetka', 'špetky', 'hrst', 'hrsti', 'šálek', 'šálky', 'sklenice', 'sklenici', 'porce', 'porcí', 'konzerva', 'konzervy', 'kelímek', 'kelímky', 'svazek', 'snítka', 'snítky', 'větvička', 'list', 'listy', 'listů'];

/** Odstrani diakritiku a prevede na mala pismena - pro vyhledavani. */
export function fold(str) {
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Stejne jako fold, jen jinde pouzivane jmeno. */
export function normalizeWord(w) {
  return String(w).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Prevede nazev na tvar vhodny do adresy (napr. "Kuře na paprice" -> "kure-na-paprice"). */
export function slugify(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Z textu jako "1 hod 30 min" udela pocet minut. Vrati null, kdyz nic nenajde. */
export function parseMinutes(t) {
  if (!t) return null;
  const h = t.match(/(\d+)\s*hod/);
  const m = t.match(/(\d+)\s*min/);
  return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0) || null;
}

/** Osetri znaky, ktere by rozbily HTML. */
export function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Zaokrouhli na dve desetinna mista a pouzije desetinnou carku. */
export function formatNum(n) {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded).replace('.', ',');
}

/** Rozdeli surovinu na mnozstvi a nazev: "200 g mouky" -> { qty: "200 g", name: "mouky" }. */
export function splitQty(text) {
  const m = String(text).match(/^(\d+(?:[.,]\d+)?(?:\s*[–\/-]\s*\d+(?:[.,]\d+)?)?)\s*(\S+)?\s*(.*)$/);
  if (!m) return { qty: '', name: text };
  let qty = m[1];
  let rest = ((m[2] || '') + ' ' + (m[3] || '')).trim();
  const w = (m[2] || '').replace(/[.,:]$/, '').toLowerCase();
  if (QTY_UNITS.indexOf(w) !== -1) { qty += ' ' + m[2]; rest = (m[3] || '').trim(); }
  if (!rest) return { qty: '', name: text };
  return { qty: qty, name: rest };
}

/** Prepocita vsechna cisla v textu suroviny podle poctu porci. */
export function scaleIngredient(text, factor) {
  if (factor === 1) return text;
  return String(text).replace(/(\d+(?:[.,]\d+)?)(\s*[–-]\s*)(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)/g, (m, a, dash, b, single) => {
    if (a !== undefined) {
      const na = parseFloat(a.replace(',', '.')) * factor;
      const nb = parseFloat(b.replace(',', '.')) * factor;
      return formatNum(na) + dash + formatNum(nb);
    }
    return formatNum(parseFloat(single.replace(',', '.')) * factor);
  });
}

/** Rimske cislice pro fancy rezim. */
export function roman(n) {
  const v = [50, 40, 10, 9, 5, 4, 1];
  const sym = ['L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let out = '';
  for (let i = 0; i < v.length; i++) {
    while (n >= v[i]) { out += sym[i]; n -= v[i]; }
  }
  return out || '\u2014';
}

/** Slepi vsechen text receptu do jednoho retezce pro fulltextove hledani. */
export function haystack(r) {
  return fold([
    r.title, r.description, r.category,
    (r.tags || []).join(' '),
    (r.meal_type || []).join(' '),
    (r.ingredients || []).join(' '),
    (r.ingredients_fancy || []).join(' ')
  ].filter(Boolean).join(' '));
}

/** Najde v textu kroku casove udaje a prevede je na sekundy (max 3). */
export function parseDurations(text) {
  const out = [];
  const re = /(\d+)(?:\s*[\u2013\u2014-]\s*(\d+))?\s*(hodin\w*|hod\.?|minut\w*|min\.?|sekund\w*|vteřin\w*|sek\.?)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const hi = parseInt(m[2] || m[1], 10);
    const u = m[3].toLowerCase();
    let secs;
    if (u.indexOf('hod') === 0) secs = hi * 3600;
    else if (u.indexOf('sek') === 0 || u.indexOf('vte') === 0) secs = hi;
    else secs = hi * 60;
    if (!secs || secs < 5 || secs > 6 * 3600) continue;
    if (out.some(o => o.secs === secs)) continue;
    out.push({ secs: secs, label: m[0].trim() });
  }
  return out.slice(0, 3);
}

/** Sekundy na tvar 12:34 nebo 1:02:03. */
export function fmtClock(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  return m + ':' + String(sec).padStart(2, '0');
}

/** Rozdeli text, ktery uzivatel napsal, na jednotlive suroviny. */
export function parseIngredients(text) {
  return String(text).toLowerCase().split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
}

/** Zjisti, jestli uzivatel ma surovinu, kterou recept potrebuje. */
export function ingredientMatch(userIngredients, recipeIngredient) {
  const ri = normalizeWord(recipeIngredient);
  return userIngredients.some(ui => {
    const nu = normalizeWord(ui);
    return ri.includes(nu) || nu.includes(ri);
  });
}
