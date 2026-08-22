/**
 * Smazani uctu (8.25) - v prohlizeci nad hotovou strankou z `dist/`.
 *
 * Proc to stoji za samostatnou sadu: smazani uctu ma DVE poloviny.
 * Server smaze radek v `users` (a kaskadou vsechno navazane). Appka
 * ale MUSI zaroven uklidit i to, co ma lokalne v prohlizeci - oblibene,
 * wishlist, hodnoceni receptu (`review_<slug>`). Bez toho by appka po
 * dalsim prihlaseni ta stara data poslala zpatky na server pres
 * `nactiStav`, ktera posila VSECHNO, co ma appka lokalne ulozene.
 * Smazany ucet by tak "ozil" sam od sebe.
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

function boot({ potvrdit }) {
  const store = {
    session: 'listek', viewMode: 'grid',
    favorites: JSON.stringify(['chilli-con-carne']),
    wishlist: JSON.stringify(['kure-na-paprice']),
    'review_chilli-con-carne': JSON.stringify({ stars: 5, note: 'super', cooked: 3, lastCooked: null }),
  };
  let deleteVolan = null;
  const confirmVolani = [];

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://vorlis08.github.io/masterchef-vorlis/',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      w.scrollTo = () => {};
      w.confirm = (msg) => { confirmVolani.push(msg); return potvrdit(confirmVolani.length); };
      w.alert = () => {};
      w.fetch = async (url, opts) => {
        const adresa = String(url);
        if (adresa.includes('/api/me')) {
          return { ok: true, status: 200, json: async () => ({ id: 'u1', email: 'a@x.cz', name: 'Honza Vorel', role: 'user', intro_done: 1 }) };
        }
        if (adresa.includes('/api/kitchens')) {
          return { ok: true, status: 200, json: async () => ({ items: [{ id: 1, name: 'Byt', pocet: 5 }], aktivni: 1 }) };
        }
        if (adresa.includes('/api/inventory')) {
          return { ok: true, status: 200, json: async () => ({ items: [], kuchyn: 1 }) };
        }
        if (adresa.includes('/api/account')) {
          deleteVolan = { method: opts && opts.method };
          return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => '{}' };
        }
        return { ok: true, status: 200, json: async () => ({ items: [] }) };
      };
      Object.defineProperty(w, 'localStorage', {
        value: {
          getItem: k => (k in store ? store[k] : null),
          setItem: (k, v) => { store[k] = String(v); },
          removeItem: k => { delete store[k]; },
          clear: () => { for (const k in store) delete store[k]; },
          get length() { return Object.keys(store).length; },
          key: (i) => Object.keys(store)[i],
        },
        configurable: true,
      });
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    },
  });
  return { w: dom.window, store, confirmVolani, ziskejDelete: () => deleteVolan };
}

const ready = async w => {
  await new Promise(r => w.addEventListener('load', r));
  await new Promise(r => setTimeout(r, 700));
};

console.log('\n--- Tlacitko v profilu ---');
{
  const { w } = boot({ potvrdit: () => true });
  await ready(w);
  const btn = w.document.getElementById('profil-smazat');
  t('existuje', !!btn);
  // Male, bez vyrazneho pozadi - at na nej nikdo neklikne omylem
  // misto na "Odhlasit se".
  t('neni to hlavni akce (bez bg-accent/bg-surface tridy)',
    btn && !/bg-(accent|surface)\b/.test(btn.className));
}

console.log('\n--- Zruseni v prvnim kroku nic nesmaze ---');
{
  const { w, store, confirmVolani, ziskejDelete } = boot({ potvrdit: () => false });
  await ready(w);
  w.document.getElementById('profil-smazat').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));

  t('zeptalo se jen jednou', confirmVolani.length === 1, confirmVolani.length);
  t('na server se nic neposlalo', ziskejDelete() === null);
  t('session zustala', store.session === 'listek');
  t('oblibene zustaly', !!store.favorites);
}

console.log('\n--- Potvrzeni prvniho, zruseni druheho kroku nic nesmaze ---');
{
  const { w, store, confirmVolani, ziskejDelete } = boot({ potvrdit: (kolikaty) => kolikaty === 1 });
  await ready(w);
  w.document.getElementById('profil-smazat').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));

  t('zeptalo se dvakrat', confirmVolani.length === 2, confirmVolani.length);
  t('na server se poresto nic neposlalo', ziskejDelete() === null);
  t('session zustala', store.session === 'listek');
}

console.log('\n--- Oboji potvrzeno: smaze se ucet na serveru i vse lokalne ---');
{
  const { w, store, confirmVolani, ziskejDelete } = boot({ potvrdit: () => true });
  await ready(w);
  w.document.getElementById('profil-smazat').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));

  t('dva ruzne potvrzovaci dialogy', confirmVolani.length === 2 && confirmVolani[0] !== confirmVolani[1]);
  t('prvni zminuje pocet kuchyni a kolikrat uvareno',
    /1 kuchyň/.test(confirmVolani[0]) && /3× uvařeno/.test(confirmVolani[0]), confirmVolani[0]);
  t('poslalo se DELETE na /api/account',
    ziskejDelete() && ziskejDelete().method === 'DELETE', JSON.stringify(ziskejDelete()));

  // Lokalni uklid - jadro cele sady. Bez nej "ozivne" smazany ucet
  // pri dalsim prihlaseni sam od sebe.
  t('session smazana', !store.session);
  t('oblibene smazany', !store.favorites);
  t('wishlist smazany', !store.wishlist);
  t('hodnoceni receptu smazano', !store['review_chilli-con-carne']);

  t('brana pro neprihlasene se zase ukazala',
    !w.document.getElementById('brana').classList.contains('je-pryc'));
  t('profil se zavrel', w.document.getElementById('profil-overlay').classList.contains('opacity-0'));
}

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
