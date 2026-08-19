// ==========================================================================
// session.js  --  prihlasovaci "listek"
//
// Po prihlaseni pres Google dostane prohlizec listek, kterym se pak
// prokazuje. Listek je podepsany tajnym klicem, ktery zna jen Worker -
// kdyz do nej nekdo sahne, podpis prestane sedet a Worker ho zahodi.
//
// Listek NENI sifrovany. Kdokoli si v nem precte email a roli. To nevadi,
// smyslem je zabranit PODVRZENI, ne cteni. Nikdy do nej nedavej nic,
// co nema uzivatel videt.
// ==========================================================================

const enc = new TextEncoder();

function b64urlEncode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

/** Porovnani podpisu v konstantnim case - aby se nedal uhodnout po znacich. */
function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Vyrobi podepsany listek.
 *
 * @param {Object} payload  co ma listek nest (sub, email, name, role)
 * @param {string} secret
 * @param {number} ttlSeconds  jak dlouho plati
 */
export async function signSession(payload, secret, ttlSeconds) {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (ttlSeconds || 60 * 60 * 24 * 30),
  };
  const head = b64urlEncode(enc.encode(JSON.stringify(body)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(head)));
  return head + '.' + b64urlEncode(sig);
}

/**
 * Overi listek. Vraci obsah, nebo null kdyz je podvrzeny, poskozeny
 * nebo uz vyprsel.
 */
export async function verifySession(token, secret) {
  if (typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [head, sig] = token.split('.');
  if (!head || !sig) return null;

  let expected;
  try {
    const key = await hmacKey(secret);
    expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(head)));
  } catch { return null; }

  let given;
  try { given = b64urlDecode(sig); } catch { return null; }
  if (!sameBytes(expected, given)) return null;

  let body;
  try { body = JSON.parse(new TextDecoder().decode(b64urlDecode(head))); } catch { return null; }
  if (!body || typeof body.exp !== 'number') return null;
  if (body.exp < Math.floor(Date.now() / 1000)) return null;
  return body;
}

/** Vytahne listek z hlavicky "Authorization: Bearer ...". */
export function bearerToken(request) {
  const h = request.headers.get('Authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}
