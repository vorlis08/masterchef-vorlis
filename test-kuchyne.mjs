import {
  VYCHOZI_NAZEV, MAX_DELKA, MAX_POCET, upravNazev, zkontrolujNazev,
  stejnyNazev, aktivniKuchyn, jdeSmazat, jdePridat, navrhniNazev,
} from './src/lib/kuchyne.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

const K = [
  { id: 1, name: 'Byt' },
  { id: 2, name: 'Chata' },
];

console.log('\n--- Uprava nazvu ---');
t('mezery na krajich pryc', upravNazev('  Chata '), 'Chata');
t('vic mezer uprostred na jednu', upravNazev('U   babicky'), 'U babicky');
t('prazdny zustane prazdny', upravNazev('   '), '');
t('null nespadne', upravNazev(null), '');
t('cislo se prevede', upravNazev(42), '42');
t('dlouhy nazev se ustrihne', upravNazev('x'.repeat(50)).length, MAX_DELKA);

console.log('\n--- Kontrola nazvu ---');
t('bezny nazev projde', zkontrolujNazev('Chalupa', K).ok, true);
t('a vrati se upraveny', zkontrolujNazev('  Chalupa  ', K).nazev, 'Chalupa');
t('prazdny neprojde', zkontrolujNazev('   ', K).ok, false);
t('a rekne proc', zkontrolujNazev('', K).chyba, 'Kuchyň musí mít jméno.');
t('duplicita neprojde', zkontrolujNazev('Chata', K).ok, false);
t('duplicita bez ohledu na velka pismena', zkontrolujNazev('CHATA', K).ok, false);
t('duplicita s mezerami navic', zkontrolujNazev('  chata ', K).ok, false);
t('a rekne proc', zkontrolujNazev('Chata', K).chyba, 'Takovou kuchyň už máš.');
t('prejmenovani na vlastni nazev projde', zkontrolujNazev('Chata', K, 2).ok, true);
t('ale na nazev sousedni kuchyne ne', zkontrolujNazev('Byt', K, 2).ok, false);
t('bez seznamu se nekontroluje duplicita', zkontrolujNazev('Cokoliv').ok, true);

console.log('\n--- Porovnani nazvu ---');
t('stejny nazev', stejnyNazev('Chata', 'chata'), true);
t('jiny nazev', stejnyNazev('Chata', 'Byt'), false);
t('prazdne se rovnaji', stejnyNazev('', ''), true);
t('null nespadne', stejnyNazev(null, ''), true);

console.log('\n--- Ktera kuchyn je aktivni ---');
t('ulozena volba plati', aktivniKuchyn(K, 2).name, 'Chata');
t('cislo i text funguji stejne', aktivniKuchyn(K, '2').name, 'Chata');
t('bez volby prvni', aktivniKuchyn(K, null).name, 'Byt');
// Kuchyn smazana na jinem zarizeni - uzivatel nema koukat do prazdna.
t('smazana volba spadne na prvni', aktivniKuchyn(K, 99).name, 'Byt');
t('prazdny seznam vrati null', aktivniKuchyn([], 1), null);
t('chybejici seznam nespadne', aktivniKuchyn(null, 1), null);

console.log('\n--- Kolik jich smi byt ---');
t('posledni kuchyn nejde smazat', jdeSmazat([{ id: 1, name: 'A' }]), false);
t('dve uz ano', jdeSmazat(K), true);
t('prazdno taky ne', jdeSmazat([]), false);
t('dalsi jde pridat', jdePridat(K), true);
t('nad strop uz ne',
  jdePridat(Array.from({ length: MAX_POCET }, (_, i) => ({ id: i, name: 'K' + i }))), false);

console.log('\n--- Navrh nazvu ---');
t('volny nazev se vezme rovnou', navrhniNazev(K, 'Chalupa'), 'Chalupa');
t('obsazeny se ocisluje', navrhniNazev(K, 'Chata'), 'Chata 2');
t('a cisluje se dal', navrhniNazev([...K, { id: 3, name: 'Chata 2' }], 'Chata'), 'Chata 3');
t('bez zakladu vlastni nazev', navrhniNazev(K), 'Nová kuchyň');
t('vychozi nazev je ten, co dostane kazdy', VYCHOZI_NAZEV, 'Moje kuchyň');

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
