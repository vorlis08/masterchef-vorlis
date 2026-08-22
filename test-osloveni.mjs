import { vokativ, osloveni } from './src/lib/osloveni.js';

let fail = 0;
const t = (name, got, want) => {
  const ok = got === want;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + want + '\n         vraceno: ' + got));
  if (!ok) fail++;
};
/** Zkratka: jmeno se ma zmenit na tvar `want`. */
const v = (jm, want) => t(jm + ' -> ' + want, vokativ(jm), want);
/** Jmeno, ktere se menit NESMI. */
const stejne = (jm) => t(jm + ' zustava', vokativ(jm), jm);

console.log('\n--- Jmena na -a (obe pohlavi) ---');
v('Honza', 'Honzo');
v('Jirka', 'Jirko');
v('Standa', 'Stando');
v('Pepa', 'Pepo');
v('Jana', 'Jano');
v('Petra', 'Petro');
v('Lenka', 'Lenko');
v('Michaela', 'Michaelo');
v('Eva', 'Evo');

console.log('\n--- Jmena na -ie a -ia se nemeni ---');
stejne('Marie');
stejne('Lucie');
stejne('Julie');
stejne('Sofia');

console.log('\n--- Mekke souhlasky -> -i ---');
v('Tomáš', 'Tomáši');
v('Lukáš', 'Lukáši');
v('Ondřej', 'Ondřeji');
v('Matěj', 'Matěji');

console.log('\n--- -k -> -ku ---');
v('Marek', 'Marku');
v('Patrik', 'Patriku');
v('Dominik', 'Dominiku');
v('Radek', 'Radku');
v('Zdeněk', 'Zdeňku');

console.log('\n--- -ch, -h, -g -> -u ---');
v('Vojtěch', 'Vojtěchu');
v('Oleg', 'Olegu');

console.log('\n--- -el -> -le, Daniel je vyjimka ---');
v('Pavel', 'Pavle');
v('Karel', 'Karle');
v('Daniel', 'Danieli');

console.log('\n--- -r ---');
v('Petr', 'Petře');
v('Alexandr', 'Alexandře');
v('Otakar', 'Otakare');
v('Viktor', 'Viktore');

console.log('\n--- Tvrde souhlasky -> -e ---');
v('David', 'Davide');
v('Martin', 'Martine');
v('Filip', 'Filipe');
v('Michal', 'Michale');
v('Robert', 'Roberte');
v('Jakub', 'Jakube');

console.log('\n--- Zenska jmena na souhlasku se NESMI zkomolit ---');
// "Ahoj Dagmare" urazi vic nez "Ahoj Dagmar".
stejne('Dagmar');
stejne('Miriam');
stejne('Ester');
stejne('Karin');
stejne('Ingrid');
stejne('Nikol');

console.log('\n--- Jmena konciciho samohlaskou ---');
stejne('Jiří');
stejne('Ivo');
stejne('Oto');
stejne('Hugo');
stejne('Rudy');
stejne('Tomi');

console.log('\n--- Ciziho jmena ---');
// Kdyz pravidlo sedi i cizimu jmenu, pouzije se - "Ahoj Johne" je bezne.
v('John', 'Johne');
v('Peter', 'Petere');
stejne('Sarah');
stejne('Deborah');

console.log('\n--- Co nesmi spadnout ---');
t('prazdne jmeno', vokativ(''), '');
t('null', vokativ(null), '');
t('undefined', vokativ(undefined), '');
t('cislo', vokativ(42), '42');
t('inicial', vokativ('J.'), 'J.');
t('dve pismena', vokativ('Ed'), 'Ed');
t('e-mail misto jmena', vokativ('a@x.cz'), 'a@x.cz');
t('cele jmeno se osloví krestnim', vokativ('Honza Vorel'), 'Honzo');
t('mezery navic', vokativ('  Honza  '), 'Honzo');

console.log('\n--- Osloveni do zpravy ---');
t('s uzivatelem', osloveni({ name: 'Honza Vorel' }), 'Ahoj Honzo');
t('s holym jmenem', osloveni('Tomáš'), 'Ahoj Tomáši');
t('bez jmena nezustane viset', osloveni({ name: '' }), 'Ahoj');
t('bez uzivatele', osloveni(null), 'Ahoj');
t('vlastni pozdrav', osloveni('Petr', 'Zdravím'), 'Zdravím Petře');

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
