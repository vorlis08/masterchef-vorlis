/**
 * Prepinac kuchyni v prohlizeci.
 *
 * Appka se pousti v jsdom nad hotovou strankou z `dist/`, prihlaseni i
 * Worker jsou podvrzene - jde o to, co dela SAMA APPKA, ne o sit.
 *
 * Proc to stoji za samostatnou sadu: prepnuti kuchyne meni obsah spize,
 * a s nim i odznaky "co muzu uvarit" u receptu. Kdyz se nekde zapomene
 * prekreslit, uzivatel kouka na cizi suroviny a nepozna proc.
 */

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

let html = fs.readFileSync('./dist/index.html', 'utf-8');
const m = html.match(/<script type="module" src="([^"]+)"><\/script>/);
if (!m) { console.error('nenalezen modulovy skript v dist/index.html'); process.exit(1); }
const jsFile = path.join('./dist', m[1].replace('/masterchef-vorlis', ''));
html = html.replace(m[0], () => '<script>' + fs.readFileSync(jsFile, 'utf-8') + '<\/script>');

let fail = 0;
const t = (name, cond, extra = '') => {
  console.log((cond ? '  OK   ' : '  FAIL ') + name + (cond ? '' : '  <- ' + extra));
  if (!cond) fail++;
};

/** Podvrzeny Worker. Drzi si kuchyne a jejich obsah jako opravdovy server. */
function udelejServer() {
  const stav = {
    kuchyne: [
      { id: 1, name: 'Byt', pocet: 2 },
      { id: 2, name: 'Chata', pocet: 1 },
    ],
    aktivni: 1,
    obsah: {
      1: [{ id: 11, name: 'máslo', kind: 'exact', quantity: 250, unit: 'g', reserved: 0 },
          { id: 12, name: 'mouka', kind: 'approx', status: 'mam', reserved: 0 }],
      2: [{ id: 21, name: 'sůl', kind: 'approx', status: 'mam', reserved: 0 }],
    },
    volani: [],
  };

  stav.fetch = async (url, opts) => {
    const adresa = String(url);
    const telo = opts && opts.body ? JSON.parse(opts.body) : null;
    stav.volani.push(adresa.replace(/^https?:\/\/[^/]+/, '') + (telo && telo.action ? ' ' + telo.action : ''));

    const odpoved = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });

    if (adresa.includes('/api/me')) {
      return odpoved({ id: 'u1', email: 'a@x.cz', name: 'Honza', role: 'user', intro_done: 1 });
    }
    if (adresa.includes('/api/kitchens')) {
      if (telo && telo.action === 'aktivni') stav.aktivni = telo.id;
      if (telo && telo.action === 'create') {
        const id = Math.max(...stav.kuchyne.map(k => k.id)) + 1;
        stav.kuchyne.push({ id, name: telo.name, pocet: 0 });
        stav.obsah[id] = [];
        stav.aktivni = id;             // nova se rovnou otevre
      }
      if (telo && telo.action === 'rename') {
        stav.kuchyne.find(k => k.id === telo.id).name = telo.name;
      }
      if (telo && telo.action === 'delete') {
        stav.kuchyne = stav.kuchyne.filter(k => k.id !== telo.id);
        delete stav.obsah[telo.id];
        stav.aktivni = stav.kuchyne[0].id;
      }
      return odpoved({ items: stav.kuchyne, aktivni: stav.aktivni });
    }
    if (adresa.includes('/api/inventory')) {
      const m2 = /kuchyn=(\d+)/.exec(adresa);
      const kid = (telo && telo.kuchyn) || (m2 && Number(m2[1])) || stav.aktivni;
      return odpoved({ items: stav.obsah[kid] || [], kuchyn: kid });
    }
    // vsechno ostatni (bookingy, nakup, stav, upozorneni) je pro tuhle
    // sadu jedno - staci, ze to nespadne
    return odpoved({ items: [] });
  };

  return stav;
}

function boot() {
  const server = udelejServer();
  const store = { session: 'listek', viewMode: 'grid' };
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://vorlis08.github.io/masterchef-vorlis/',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      w.scrollTo = () => {};
      w.fetch = server.fetch;
      Object.defineProperty(w, 'localStorage', {
        value: {
          getItem: k => (k in store ? store[k] : null),
          setItem: (k, v) => { store[k] = String(v); },
          removeItem: k => { delete store[k]; },
          clear: () => { for (const k in store) delete store[k]; },
        },
        configurable: true,
      });
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.confirm = () => true;
    },
  });
  return { w: dom.window, server };
}

const ready = async w => {
  await new Promise(r => w.addEventListener('load', r));
  await new Promise(r => setTimeout(r, 500));
};
const chvili = (ms = 250) => new Promise(r => setTimeout(r, ms));

console.log('\n--- Prihlaseny vidi jmeno sve kuchyne ---');
{
  const { w } = boot();
  await ready(w);
  const nazev = w.document.getElementById('kuchyn-nazev');
  const sipka = w.document.getElementById('kuchyn-prepnout');

  t('v hlavicce je jmeno otevrene kuchyne', nazev.textContent === 'Byt', nazev.textContent);
  t('sipka na prepnuti je videt', !sipka.classList.contains('hidden'));
  t('okno kuchyne nese tentyz nazev',
    w.document.getElementById('pantry-nadpis').textContent === 'Byt',
    w.document.getElementById('pantry-nadpis').textContent);
}

console.log('\n--- Prepnuti kuchyne ---');
{
  const { w, server } = boot();
  await ready(w);

  w.document.getElementById('kuchyn-prepnout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await chvili(80);

  const polozky = w.document.querySelectorAll('.kuchyn-polozka');
  t('nabidka vypise obe kuchyne', polozky.length === 2, 'pocet=' + polozky.length);
  t('otevrena je oznacena', polozky[0].classList.contains('je-otevrena'));
  t('a druha ne', !polozky[1].classList.contains('je-otevrena'));
  t('u kazde je pocet surovin', polozky[0].textContent.includes('2'), polozky[0].textContent.trim());

  polozky[1].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await chvili(400);

  t('jmeno v hlavicce se zmenilo',
    w.document.getElementById('kuchyn-nazev').textContent === 'Chata',
    w.document.getElementById('kuchyn-nazev').textContent);
  t('server o prepnuti vi', server.aktivni === 2, 'aktivni=' + server.aktivni);
  t('nabidka se zavrela', w.document.getElementById('kuchyn-nabidka').classList.contains('hidden'));
  // Tohle je jadro veci: prepnuti kuchyne musi prekreslit i obsah.
  t('spiz se nacetla znovu pro novou kuchyn',
    server.volani.some(v => v.includes('/api/inventory?kuchyn=2')),
    server.volani.join(' | '));
}

console.log('\n--- Zalozeni nove kuchyne ---');
{
  const { w, server } = boot();
  await ready(w);
  w.document.getElementById('kuchyn-prepnout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await chvili(80);

  w.document.getElementById('kuchyn-nova').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await chvili(80);
  const pole = w.document.getElementById('kuchyn-pole');
  t('formular se otevrel', !w.document.getElementById('kuchyn-formular').classList.contains('hidden'));
  t('a je predvyplneny navrhem', pole.value === 'Nová kuchyň', pole.value);

  // Prazdny nazev server vubec nesmi videt - chyba se ukaze hned.
  pole.value = '   ';
  w.document.getElementById('kuchyn-formular').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await chvili(120);
  const chyba = w.document.getElementById('kuchyn-chyba');
  t('prazdny nazev appka odmitne sama', !chyba.classList.contains('hidden') && chyba.textContent.length > 0, chyba.textContent);
  t('a na server s tim nechodi', !server.volani.some(v => v.includes('create')), server.volani.join(' | '));

  pole.value = 'U babičky';
  w.document.getElementById('kuchyn-formular').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await chvili(400);

  t('kuchyn pribyla', server.kuchyne.length === 3, 'pocet=' + server.kuchyne.length);
  t('a rovnou se otevrela',
    w.document.getElementById('kuchyn-nazev').textContent === 'U babičky',
    w.document.getElementById('kuchyn-nazev').textContent);
  t('takze se nacetl i jeji (prazdny) obsah',
    server.volani.some(v => v.includes('/api/inventory?kuchyn=3')),
    server.volani.join(' | '));
}

console.log('\n--- Prejmenovani ---');
{
  const { w, server } = boot();
  await ready(w);
  w.document.getElementById('kuchyn-prepnout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await chvili(80);
  w.document.getElementById('kuchyn-prejmenovat').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await chvili(80);

  const pole = w.document.getElementById('kuchyn-pole');
  t('pole nese soucasny nazev', pole.value === 'Byt', pole.value);

  // Nazev, ktery uz ma sousedni kuchyn.
  pole.value = 'Chata';
  w.document.getElementById('kuchyn-formular').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await chvili(120);
  t('duplicitu appka odmitne sama',
    !w.document.getElementById('kuchyn-chyba').classList.contains('hidden'));

  pole.value = 'Byt 2. patro';
  w.document.getElementById('kuchyn-formular').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await chvili(300);
  t('novy nazev je v hlavicce',
    w.document.getElementById('kuchyn-nazev').textContent === 'Byt 2. patro',
    w.document.getElementById('kuchyn-nazev').textContent);
  t('i v okne kuchyne',
    w.document.getElementById('pantry-nadpis').textContent === 'Byt 2. patro');
  t('server ho ma taky', server.kuchyne[0].name === 'Byt 2. patro', server.kuchyne[0].name);
}

console.log('\n--- Smazani ---');
{
  const { w, server } = boot();
  await ready(w);
  w.document.getElementById('kuchyn-prepnout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await chvili(80);
  w.document.getElementById('kuchyn-smazat').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await chvili(400);

  t('kuchyn ubyla', server.kuchyne.length === 1, 'pocet=' + server.kuchyne.length);
  t('otevrela se zbyla',
    w.document.getElementById('kuchyn-nazev').textContent === 'Chata',
    w.document.getElementById('kuchyn-nazev').textContent);

  // Posledni uz smazat nejde - tlacitko se ani neukaze.
  w.document.getElementById('kuchyn-prepnout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await chvili(80);
  t('u posledni kuchyne uz mazani nenabizi',
    w.document.getElementById('kuchyn-smazat').classList.contains('hidden'));
}

console.log('\n--- Zavirani nabidky ---');
{
  const { w } = boot();
  await ready(w);
  const nabidka = w.document.getElementById('kuchyn-nabidka');

  w.document.getElementById('kuchyn-prepnout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await chvili(80);
  t('nabidka je otevrena', !nabidka.classList.contains('hidden'));

  w.document.body.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await chvili(80);
  t('kliknuti vedle ji zavre', nabidka.classList.contains('hidden'));

  w.document.getElementById('kuchyn-prepnout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await chvili(80);
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await chvili(120);
  t('Escape ji zavre taky', nabidka.classList.contains('hidden'));
  // Escape nesmi zaroven zavrit okno pod ni - jeden stisk, jedna vec.
  t('a nic jineho nezavre',
    w.document.getElementById('pantry-overlay').classList.contains('hidden'));
}

console.log('\n--- Appka nasazena driv nez Worker ---');
// Stranka na Pages se nasazuje sama pushem, Worker rucne. Mezi tim tedy
// bezi nova appka proti STAREMU Workeru, ktery /api/kitchens jeste nezna.
// Nesmi se rozsypat - jen se chova, jako by kuchyn byla jedna a bezejmenna.
{
  const server = udelejServer();
  const puvodni = server.fetch;
  server.fetch = async (url, opts) => {
    if (String(url).includes('/api/kitchens')) {
      return { ok: false, status: 404, json: async () => ({ error: 'Neznámý požadavek.' }),
               text: async () => '{}' };
    }
    return puvodni(url, opts);
  };

  const store = { session: 'listek', viewMode: 'grid' };
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://vorlis08.github.io/masterchef-vorlis/',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      w.scrollTo = () => {};
      w.fetch = server.fetch;
      Object.defineProperty(w, 'localStorage', {
        value: {
          getItem: k => (k in store ? store[k] : null),
          setItem: (k, v) => { store[k] = String(v); },
          removeItem: k => { delete store[k]; },
          clear: () => {},
        }, configurable: true,
      });
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.confirm = () => true;
    },
  });
  const w = dom.window;
  await ready(w);

  t('appka nabehla', w.document.querySelectorAll('#recipe-grid [data-slug]').length > 0);
  t('v hlavicce je obecny nazev',
    w.document.getElementById('kuchyn-nazev').textContent === 'Kuchyň',
    w.document.getElementById('kuchyn-nazev').textContent);
  t('sipka se neukazuje', w.document.getElementById('kuchyn-prepnout').classList.contains('hidden'));
  t('spiz se stejne nacetla bez urceni kuchyne',
    server.volani.some(v => v === '/api/inventory'), server.volani.join(' | '));
}

console.log('\n' + (fail === 0 ? '=== VSE PROSLO ===' : '=== ' + fail + ' TESTU SELHALO ==='));
process.exit(fail === 0 ? 0 : 1);
