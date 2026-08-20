import {
  cleanName, guessKind, needsQuantity, freeQuantity, starterList,
  pantryView, statusLabel, STATUSES, isCountable, defaultUnit,
  krokMnozstvi, posunMnozstvi
} from './src/lib/pantry.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

console.log('\n--- Ocisteni nazvu suroviny ---');
t('odstrani mnozstvi', cleanName('500 g kuřecího masa'), 'kuřecího masa');
t('odstrani jednotku', cleanName('250 ml smetany'), 'smetany');
t('odstrani zavorku', cleanName('2 cibule (velké)'), 'cibule');
t('odstrani poznamku za pomlckou', cleanName('smetana – nejlépe 33%'), 'smetana');
t('bez mnozstvi necha byt', cleanName('sůl'), 'sůl');
t('prevede na mala pismena', cleanName('Sůl'), 'sůl');

console.log('\n--- Presne vs priblizne (4.4) ---');
t('sul je priblizna', guessKind('sůl'), 'approx');
t('olej je priblizny', guessKind('slunečnicový olej'), 'approx');
t('koreni je priblizne', guessKind('koření na gulyáš'), 'approx');
t('pepr je priblizny', guessKind('pepř'), 'approx');
t('maso se vazi', guessKind('kuřecí prsa'), 'exact');
t('smetana se vazi', guessKind('smetana'), 'exact');
t('testoviny se vazi', guessKind('tagliatelle'), 'exact');
t('neznama surovina se radeji vazi', guessKind('křupavá věc'), 'exact');

console.log('\n--- Pole na mnozstvi se u priblizne suroviny neukaze ---');
t('u presne ano', needsQuantity({ kind: 'exact' }), true);
t('u priblizne ne', needsQuantity({ kind: 'approx' }), false);

console.log('\n--- Rezervace zamyka, neodecita (4.2) ---');
const smetana = { kind: 'exact', quantity: 500 };
t('bez rezervace je volne vse', freeQuantity(smetana, 0), 500);
t('rezervace ubere z volneho', freeQuantity(smetana, 200), 300);
t('vetsi rezervace nejde do zaporu', freeQuantity(smetana, 900), 0);
t('u priblizne se nepocita', freeQuantity({ kind: 'approx' }, 5), null);

console.log('\n--- Startovni seznam z receptu (4.9) ---');
const RECEPTY = [
  { ingredients: ['500 g kuřecího masa', '250 ml smetany', 'sůl', 'pepř'] },
  { ingredients: ['250 ml smetany', '2 cibule', 'sůl'] },
  { ingredients: ['sůl', 'sůl'] },
];
const seznam = starterList(RECEPTY);
t('nejcastejsi je prvni', seznam[0].name, 'sůl');
t('a spocita se spravne', seznam[0].count, 3);
t('v jednom receptu se pocita jednou', seznam.find(x => x.name === 'sůl').count, 3);
t('smetana je druha', seznam[1].name, 'smetany');
t('sul je oznacena jako priblizna', seznam[0].kind, 'approx');
t('maso je oznacene jako presne', seznam.find(x => x.name === 'kuřecího masa').kind, 'exact');
t('kazda surovina jen jednou', seznam.length, new Set(seznam.map(x => x.name)).size);
t('poradi je vyplnene', seznam[0].sort_order, 0);
t('prazdny vstup nespadne', starterList([]), []);
t('recept bez ingredienci nespadne', starterList([{}]), []);

console.log('\n--- Krok pri tuknuti na plus/minus ---');
const kus = (u, k) => ({ kind: k || 'exact', unit: u, quantity: 0 });
t('maso v gramech po 100', krokMnozstvi(kus('g')), 100);
t('brambory v kilech po pul', krokMnozstvi(kus('kg')), 0.5);
t('smetana v ml po 50', krokMnozstvi(kus('ml')), 50);
t('mleko v litrech po pul', krokMnozstvi(kus('l')), 0.5);
t('kusy po jednom', krokMnozstvi(kus('ks')), 1);
t('baleni po jednom', krokMnozstvi(kus('balení')), 1);
t('pocitana surovina po jednom', krokMnozstvi(kus(null, 'count')), 1);
t('neznama jednotka po jednom', krokMnozstvi(kus('křáplo')), 1);

t('plus prida krok', posunMnozstvi({ kind: 'exact', unit: 'g', quantity: 200 }, 1), 300);
t('minus ubere krok', posunMnozstvi({ kind: 'exact', unit: 'g', quantity: 200 }, -1), 100);
t('do zaporu to nejde', posunMnozstvi({ kind: 'exact', unit: 'g', quantity: 50 }, -1), 0);
t('prazdne mnozstvi zacina od nuly', posunMnozstvi({ kind: 'exact', unit: 'g' }, 1), 100);
t('pulky kil nedelaji desetinne smeti',
  posunMnozstvi({ kind: 'exact', unit: 'kg', quantity: 1 }, 1), 1.5);
t('a ani po vice krocich',
  posunMnozstvi({ kind: 'exact', unit: 'kg', quantity: 1.5 }, 1), 2);

console.log('\n--- Podklad pro vykresleni ---');
const pohled = pantryView([
  { id: 1, name: 'smetana', kind: 'exact', quantity: 500, unit: 'ml', staple: 0 },
  { id: 2, name: 'sůl', kind: 'approx', status: 'dochazi', staple: 1 },
]);
t('presna ma mnozstvi', pohled[0].showQuantity, true);
t('presna nese jednotku', pohled[0].unit, 'ml');
t('presna nema stav', pohled[0].status, null);
t('priblizna nema mnozstvi', pohled[1].showQuantity, false);
const sDetailem = pantryView([{ id: 2, name: 'sůl', kind: 'approx', status: 'dochazi' }], true);
t('se zapnutym detailem ma i priblizna mnozstvi', sDetailem[0].showQuantity, true);
const pocitane = pantryView([{ id: 3, name: 'vejce', kind: 'count', quantity: 6 }]);
t('pocitana je oznacena', pocitane[0].countable, true);
t('pocitana ma jednotku ks', pocitane[0].unit, 'ks');
t('pocitana nese pocet', pocitane[0].quantity, 6);
t('priblizna nese stav', pohled[1].status, 'dochazi');
t('priblizna ma popisek stavu', pohled[1].statusLabel, 'Dochází');
t('staple se prenese', pohled[1].staple, true);

console.log('\n--- Popisky stavu ---');
t('mam', statusLabel('mam'), 'Mám');
t('dochazi', statusLabel('dochazi'), 'Dochází');
t('doslo se rika Nemam', statusLabel('doslo'), 'Nemám');
t('neznamy stav = Nemam', statusLabel('necoJineho'), 'Nemám');
t('tri moznosti', STATUSES.length, 3);

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
