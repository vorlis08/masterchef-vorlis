import { CATALOG, GROUPS, FROM_RECIPES, buildChecklist, checklistProgress } from './src/lib/catalog.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

const RECEPTY = [
  { ingredients: ['500 g kuřecích prsou', '250 ml smetany na vaření', 'sůl', '2 lžíce sriracha omáčky'] },
];

const najdi = (groups, name) => {
  for (const g of groups) for (const it of g.items) if (it.name === name) return it;
  return null;
};

console.log('\n--- Katalog sam o sobe ---');
t('katalog neni prazdny', CATALOG.length > 50, true);
t('kazda polozka ma nazev', CATALOG.every(x => !!x.name), true);
t('kazda polozka ma skupinu z GROUPS', CATALOG.every(x => GROUPS.includes(x.group)), true);
t('kazda polozka ma kind', CATALOG.every(x => x.kind === 'exact' || x.kind === 'approx'), true);
t('zadne duplicity', CATALOG.length, new Set(CATALOG.map(x => x.name)).size);

console.log('\n--- Mouka se nevazi, maso ano (4.4) ---');
t('mouka hladka je priblizna', CATALOG.find(x => x.name === 'mouka hladká').kind, 'approx');
t('sul je priblizna', CATALOG.find(x => x.name === 'sůl').kind, 'approx');
t('olej je priblizny', CATALOG.find(x => x.name === 'olivový olej').kind, 'approx');
t('kureci prsa se vazi', CATALOG.find(x => x.name === 'kuřecí prsa').kind, 'exact');
t('smetana se vazi', CATALOG.find(x => x.name === 'smetana na vaření').kind, 'exact');

console.log('\n--- Poradi podle kuchyne, ne podle abecedy (4.9) ---');
const prazdny = buildChecklist([], []);
t('prvni skupina je spiz', prazdny[0].group, 'Spíž — základ');
t('koreni je pred lednici',
  prazdny.findIndex(g => g.group === 'Koření a dochucovadla') < prazdny.findIndex(g => g.group === 'Lednice'), true);
t('neni serazeno abecedne', prazdny[0].items[0].name === [...prazdny[0].items].map(i => i.name).sort()[0], false);

console.log('\n--- Doplneni ze surovin v receptech ---');
const sReceptem = buildChecklist(RECEPTY, []);
const sriracha = najdi(sReceptem, 'sriracha omáčky');
t('neznama surovina se doplni', !!sriracha, true);
t('a je ve vlastni skupine', sriracha.group, FROM_RECIPES);
t('surovina uz v katalogu se nezdvoji',
  sReceptem.flatMap(g => g.items).filter(x => x.name === 'sůl').length, 1);

console.log('\n--- Co uz uzivatel ve spizi ma ---');
const SPIZ = [
  { id: 7, name: 'sůl', kind: 'approx', status: 'dochazi', staple: 1 },
  { id: 8, name: 'smetana na vaření', kind: 'exact', quantity: 500, unit: 'ml', staple: 0 },
  { id: 9, name: 'domácí sirup', kind: 'exact', quantity: 1, unit: 'l', staple: 0 },
];
const sSpizi = buildChecklist(RECEPTY, SPIZ);

const sul = najdi(sSpizi, 'sůl');
t('polozka ze spize je oznacena', sul.inPantry, true);
t('nese svoje id', sul.id, 7);
t('nese svuj stav', sul.status, 'dochazi');
t('nese staple', sul.staple, true);

const smetana = najdi(sSpizi, 'smetana na vaření');
t('presna nese mnozstvi', smetana.quantity, 500);
t('presna nese jednotku', smetana.unit, 'ml');

const sirup = najdi(sSpizi, 'domácí sirup');
t('vlastni polozka se neztrati', !!sirup, true);
t('a ma vlastni skupinu', sirup.group, 'Moje vlastní');

const nedotcena = najdi(sSpizi, 'brambory');
t('nedotcena polozka neni ve spizi', nedotcena.inPantry, false);
t('a nema id', nedotcena.id, null);
t('a nema mnozstvi', nedotcena.quantity, '');

console.log('\n--- Nastaveni uzivatele prebiji katalog ---');
const PREPNUTA = [{ id: 5, name: 'mouka hladká', kind: 'exact', quantity: 1000, unit: 'g' }];
const prepnuty = buildChecklist([], PREPNUTA);
t('kdyz si uzivatel mouku prepnul na vazeni, zustane', najdi(prepnuty, 'mouka hladká').kind, 'exact');

console.log('\n--- Postup ---');
const postup = checklistProgress(sSpizi);
t('spocita vyplnene', postup.filled, 3);
t('spocita celkem', postup.total > 50, true);
t('popisek', postup.label, postup.filled + ' z ' + postup.total);
t('prazdny vstup nespadne', checklistProgress([]).total, 0);

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
