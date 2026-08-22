/**
 * Pousti SKUTECNE SQL Workeru proti skutecne SQLite.
 *
 * Proc: chyba v dotazu se jinak pozna az po nasazeni, kdy Worker vrati
 * "Error 1101" a appka prestane fungovat celá. Tady se pozna za vterinu.
 *
 * Databaze se postavi prehranim vsech migraci ze `worker/migrations/`,
 * takze se zaroven kontroluje, ze migrace na sebe navazuji.
 *
 * `env.DB` je napodobenina D1 nad `node:sqlite` - D1 ma stejny tvar
 * rozhrani (prepare -> bind -> run/first/all + batch).
 */

import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import {
  listKitchens, saveKitchen, listInventory, saveInventory, vyberKuchyn,
} from './worker/src/api.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

// -- Napodobenina D1 -------------------------------------------------------

/**
 * Nacte migraci tak, jak ji uvidi D1.
 *
 * D1 pousti migraci v TRANSAKCI, a `PRAGMA foreign_keys` je uvnitr
 * transakce tichy no-op. Kdyz tedy migrace prestavuje tabulku, na kterou
 * nekdo ukazuje cizim klicem, D1 ten klic uplatni - a `ON DELETE SET NULL`
 * odkaz vynuluje. Draze zjisteno migraci 0011: zamky ve spizi prisly
 * o surovinu a nikde to necvaklo.
 *
 * `node:sqlite` PRAGMA naopak posloucha, takze by tady vsechno proslo a
 * test by tvrdil, ze je vsechno v poradku. Radky s PRAGMA proto
 * zahazujeme - at je test aspon tak prisny jako ostra databaze.
 */
function nactiMigraci(soubor) {
  return readFileSync('worker/migrations/' + soubor, 'utf8')
    .replace(/^[ 	]*PRAGMA[ 	]+foreign_keys[^;]*;[ 	]*$/gim, '');
}

function udelejDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of readdirSync('worker/migrations').filter(x => x.endsWith('.sql')).sort()) {
    db.exec(nactiMigraci(f));
  }

  const prepare = (sql) => {
    const stmt = () => db.prepare(sql);
    const obal = (args) => ({
      run: async () => {
        const v = stmt().run(...args);
        return { meta: { last_row_id: Number(v.lastInsertRowid), changes: Number(v.changes) } };
      },
      first: async () => stmt().get(...args) ?? null,
      all: async () => ({ results: stmt().all(...args) }),
      __args: args, __sql: sql,
    });
    return { bind: (...args) => obal(args), ...obal([]) };
  };

  return {
    prepare,
    batch: async (prikazy) => {
      for (const p of prikazy) await p.run();
      return [];
    },
    _raw: db,
  };
}

const cors = () => ({});
const telo = (o) => ({ json: async () => o });

async function vysledek(res) {
  return JSON.parse(await res.text());
}

// -- Priprava --------------------------------------------------------------

const DB = udelejDb();
const env = { DB };
DB._raw.exec("INSERT INTO users (id, email, name) VALUES ('u1','a@x.cz','Honza'), ('u2','b@x.cz','Petr')");
// Migrace uz kazdemu jednu kuchyn zalozila.
const ja = { sub: 'u1' };
const cizi = { sub: 'u2' };

console.log('\n--- Po migraci ma kazdy jednu kuchyn ---');
{
  const v = await vysledek(await listKitchens(env, ja, null, cors));
  t('jedna kuchyn', v.items.length, 1);
  t('a jmenuje se Moje kuchyň', v.items[0].name, 'Moje kuchyň');
  t('a je otevrena', v.aktivni, v.items[0].id);
  t('a je prazdna', v.items[0].pocet, 0);
}

console.log('\n--- Zalozeni dalsi ---');
{
  const v = await vysledek(await saveKitchen(telo({ action: 'create', name: '  Chata  ' }), env, ja, null, cors));
  t('kuchyne jsou dve', v.items.length, 2);
  t('nazev se ocistil', v.items[1].name, 'Chata');
  t('nova se rovnou otevre', v.aktivni, v.items[1].id);

  const dup = await vysledek(await saveKitchen(telo({ action: 'create', name: 'chata' }), env, ja, null, cors));
  t('duplicitni nazev odmitnut', dup.error, 'Takovou kuchyň už máš.');

  const prazdny = await vysledek(await saveKitchen(telo({ action: 'create', name: '   ' }), env, ja, null, cors));
  t('prazdny nazev odmitnut', prazdny.error, 'Kuchyň musí mít jméno.');
}

const kuchyne = (await vysledek(await listKitchens(env, ja, null, cors))).items;
const BYT = kuchyne[0].id;
const CHATA = kuchyne[1].id;

console.log('\n--- Tataz surovina smi byt v obou kuchynich ---');
{
  await saveInventory(telo({ kuchyn: BYT, item: { name: 'máslo', kind: 'exact', quantity: 250, unit: 'g' } }), env, ja, null, cors);
  const v = await vysledek(await saveInventory(telo({ kuchyn: CHATA, item: { name: 'máslo', kind: 'exact', quantity: 100, unit: 'g' } }), env, ja, null, cors));
  t('na chate je maslo jednou', v.items.length, 1);
  t('a ma svoje mnozstvi', v.items[0].quantity, 100);

  const byt = await vysledek(await listInventory(env, ja, null, cors, BYT));
  t('v byte je taky jednou', byt.items.length, 1);
  t('a ma svoje mnozstvi', byt.items[0].quantity, 250);
  t('vraci se i to, ktera kuchyn to je', byt.kuchyn, BYT);
}

console.log('\n--- Do ktere kuchyne se zapisuje ---');
{
  await saveKitchen(telo({ action: 'aktivni', id: BYT }), env, ja, null, cors);
  const v = await vysledek(await saveInventory(telo({ item: { name: 'mouka', kind: 'approx', status: 'mam' } }), env, ja, null, cors));
  t('bez urceni padne do otevrene', v.items.map(i => i.name), ['mouka', 'máslo']);

  const chata = await vysledek(await listInventory(env, ja, null, cors, CHATA));
  t('do druhe se nic nepridalo', chata.items.map(i => i.name), ['máslo']);
}

console.log('\n--- Do cizi kuchyne se nikdo nedostane ---');
{
  const cizinec = await vysledek(await listInventory(env, cizi, null, cors, BYT));
  t('cizi kuchyn se neotevre', cizinec.items.length, 0);
  t('a spadne se na vlastni', cizinec.kuchyn !== BYT, true);

  const zapis = await vysledek(await saveInventory(telo({ kuchyn: BYT, item: { name: 'podvrh', kind: 'exact' } }), env, cizi, null, cors));
  t('zapis do cizi kuchyne skonci ve vlastni', zapis.items.map(i => i.name), ['podvrh']);
  const byt = await vysledek(await listInventory(env, ja, null, cors, BYT));
  t('a v cizi kuchyni po nem neni stopa', byt.items.some(i => i.name === 'podvrh'), false);

  const prejmenovani = await vysledek(await saveKitchen(telo({ action: 'rename', id: BYT, name: 'Ukradeno' }), env, cizi, null, cors));
  t('cizi kuchyn nejde prejmenovat', prejmenovani.error, 'Takovou kuchyň nemáš.');
  const smazani = await vysledek(await saveKitchen(telo({ action: 'delete', id: BYT }), env, cizi, null, cors));
  t('ani smazat', smazani.error, 'Takovou kuchyň nemáš.');
}

console.log('\n--- Prejmenovani ---');
{
  const v = await vysledek(await saveKitchen(telo({ action: 'rename', id: BYT, name: 'Byt' }), env, ja, null, cors));
  t('nazev se zmenil', v.items.find(k => k.id === BYT).name, 'Byt');
  t('obsah zustal', v.items.find(k => k.id === BYT).pocet, 2);

  const naSebe = await vysledek(await saveKitchen(telo({ action: 'rename', id: BYT, name: 'Byt' }), env, ja, null, cors));
  t('prejmenovani na vlastni nazev projde', naSebe.error, undefined);
  const kolize = await vysledek(await saveKitchen(telo({ action: 'rename', id: BYT, name: 'Chata' }), env, ja, null, cors));
  t('na nazev sousedni kuchyne ne', kolize.error, 'Takovou kuchyň už máš.');
}

console.log('\n--- Smazani ---');
{
  await saveKitchen(telo({ action: 'aktivni', id: CHATA }), env, ja, null, cors);
  const v = await vysledek(await saveKitchen(telo({ action: 'delete', id: CHATA }), env, ja, null, cors));
  t('zbyla jedna', v.items.length, 1);
  t('a otevrela se ta zbyla', v.aktivni, BYT);
  t('suroviny smazane kuchyne jsou pryc',
    DB._raw.prepare('SELECT COUNT(*) AS p FROM inventory WHERE kitchen_id = ?').get(CHATA).p, 0);
  t('obsah zbyle kuchyne zustal',
    DB._raw.prepare('SELECT COUNT(*) AS p FROM inventory WHERE kitchen_id = ?').get(BYT).p, 2);

  const posledni = await vysledek(await saveKitchen(telo({ action: 'delete', id: BYT }), env, ja, null, cors));
  t('posledni kuchyn smazat nejde', posledni.error, 'Poslední kuchyň smazat nejde.');
}

console.log('\n--- Ucet, ktery migraci nezastihla ---');
{
  DB._raw.exec("INSERT INTO users (id, email, name) VALUES ('u3','c@x.cz','Nova')");
  const bezKuchyne = { sub: 'u3' };
  const id = await vyberKuchyn(env, 'u3');
  t('kuchyn se dozalozi', typeof id === 'number' && id > 0, true);
  const v = await vysledek(await listInventory(env, bezKuchyne, null, cors));
  t('a spiz se otevre prazdna misto chyby', v.items.length, 0);
}

console.log('\n--- Zamky ve spizi se pocitaji jen vlastniku ---');
{
  // Cizi uzivatel se pokusi zamknout MOJI surovinu.
  const mojeMaslo = DB._raw.prepare("SELECT id FROM inventory WHERE kitchen_id = ? AND name = 'máslo'").get(BYT).id;
  DB._raw.exec("INSERT INTO bookings (user_id, recipe_slug, cook_date) VALUES ('u2','kure','2026-09-01')");
  const b = DB._raw.prepare('SELECT id FROM bookings ORDER BY id DESC LIMIT 1').get().id;
  DB._raw.prepare('INSERT INTO reservations (booking_id, user_id, inventory_id, ingredient, amount) VALUES (?,?,?,?,?)')
    .run(b, 'u2', mojeMaslo, 'máslo', 5);

  const v = await vysledek(await listInventory(env, ja, null, cors, BYT));
  const maslo = v.items.find(i => i.name === 'máslo');
  t('cizi rezervace mi surovinu nezamkne', maslo.reserved, 0);
}

console.log('\n--- Migrace stavajiciho uctu ---');
// Uzivatel, ktery uz ve spizi neco mel, nesmi o nic prijit ani si niceho
// vsimnout: dostane jednu kuchyn a vsechno se do ni presune.
{
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const migrace = readdirSync('worker/migrations').filter(x => x.endsWith('.sql')).sort();

  // stav PRED kuchynemi
  for (const f of migrace.filter(f => !/^(0011|0012)/.test(f))) {
    db.exec(nactiMigraci(f));
  }
  db.exec("INSERT INTO users (id, email, name) VALUES ('stary','s@x.cz','Stary')");
  db.exec("INSERT INTO inventory (user_id, name, kind, quantity, unit) VALUES ('stary','máslo','exact',250,'g'), ('stary','sůl','approx',NULL,NULL)");
  db.exec("INSERT INTO bookings (user_id, recipe_slug, cook_date) VALUES ('stary','kure','2026-09-01')");
  db.exec("INSERT INTO reservations (booking_id, user_id, inventory_id, ingredient, amount) SELECT 1,'stary',id,'máslo',1 FROM inventory WHERE name='máslo'");
  const pred = db.prepare('SELECT id, name FROM inventory ORDER BY id').all();

  // a ted migrace na kuchyne + oprava zamku po ni
  db.exec(nactiMigraci('0011_kuchyne.sql'));
  db.exec(nactiMigraci('0012_zamky_zpet.sql'));

  const kuchyne = db.prepare('SELECT id, name FROM kitchens WHERE user_id = ?').all('stary');
  t('dostal prave jednu kuchyn', kuchyne.length, 1);
  t('s vychozim nazvem', kuchyne[0].name, 'Moje kuchyň');
  t('a je rovnou otevrena',
    db.prepare('SELECT active_kitchen_id AS k FROM users WHERE id = ?').get('stary').k, kuchyne[0].id);

  const po = db.prepare('SELECT id, name, kitchen_id FROM inventory ORDER BY id').all();
  t('suroviny zustaly vsechny', po.length, pred.length);
  t('a nezmenila se jim id (jinak by osirely zamky)', po.map(i => i.id), pred.map(i => i.id));
  t('vsechny sedi v te jedne kuchyni', po.every(i => i.kitchen_id === kuchyne[0].id), true);
  t('zamek porad ukazuje na spravnou surovinu',
    db.prepare('SELECT inventory_id AS i FROM reservations').get().i,
    po.find(i => i.name === 'máslo').id);
}

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
