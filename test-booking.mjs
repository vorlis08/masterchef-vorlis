import {
  naDatum, jeDatum, jeCas, popisDatumu, popisBookingu,
  konflikty, popisKonfliktu, coZamknout, serad, nadchazejici, rychleTerminy, kPripomenuti,
} from './src/lib/booking.js';
import { sediSurovina, chybejici, pripravenost, podlePripravenosti } from './src/lib/match.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

console.log('\n--- Datum a cas ---');
t('datum se slozi', naDatum(new Date(2026, 7, 20)), '2026-08-20');
t('jednociferny den ma nulu', naDatum(new Date(2026, 0, 5)), '2026-01-05');
t('platne datum', jeDatum('2026-08-20'), true);
t('nesmysl neprojde', jeDatum('20.8.2026'), false);
t('prazdne neprojde', jeDatum(''), false);
t('platny cas', jeCas('18:30'), true);
t('prazdny cas = cely den', jeCas(''), true);
t('25 hodin neexistuje', jeCas('25:00'), false);
t('60 minut neexistuje', jeCas('18:60'), false);

console.log('\n--- Lidsky zapis ---');
const DNES = '2026-08-20';
t('dnes', popisDatumu('2026-08-20', DNES), 'dnes');
t('zitra', popisDatumu('2026-08-21', DNES), 'zítra');
t('pozitri', popisDatumu('2026-08-22', DNES), 'pozítří');
t('do tydne dnem', popisDatumu('2026-08-24', DNES), 'v pondělí');
t('dal uz datem', popisDatumu('2026-09-15', DNES), '15. září');
t('booking s casem', popisBookingu({ cook_date: '2026-08-21', cook_time: '18:30' }, DNES), 'zítra v 18:30');
t('booking na cely den', popisBookingu({ cook_date: '2026-08-21', cook_time: null }, DNES), 'zítra, celý den');

console.log('\n--- Konflikty (4.1) ---');
const STAVAJICI = [
  { id: 1, cook_date: '2026-08-21', cook_time: '18:30', state: 'planned', recipe_slug: 'gulas', recipe_title: 'Guláš' },
  { id: 2, cook_date: '2026-08-21', cook_time: null, state: 'planned', recipe_slug: 'chleba' },
  { id: 3, cook_date: '2026-08-22', cook_time: '18:30', state: 'planned', recipe_slug: 'kure' },
  { id: 4, cook_date: '2026-08-21', cook_time: '18:30', state: 'cancelled', recipe_slug: 'zruseny' },
];

t('casovany x casovany se ohlasi',
  konflikty({ cook_date: '2026-08-21', cook_time: '18:30' }, STAVAJICI).map(b => b.id), [1]);
t('jiny cas tyz den je v poradku',
  konflikty({ cook_date: '2026-08-21', cook_time: '20:00' }, STAVAJICI), []);
t('jiny den je v poradku',
  konflikty({ cook_date: '2026-08-23', cook_time: '18:30' }, STAVAJICI), []);
t('cely den se nebije nikdy',
  konflikty({ cook_date: '2026-08-21', cook_time: null }, STAVAJICI), []);
t('zruseny booking nekoliduje',
  konflikty({ cook_date: '2026-08-21', cook_time: '18:30' }, STAVAJICI).some(b => b.id === 4), false);
t('uprava sebe sama nekoliduje',
  konflikty({ id: 1, cook_date: '2026-08-21', cook_time: '18:30' }, STAVAJICI), []);
t('hlaska jmenuje recept',
  popisKonfliktu(konflikty({ cook_date: '2026-08-21', cook_time: '18:30' }, STAVAJICI)).includes('Guláš'), true);
t('bez konfliktu je hlaska prazdna', popisKonfliktu([]), '');

console.log('\n--- Co booking zamkne (4.2) ---');
const RECEPT = { ingredients: ['500 g kuřecího masa', '250 ml smetany', 'sůl', '2 cibule'] };
const SPIZ = [
  { id: 10, name: 'kuřecí maso', kind: 'exact', quantity: 800, unit: 'g' },
  { id: 11, name: 'smetana', kind: 'exact', quantity: 500, unit: 'ml' },
  { id: 12, name: 'sůl', kind: 'approx', status: 'mam' },
  { id: 13, name: 'cibule', kind: 'count', quantity: 3, unit: 'ks', staple: 1 },
];
const zamky = coZamknout(RECEPT, SPIZ, sediSurovina);
t('zamkne maso a smetanu', zamky.map(z => z.inventory_id).sort(), [10, 11]);
t('priblizna surovina se nezamyka', zamky.some(z => z.inventory_id === 12), false);
t('"mam doma standardne" se nezamyka', zamky.some(z => z.inventory_id === 13), false);
t('nese jednotku', zamky.find(z => z.inventory_id === 11).unit, 'ml');
t('co nemam, neni co zamykat', coZamknout(RECEPT, [], sediSurovina), []);
t('recept bez surovin', coZamknout({}, SPIZ, sediSurovina), []);

console.log('\n--- Zamek NEODECITA, jen ubira volne (4.2) ---');
const PO_ZAMKU = [
  { name: 'smetana', kind: 'exact', quantity: 500, reserved: 500 },
  { name: 'kuřecí maso', kind: 'exact', quantity: 800, reserved: 0 },
];
t('smetana je porad ve spizi', PO_ZAMKU[0].quantity, 500);
t('ale zamcena uz se nepocita', chybejici({ ingredients: ['250 ml smetany'] }, PO_ZAMKU).pocet, 1);

console.log('\n--- Pripravenost je skala, ne filtr (4.3) ---');
const PLNA = [
  { name: 'kuřecí maso', kind: 'exact', quantity: 800 },
  { name: 'smetana', kind: 'exact', quantity: 500 },
  { name: 'sůl', kind: 'approx', status: 'mam' },
  { name: 'cibule', kind: 'count', quantity: 3 },
];
t('nechybi nic', pripravenost(RECEPT, PLNA).stav, 'vse');
t('a rekne to', pripravenost(RECEPT, PLNA).popisek, 'Máš všechny suroviny');

const skoro = pripravenost(RECEPT, PLNA.slice(0, 3));
t('chybi jedna vec = skoro', skoro.stav, 'skoro');
t('popisek jednotne', skoro.popisek, 'Chybí 1 surovina');
t('popisek vzdycky rekne, CO chybi', pripravenost(RECEPT, PLNA).popisek.includes('surovin'), true);
t('rekne i co chybi', skoro.chybiCo, ['cibule']);

t('chybi dve = porad skoro', pripravenost(RECEPT, PLNA.slice(0, 2)).stav, 'skoro');
t('chybi tri = daleko', pripravenost(RECEPT, PLNA.slice(0, 1)).stav, 'daleko');
t('prazdna spiz neni "daleko", ale "nevim"', pripravenost(RECEPT, []).stav, 'nevim');
t('a nic netvrdi', pripravenost(RECEPT, []).popisek, '');
t('recept bez surovin nesoudime', pripravenost({ ingredients: [] }, PLNA).stav, 'nevim');

console.log('\n--- Razeni podle pripravenosti ---');
const R1 = { slug: 'a', ingredients: ['250 ml smetany'] };
const R2 = { slug: 'b', ingredients: ['250 ml smetany', 'kuřecí maso', 'rajčata', 'bazalka'] };
const R3 = { slug: 'c', ingredients: ['kuřecí maso'] };
t('nejlepe uvaritelne nahore',
  podlePripravenosti([R2, R1, R3], PLNA).map(r => r.slug), ['a', 'c', 'b']);
t('prazdny seznam nespadne', podlePripravenosti([], PLNA), []);

console.log('\n--- Razeni a vyber bookingu ---');
// 1 a 4 maji tyz den i cas, 2 je celodenni (az za nimi), 3 je dalsi den
t('nejblizsi nahore', serad(STAVAJICI).map(b => b.id), [1, 4, 2, 3]);
t('cely den az za casovanymi tyz den',
  serad([{ cook_date: '2026-08-21', cook_time: null, id: 'A' },
         { cook_date: '2026-08-21', cook_time: '09:00', id: 'B' }]).map(b => b.id), ['B', 'A']);
t('minule se nezobrazuji',
  nadchazejici(STAVAJICI, '2026-08-22').map(b => b.id), [3]);
t('zrusene se nezobrazuji',
  nadchazejici(STAVAJICI, '2026-08-20').some(b => b.id === 4), false);

console.log('\n--- Rychle terminy ---');
// 20. 8. 2026 je ctvrtek.
const rt = (s) => rychleTerminy(new Date(s));
t('rano nabizi dnes vecer', rt('2026-08-20T09:00').map(o => o.id),
  ['dnes-vecer', 'zitra', 'vikend']);
t('dnes vecer je na 18:00', rt('2026-08-20T09:00')[0].cas, '18:00');
t('po pul pate uz je "za hodinu"', rt('2026-08-20T17:10')[0].id, 'za-hodinu');
t('za hodinu se zaokrouhli na pulhodinu', rt('2026-08-20T17:10')[0].cas, '18:30');
t('cela hodina se neposouva', rt('2026-08-20T17:00')[0].cas, '18:00');
t('pozde vecer uz dnesek nenabizi', rt('2026-08-20T23:00').map(o => o.id),
  ['zitra', 'vikend']);
t('sobota se nenabizi dvakrat, kdyz je to zitra',
  rt('2026-08-21T10:00').map(o => o.id), ['dnes-vecer', 'zitra']);
t('v sobotu ukazuje az tu pristi', rt('2026-08-22T10:00')[2].datum, '2026-08-29');
t('vikend je na poledne', rt('2026-08-20T09:00')[2].cas, '12:00');
t('zitrek je opravdu zitra', rt('2026-08-31T09:00')[1].datum, '2026-09-01');

console.log('\n--- Pripominky na telefon ---');
// 18:00 ceskeho casu = 16:00 UTC.
const PB = [
  { id: 1, state: 'planned', cook_date: '2026-08-20', cook_time: '18:00' },
  { id: 2, state: 'planned', cook_date: '2026-08-20', cook_time: null },
  { id: 3, state: 'planned', cook_date: '2026-08-20', cook_time: '18:00', push_sent: '2026-08-20T15:00' },
  { id: 4, state: 'planned', cook_date: '2026-08-21', cook_time: '18:00' },
  { id: 5, state: 'cancelled', cook_date: '2026-08-20', cook_time: '18:00' },
];
const kp = (t, p) => kPripomenuti(PB, new Date(t), p).map(b => b.id);
t('hodinu pred varenim', kp('2026-08-20T15:00:00Z', 60), [1]);
t('dve hodiny pred jeste ne', kp('2026-08-20T14:00:00Z', 60), []);
t('s dvouhodinovym predstihem uz ano', kp('2026-08-20T14:00:00Z', 120), [1]);
t('v case vareni uz se nepripomina', kp('2026-08-20T16:00:00Z', 60), []);
t('po case vareni uz vubec', kp('2026-08-20T17:00:00Z', 60), []);
t('pul hodiny pred se jeste chyti', kp('2026-08-20T15:30:00Z', 60), [1]);
t('celodenni se nepripomina', kp('2026-08-20T15:00:00Z', 60).includes(2), false);
t('uz odeslane se neopakuje', kp('2026-08-20T15:00:00Z', 60).includes(3), false);
t('zrusene se nepripomina', kp('2026-08-20T15:00:00Z', 60).includes(5), false);
t('zitrejsi vareni jeste ne', kp('2026-08-20T15:00:00Z', 60).includes(4), false);
t('zitrejsi den hodinu pred', kp('2026-08-21T15:00:00Z', 60), [4]);
t('nesmyslny predstih spadne na hodinu', kp('2026-08-20T15:00:00Z', 0), [1]);
t('prazdny seznam nespadne', kPripomenuti([], new Date(), 60), []);

// V zime je posun 1 h, ne 2. Vareni v 18:00 ceskeho casu je tedy v 17:00
// UTC - drive se s pevnym "+2" pripominalo o hodinu driv.
const PZ = [{ id: 9, state: 'planned', cook_date: '2026-12-20', cook_time: '18:00' }];
t('zima: hodinu pred varenim',
  kPripomenuti(PZ, new Date('2026-12-20T16:00:00Z'), 60).map(b => b.id), [9]);
t('zima: dve hodiny pred jeste ne',
  kPripomenuti(PZ, new Date('2026-12-20T15:00:00Z'), 60).map(b => b.id), []);
t('zima: v case vareni uz ne',
  kPripomenuti(PZ, new Date('2026-12-20T17:00:00Z'), 60).map(b => b.id), []);
t('vnuceny posun porad funguje',
  kPripomenuti(PZ, new Date('2026-12-20T15:00:00Z'), 60, 2).map(b => b.id), [9]);

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
