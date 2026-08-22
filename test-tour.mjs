import {
  KROKY, pocetKroku, krok, omez, jePrvni, jePosledni,
  popisPostupu, popisekDopredu, akceKroku,
} from './src/lib/tour.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

console.log('\n--- Prohlidka projde vsechno ---');
t('kroku je dost', pocetKroku() >= 20, true);
t('kazdy krok ma cil', KROKY.every(k => typeof k.cil === 'string' && k.cil.startsWith('#')), true);
t('kazdy krok ma nadpis', KROKY.every(k => !!k.nadpis), true);
t('kazdy krok ma text', KROKY.every(k => k.text && k.text.length > 20), true);
t('zadny cil se neopakuje', KROKY.length, new Set(KROKY.map(k => k.cil)).size);

const nadpisy = KROKY.map(k => k.nadpis);
[
  'Hledání', 'Filtry', 'Dva pohledy', 'Detail receptu', 'Porce',
  'Basic a Fancy', 'Režim vaření', 'Nutriční hodnoty', 'Náhrada suroviny',
  'Do nákupního seznamu', 'Chci vyzkoušet', 'Hodnocení', 'Poznámky',
  'Oblíbené', 'Nákupní seznam', 'Kuchyň', 'Dlouhý seznam',
  'Kuchařský kámoš', 'Barevné palety', 'Tvůj účet',
].forEach(n => t('prochazi: ' + n, nadpisy.includes(n), true));

console.log('\n--- Pohyb mezi kroky ---');
t('zacina na prvnim', jePrvni(0), true);
t('prvni neni posledni', jePosledni(0), false);
t('posledni se pozna', jePosledni(pocetKroku() - 1), true);
t('zaporne cislo spadne na zacatek', omez(-5), 0);
t('prilis velke spadne na konec', omez(999), pocetKroku() - 1);
t('platne zustane', omez(3), 3);

console.log('\n--- Popisky ---');
t('postup na zacatku', popisPostupu(0), '1 / ' + pocetKroku());
t('postup uprostred', popisPostupu(3), '4 / ' + pocetKroku());
t('postup mimo rozsah se srovna', popisPostupu(999), pocetKroku() + ' / ' + pocetKroku());
t('tlacitko uprostred', popisekDopredu(2), 'Dál');
t('tlacitko na konci', popisekDopredu(pocetKroku() - 1), 'Hotovo');

console.log('\n--- Akce pro vzhled ---');
const platneAkce = ['otevriRecept', 'zavriRecept', 'otevriSpiz', 'zavriSpiz', 'otevriNastaveni', 'zavriNastaveni'];
t('vsechny akce jsou dohodnute',
  KROKY.filter(k => k.akce).every(k => platneAkce.includes(k.akce)), true);
t('recept se nekde otevre', KROKY.some(k => k.akce === 'otevriRecept'), true);
t('a taky zavre', KROKY.some(k => k.akce === 'zavriRecept'), true);
t('nastaveni se otevre i zavre',
  [KROKY.some(k => k.akce === 'otevriNastaveni'), KROKY.some(k => k.akce === 'zavriNastaveni')], [true, true]);

const iOtevri = KROKY.findIndex(k => k.akce === 'otevriRecept');
const iZavri = KROKY.findIndex(k => k.akce === 'zavriRecept');
t('recept se zavira az po otevreni', iZavri > iOtevri, true);
t('kroky uvnitr receptu jsou mezi tim', iZavri - iOtevri >= 8, true);

t('akce se precte', akceKroku(iOtevri), 'otevriRecept');
t('krok bez akce vraci null', akceKroku(0), null);
t('mimo rozsah nespadne', akceKroku(999), KROKY[KROKY.length - 1].akce || null);

console.log('\n--- Jednotlive kroky ---');
t('krok mimo rozsah je null', krok(999), null);
t('prvni krok je hledani', krok(0).cil, '#search');
t('posledni krok konci ucтem', krok(pocetKroku() - 1).cil, '#auth-btn');

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
