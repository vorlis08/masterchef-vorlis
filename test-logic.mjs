// Test vytazene logiky - bez prohlizece, bez appky.
import {
  fold, normalizeWord, slugify, parseMinutes, esc, escAttr, formatNum, splitQty,
  scaleIngredient, roman, haystack, parseDurations, fmtClock,
  parseIngredients, ingredientMatch
} from './src/lib/recipe-logic.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

console.log('\n--- Hledani a text ---');
t('fold odstrani diakritiku', fold('Kuře na Paprice'), 'kure na paprice');
t('normalizeWord stejne', normalizeWord('Žížala'), 'zizala');
t('slugify', slugify('Kuře na paprice!'), 'kure-na-paprice');
t('esc osetri HTML', esc('<b>&</b>'), '&lt;b&gt;&amp;&lt;/b&gt;');
t('escAttr osetri uvozovky', escAttr('a" onerror="x'), 'a&quot; onerror&#61;&quot;x'.replace('&#61;', '='));
t('escAttr osetri apostrof', escAttr("a'b"), 'a&#39;b');
t('escAttr osetri i HTML', escAttr('<b>'), '&lt;b&gt;');

console.log('\n--- Cas ---');
t('parseMinutes hod+min', parseMinutes('1 hod 30 min'), 90);
t('parseMinutes jen min', parseMinutes('45 min'), 45);
t('parseMinutes prazdne', parseMinutes(''), null);
t('parseMinutes nesmysl', parseMinutes('brzy'), null);
t('fmtClock pod hodinu', fmtClock(125), '2:05');
t('fmtClock nad hodinu', fmtClock(3725), '1:02:05');

console.log('\n--- Cisla a mnozstvi ---');
t('formatNum desetinna carka', formatNum(1.5), '1,5');
t('formatNum zaokrouhleni', formatNum(0.333333), '0,33');
t('formatNum cele cislo', formatNum(200), '200');
t('splitQty s jednotkou', splitQty('200 g mouky'), { qty: '200 g', name: 'mouky' });
t('splitQty bez jednotky', splitQty('2 cibule'), { qty: '2', name: 'cibule' });
t('splitQty bez cisla', splitQty('sul'), { qty: '', name: 'sul' });
t('splitQty jen cislo', splitQty('200'), { qty: '', name: '200' });

console.log('\n--- Skalovani porci ---');
t('scale faktor 1 nemeni', scaleIngredient('200 g mouky', 1), '200 g mouky');
t('scale zdvojnasobi', scaleIngredient('200 g mouky', 2), '400 g mouky');
t('scale pulka', scaleIngredient('200 g mouky', 0.5), '100 g mouky');
t('scale rozsah', scaleIngredient('2-3 lzice', 2), '4-6 lzice');
t('scale desetinne', scaleIngredient('1,5 lzicky', 2), '3 lzicky');

console.log('\n--- Rimske cislice ---');
t('roman 1', roman(1), 'I');
t('roman 4', roman(4), 'IV');
t('roman 14', roman(14), 'XIV');
t('roman 0 -> pomlcka', roman(0), '\u2014');

console.log('\n--- Casovace z kroku ---');
t('najde minuty', parseDurations('Vari 15 minut'), [{ secs: 900, label: '15 minut' }]);
t('rozsah bere horni mez', parseDurations('Restuj 3-4 min'), [{ secs: 240, label: '3-4 min' }]);
t('prilis kratke ignoruje', parseDurations('pockej 2 sekundy'), []);
t('bez casu nic', parseDurations('Osol podle chuti'), []);
t('max 3 casovace', parseDurations('5 min, 10 min, 15 min, 20 min').length, 3);

console.log('\n--- Vyhledavaci text receptu ---');
t('haystack slepi a zbavi diakritiky',
  haystack({ title: 'Kuře', description: 'Dobré', category: 'Maso', tags: ['rychlé'], ingredients: ['sůl'] }),
  'kure dobre maso rychle sul');
t('haystack zvladne chybejici pole', haystack({ title: 'Test' }), 'test');

console.log('\n--- Suroviny od uzivatele ---');
t('parseIngredients carky', parseIngredients('kure, ryze, sul'), ['kure', 'ryze', 'sul']);
t('parseIngredients radky a strednik', parseIngredients('kure;ryze\nsul'), ['kure', 'ryze', 'sul']);
t('parseIngredients prazdne kusy', parseIngredients('kure,,  ,ryze'), ['kure', 'ryze']);
t('match najde shodu', ingredientMatch(['kure'], 'kuřecí prsa'), true);
t('match castecna shoda', ingredientMatch(['kureci'], 'kuřecí prsa'), true);
t('match diakritika nevadi', ingredientMatch(['sůl'], 'sul'), true);
t('match nenajde', ingredientMatch(['ryze'], 'mouka'), false);

console.log('\n' + (fail === 0 ? '=== VSE PROSLO ===' : '=== ' + fail + ' TESTU SELHALO ==='));
process.exit(fail === 0 ? 0 : 1);
