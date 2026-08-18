import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Skript je nove samostatny soubor (modul). jsdom ho sam nenacte,
// tak ho vlozime primo do stranky jako klasicky skript.
let html = fs.readFileSync('./dist/index.html', 'utf-8');
const m = html.match(/<script type="module" src="([^"]+)"><\/script>/);
if (!m) { console.error('nenalezen modulovy skript v dist/index.html'); process.exit(1); }
const jsFile = path.join('./dist', m[1].replace('/masterchef-vorlis', ''));
const js = fs.readFileSync(jsFile, 'utf-8');
html = html.replace(m[0], () => '<script>' + js + '<\/script>');

function boot(seed = {}) {
  const store = { ...seed };
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://vorlis08.github.io/masterchef-vorlis/',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      w.scrollTo = () => {};
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
    },
  });
  return { dom, w: dom.window, store };
}

const ready = async w => {
  await new Promise(r => w.addEventListener('load', r));
  await new Promise(r => setTimeout(r, 400));
};

let fail = 0;
const t = (name, cond, extra = '') => {
  console.log((cond ? '  OK   ' : '  FAIL ') + name + (cond ? '' : '  <- ' + extra));
  if (!cond) fail++;
};

console.log('\n--- Appka cte drive ulozena data ---');
{
  const { w } = boot({
    favorites: JSON.stringify(['chilli-con-carne']),
    viewMode: 'grid',
    shopping_list: JSON.stringify([{ text: 'mleko', done: false }, { text: 'chleba', done: false }]),
    'review_chilli-con-carne': JSON.stringify({ stars: 4, note: 'dobre', cooked: 2, lastCooked: null }),
  });
  await ready(w);

  const items = w.document.querySelectorAll('#recipe-grid [data-slug], #recipe-list [data-slug]');
  t('appka nabehla a vykreslila recepty', items.length > 0, 'pocet=' + items.length);

  const badge = w.document.getElementById('shopping-count');
  t('nakupni seznam nacten (badge = 2)', badge && badge.textContent.trim() === '2', badge && badge.textContent);
  t('badge je viditelny', badge && !badge.classList.contains('hidden'));
}

console.log('\n--- Akce uzivatele se ukladaji ---');
{
  const { w, store } = boot({ viewMode: 'grid' });
  await ready(w);

  const favBtn = w.document.querySelector('#recipe-grid [data-fav], #recipe-list [data-fav]');
  t('tlacitko oblibene existuje', !!favBtn);
  if (favBtn) {
    const slug = favBtn.dataset.fav;
    favBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    t('kliknuti na oblibene ulozilo', store.favorites === JSON.stringify([slug]), store.favorites);

    const favBtn2 = w.document.querySelector('[data-fav="' + slug + '"]');
    favBtn2.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    t('odkliknuti oblibene ulozilo', store.favorites === '[]', store.favorites);
  }

  const themeBtn = w.document.querySelector('.theme-swatch[data-theme]:not([data-theme=""])');
  if (themeBtn) {
    const theme = themeBtn.dataset.theme;
    themeBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    t('zmena tematu ulozila', store.theme === theme, store.theme);
    t('tema aplikovano na html', w.document.documentElement.getAttribute('data-theme') === theme);
  }

  const viewBtn = w.document.querySelector('[data-view="menu"]');
  if (viewBtn) {
    const v = viewBtn.dataset.view;
    viewBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    t('prepnuti zobrazeni ulozilo', store.viewMode === v, store.viewMode);
  }

  const defBtn = w.document.querySelector('.theme-swatch[data-theme=""]');
  if (defBtn) {
    defBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    t('vychozi tema smaze ulozenou hodnotu', !('theme' in store), JSON.stringify(store.theme));
    t('data-theme odstraneno z html', !w.document.documentElement.hasAttribute('data-theme'));
  }

  const tokenInput = w.document.getElementById('token-input');
  const tokenSave = w.document.getElementById('token-save');
  if (tokenInput && tokenSave) {
    tokenInput.value = 'github_pat_TESTONLY';
    tokenSave.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    t('token se ulozil', store.gh_token === 'github_pat_TESTONLY', store.gh_token);
  }
}

console.log('\n--- Odolnost proti poskozenym datum ---');
{
  const { w, store } = boot({
    viewMode: 'grid',
    favorites: '{{{ rozbite',
    shopping_list: 'taky rozbite',
    'review_chilli-con-carne': 'neni json',
  });
  await ready(w);

  const items = w.document.querySelectorAll('#recipe-grid [data-slug], #recipe-list [data-slug]');
  t('appka nespadla na poskozenych datech', items.length > 0, 'pocet=' + items.length);

  const badge = w.document.getElementById('shopping-count');
  t('nakupni seznam se choval jako prazdny', badge && badge.classList.contains('hidden'));

  const favBtn = w.document.querySelector('[data-fav]');
  if (favBtn) {
    favBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    t('lze pridat oblibeny i po poskozeni', store.favorites === JSON.stringify([favBtn.dataset.fav]), store.favorites);
  }
}

console.log('\n--- Uplne novy uzivatel (zadna data) ---');
{
  const { w } = boot({});
  await ready(w);
  const items = w.document.querySelectorAll('#recipe-grid [data-slug], #recipe-list [data-slug]');
  t('appka nabehla bez ulozenych dat', items.length > 0, 'pocet=' + items.length);
  const badge = w.document.getElementById('shopping-count');
  t('nakupni badge skryty', badge && badge.classList.contains('hidden'));
}

console.log('\n--- Filtrovani je zapojene do appky ---');
{
  const { w } = boot({ viewMode: 'grid' });
  await ready(w);
  const count = () => w.document.querySelectorAll('#recipe-grid [data-slug], #recipe-list [data-slug]').length;
  const total = count();
  t('nejaky recepty na zacatku', total > 0, 'pocet=' + total);

  const search = w.document.getElementById('search');
  search.value = 'zzzznesmysl';
  search.dispatchEvent(new w.Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 60));
  t('hledani nesmyslu nic nenajde', count() === 0, 'pocet=' + count());
  const noRes = w.document.getElementById('no-results');
  t('hlaska o zadnych vysledcich se ukaze', noRes && !noRes.classList.contains('hidden'));

  search.value = '';
  search.dispatchEvent(new w.Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 60));
  t('vymazani hledani vrati vse', count() === total, 'pocet=' + count());

  const catBtn = w.document.querySelector('.filter-btn[data-category]:not([data-category="all"]):not([data-category="__fav"])');
  if (catBtn) {
    const cat = catBtn.dataset.category;
    catBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const n = count();
    t('filtr kategorie zuzi vyber', n > 0 && n <= total, 'pocet=' + n + ' z ' + total);
    const gt = w.document.getElementById('grid-title');
    t('nadpis ukazuje kategorii', gt && gt.textContent === cat, gt && gt.textContent);
  }
}

console.log('\n' + (fail === 0 ? '=== VSE PROSLO ===' : '=== ' + fail + ' TESTU SELHALO ==='));
process.exit(fail === 0 ? 0 : 1);
