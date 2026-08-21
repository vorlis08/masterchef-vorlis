// Test skladani udalosti pro Google kalendar.
//
// Pointa: chyba tady se neprojevi vyjimkou, ale tim, ze uzivateli
// vareni v kalendari sedi o hodinu vedle nebo celodenni udalost neni
// vubec videt. Obojí zjistis az kdyz ti ujede.

import { udalostZBookingu, minutyZReceptu, PASMO } from './worker/src/gcal.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

console.log('\n--- Delka vareni ---');
t('z "35 min" je 35', minutyZReceptu('35 min'), 35);
t('z "1 h 20 min" bere prvni cislo', minutyZReceptu('1 h 20 min'), 1);
t('bez cisla vychozi hodina', minutyZReceptu('chvilku'), 60);
t('prazdne vychozi hodina', minutyZReceptu(null), 60);
t('nesmyslne dlouhe se orizne na vychozi', minutyZReceptu('720 min'), 60);
t('vlastni vychozi hodnota', minutyZReceptu('', 45), 45);

console.log('\n--- Vareni v konkretni cas ---');
const RECEPT = { title: 'Krémové kuřecí tagliatelle', time: '35 min', slug: 'kremove-kureci-tagliatelle' };
const u = udalostZBookingu(
  { cook_date: '2026-08-27', cook_time: '18:00', servings: 4 }, RECEPT,
  'https://vorlis08.github.io/masterchef-vorlis/'
);
t('nazev je nazev receptu', u.summary, 'Krémové kuřecí tagliatelle');
t('zacatek sedi', u.start, { dateTime: '2026-08-27T18:00:00', timeZone: PASMO });
t('konec je zacatek plus doba vareni', u.end,
  { dateTime: '2026-08-27T18:35:00', timeZone: PASMO });
t('pasmo je prazske', PASMO, 'Europe/Prague');
t('v popisu jsou porce', u.description.includes('Porcí: 4'), true);
t('v popisu je odkaz do appky',
  u.description.includes('https://vorlis08.github.io/masterchef-vorlis/'), true);
t('vlastni pripominka se nenastavuje', u.reminders, { useDefault: false, overrides: [] });

console.log('\n--- Prechod pres pulnoc ---');
const noc = udalostZBookingu(
  { cook_date: '2026-08-27', cook_time: '23:40' }, { title: 'Bůček', time: '90 min' }
);
t('konec spadne na dalsi den', noc.end.dateTime, '2026-08-28T01:10:00');
t('zacatek zustava', noc.start.dateTime, '2026-08-27T23:40:00');

const mesic = udalostZBookingu(
  { cook_date: '2026-08-31', cook_time: '23:30' }, { title: 'X', time: '60 min' }
);
t('preteceni pres konec mesice', mesic.end.dateTime, '2026-09-01T00:30:00');

console.log('\n--- Vareni na cely den ---');
const cely = udalostZBookingu({ cook_date: '2026-08-27', cook_time: null }, RECEPT);
t('celodenni ma date, ne dateTime', Object.keys(cely.start), ['date']);
t('zacatek je ten den', cely.start.date, '2026-08-27');
t('konec je den po - u celodennich je konec vylucny', cely.end.date, '2026-08-28');
t('celodenni nechava pripominky na Googlu', cely.reminders, { useDefault: true });

const konecMesice = udalostZBookingu({ cook_date: '2026-08-31', cook_time: null }, RECEPT);
t('celodenni na konci mesice pretece spravne', konecMesice.end.date, '2026-09-01');

const prestupny = udalostZBookingu({ cook_date: '2028-02-28', cook_time: null }, RECEPT);
t('prestupny rok', prestupny.end.date, '2028-02-29');

console.log('\n--- Kdyz neco chybi ---');
const bezReceptu = udalostZBookingu({ cook_date: '2026-08-27', cook_time: '12:00' }, null);
t('bez receptu nespadne', bezReceptu.summary, 'Vaření');
t('bez receptu je hodina', bezReceptu.end.dateTime, '2026-08-27T13:00:00');
t('bez porci se o nich nemluvi',
  udalostZBookingu({ cook_date: '2026-08-27', cook_time: '12:00' }, RECEPT)
    .description.includes('Porcí'), false);
t('bez odkazu se source nepridava',
  udalostZBookingu({ cook_date: '2026-08-27', cook_time: '12:00' }, RECEPT).source, undefined);

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
