import {
  cardView, rowView, gridView, orderNumber, servingsLabel, initialOf
} from './src/lib/recipe-view.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

const KURE = {
  slug: 'kure', title: 'Kuře na paprice', category: 'Maso', difficulty: 'Střední',
  time: '1 hod 15 min', servings: 4, image: '/kure.webp', blur: 'data:blur',
};
const HOLY = { slug: 'holy', title: 'Holý recept' };

console.log('\n--- Drobne prevody ---');
t('poradi doplni nulu', orderNumber(3), '03');
t('poradi dvouciferne', orderNumber(12), '12');
t('porce', servingsLabel(4), '4 porcí');
t('porce kdyz chybi', servingsLabel(undefined), '? porcí');
t('prvni pismeno', initialOf('Kuře'), 'K');
t('prvni pismeno kdyz chybi nazev', initialOf(''), '?');

console.log('\n--- Dlazdice ---');
const c = cardView(KURE, { favorite: true, rating: 4 });
t('slug', c.slug, 'kure');
t('nazev', c.title, 'Kuře na paprice');
t('kategorie', c.category, 'Maso');
t('cas', c.time, '1 hod 15 min');
t('porce', c.servingsLabel, '4 porcí');
t('hvezdicky', c.stars, 4);
t('oblibene', c.favorite, true);
t('obrazek', c.image, '/kure.webp');

const cHoly = cardView(HOLY);
t('bez udaju nespadne', cHoly.title, 'Holý recept');
t('prazdna kategorie', cHoly.category, '');
t('nahradni pismeno', cHoly.initial, 'H');
t('bez hodnoceni je nula', cHoly.stars, 0);
t('bez oblibenosti je false', cHoly.favorite, false);

console.log('\n--- Radek v seznamu ---');
const r = rowView(KURE, { favorite: false, rating: 0, number: 7 });
t('poradove cislo', r.number, '07');
t('podnadpis sklada tri udaje', r.subtitle, 'Maso · Střední · 4 porcí');
t('cas', r.time, '1 hod 15 min');

const rHoly = rowView(HOLY, { number: 1 });
t('podnadpis jen s porcemi', rHoly.subtitle, '? porcí');

console.log('\n--- Cely seznam ---');
const g = gridView([KURE, HOLY], {
  mode: 'grid',
  isFavorite: s => s === 'kure',
  ratingOf: s => (s === 'kure' ? 5 : 0),
});
t('rezim dlazdic', g.mode, 'grid');
t('pocet', g.count, 2);
t('neni prazdny', g.empty, false);
t('prvni je oblibeny', g.items[0].favorite, true);
t('prvni ma hvezdicky', g.items[0].stars, 5);
t('druhy neni oblibeny', g.items[1].favorite, false);
t('dlazdice nemaji poradi', g.items[0].number, undefined);

const gl = gridView([KURE, HOLY], { mode: 'list' });
t('rezim seznamu', gl.mode, 'list');
t('radky maji poradi od jedne', gl.items[0].number, '01');
t('druhy radek', gl.items[1].number, '02');
t('radky maji podnadpis', gl.items[1].subtitle, '? porcí');

const prazdny = gridView([], { mode: 'grid' });
t('prazdny seznam se pozna', prazdny.empty, true);
t('prazdny seznam ma nula polozek', prazdny.count, 0);

t('neznamy rezim spadne na dlazdice', gridView([KURE], { mode: 'necoJineho' }).mode, 'grid');

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
