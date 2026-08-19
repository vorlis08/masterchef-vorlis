import { pageCount, clampPage, pageItems, pageView } from './src/lib/pagination.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

const A = ['a','b','c','d','e','f','g'];

console.log('\n--- Pocet stran ---');
t('7 po 4 jsou dve strany', pageCount(7, 4), 2);
t('8 po 4 jsou dve strany', pageCount(8, 4), 2);
t('9 po 4 jsou tri strany', pageCount(9, 4), 3);
t('prazdny seznam ma porad jednu stranu', pageCount(0, 4), 1);

console.log('\n--- Srovnani cisla strany ---');
t('zaporne jde na prvni', clampPage(-3, 7, 4), 0);
t('prilis velke jde na posledni', clampPage(99, 7, 4), 1);
t('platne zustane', clampPage(1, 7, 4), 1);

console.log('\n--- Polozky na strane ---');
t('prvni strana', pageItems(A, 0, 4), ['a','b','c','d']);
t('posledni strana je kratsi', pageItems(A, 1, 4), ['e','f','g']);
t('strana za koncem vrati posledni', pageItems(A, 9, 4), ['e','f','g']);
t('prazdny seznam vrati nic', pageItems([], 0, 4), []);

console.log('\n--- Podklad pro stranu ---');
const p0 = pageView(A, 0, 4);
t('cislo strany', p0.page, 0);
t('pocet stran', p0.pages, 2);
t('je prvni', p0.first, true);
t('neni posledni', p0.last, false);
t('popisek', p0.label, '1 / 2');
t('polozky', p0.items, ['a','b','c','d']);

const p1 = pageView(A, 1, 4);
t('druha strana neni prvni', p1.first, false);
t('druha strana je posledni', p1.last, true);
t('popisek druhe', p1.label, '2 / 2');

const jedna = pageView(['a'], 0, 4);
t('jedina strana je prvni i posledni', [jedna.first, jedna.last], [true, true]);

const nic = pageView([], 0, 4);
t('prazdny podklad ma jednu stranu', nic.label, '1 / 1');
t('prazdny podklad nema polozky', nic.items, []);

t('nulovy pocet na stranu nespadne', pageView(A, 0, 0).items, ['a']);

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
