// ==========================================================================
// push.js  --  oznameni na telefon (Web Push)
//
// Proc to neni jen "posli zpravu": push server (Google, Apple, Mozilla)
// obsah zpravy NIKDY nevidi. Text se sifruje klicem, ktery zna jen
// prohlizec uzivatele. Worker tedy musi udelat dve veci:
//
//   1. PODEPSAT se push serveru        -> VAPID (JWT podepsany ES256)
//   2. ZASIFROVAT obsah pro prohlizec  -> aes128gcm (RFC 8291)
//
// Obojí se sklada z Web Crypto, zadna knihovna. Postup je presne dany
// normou, takze se v nem nedaji delat "vylepseni" - kdyz se zmeni jediny
// bajt v poradi, push server to vezme, ale telefon zpravu zahodi bez
// chybove hlasky. Proto je na to `test-push.mjs`, ktery zpravu zase
// rozsifruje a porovna.
//
// Klice: VAPID_PUBLIC_KEY (verejny, smi do prohlizece) a
// VAPID_PRIVATE_KEY (secret). Generuji se skriptem scripts/vapid-keys.mjs.
// ==========================================================================

// -- Prevody -------------------------------------------------------------

export function b64urlDecode(s) {
  const base = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(base + '='.repeat((4 - base.length % 4) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function b64urlEncode(bytes) {
  let bin = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function spoj(...casti) {
  const delka = casti.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(delka);
  let pos = 0;
  for (const c of casti) { out.set(c, pos); pos += c.length; }
  return out;
}

const utf8 = (s) => new TextEncoder().encode(s);

// -- VAPID: podpis pro push server ----------------------------------------

/**
 * Slozi z verejneho a soukromeho klice JWK, se kterym umi Web Crypto
 * podepisovat. Verejny klic je 65 bajtu "nekomprimovaneho" bodu:
 * 0x04 || X (32 B) || Y (32 B) - X a Y se z nej jen vykrojí.
 */
async function podepisovaciKlic(verejny, soukromy) {
  const v = b64urlDecode(verejny);
  if (v.length !== 65 || v[0] !== 4) throw new Error('VAPID_PUBLIC_KEY nema 65 bajtu');
  return crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256',
    x: b64urlEncode(v.slice(1, 33)),
    y: b64urlEncode(v.slice(33, 65)),
    d: soukromy,
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/**
 * VAPID hlavicka. `aud` je puvod push serveru (ne nase adresa) a
 * `sub` musi byt kontakt na provozovatele - push server podle nej vi,
 * komu si stezovat, kdyz zpravy zlobi.
 */
export async function vapidHlavicka(endpoint, env, ted) {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor((ted || Date.now()) / 1000) + 12 * 3600;

  const hlava = b64urlEncode(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const telo = b64urlEncode(utf8(JSON.stringify({
    aud, exp, sub: 'mailto:' + (env.MAIL_FROM || 'honzavorel0@gmail.com'),
  })));

  const klic = await podepisovaciKlic(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const podpis = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, klic, utf8(hlava + '.' + telo)
  );

  return 'vapid t=' + hlava + '.' + telo + '.' + b64urlEncode(podpis) +
    ', k=' + env.VAPID_PUBLIC_KEY;
}

// -- Sifrovani obsahu (RFC 8291) ------------------------------------------

async function hmac(klicBajty, data) {
  const k = await crypto.subtle.importKey(
    'raw', klicBajty, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/** HKDF, jak ho pouziva push: jeden blok, takze staci info || 0x01. */
async function hkdf(sul, ikm, info, delka) {
  const prk = await hmac(sul, ikm);
  const out = await hmac(prk, spoj(info, new Uint8Array([1])));
  return out.slice(0, delka);
}

/**
 * Zasifruje text pro jednu konkretni prihlasku.
 *
 * @param {string} plaintext  co ma prijit do telefonu (JSON)
 * @param {{p256dh: string, auth: string}} sub  klice z prohlizece
 * @returns {Promise<Uint8Array>} telo pozadavku
 */
export async function zasifruj(plaintext, sub, testKeys) {
  const uaPublic = b64urlDecode(sub.p256dh);      // verejny klic prohlizece
  const authSecret = b64urlDecode(sub.auth);      // sdilene tajemstvi

  // Jednorazovy par klicu - pro kazdou zpravu novy.
  const par = testKeys || await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));

  const uaKey = await crypto.subtle.importKey(
    'raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const sdilene = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaKey }, par.privateKey, 256
  ));

  // Z ECDH tajemstvi a `auth` vznikne vstup pro odvozeni klice. Do
  // "info" se davaji OBA verejne klice v poradi prohlizec, pak nas -
  // prohozene poradi da jiny klic a telefon zpravu zahodi.
  const ikm = await hkdf(
    authSecret, sdilene,
    spoj(utf8('WebPush: info\0'), uaPublic, asPublic), 32
  );

  const sul = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sul, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sul, ikm, utf8('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // 0x02 na konci znamena "tohle je posledni (a jediny) kus zpravy".
  const sifra = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aes, spoj(utf8(plaintext), new Uint8Array([2]))
  ));

  // Hlavicka tela: sul (16) || velikost okna (4) || delka klice (1) || klic (65)
  const okno = new Uint8Array(4);
  new DataView(okno.buffer).setUint32(0, 4096);

  return spoj(sul, okno, new Uint8Array([asPublic.length]), asPublic, sifra);
}

// -- Odeslani -------------------------------------------------------------

/**
 * Posle jedno oznameni.
 *
 * @returns {Promise<{ok: boolean, status: number, mrtva: boolean}>}
 *   `mrtva` znamena, ze prihlaska uz neplati (uzivatel appku smazal
 *   nebo oznameni zakazal) a ma se z databaze vyhodit. Push servery to
 *   hlasi jako 404 nebo 410.
 */
export async function poslatPush(env, sub, zprava) {
  const telo = await zasifruj(JSON.stringify(zprava), sub);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': await vapidHlavicka(sub.endpoint, env),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '3600',
      'Urgency': 'normal',
    },
    body: telo,
  });
  return { ok: res.ok, status: res.status, mrtva: res.status === 404 || res.status === 410 };
}
