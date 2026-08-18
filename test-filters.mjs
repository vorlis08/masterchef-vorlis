import {
  filterRecipes, matchesSearch, matchesCategory, matchesMeal, matchesTime,
  headingFor, countLabel
} from './src/lib/filters.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

const R = [
  { slug: 'chilli', title: 'Chilli con carne', category: 'Maso', time: '1 hod 30 min',
    meal_type: ['oběd', 'večeře'], tags: ['ostré'], ingredients: ['mleté maso', 'fazole'] },
  { slug: 'palacinky', title: 'Palačinky', category: 'Sladké', time: '20 min',
    meal_type: ['snídaně'], tags: [], ingredients: ['mouka', 'vejce', 'mléko'] },
  { slug: 'carbonara', title: 'Carbonara', category: 'Těstoviny', time: '25 min',
    meal_type: ['večeře'], tags: ['rychlé'], ingredients: ['slanina', 'vejce', 'parmazán'] },
  { slug: 'gulas', title: 'Guláš', category: 'Maso', time: '2 hod',
    meal_type: ['oběd'], tags: [], ingredients: ['hovězí', 'cibule'] },
  { slug: 'bezcasu', title: 'Bez času', category: 'Maso', time: '',
    meal_type: [], tags: [], ingredients: ['sůl'] },
];
const slugs = list => list.map(r => r.slug);

console.log('\n--- Hledani ---');
t('prazdny dotaz projde vse', matchesSearch(R[0], ''), true);
t('najde v nazvu', matchesSearch(R[1], 'palacinky'), true);
t('diakritika nevadi', matchesSearch(R[1], 'Palačinky'), true);
t('najde v surovinach', matchesSearch(R[2], 'slanina'), true);
t('sklonovani: slanina najde slaninou', matchesSearch({ ...R[2], ingredients: ['se slaninou'] }, 'slanina'), true);
t('najde v tazich', matchesSearch(R[0], 'ostré'), true);
t('nenajde nesmysl', matchesSearch(R[0], 'ananas'), false);

console.log('\n--- Kategorie ---');
t('all projde vse', matchesCategory(R[0], 'all', false), true);
t('sedici kategorie', matchesCategory(R[0], 'Maso', false), true);
t('nesedici kategorie', matchesCategory(R[0], 'Sladké', false), false);
t('__fav jen oblibene', matchesCategory(R[0], '__fav', true), true);
t('__fav vylouci neoblibene', matchesCategory(R[0], '__fav', false), false);

console.log('\n--- Typ jidla ---');
t('bez filtru projde', matchesMeal(R[0], null), true);
t('sedici typ', matchesMeal(R[0], 'oběd'), true);
t('nesedici typ', matchesMeal(R[1], 'oběd'), false);
t('prazdny meal_type neprojde filtrem', matchesMeal(R[4], 'oběd'), false);

console.log('\n--- Cas ---');
t('bez filtru projde', matchesTime(R[1], null), true);
t('20 min do pasma 20', matchesTime(R[1], '20'), true);
t('25 min nespada do 20', matchesTime(R[2], '20'), false);
t('25 min spada do 45', matchesTime(R[2], '45'), true);
t('90 min spada do 90', matchesTime(R[0], '90'), true);
t('2 hod spada do 90+', matchesTime(R[3], '90+'), true);
t('2 hod nespada do 90', matchesTime(R[3], '90'), false);
t('recept bez casu vypadne', matchesTime(R[4], '20'), false);
t('recept bez casu projde bez filtru', matchesTime(R[4], null), true);

console.log('\n--- Kombinace filtru ---');
t('bez kriterii vrati vse', slugs(filterRecipes(R, {})).length, 5);
t('jen kategorie Maso', slugs(filterRecipes(R, { category: 'Maso' })), ['chilli', 'gulas', 'bezcasu']);
t('kategorie + cas', slugs(filterRecipes(R, { category: 'Maso', time: '90+' })), ['gulas']);
t('oblibene', slugs(filterRecipes(R, { category: '__fav', favorites: ['carbonara'] })), ['carbonara']);
t('oblibene bez ulozenych', slugs(filterRecipes(R, { category: '__fav', favorites: [] })), []);
t('hledani + typ jidla', slugs(filterRecipes(R, { query: 'vejce', meal: 'večeře' })), ['carbonara']);
t('nic nesedi', slugs(filterRecipes(R, { query: 'ananas' })), []);
t('zachova poradi', slugs(filterRecipes(R, { category: 'Maso' })), ['chilli', 'gulas', 'bezcasu']);

console.log('\n--- Odolnost ---');
t('prazdny seznam receptu', filterRecipes([], { query: 'x' }), []);
t('chybejici seznam receptu', filterRecipes(null, {}), []);
t('chybejici kriteria', slugs(filterRecipes(R, null)).length, 5);

console.log('\n--- Popisky ---');
t('nadpis oblibene', headingFor('__fav'), 'Oblíbené');
t('nadpis vse', headingFor('all'), 'Rejstřík');
t('nadpis kategorie', headingFor('Maso'), 'Maso');
t('pocet 1', countLabel(1), '1 recept');
t('pocet 3', countLabel(3), '3 recepty');
t('pocet 12', countLabel(12), '12 receptů');
t('pocet 0', countLabel(0), '0 receptů');

console.log('\n' + (fail === 0 ? '=== VSE PROSLO ===' : '=== ' + fail + ' TESTU SELHALO ==='));
process.exit(fail === 0 ? 0 : 1);
