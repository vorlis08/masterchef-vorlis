import { signSession, verifySession, bearerToken } from './worker/src/session.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

const TAJEMSTVI = 'tajny-klic-jen-pro-worker';
const UZIVATEL = { sub: 'honza', email: 'honzavorel0@gmail.com', name: 'Honza Vorel', role: 'admin' };

console.log('\n--- Podepsany listek ---');
const listek = await signSession(UZIVATEL, TAJEMSTVI, 3600);
const obsah = await verifySession(listek, TAJEMSTVI);
t('listek se overi', !!obsah, true);
t('nese uzivatele', obsah.sub, 'honza');
t('nese email', obsah.email, 'honzavorel0@gmail.com');
t('nese roli', obsah.role, 'admin');
t('ma platnost', typeof obsah.exp, 'number');

console.log('\n--- Co se musi odmitnout ---');
t('jiny podpisovy klic', await verifySession(listek, 'jine-tajemstvi'), null);

const [hlava, podpis] = listek.split('.');
t('podvrzeny podpis', await verifySession(hlava + '.' + 'AAAA' + podpis.slice(4), TAJEMSTVI), null);

// zmena obsahu (povyseni na admina) musi rozbit podpis
const bezny = await signSession({ sub: 'cizi', email: 'x@y.cz', role: 'user' }, TAJEMSTVI, 3600);
const [bh, bp] = bezny.split('.');
const zfalsovanyObsah = Buffer.from(JSON.stringify({ sub: 'cizi', email: 'x@y.cz', role: 'admin', exp: 99999999999 }))
  .toString('base64url');
t('prepsany obsah (povyseni na admina)', await verifySession(zfalsovanyObsah + '.' + bp, TAJEMSTVI), null);

t('prazdny listek', await verifySession('', TAJEMSTVI), null);
t('nesmysl', await verifySession('abcdef', TAJEMSTVI), null);
t('jen tecka', await verifySession('.', TAJEMSTVI), null);
t('null', await verifySession(null, TAJEMSTVI), null);

console.log('\n--- Platnost ---');
const prosly = await signSession(UZIVATEL, TAJEMSTVI, -10);
t('prosly listek se odmitne', await verifySession(prosly, TAJEMSTVI), null);

console.log('\n--- Cteni z hlavicky ---');
const req = h => ({ headers: { get: () => h } });
t('Bearer se precte', bearerToken(req('Bearer abc.def')), 'abc.def');
t('bearer malymi pismeny', bearerToken(req('bearer abc.def')), 'abc.def');
t('bez hlavicky', bearerToken(req('')), null);
t('jina hlavicka', bearerToken(req('Basic neco')), null);

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
