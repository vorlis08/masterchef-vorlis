// ==========================================================================
// digest.js  --  pravidelne zpravy (spousti je Cron ve Workeru)
//
// Bezi i kdyz je appka zavrena - proto Cron ve Workeru a ne kod
// v prohlizeci (viz 4.6 v PROJEKT.md).
//
// Recepty si Worker stahuje z GitHubu, aby existoval jediny zdroj pravdy.
// Kdyby je mel ve svoji kopii, rozesly by se s appkou do tydne.
// ==========================================================================

import { cleanName } from '../../src/lib/pantry.js';
import { fold } from '../../src/lib/recipe-logic.js';
import {
  sendMail, newRecipesMail, wishlistMail, summaryMail, adminError, unsubUrl,
} from './mail.js';

const RECIPES_URL =
  'https://raw.githubusercontent.com/vorlis08/masterchef-vorlis/main/src/data/recipes.json';

/** Nocni hodiny, kdy se neposila nic. Cas je v UTC, appka zije v CZ. */
export function jeVhodnaDoba(datum) {
  const hodinaCz = (datum.getUTCHours() + 2) % 24;   // hrube CEST
  return hodinaCz >= 7 && hodinaCz < 22;
}

async function nactiRecepty() {
  const res = await fetch(RECIPES_URL, { headers: { 'User-Agent': 'masterchef-worker' } });
  if (!res.ok) throw new Error('recipes.json ' + res.status);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Zapise si, ze uz zpravu poslal - aby neprisla dvakrat. */
async function zapisOdeslani(env, userId, kind, note) {
  await env.DB.prepare('INSERT INTO email_log (user_id, kind, note) VALUES (?, ?, ?)')
    .bind(userId, kind, note || null).run();
}

async function poslednich(env, userId, kind, dni) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS pocet FROM email_log WHERE user_id = ? AND kind = ? AND sent_at > datetime('now', ?)"
  ).bind(userId, kind, '-' + dni + ' days').first();
  return (row && row.pocet) || 0;
}

/**
 * Strop: nejvyse jedna zprava denne a tri tydne na cloveka.
 * Radsi vynechat nez poslat dve za sebou.
 */
async function smiSePoslat(env, userId) {
  const dnes = await env.DB.prepare(
    "SELECT COUNT(*) AS pocet FROM email_log WHERE user_id = ? AND sent_at > datetime('now', '-20 hours')"
  ).bind(userId).first();
  if ((dnes && dnes.pocet) > 0) return false;

  const tyden = await env.DB.prepare(
    "SELECT COUNT(*) AS pocet FROM email_log WHERE user_id = ? AND sent_at > datetime('now', '-7 days')"
  ).bind(userId).first();
  return ((tyden && tyden.pocet) || 0) < 3;
}

function odberatele(env, kind) {
  const sloupec = { recipes: 'notify_recipes', wishlist: 'notify_wishlist', summary: 'notify_summary' }[kind];
  return env.DB.prepare(
    'SELECT id, email, name, unsub_token, role FROM users WHERE ' + sloupec + ' = 1'
  ).all();
}

// -- 5. Nove recepty ------------------------------------------------------

/**
 * Porovna recepty na GitHubu s tim, co uz system videl.
 * Pri uplne prvnim behu se jen zapamatuji - nikomu se neposila,
 * jinak by prvni e-mail obsahoval celou kucharku.
 */
export async function noveRecepty(env) {
  const recepty = await nactiRecepty();
  if (!recepty.length) return { nove: [], prvniBeh: false };

  const { results } = await env.DB.prepare('SELECT slug FROM known_recipes').all();
  const znam = new Set((results || []).map(r => r.slug));
  const prvniBeh = znam.size === 0;

  const nove = recepty.filter(r => r.slug && !znam.has(r.slug));
  if (nove.length) {
    const stmt = env.DB.prepare('INSERT OR IGNORE INTO known_recipes (slug, title) VALUES (?, ?)');
    await env.DB.batch(nove.map(r => stmt.bind(r.slug, r.title || null)));
  }
  return { nove: prvniBeh ? [] : nove, prvniBeh: prvniBeh };
}

// -- 6. Z wishlistu jde uvarit -------------------------------------------

/**
 * Sedi surovina ze spize na surovinu z receptu?
 *
 * Nepouziva se ingredientMatch z recipe-logic: to porovnava podretezce,
 * takze "smetana" a "smetany" mu nesednou. Cestina sklonuje, proto se
 * porovnavaji koreny slov stejne jako v katalogu.
 */
function koreny(text) {
  return String(text).trim().split(/\s+/)
    .map(w => fold(w).replace(/[^a-z]/g, ''))
    .filter(w => w.length >= 3)     // "sul" a "med" musi projit
    .map(w => w.slice(0, 4));
}

export function sediSurovina(mamNazev, potreba) {
  const a = new Set(koreny(mamNazev));
  if (!a.size) return false;
  return koreny(potreba).some(st => a.has(st));
}

/**
 * Kolik surovin receptu uzivateli chybi.
 *
 * Pocita se jen s NEZAMCENYMI zasobami (4.2) a polozky oznacene
 * "mam doma standardne" se povazuji za dostupne vzdy (4.5).
 *
 * Zamerne to nevraci ano/ne, ale cislo - "co muzu uvarit" ma byt
 * skala, ne tvrdy filtr (4.3).
 */
export function chybejiciSuroviny(recept, spiz) {
  const mam = (spiz || [])
    .filter(i => {
      if (i.staple) return true;
      if (i.kind === 'approx') return i.status === 'mam' || i.status === 'dochazi';
      const volne = (Number(i.quantity) || 0) - (Number(i.reserved) || 0);
      return volne > 0;
    })
    .map(i => cleanName(i.name));

  const potreba = (recept.ingredients || []).map(cleanName).filter(Boolean);
  return potreba.filter(sur => !mam.some(m => sediSurovina(m, sur))).length;
}

export async function wishlistHotove(env, user, recepty) {
  const { results } = await env.DB.prepare(
    "SELECT recipe_slug FROM recipe_state WHERE user_id = ? AND status = 'wishlist'"
  ).bind(user.id).all();
  const chci = new Set((results || []).map(r => r.recipe_slug));
  if (!chci.size) return [];

  const spiz = await env.DB.prepare(
    `SELECT i.name, i.kind, i.quantity, i.status, i.staple,
            COALESCE((SELECT SUM(r.amount) FROM reservations r WHERE r.inventory_id = i.id), 0) AS reserved
       FROM inventory i WHERE i.user_id = ?`
  ).bind(user.id).all();

  return recepty
    .filter(r => chci.has(r.slug))
    .map(r => ({ title: r.title, slug: r.slug, chybi: chybejiciSuroviny(r, spiz.results || []) }))
    .filter(r => r.chybi === 0)
    .slice(0, 5);
}

// -- 8. Mesicni souhrn ----------------------------------------------------

export async function mesicniSouhrn(env, user) {
  const stat = await env.DB.prepare(
    `SELECT COALESCE(SUM(cooked), 0) AS uvareno,
            COUNT(*) AS ruznych
       FROM recipe_state
      WHERE user_id = ? AND cooked > 0 AND last_cooked > datetime('now', '-1 month')`
  ).bind(user.id).first();

  const nej = await env.DB.prepare(
    `SELECT recipe_slug FROM recipe_state
      WHERE user_id = ? AND cooked > 0 ORDER BY cooked DESC LIMIT 1`
  ).bind(user.id).first();

  const nejlepsi = await env.DB.prepare(
    `SELECT recipe_slug FROM recipe_state
      WHERE user_id = ? AND stars > 0 ORDER BY stars DESC, cooked DESC LIMIT 1`
  ).bind(user.id).first();

  const spiz = await env.DB.prepare(
    'SELECT COUNT(*) AS pocet FROM inventory WHERE user_id = ?'
  ).bind(user.id).first();

  return {
    uvareno: (stat && stat.uvareno) || 0,
    ruznych: (stat && stat.ruznych) || 0,
    nejcastejsi: nej ? nej.recipe_slug : null,
    nejlepsi: nejlepsi ? nejlepsi.recipe_slug : null,
    spiz: (spiz && spiz.pocet) || 0,
  };
}

// -- Spousteni ------------------------------------------------------------

/** Tydenni beh: nove recepty + co jde uvarit z wishlistu. */
export async function tydenniBeh(env, origin) {
  const { nove, prvniBeh } = await noveRecepty(env);
  const recepty = await nactiRecepty();
  let posláno = 0;

  const { results: lide } = await odberatele(env, 'recipes');
  if (nove.length && !prvniBeh) {
    for (const u of lide || []) {
      if (!(await smiSePoslat(env, u.id))) continue;
      const mail = newRecipesMail(u, nove.slice(0, 10), unsubUrl(origin, u, 'recipes'));
      if (await sendMail(env, { to: u.email, name: u.name, ...mail })) {
        await zapisOdeslani(env, u.id, 'recipes', nove.map(r => r.slug).join(','));
        posláno++;
      }
    }
  }

  const { results: lide2 } = await odberatele(env, 'wishlist');
  for (const u of lide2 || []) {
    if (!(await smiSePoslat(env, u.id))) continue;
    if (await poslednich(env, u.id, 'wishlist', 14)) continue;   // nejvys jednou za 14 dni
    const hotove = await wishlistHotove(env, u, recepty);
    if (!hotove.length) continue;
    const mail = wishlistMail(u, hotove, unsubUrl(origin, u, 'wishlist'));
    if (await sendMail(env, { to: u.email, name: u.name, ...mail })) {
      await zapisOdeslani(env, u.id, 'wishlist', hotove.map(h => h.slug).join(','));
      posláno++;
    }
  }
  return { nove: nove.length, prvniBeh: prvniBeh, posláno: posláno };
}

/** Mesicni beh: souhrn. */
export async function mesicniBeh(env, origin) {
  const { results: lide } = await odberatele(env, 'summary');
  let posláno = 0;
  for (const u of lide || []) {
    if (await poslednich(env, u.id, 'summary', 25)) continue;
    const s = await mesicniSouhrn(env, u);
    const mail = summaryMail(u, s, unsubUrl(origin, u, 'summary'));
    if (await sendMail(env, { to: u.email, name: u.name, ...mail })) {
      await zapisOdeslani(env, u.id, 'summary', null);
      posláno++;
    }
  }
  return { posláno: posláno };
}

/** Vstupni bod pro Cron. */
export async function spustCron(event, env, origin) {
  try {
    if (!jeVhodnaDoba(new Date())) return;
    if (event.cron === '0 5 1 * *') return void (await mesicniBeh(env, origin));
    return void (await tydenniBeh(env, origin));
  } catch (e) {
    console.error('Cron spadl: ' + String(e).slice(0, 300));
    await adminError(env, 'Cron ' + (event.cron || ''), e && e.stack ? e.stack : e);
  }
}
