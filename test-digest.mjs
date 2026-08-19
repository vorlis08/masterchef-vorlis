import { chybejiciSuroviny, jeVhodnaDoba } from './worker/src/digest.js';
import { welcomeMail, newRecipesMail, wishlistMail, summaryMail } from './worker/src/mail.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

const RECEPT = { title: 'Kuře na paprice', slug: 'kure', ingredients: ['500 g kuřecího masa', '250 ml smetany', 'sůl', '2 cibule'] };

console.log('\n--- Kolik surovin chybi (4.3: skala, ne ano/ne) ---');
t('prazdna spiz = chybi vse', chybejiciSuroviny(RECEPT, []), 4);

t('plna spiz = nechybi nic', chybejiciSuroviny(RECEPT, [
  { name: 'kuřecí maso', kind: 'exact', quantity: 800 },
  { name: 'smetana', kind: 'exact', quantity: 500 },
  { name: 'sůl', kind: 'approx', status: 'mam' },
  { name: 'cibule', kind: 'count', quantity: 3 },
]), 0);

t('chybi dve veci', chybejiciSuroviny(RECEPT, [
  { name: 'kuřecí maso', kind: 'exact', quantity: 800 },
  { name: 'smetana', kind: 'exact', quantity: 500 },
]), 2);

console.log('\n--- Rezervace zamyka, takze zamcene nepocitame (4.2) ---');
t('zamcena smetana se nepocita', chybejiciSuroviny(
  { ingredients: ['250 ml smetany'] },
  [{ name: 'smetana', kind: 'exact', quantity: 200, reserved: 200 }]
), 1);
t('zbyle volne mnozstvi staci', chybejiciSuroviny(
  { ingredients: ['250 ml smetany'] },
  [{ name: 'smetana', kind: 'exact', quantity: 500, reserved: 200 }]
), 0);

console.log('\n--- Priblizne a "mam doma standardne" (4.4, 4.5) ---');
t('priblizna se stavem mam se pocita', chybejiciSuroviny(
  { ingredients: ['sůl'] }, [{ name: 'sůl', kind: 'approx', status: 'mam' }]), 0);
t('priblizna se stavem dochazi se jeste pocita', chybejiciSuroviny(
  { ingredients: ['sůl'] }, [{ name: 'sůl', kind: 'approx', status: 'dochazi' }]), 0);
t('priblizna se stavem nemam chybi', chybejiciSuroviny(
  { ingredients: ['sůl'] }, [{ name: 'sůl', kind: 'approx', status: 'doslo' }]), 1);
t('"mam doma standardne" plati vzdy', chybejiciSuroviny(
  { ingredients: ['sůl'] }, [{ name: 'sůl', kind: 'approx', status: 'doslo', staple: 1 }]), 0);
t('nulove mnozstvi je jako by nebylo', chybejiciSuroviny(
  { ingredients: ['250 ml smetany'] }, [{ name: 'smetana', kind: 'exact', quantity: 0 }]), 1);

console.log('\n--- Recept bez ingredienci nespadne ---');
t('prazdny recept', chybejiciSuroviny({}, []), 0);

console.log('\n--- V noci se neposila ---');
t('rano v 8 se posila', jeVhodnaDoba(new Date('2026-08-20T06:00:00Z')), true);
t('vecer ve 21 se posila', jeVhodnaDoba(new Date('2026-08-20T19:00:00Z')), true);
t('ve 23 uz ne', jeVhodnaDoba(new Date('2026-08-20T21:00:00Z')), false);
t('ve 3 rano ne', jeVhodnaDoba(new Date('2026-08-20T01:00:00Z')), false);
t('v 6 rano jeste ne', jeVhodnaDoba(new Date('2026-08-20T04:00:00Z')), false);

console.log('\n--- Podoba zprav ---');
const U = { id: 'u1', name: 'Honza Vorel', email: 'h@x.cz', unsub_token: 'tok' };

const uvitani = welcomeMail(U);
t('uvitani oslovuje krestnim jmenem', uvitani.html.includes('Ahoj Honza'), true);
t('uvitani nema odhlasovaci odkaz', uvitani.html.includes('Vypni si je'), false);

const nove = newRecipesMail(U, [{ title: 'Guláš', category: 'Maso' }], 'https://w/unsub');
t('jeden recept ma jednotne cislo', nove.subject.includes('Přibyl nový recept'), true);
t('vice receptu ma mnozne cislo',
  newRecipesMail(U, [{ title: 'A' }, { title: 'B' }], 'x').subject.includes('Přibyly'), true);
t('pravidelna zprava ma odhlasovaci odkaz', nove.html.includes('https://w/unsub'), true);

const wl = wishlistMail(U, [{ title: 'Guláš', chybi: 0 }], 'https://w/unsub');
t('wishlist rika, ze mas vsechno', wl.html.includes('máš všechno'), true);

const souhrn = summaryMail(U, { uvareno: 0, ruznych: 0, nejcastejsi: null, nejlepsi: null, spiz: 12 }, 'x');
t('prazdny souhrn to prizna', souhrn.html.includes('Zatím nic'), true);
t('souhrn s daty nerýpe',
  summaryMail(U, { uvareno: 5, ruznych: 3, nejcastejsi: 'gulas', nejlepsi: 'gulas', spiz: 12 }, 'x')
    .html.includes('Zatím nic'), false);

t('nazev receptu se v HTML osetri',
  newRecipesMail(U, [{ title: '<script>zle()</script>' }], 'x').html.includes('<script>'), false);

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
