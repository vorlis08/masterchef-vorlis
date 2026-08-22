// ==========================================================================
// digest.js  --  pravidelne zpravy (spousti je Cron ve Workeru)
//
// Bezi i kdyz je appka zavrena - proto Cron ve Workeru a ne kod
// v prohlizeci (viz 4.6 v PROJEKT.md).
//
// Recepty si Worker stahuje z GitHubu, aby existoval jediny zdroj pravdy.
// Kdyby je mel ve svoji kopii, rozesly by se s appkou do tydne.
// ==========================================================================

import { sediSurovina, chybejici } from '../../src/lib/match.js';
import { cleanName } from '../../src/lib/pantry.js';
import {
  sendMail, newRecipesMail, wishlistMail, summaryMail, reminderMail,
  adminError, unsubUrl,
} from './mail.js';
import { zitra, popisBookingu, kPripomenuti } from '../../src/lib/booking.js';
import { poslatPush } from './push.js';
import { zpravaVareni, zpravaNeaktivita } from './push-zpravy.js';
import { nactiRecepty } from './recepty.js';
import { hodinaVPraze } from '../../src/lib/cas.js';


/**
 * Nocni hodiny, kdy se neposila nic. Cas je v UTC, appka zije v CZ.
 *
 * Prepocet dela `cas.js` pres Intl, ne pevnym "+2" - to plati jen v lete.
 * Pres zimu se s nim hodinovy beh mezi 21:00 a 22:00 povazoval za noc
 * a na pozdni vecerni vareni nikomu nepipnul.
 */
export function jeVhodnaDoba(datum) {
  const hodinaCz = hodinaVPraze(datum);
  return hodinaCz >= 7 && hodinaCz < 22;
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
 *
 * Pocitaji se jen E-MAILY. Oznameni na telefon (kind `push_*`) se do
 * stropu nezapocitava - je to jiny kanal, uzivatel si ho zapnul zvlast
 * a jinak by jedno pipnuti tise umlcelo tydenni e-mail o novych
 * receptech. Vlastni strop na oznameni hlida `neaktivniBeh`.
 */
async function smiSePoslat(env, userId) {
  const dnes = await env.DB.prepare(
    "SELECT COUNT(*) AS pocet FROM email_log WHERE user_id = ? AND kind NOT LIKE 'push%' AND sent_at > datetime('now', '-20 hours')"
  ).bind(userId).first();
  if ((dnes && dnes.pocet) > 0) return false;

  const tyden = await env.DB.prepare(
    "SELECT COUNT(*) AS pocet FROM email_log WHERE user_id = ? AND kind NOT LIKE 'push%' AND sent_at > datetime('now', '-7 days')"
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
            COALESCE((SELECT SUM(r.amount) FROM reservations r
                       WHERE r.inventory_id = i.id AND r.user_id = i.user_id), 0) AS reserved
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

// -- Denni beh: nakupni seznam a pripominka (4.6) -------------------------

/**
 * Projde zitrejsi bookingy, porovna je se spizi a chybejici suroviny
 * doplni do nakupniho seznamu.
 *
 * Polozky oznacene "mam doma standardne" se preskakuji (4.5) - o to se
 * stara uz `chybejici`, ktera je povazuje za dostupne vzdy.
 *
 * Bezi ve Workeru, aby to fungovalo i pri zavrene appce.
 */
export async function denniBeh(env, origin) {
  const den = zitra();
  const recepty = await nactiRecepty();

  const { results: bookingy } = await env.DB.prepare(
    `SELECT b.id, b.user_id, b.recipe_slug, b.cook_date, b.cook_time,
            u.email, u.name, u.unsub_token, u.notify_wishlist
       FROM bookings b JOIN users u ON u.id = b.user_id
      WHERE b.cook_date = ? AND b.state = 'planned'`
  ).bind(den).all();

  if (!bookingy || !bookingy.length) return { bookingu: 0, posláno: 0 };

  // Podle uzivatele, at kazdy dostane jednu zpravu se vsim.
  const podleUzivatele = new Map();
  bookingy.forEach(b => {
    if (!podleUzivatele.has(b.user_id)) podleUzivatele.set(b.user_id, []);
    podleUzivatele.get(b.user_id).push(b);
  });

  let posláno = 0;

  for (const [userId, jehoBookingy] of podleUzivatele) {
    // Zamky ZITREJSICH bookingu se odectou vsechny najednou - ptame se
    // prece, co uzivateli chybi PRAVE NA NE. Kdyby se vyloucil jen prvni
    // (a tak to tu drive bylo), druhe vareni toho dne by vlastni zamky
    // videlo jako cizi rezervaci a poslalo suroviny do nakupu zbytecne.
    const otazniky = jehoBookingy.map(() => '?').join(', ');
    const { results: spiz } = await env.DB.prepare(
      `SELECT i.id, i.name, i.kind, i.quantity, i.status, i.staple,
              COALESCE((SELECT SUM(r.amount) FROM reservations r
                         WHERE r.inventory_id = i.id AND r.user_id = i.user_id
                           AND r.booking_id NOT IN (${otazniky})), 0) AS reserved
         FROM inventory i WHERE i.user_id = ?`
    ).bind(...jehoBookingy.map(b => b.id), userId).all();

    const plan = [];
    const doNakupu = [];

    for (const b of jehoBookingy) {
      const recept = recepty.find(r => r.slug === b.recipe_slug);
      if (!recept) continue;
      const m = chybejici(recept, spiz.results || []);
      plan.push({
        title: recept.title || b.recipe_slug,
        kdy: popisBookingu(b, den),
        chybi: m.chybi,
      });
      m.chybi.forEach(sur => {
        if (!doNakupu.includes(sur)) doNakupu.push(sur);
      });
    }

    if (!plan.length) continue;

    // Do nakupniho seznamu jen to, co tam jeste neni.
    if (doNakupu.length) {
      const { results: uzTam } = await env.DB.prepare(
        'SELECT text FROM shopping_list WHERE user_id = ? AND done = 0'
      ).bind(userId).all();
      const mam = new Set((uzTam || []).map(x => String(x.text).toLowerCase()));

      const nove = doNakupu.filter(x => !mam.has(x.toLowerCase()));
      if (nove.length) {
        const stmt = env.DB.prepare(
          "INSERT INTO shopping_list (user_id, text, source, booking_id) VALUES (?, ?, 'auto', ?)"
        );
        await env.DB.batch(nove.map(x => stmt.bind(userId, x, jehoBookingy[0].id)));
      }
    }

    // Pripominka chodi pod stejnym nastavenim jako ostatni zpravy.
    const u = jehoBookingy[0];
    if (!u.notify_wishlist) continue;
    if (await poslednich(env, userId, 'reminder', 1)) continue;

    const mail = reminderMail(u, plan, unsubUrl(origin, u, 'wishlist'));
    if (await sendMail(env, { to: u.email, name: u.name, ...mail })) {
      await zapisOdeslani(env, userId, 'reminder', den);
      posláno++;
    }
  }

  return { bookingu: bookingy.length, posláno: posláno };
}

// -- Pripominka na telefon -------------------------------------------------
//
// Bezi kazdou hodinu. Na rozdil od e-mailu se tady neuplatnuje strop
// "jedna zprava denne" - oznameni je jina vec: uzivatel si ho vyslovne
// zapnul a tyka se toho, co ma za hodinu delat.

export async function pushBeh(env, ted) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return { poslano: 0, duvod: 'bez klicu' };

  const ted2 = ted || new Date();
  const recepty = await nactiRecepty();

  // Bereme dnesek i zitrek: pozdni vecerni vareni ceskeho casu uz
  // v UTC spada na dalsi den a naopak.
  const { results: bookingy } = await env.DB.prepare(
    `SELECT b.id, b.user_id, b.recipe_slug, b.cook_date, b.cook_time, b.state,
            b.push_sent, u.push_predstih
       FROM bookings b JOIN users u ON u.id = b.user_id
      WHERE u.notify_push = 1 AND b.state = 'planned' AND b.push_sent IS NULL
        AND b.cook_date BETWEEN date('now', '-1 day') AND date('now', '+2 days')`
  ).all();

  let poslano = 0;

  for (const b of bookingy || []) {
    if (!kPripomenuti([b], ted2, b.push_predstih).length) continue;

    const recept = recepty.find(r => r.slug === b.recipe_slug);
    const nazev = (recept && recept.title) || b.recipe_slug;

    const { results: subs } = await env.DB.prepare(
      'SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id = ?'
    ).bind(b.user_id).all();
    if (!subs || !subs.length) continue;

    const zprava = zpravaVareni(nazev, b.cook_time, b.recipe_slug);

    let doslo = false;
    for (const sub of subs) {
      let v;
      try {
        v = await poslatPush(env, sub, zprava);
      } catch (e) {
        console.error('push spadl: ' + String(e).slice(0, 200));
        continue;
      }
      // Zarizeni, ktere uz neexistuje, se rovnou vyhodi - jinak by se
      // na nej zkouselo posilat donekonecna.
      if (v.mrtva) {
        await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(sub.endpoint).run();
      } else if (v.ok) {
        doslo = true;
      }
    }

    // Zapisujeme, i kdyz to nikam nedoslo. Booking, u ktereho se to
    // nepovedlo, uz stejne za hodinu nebude aktualni - opakovat by
    // znamenalo poslat pripominku po case vareni.
    await env.DB.prepare("UPDATE bookings SET push_sent = datetime('now') WHERE id = ?")
      .bind(b.id).run();
    if (doslo) poslano++;
  }

  return { poslano: poslano };
}

// -- Pripomenuti po tydnu neaktivity ---------------------------------------
//
// Bezi v dennim behu (7:00), ne kazdou hodinu - pripomenuti neni
// naléhavé a v sedm rano se na nej clovek podiva u kavy.
//
// Posila se nejvys jednou za 14 dni. Kdo appku neotevrel, tomu by
// jinak chodilo "tyden ses tu neukazal" kazdy den donekonecna - a to
// je presne ten druh oznameni, po kterem si je clovek vypne uplne.

const NEAKTIVITA_DNI = 7;

export async function neaktivniBeh(env) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return { poslano: 0 };

  const { results: lide } = await env.DB.prepare(
    `SELECT id, name, last_seen FROM users
      WHERE notify_push = 1
        AND last_seen IS NOT NULL
        AND last_seen < datetime('now', ?)`
  ).bind('-' + NEAKTIVITA_DNI + ' days').all();

  if (!lide || !lide.length) return { poslano: 0 };

  const recepty = await nactiRecepty();
  let poslano = 0;

  for (const u of lide) {
    if (await poslednich(env, u.id, 'push_neaktivita', 14)) continue;

    const { results: subs } = await env.DB.prepare(
      'SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id = ?'
    ).bind(u.id).all();
    if (!subs || !subs.length) continue;

    // Kdyz ma neco v "chci vyzkouset" a suroviny na to doma, zmini se
    // to jmenem. Obecne "vrat se do appky" je reklama, konkretni
    // recept je duvod.
    const hotove = await wishlistHotove(env, u, recepty).catch(() => []);
    const dni = Math.round(
      (Date.now() - Date.parse(String(u.last_seen).replace(' ', 'T') + 'Z')) / 86400000
    );
    const zprava = zpravaNeaktivita(dni, hotove.length ? hotove[0].title : null);

    let doslo = false;
    for (const sub of subs) {
      let v;
      try {
        v = await poslatPush(env, sub, zprava);
      } catch (e) {
        console.error('push spadl: ' + String(e).slice(0, 200));
        continue;
      }
      if (v.mrtva) {
        await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(sub.endpoint).run();
      } else if (v.ok) {
        doslo = true;
      }
    }

    if (doslo) {
      await zapisOdeslani(env, u.id, 'push_neaktivita', String(dni));
      poslano++;
    }
  }

  return { poslano: poslano };
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

/**
 * Uklid stareho zaznamu o odeslanych zpravach.
 *
 * `email_log` se jinak nemaze vubec a `poslednich()` nad ni chodi pri
 * kazdem behu. Rok zpatky staci: nejdelsi okno, na ktere se ptame, je
 * 25 dni (mesicni souhrn).
 */
async function uklidLog(env) {
  await env.DB.prepare("DELETE FROM email_log WHERE sent_at < datetime('now', '-1 year')")
    .run().catch(() => {});
}

/** Vstupni bod pro Cron. */
export async function spustCron(event, env, origin) {
  try {
    if (!jeVhodnaDoba(new Date())) return;
    // Uklid patri k mesicnimu behu - jednou za mesic je az az.
    if (event.cron === '0 5 1 * *') await uklidLog(env);
    // Hodinovy beh musi mit svoji vetev PRED vychozi - jinak by kazdou
    // hodinu probehl denni beh a nakupni seznam by se plnil dokola.
    if (event.cron === '0 * * * *') return void (await pushBeh(env));
    if (event.cron === '0 5 1 * *') return void (await mesicniBeh(env, origin));
    if (event.cron === '0 5 * * 1') return void (await tydenniBeh(env, origin));
    await denniBeh(env, origin);
    // Az po dennim behu: ten resi zitrejsi vareni, tohle lidi, kteri
    // nemaji naplanovaneho nic. Kdyz spadne, nakupni seznam uz je hotovy.
    return void (await neaktivniBeh(env));
  } catch (e) {
    console.error('Cron spadl: ' + String(e).slice(0, 300));
    await adminError(env, 'Cron ' + (event.cron || ''), e && e.stack ? e.stack : e);
  }
}
