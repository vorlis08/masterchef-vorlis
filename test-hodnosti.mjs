import { HODNOSTI, hodnost, celkemUvareno } from './src/lib/hodnosti.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

console.log('\n--- Hodnosti ---');
t('nikdo nikdy nevaril', hodnost(0).nazev, 'Zase toast');
t('prvni uvarene jidlo hned posune', hodnost(1).nazev, 'První pokus');
t('mezi prahy drzi nizsi hodnost', hodnost(2).nazev, 'První pokus');
t('presne na prahu uz plati vyssi', hodnost(3).nazev, 'Nedělní kuchař');
t('nejvyssi hodnost', hodnost(500).nazev, 'MasterChef Vorlis');

console.log('\n--- Postup k dalsi ---');
t('rekne, ktera je dalsi', hodnost(1).dalsi, 'Nedělní kuchař');
t('kolik zbyva', hodnost(1).doDalsi, 2);
t('na prahu zbyva cely skok', hodnost(3).doDalsi, 5);
t('podil na zacatku stupne je nula', hodnost(3).podil, 0);
t('podil v polovine', hodnost(5).podil, 0.4);
t('podil nikdy nepresahne jedna', hodnost(119).podil <= 1, true);
t('nejvyssi hodnost nema dalsi', hodnost(200).dalsi, null);
t('nejvyssi hodnost ma plny prouzek', hodnost(200).podil, 1);
t('nejvyssi hodnost uz nic nedluzi', hodnost(200).doDalsi, 0);

console.log('\n--- Nesmyslne vstupy ---');
t('zaporne se bere jako nula', hodnost(-5).nazev, 'Zase toast');
t('null nespadne', hodnost(null).nazev, 'Zase toast');
t('text nespadne', hodnost('spousta').nazev, 'Zase toast');
t('desetinne se zaokrouhli dolu', hodnost(2.9).nazev, 'První pokus');

console.log('\n--- Prahy davaji smysl ---');
t('prahy jsou vzestupne',
  HODNOSTI.every((h, i) => i === 0 || h.od > HODNOSTI[i - 1].od), true);
t('zacina se na nule', HODNOSTI[0].od, 0);
t('zadna hodnost nema prazdny nazev', HODNOSTI.every(h => !!h.nazev), true);
t('kazda hodnost je dosazitelna',
  HODNOSTI.every(h => hodnost(h.od).nazev === h.nazev), true);

console.log('\n--- Scitani uvarenych ---');
t('secte vsechno', celkemUvareno([{ cooked: 3 }, { cooked: 1 }, { cooked: 0 }]), 4);
t('tentyz recept vickrat se pocita vickrat',
  celkemUvareno([{ cooked: 10 }]), 10);
t('prazdne je nula', celkemUvareno([]), 0);
t('null nespadne', celkemUvareno(null), 0);
t('chybejici cooked nevadi', celkemUvareno([{}, { cooked: 2 }]), 2);
t('zaporne se ignoruje', celkemUvareno([{ cooked: -4 }, { cooked: 2 }]), 2);
t('text se ignoruje', celkemUvareno([{ cooked: 'hodne' }, { cooked: 1 }]), 1);

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
