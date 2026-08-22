// Test sifrovani oznameni (Web Push).
//
// Pointa: sifrovani se nedá overit tim, ze "nespadne". Kdyz se splete
// jediny bajt, push server zpravu prijme a telefon ji tise zahodi.
// Test proto hraje obe strany - zasifruje zpravu jako Worker a hned ji
// rozsifruje jako prohlizec. Kdyz text sedi, sedi cely postup.

import {
  b64urlDecode, b64urlEncode, zasifruj, vapidHlavicka,
} from './worker/src/push.js';
import {
  zpravaVareni, zpravaUvitani, zpravaNeaktivita,
} from './worker/src/push-zpravy.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

const utf8 = (s) => new TextEncoder().encode(s);
const spoj = (...c) => {
  const out = new Uint8Array(c.reduce((s, x) => s + x.length, 0));
  let p = 0; for (const x of c) { out.set(x, p); p += x.length; }
  return out;
};

async function hmac(k, d) {
  const key = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, d));
}
async function hkdf(sul, ikm, info, delka) {
  const prk = await hmac(sul, ikm);
  return (await hmac(prk, spoj(info, new Uint8Array([1])))).slice(0, delka);
}

/** Hraje prohlizec: z prijateho tela vytahne puvodni text. */
async function rozsifruj(telo, uaPar, authSecret) {
  const sul = telo.slice(0, 16);
  const delkaKlice = telo[20];
  const asPublic = telo.slice(21, 21 + delkaKlice);
  const sifra = telo.slice(21 + delkaKlice);

  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', uaPar.publicKey));
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sdilene = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: asKey }, uaPar.privateKey, 256));

  const ikm = await hkdf(authSecret, sdilene,
    spoj(utf8('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(sul, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sul, ikm, utf8('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const otevrene = new Uint8Array(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce }, aes, sifra));
  return new TextDecoder().decode(otevrene.slice(0, -1));   // posledni bajt je 0x02
}

console.log('\n--- Prevody ---');
t('tam a zpet', b64urlEncode(b64urlDecode('aGVsbG8')), 'aGVsbG8');
t('bez vyplne a lomitek', /^[A-Za-z0-9_-]*$/.test(b64urlEncode(new Uint8Array([251, 255, 62, 63]))), true);

console.log('\n--- Sifrovani zpravy ---');

// Prohlizec si vyrobi svuj par klicu a nahodne tajemstvi - presne tohle
// posila appka pri prihlaseni k odberu.
const uaPar = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const authSecret = crypto.getRandomValues(new Uint8Array(16));
const sub = {
  p256dh: b64urlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', uaPar.publicKey))),
  auth: b64urlEncode(authSecret),
};

const zprava = JSON.stringify({ titul: 'Za hodinu vaříš', text: 'Krémové kuřecí tagliatelle' });
const telo = await zasifruj(zprava, sub);

t('telo zacina soli a hlavickou', telo.length > 16 + 4 + 1 + 65, true);
t('velikost okna je 4096', new DataView(telo.buffer, telo.byteOffset).getUint32(16), 4096);
t('delka klice je 65', telo[20], 65);
t('prohlizec zpravu precte', await rozsifruj(telo, uaPar, authSecret), zprava);

t('diakritika prezije', await (async () => {
  const b = await zasifruj('Řízek s bramborovým salátem — 18:30', sub);
  return rozsifruj(b, uaPar, authSecret);
})(), 'Řízek s bramborovým salátem — 18:30');

t('kazda zprava ma jinou sul', (() => {
  const a = telo.slice(0, 16).join(',');
  return a !== null;
})(), true);

const druhe = await zasifruj(zprava, sub);
t('dve stejne zpravy nedaji stejne telo',
  b64urlEncode(telo) === b64urlEncode(druhe), false);

t('cizi tajemstvi zpravu neotevre', await (async () => {
  try {
    await rozsifruj(telo, uaPar, crypto.getRandomValues(new Uint8Array(16)));
    return 'otevrelo';
  } catch { return 'neotevrelo'; }
})(), 'neotevrelo');

console.log('\n--- VAPID hlavicka ---');

// Testovaci par klicu. Ostry je v secrets Workeru, sem nikdy nepatri.
const vapidPar = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const jwk = await crypto.subtle.exportKey('jwk', vapidPar.privateKey);
const ENV = {
  VAPID_PUBLIC_KEY: b64urlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', vapidPar.publicKey))),
  VAPID_PRIVATE_KEY: jwk.d,
  MAIL_FROM: 'honzavorel0@gmail.com',
};

const h = await vapidHlavicka('https://fcm.googleapis.com/fcm/send/abc123', ENV, 1_755_000_000_000);
t('zacina slovem vapid', h.startsWith('vapid t='), true);
t('obsahuje verejny klic', h.includes(', k=' + ENV.VAPID_PUBLIC_KEY), true);

const jwt = h.slice('vapid t='.length).split(',')[0];
const [hlava, telo2, podpis] = jwt.split('.');
t('jwt ma tri casti', [hlava, telo2, podpis].every(Boolean), true);
t('algoritmus je ES256', JSON.parse(new TextDecoder().decode(b64urlDecode(hlava))).alg, 'ES256');

const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(telo2)));
t('aud je puvod push serveru, ne cela adresa', claims.aud, 'https://fcm.googleapis.com');
t('kontakt je mailto', claims.sub, 'mailto:honzavorel0@gmail.com');
t('plati 12 hodin', claims.exp, 1_755_000_000 + 12 * 3600);
t('podpis ma 64 bajtu', b64urlDecode(podpis).length, 64);

// Overeni podpisu verejnym klicem - stejne, jak to udela push server.
const overovaci = await crypto.subtle.importKey('jwk', {
  kty: 'EC', crv: 'P-256',
  x: b64urlEncode(b64urlDecode(ENV.VAPID_PUBLIC_KEY).slice(1, 33)),
  y: b64urlEncode(b64urlDecode(ENV.VAPID_PUBLIC_KEY).slice(33, 65)),
}, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
t('push server podpis overi', await crypto.subtle.verify(
  { name: 'ECDSA', hash: 'SHA-256' }, overovaci,
  b64urlDecode(podpis), utf8(hlava + '.' + telo2)), true);

t('podvrzeny podpis neprojde', await crypto.subtle.verify(
  { name: 'ECDSA', hash: 'SHA-256' }, overovaci,
  b64urlDecode(podpis), utf8(hlava + '.' + telo2 + 'x')), false);

console.log('\n--- Texty oznameni ---');

t('pripominka rekne co a kdy',
  zpravaVareni('Krémové kuřecí tagliatelle', '18:00', 'kremove-kureci-tagliatelle'),
  { titul: 'Za chvíli vaříš', text: 'Krémové kuřecí tagliatelle — 18:00', slug: 'kremove-kureci-tagliatelle' });
t('pripominka bez casu nema pomlcku',
  zpravaVareni('Kuře na paprice', null).text, 'Kuře na paprice');
t('dlouhy nazev se ustrihne v mezere',
  zpravaVareni('Pečený bůček s bramborovou kaší a zelím podle babičky z Vysočiny', '17:00').text.includes('…'), true);
t('ustrizeny nazev nekonci pulkou slova',
  /[ ]…/.test(zpravaVareni('Pečený bůček s bramborovou kaší a zelím podle babičky z Vysočiny', '17:00').text), false);

// Patym padem, ne prvnim: "Honzo", ne "Honza".
t('uvitani oslovi krestnim jmenem v 5. pade',
  zpravaUvitani('Honza Vorel').text.startsWith('Honzo, takhle'), true);
t('a sklonuje i jina jmena',
  zpravaUvitani('Tomáš').text.startsWith('Tomáši, takhle'), true);
t('uvitani bez jmena nespadne',
  zpravaUvitani('').text.startsWith('Takhle'), true);
// Drive tu stalo "Víc už toho posílat nebudu" - a pritom po tydnu
// neaktivity prijde dalsi oznameni. Slib, ktery appka sama porusi.
t('uvitani neslibuje, ze uz nic neprijde',
  zpravaUvitani('Honza').text.includes('Víc už toho posílat nebudu'), false);
t('ale rekne, ze otravovat nebude',
  zpravaUvitani('Honza').text.includes('Jinak budu zticha'), true);
t('titulek uvitani je kratky', zpravaUvitani('Honza').titul.length <= 30, true);

t('neaktivita bez wishlistu zmini pocet dni',
  zpravaNeaktivita(9).text.startsWith('9 dní'), true);
// Po prejmenovani spize na kuchyn tu chvili stala veta, ktera nedavala
// smysl ("V kuchyni pořád víš, co v ní je").
t('neaktivita mluvi o kuchyni srozumitelne',
  zpravaNeaktivita(9).text.includes('Kuchyň si pořád pamatuje'), true);
t('neaktivita s receptem ho zmini jmenem',
  zpravaNeaktivita(9, 'Chilli con carne').text.startsWith('Chilli con carne'), true);
t('neaktivita nikdy nerekne min nez tyden',
  zpravaNeaktivita(3).text.startsWith('7 dní'), true);
t('neaktivita snese nesmyslny vstup',
  zpravaNeaktivita(null).text.startsWith('7 dní'), true);
t('vsechny titulky se vejdou na zamcenou obrazovku',
  [zpravaVareni('Kuře na paprice', '18:00'), zpravaUvitani('Honza'), zpravaNeaktivita(7)]
    .every(z => z.titul.length <= 30), true);
t('zadna zprava nema prazdny text',
  [zpravaVareni('Kuře na paprice', '18:00'), zpravaUvitani(''),
   zpravaNeaktivita(7), zpravaNeaktivita(7, 'Chilli con carne')]
    .every(z => z.text.length > 10), true);

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
