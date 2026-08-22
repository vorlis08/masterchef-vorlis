// ==========================================================================
// google.js  --  prihlaseni pres Google
//
// Prubeh:
//   1. /auth/start     -> posleme uzivatele ke Googlu
//   2. Google se ho zepta, jestli souhlasi
//   3. /auth/callback  -> Google vrati jednorazovy kod
//   4. Worker kod vymeni (uz sam, s tajemstvim) za udaje o uzivateli
//   5. Worker vyrobi podepsany listek a posle uzivatele zpatky do appky
//
// Klic ke Googlu se do prohlizece nikdy nedostane - vymenu dela Worker.
// ==========================================================================

import { signSession, verifySession } from './session.js';
import { sendWelcome, adminNewUser } from './mail.js';
import { SCOPE_KALENDAR } from './gcal.js';
import { VYCHOZI_NAZEV } from '../../src/lib/kuchyne.js';

const GOOGLE_AUTH  = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';

/** Adresa, kam Google vraci uzivatele. Musi presne sedet s nastavenim u Googlu. */
export function redirectUri(request) {
  return new URL('/auth/callback', new URL(request.url).origin).toString();
}

/**
 * Kam se smi uzivatel po prihlaseni vratit.
 * Bez tehle kontroly by slo poslat uzivatele i s listkem na cizi web.
 */
function safeReturnUrl(candidate, allowed) {
  if (!candidate) return allowed[0];
  const ok = allowed.some(origin => candidate === origin || candidate.startsWith(origin + '/'));
  return ok ? candidate : allowed[0];
}

/** Krok 1: presmerovani ke Googlu. */
export async function startLogin(request, env, allowed) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return failPage('Přihlášení přes Google zatím není nastavené.');
  }
  const url = new URL(request.url);
  const back = safeReturnUrl(url.searchParams.get('return'), allowed);

  // Stav je taky podepsany - Google nam ho vrati a my poznáme, ze je nas.
  // Kratka platnost: prihlaseni se ma dokoncit hned.
  // `gcal` si nese informaci, ze uzivatel prisel PRAVE kvuli kalendari.
  // Podle nej se po navratu prepinac sam zapne. Bez toho se clovek
  // zacykli: souhlas da, ale prepinac zustane vypnuty, takze ho appka
  // posle pro souhlas znovu.
  //
  // Je to v PODEPSANEM stavu, ne v adrese - jinak by si kdokoliv mohl
  // zapnout zapis do ciziho kalendare pouhym odkazem.
  const chceKalendar = url.searchParams.get('consent') === '1';
  const state = await signSession(
    { back: back, kind: 'oauth-state', gcal: chceKalendar }, env.SESSION_SECRET, 600);

  const to = new URL(GOOGLE_AUTH);
  to.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  to.searchParams.set('redirect_uri', redirectUri(request));
  to.searchParams.set('response_type', 'code');
  // Kalendar je navic k prihlaseni. Google si na nej rekne uzivateli
  // zvlast - kdo souhlas nedá, prihlasi se dal, jen mu vareni do
  // kalendare chodit nebude.
  to.searchParams.set('scope', 'openid email profile ' + SCOPE_KALENDAR);
  to.searchParams.set('state', state);

  // Bez `offline` dostaneme jen hodinovy pristup a do kalendare by
  // neslo zapsat nic pozdeji. Obnovovaci token ale Google posle jen
  // pri souhlasne obrazovce - proto `consent=1`, kterym appka posila
  // uzivatele, kdyz kalendar pripojuje (nebo pripojuje znovu).
  to.searchParams.set('access_type', 'offline');
  to.searchParams.set('include_granted_scopes', 'true');
  to.searchParams.set('prompt', chceKalendar ? 'consent' : 'select_account');

  return Response.redirect(to.toString(), 302);
}

/** Rozebere id_token od Googlu. Prisel primo od Googlu po TLS, takze ho jen cteme. */
function readIdToken(idToken) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const pad = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}

/** Krok 4+5: vymena kodu za udaje, zalozeni uzivatele, vydani listku. */
export async function finishLogin(request, env, allowed, ctx) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (url.searchParams.get('error')) return failPage('Přihlášení jsi zrušil.');
  if (!code || !state) return failPage('Chybí údaje od Googlu.');

  const st = await verifySession(state, env.SESSION_SECRET);
  if (!st || st.kind !== 'oauth-state') return failPage('Přihlášení vypršelo, zkus to znovu.');

  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(request),
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    console.error('Google token ' + res.status + ': ' + (await res.text()).slice(0, 300));
    return failPage('Google odmítl přihlášení.');
  }

  const data = await res.json();
  const claims = readIdToken(data.id_token);
  if (!claims || !claims.email) return failPage('Google neposlal e-mail.');
  if (claims.aud !== env.GOOGLE_CLIENT_ID) return failPage('Přihlášení nepatří téhle aplikaci.');
  if (!/(^|\.)accounts\.google\.com$|^https:\/\/accounts\.google\.com$/.test(claims.iss || '')) {
    return failPage('Neznámý vydavatel přihlášení.');
  }
  if (claims.email_verified === false) return failPage('Tenhle e-mail není u Googlu ověřený.');

  const user = await upsertUser(env.DB, claims);

  // Obnovovaci token prijde jen tehdy, kdyz uzivatel prave prosel
  // souhlasnou obrazovkou. Pri beznem prihlaseni nechodi - proto se
  // ten ulozeny NIKDY neprepisuje prazdnou hodnotou.
  //
  // V try schvalne: kalendar je DOPLNEK. Kdyz zapis selze (treba
  // proto, ze jeste nedobehla migrace), uzivatel se musi prihlasit
  // stejne. Draze zjisteno - bez toho padalo cele prihlaseni na
  // Error 1101 a do appky se nedalo vubec dostat.
  if (data.refresh_token) {
    try {
      // Prepinac zapiname JEN kdyz uzivatel prisel kvuli kalendari
      // (st.gcal). Pri uplne prvnim prihlaseni Google taky posle
      // obnovovaci token - ale to neni souhlas s tim, aby mu appka
      // psala do kalendare. O to si musi rict sam.
      await env.DB.prepare(
        st.gcal
          ? 'UPDATE users SET google_refresh = ?, gcal_on = 1 WHERE id = ?'
          : 'UPDATE users SET google_refresh = ? WHERE id = ?'
      ).bind(data.refresh_token, user.id).run();
    } catch (e) {
      console.error('ulozeni pristupu ke kalendari selhalo: ' + String(e).slice(0, 200));
    }
  }

  // Uvitaci e-mail az po prvnim prihlaseni. Posila se na pozadi - uzivatel
  // na nej neceka a kdyz posilatel selze, prihlaseni to nerozbije.
  if (!user.welcome_sent_at) {
    const odeslani = (async () => {
      await sendWelcome(env, user);
      // 9. Zprava spravci o novem uzivateli. Jde jen tobe, takze bez
      //    ohledu na nastaveni upozorneni.
      if (user.jeNovy) {
        const pocet = await env.DB.prepare('SELECT COUNT(*) AS p FROM users').first();
        await adminNewUser(env, user, (pocet && pocet.p) || '?');
      }
    })();
    if (ctx && ctx.waitUntil) ctx.waitUntil(odeslani);
  }
  const token = await signSession(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    env.SESSION_SECRET,
    60 * 60 * 24 * 30
  );

  // Listek jde za mrizkou - ta se na server neposila a nezustane v logu.
  return Response.redirect(safeReturnUrl(st.back, allowed) + '#token=' + encodeURIComponent(token), 302);
}

/**
 * Zalozi uzivatele, nebo najde uz existujiciho podle e-mailu.
 * Role se pri opakovanem prihlaseni NEPREPISUJE - jinak by se admin
 * pri kazdem prihlaseni degradoval na bezneho uzivatele.
 */
async function upsertUser(db, claims) {
  const email = String(claims.email).toLowerCase();
  const name = claims.name || claims.given_name || null;

  const found = await db.prepare('SELECT id, email, name, role, welcome_sent_at, unsub_token FROM users WHERE email = ?')
    .bind(email).first();

  if (found) {
    // Starsi ucty token na odhlaseni jeste nemaji - doplnime ho.
    if (!found.unsub_token) {
      found.unsub_token = crypto.randomUUID();
      await db.prepare('UPDATE users SET unsub_token = ? WHERE id = ?')
        .bind(found.unsub_token, found.id).run();
    }
    if (name && name !== found.name) {
      await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, found.id).run();
      found.name = name;
    }
    return found;
  }

  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  // gcal_on rovnou zapnute - appka uz na to prepinac nema a vsechno
  // chodi od zacatku. Zapis do kalendare stejne nic neudela, dokud
  // uzivatel nedá Googlu souhlas.
  await db.prepare(
    'INSERT INTO users (id, email, name, role, unsub_token, gcal_on) VALUES (?, ?, ?, ?, ?, 1)'
  ).bind(id, email, name, 'user', token).run();

  // Kazdy dostane jednu kuchyn rovnou. Suroviny patri kuchyni, takze
  // bez ni by nemel prvni surovinu kam ulozit - a resit to az pri
  // prvnim zapisu znamena resit to v pulce mist v api.js.
  // V try schvalne: zalozeni uctu nesmi spadnout na doplnku.
  try {
    const k = await db.prepare('INSERT INTO kitchens (user_id, name) VALUES (?, ?)')
      .bind(id, VYCHOZI_NAZEV).run();
    const kid = k.meta && k.meta.last_row_id;
    if (kid) await db.prepare('UPDATE users SET active_kitchen_id = ? WHERE id = ?').bind(kid, id).run();
  } catch (e) {
    console.error('zalozeni kuchyne selhalo: ' + String(e).slice(0, 200));
  }

  return {
    id: id, email: email, name: name, role: 'user',
    welcome_sent_at: null, unsub_token: token, jeNovy: true,
  };
}

/** Chybova stranka - uzivatel je tu po presmerovani, nekouka do konzole. */
function failPage(message) {
  const body = '<!doctype html><meta charset="utf-8">' +
    '<title>Přihlášení se nepovedlo</title>' +
    '<body style="font-family:system-ui;padding:2rem;line-height:1.5">' +
    '<h1 style="font-size:1.25rem">Přihlášení se nepovedlo</h1>' +
    '<p>' + message.replace(/[<>&]/g, '') + '</p>' +
    '<p><a href="https://vorlis08.github.io/masterchef-vorlis/">Zpátky do kuchařky</a></p>';
  return new Response(body, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
