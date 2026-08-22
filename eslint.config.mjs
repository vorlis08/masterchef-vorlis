// ==========================================================================
// eslint.config.mjs  --  hlidac prekleputo
//
// Proc to tu je: v index.astro dlouho sedelo volani `paintWishBtn(slug)`
// s promennou, ktera na tom miste vubec neexistovala. Prohlizec na to
// prisel az ve chvili, kdy uzivatel prepnul recept na Fancy - vyjimka
// utla zbytek vykreslovani a pulka okna zustala v puvodni podobe.
//
// Zadny z 621 testu to chytit nemohl: testuje se `src/lib/`, ne lepidlo
// v index.astro. Tohle ano, a za pul vteriny.
//
// Pravidla jsou schvalne UZKA. Tohle neni nastroj na to, aby vnucoval
// styl - od toho tu neni nikdo. Hleda jen dve veci:
//   - `no-undef`       -> pouzita promenna, ktera nikde nevznikla
//   - `no-unused-vars` -> naopak zbytek po smazane funkci (jen varovani)
// ==========================================================================

const spolecnaPravidla = {
  'no-undef': 'error',
  'no-unused-vars': ['warn', {
    args: 'none',
    varsIgnorePattern: '^_',
    caughtErrors: 'none',
  }],
};

/** Co umi prohlizec. Doplnuje se, kdyz appka sahne po necem novem. */
const prohlizec = {
  window: 'readonly', document: 'readonly', navigator: 'readonly',
  location: 'readonly', history: 'readonly', localStorage: 'readonly',
  fetch: 'readonly', console: 'readonly', alert: 'readonly',
  confirm: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly',
  requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
  IntersectionObserver: 'readonly', MutationObserver: 'readonly',
  Notification: 'readonly', Image: 'readonly', FileReader: 'readonly',
  TextDecoder: 'readonly', TextEncoder: 'readonly', URLSearchParams: 'readonly',
  URL: 'readonly', CSS: 'readonly', atob: 'readonly', btoa: 'readonly',
  crypto: 'readonly', Intl: 'readonly', getComputedStyle: 'readonly',
};

/** Co umi Cloudflare Worker. Prohlizecove veci tu vetsinou taky jsou. */
const worker = {
  fetch: 'readonly', Response: 'readonly', Request: 'readonly',
  Headers: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
  crypto: 'readonly', console: 'readonly', atob: 'readonly', btoa: 'readonly',
  TextEncoder: 'readonly', TextDecoder: 'readonly', DataView: 'readonly',
  Uint8Array: 'readonly', Intl: 'readonly', escape: 'readonly',
};

/** Co umi Node - testy a skripty. */
const node = {
  console: 'readonly', process: 'readonly', Buffer: 'readonly',
  URL: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly',
  crypto: 'readonly', Intl: 'readonly', setTimeout: 'readonly',
  fetch: 'readonly',
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.astro/**', 'worker/.wrangler/**'],
  },
  {
    // "Mozek" - bezi v prohlizeci i ve Workeru, takze prunik obojiho.
    files: ['src/lib/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...prohlizec, ...worker },
    },
    rules: spolecnaPravidla,
  },
  {
    files: ['worker/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: worker,
    },
    rules: spolecnaPravidla,
  },
  {
    files: ['test-*.mjs', 'scripts/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: node,
    },
    rules: spolecnaPravidla,
  },
  {
    // Vytazeny <script> z index.astro - viz scripts/lint-astro.mjs.
    files: ['lint-tmp/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...prohlizec, webkitAudioContext: 'readonly' },
    },
    rules: spolecnaPravidla,
  },
];
