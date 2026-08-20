import {
  DNY_ZKRATKY, MESICE, nazevMesice, posunMesic, dniVMesici,
  bookingyDne, mesicniMrizka, pocetVMesici, nejblizsiDen,
} from './src/lib/kalendar.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

console.log('\n--- Zaklad ---');
t('tyden zacina pondelim', DNY_ZKRATKY[0], 'Po');
t('a konci nedeli', DNY_ZKRATKY[6], 'Ne');
t('dvanact mesicu', MESICE.length, 12);
t('nazev mesice', nazevMesice(2026, 8), 'srpen 2026');

console.log('\n--- Posun mesice ---');
t('dopredu', posunMesic(2026, 8, 1), { rok: 2026, mesic: 9 });
t('zpatky', posunMesic(2026, 8, -1), { rok: 2026, mesic: 7 });
t('pres novy rok dopredu', posunMesic(2026, 12, 1), { rok: 2027, mesic: 1 });
t('pres novy rok zpatky', posunMesic(2026, 1, -1), { rok: 2025, mesic: 12 });
t('o vic mesicu', posunMesic(2026, 8, 5), { rok: 2027, mesic: 1 });

console.log('\n--- Delka mesice ---');
t('srpen ma 31', dniVMesici(2026, 8), 31);
t('unor 2026 ma 28', dniVMesici(2026, 2), 28);
t('unor 2028 ma 29 (prestupny)', dniVMesici(2028, 2), 29);
t('duben ma 30', dniVMesici(2026, 4), 30);

console.log('\n--- Mrizka ---');
const BOOKINGY = [
  { id: 1, cook_date: '2026-08-20', cook_time: '18:30', state: 'planned', recipe_slug: 'kure' },
  { id: 2, cook_date: '2026-08-20', cook_time: null,    state: 'planned', recipe_slug: 'chleba' },
  { id: 3, cook_date: '2026-08-25', cook_time: '12:00', state: 'planned', recipe_slug: 'gulas' },
  { id: 4, cook_date: '2026-08-20', cook_time: '09:00', state: 'cancelled', recipe_slug: 'zruseny' },
  { id: 5, cook_date: '2026-09-02', cook_time: '18:00', state: 'planned', recipe_slug: 'pasta' },
];

const m = mesicniMrizka(2026, 8, BOOKINGY, '2026-08-20');
t('nazev', m.nazev, 'srpen 2026');
t('kazdy tyden ma sedm dni', m.tydny.every(t7 => t7.length === 7), true);
t('prvni bunka je pondeli', m.tydny[0][0].datum, '2026-07-27');
t('srpen 2026 zacina v sobotu', m.tydny[0][5].datum, '2026-08-01');
t('dobeh z cervence je oznacen', m.tydny[0][0].jinyMesic, true);
t('prvni srpnovy den neni z jineho mesice', m.tydny[0][5].jinyMesic, false);

const vsechny = m.tydny.flat();
t('mrizka obsahuje cely mesic', vsechny.filter(d => !d.jinyMesic).length, 31);

const dvacatyDen = vsechny.find(d => d.datum === '2026-08-20');
t('dnesek je oznacen', dvacatyDen.dnes, true);
t('dva bookingy na dnesek', dvacatyDen.bookingy.length, 2);
t('casovany je pred celodennim', dvacatyDen.bookingy.map(b => b.id), [1, 2]);
t('zruseny se nezobrazi', dvacatyDen.bookingy.some(b => b.id === 4), false);

const minuly = vsechny.find(d => d.datum === '2026-08-10');
t('minulost je oznacena', minuly.minulost, true);
t('dnesek uz neni minulost', dvacatyDen.minulost, false);

t('booking z jineho mesice se do srpna nepocita', pocetVMesici(m), 3);

console.log('\n--- Mesic, ktery zacina v pondeli ---');
const cerven = mesicniMrizka(2026, 6, [], '2026-06-15');
t('zacina rovnou prvnim', cerven.tydny[0][0].datum, '2026-06-01');
t('zadny dobeh na zacatku', cerven.tydny[0][0].jinyMesic, false);

console.log('\n--- Mesic, ktery zacina v nedeli ---');
const listopad = mesicniMrizka(2026, 11, [], '2026-11-15');
t('prvni radek zacina 26. rijna', listopad.tydny[0][0].datum, '2026-10-26');
t('vsechny dny listopadu se vejdou',
  listopad.tydny.flat().filter(d => !d.jinyMesic).length, 30);

console.log('\n--- Prazdny tyden navic se zahodi ---');
t('unor 2027 nema prebytecny radek', mesicniMrizka(2027, 2, [], '2027-02-10').tydny.length <= 6, true);
t('kazdy mesic ma aspon 4 tydny', mesicniMrizka(2026, 2, [], '2026-02-10').tydny.length >= 4, true);

console.log('\n--- Bookingy dne ---');
t('najde podle data', bookingyDne(BOOKINGY, '2026-08-25').map(b => b.id), [3]);
t('prazdny den', bookingyDne(BOOKINGY, '2026-08-11'), []);
t('bez bookingu nespadne', bookingyDne(null, '2026-08-11'), []);

console.log('\n--- Nejblizsi naplanovany den ---');
t('od dneska dal', nejblizsiDen(BOOKINGY, '2026-08-21'), '2026-08-25');
t('dnesek se pocita', nejblizsiDen(BOOKINGY, '2026-08-20'), '2026-08-20');
t('kdyz nic neni, vrati null', nejblizsiDen(BOOKINGY, '2026-12-01'), null);
t('prazdny vstup', nejblizsiDen([], '2026-08-20'), null);

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
