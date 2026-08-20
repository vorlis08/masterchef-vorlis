// ==========================================================================
// api.js  --  rozhrani pro prihlaseneho uzivatele
//
// Vsechno tady je PER UZIVATEL. Kazdy dotaz se omezuje na `user_id`
// z prihlasovaciho listku - nikdy na id poslane z prohlizece, jinak by
// si kdokoli precetl cizi spiz.
// ==========================================================================

const KINDS = ['exact', 'approx', 'count'];
const STATUSES = ['mam', 'dochazi', 'doslo'];

function json(body, origin, cors, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  });
}

function text(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 120);
}

// -- Profil ---------------------------------------------------------------

export async function updateProfile(request, env, session, origin, cors) {
  const data = await request.json().catch(() => ({}));
  const name = text(data.name, 80);
  const avatar = text(data.avatar, 500);

  if (!name) return json({ error: 'Jméno nesmí být prázdné.' }, origin, cors, 400);
  // Jen obrazek po https - jinak by slo do stranky vlozit cokoliv.
  if (avatar && !/^https:\/\//i.test(avatar)) {
    return json({ error: 'Odkaz na fotku musí začínat https://' }, origin, cors, 400);
  }

  await env.DB.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?')
    .bind(name, avatar || null, session.sub).run();

  const user = await env.DB
    .prepare('SELECT id, email, name, role, avatar FROM users WHERE id = ?')
    .bind(session.sub).first();
  return json(user, origin, cors);
}

// -- Spiz -----------------------------------------------------------------

export async function listInventory(env, session, origin, cors) {
  const { results } = await env.DB.prepare(
    `SELECT i.id, i.name, i.kind, i.quantity, i.unit, i.status, i.staple, i.sort_order,
            COALESCE((SELECT SUM(r.amount) FROM reservations r WHERE r.inventory_id = i.id), 0) AS reserved
       FROM inventory i
      WHERE i.user_id = ?
      ORDER BY i.sort_order, i.name`
  ).bind(session.sub).all();
  return json({ items: results || [] }, origin, cors);
}

export async function saveInventory(request, env, session, origin, cors) {
  const data = await request.json().catch(() => ({}));

  if (data.action === 'delete') {
    if (!(data.id > 0)) return json({ error: 'Chybí položka.' }, origin, cors, 400);
    await env.DB.prepare('DELETE FROM inventory WHERE id = ? AND user_id = ?')
      .bind(data.id, session.sub).run();
    return listInventory(env, session, origin, cors);
  }

  // Zalozeni startovniho seznamu z receptu (4.9). Uz existujici polozky
  // se nepreptisuji - uzivatel uz je mohl upravit.
  if (data.action === 'seed') {
    const items = Array.isArray(data.items) ? data.items.slice(0, 300) : [];
    const stmt = env.DB.prepare(
      `INSERT INTO inventory (user_id, name, kind, status, sort_order)
            VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, name) DO NOTHING`
    );
    const batch = items
      .map(it => ({ name: text(it.name, 80), kind: KINDS.includes(it.kind) ? it.kind : 'exact', order: Number(it.sort_order) || 0 }))
      .filter(it => it.name)
      .map(it => stmt.bind(session.sub, it.name, it.kind, it.kind === 'approx' ? 'doslo' : null, it.order));
    if (batch.length) await env.DB.batch(batch);
    return listInventory(env, session, origin, cors);
  }

  // Ulozeni jedne polozky
  const item = data.item || {};
  const name = text(item.name, 80);
  if (!name) return json({ error: 'Surovina musí mít název.' }, origin, cors, 400);

  const kind = KINDS.includes(item.kind) ? item.kind : 'exact';
  const staple = item.staple ? 1 : 0;
  const order = Number(item.sort_order) || 0;

  // 4.4: u priblizne suroviny se mnozstvi ZAMERNE neuklada.
  // Vazene (exact) i pocitane (count) mnozstvi maji.
  const merene = kind === 'exact' || kind === 'count';
  const quantity = merene && item.quantity !== '' && item.quantity != null
    ? Number(item.quantity) : null;
  if (quantity != null && !(quantity >= 0)) {
    return json({ error: 'Množství musí být číslo.' }, origin, cors, 400);
  }
  const unit = merene ? (text(item.unit, 20) || (kind === 'count' ? 'ks' : null)) : null;
  const status = kind === 'approx'
    ? (STATUSES.includes(item.status) ? item.status : 'doslo') : null;

  if (item.id > 0) {
    await env.DB.prepare(
      `UPDATE inventory
          SET name = ?, kind = ?, quantity = ?, unit = ?, status = ?, staple = ?,
              sort_order = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?`
    ).bind(name, kind, quantity, unit, status, staple, order, item.id, session.sub).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO inventory (user_id, name, kind, quantity, unit, status, staple, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, name) DO UPDATE SET
            kind = excluded.kind, quantity = excluded.quantity, unit = excluded.unit,
            status = excluded.status, staple = excluded.staple,
            updated_at = datetime('now')`
    ).bind(session.sub, name, kind, quantity, unit, status, staple, order).run();
  }

  return listInventory(env, session, origin, cors);
}

// -- Nastaveni upozorneni -------------------------------------------------

const NOTIFY = {
  recipes:  'notify_recipes',
  wishlist: 'notify_wishlist',
  summary:  'notify_summary',
};

export async function getNotify(env, session, origin, cors) {
  const u = await env.DB.prepare(
    'SELECT notify_recipes, notify_wishlist, notify_summary FROM users WHERE id = ?'
  ).bind(session.sub).first();
  return json({
    recipes:  !!(u && u.notify_recipes),
    wishlist: !!(u && u.notify_wishlist),
    summary:  !!(u && u.notify_summary),
  }, origin, cors);
}

export async function setNotify(request, env, session, origin, cors) {
  const data = await request.json().catch(() => ({}));
  const sloupec = NOTIFY[data.kind];
  if (!sloupec) return json({ error: 'Neznámý druh zpráv.' }, origin, cors, 400);

  await env.DB.prepare('UPDATE users SET ' + sloupec + ' = ? WHERE id = ?')
    .bind(data.on ? 1 : 0, session.sub).run();
  return getNotify(env, session, origin, cors);
}

// -- Vztah uzivatele k receptum -------------------------------------------
//
// Nahrazuje localStorage klice `favorites` a `review_<slug>` (8.5).
// Appka posle svuj stav, Worker ho ulozi a vrati zpatky vsechno,
// co o uzivateli vi - diky tomu se to srovna i mezi zarizenimi.

const STAVY = ['neuvareno', 'wishlist', 'uvareno'];

export async function syncState(request, env, session, origin, cors) {
  const data = await request.json().catch(() => ({}));
  const polozky = Array.isArray(data.items) ? data.items.slice(0, 500) : [];

  if (polozky.length) {
    const stmt = env.DB.prepare(
      `INSERT INTO recipe_state (user_id, recipe_slug, favorite, status, stars, note, cooked, last_cooked, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (user_id, recipe_slug) DO UPDATE SET
            favorite = excluded.favorite, status = excluded.status,
            stars = excluded.stars, note = excluded.note,
            cooked = excluded.cooked, last_cooked = excluded.last_cooked,
            updated_at = datetime('now')`
    );
    const davka = polozky
      .filter(it => it && it.slug)
      .map(it => stmt.bind(
        session.sub,
        text(it.slug, 120),
        it.favorite ? 1 : 0,
        STAVY.includes(it.status) ? it.status : 'neuvareno',
        Math.max(0, Math.min(5, Number(it.stars) || 0)),
        it.note ? text(it.note, 2000) : null,
        Math.max(0, Number(it.cooked) || 0),
        it.lastCooked ? text(it.lastCooked, 40) : null
      ));
    if (davka.length) await env.DB.batch(davka);
  }

  const { results } = await env.DB.prepare(
    `SELECT recipe_slug AS slug, favorite, status, stars, note, cooked, last_cooked AS lastCooked
       FROM recipe_state WHERE user_id = ?`
  ).bind(session.sub).all();

  return json({ items: results || [] }, origin, cors);
}

// -- Uvodni okno ----------------------------------------------------------

/** Oznaci, ze uzivatel uvod uz videl. Zpatky se otevre jen odkazem ?uvod=1. */
export async function markIntroDone(env, session, origin, cors) {
  await env.DB.prepare('UPDATE users SET intro_done = 1 WHERE id = ?').bind(session.sub).run();
  return json({ ok: true }, origin, cors);
}

// -- Bookingy ("TO UVAŘÍM!") ----------------------------------------------
//
// 4.2: booking surovinu NEODECTE. Vytvori se radek v `reservations`, ktery
// ji zamkne. Skutecne odecteni nastane az po "DOVAŘENO".

export async function listBookings(env, session, origin, cors) {
  const { results } = await env.DB.prepare(
    `SELECT id, recipe_slug, cook_date, cook_time, servings, state, created_at
       FROM bookings
      WHERE user_id = ? AND state != 'cancelled'
      ORDER BY cook_date, COALESCE(cook_time, '99:99')`
  ).bind(session.sub).all();
  return json({ items: results || [] }, origin, cors);
}

export async function saveBooking(request, env, session, origin, cors) {
  const data = await request.json().catch(() => ({}));

  if (data.action === 'cancel') {
    if (!(data.id > 0)) return json({ error: 'Chybí rezervace.' }, origin, cors, 400);
    // Zamky padaji s bookingem - o to se stara ON DELETE CASCADE.
    await env.DB.prepare('DELETE FROM bookings WHERE id = ? AND user_id = ?')
      .bind(data.id, session.sub).run();
    return listBookings(env, session, origin, cors);
  }

  // -- "DOVAŘENO": ted se teprve odecita --
  if (data.action === 'done') {
    if (!(data.id > 0)) return json({ error: 'Chybí rezervace.' }, origin, cors, 400);

    const { results: zamky } = await env.DB.prepare(
      'SELECT inventory_id, amount FROM reservations WHERE booking_id = ? AND user_id = ?'
    ).bind(data.id, session.sub).all();

    const odecty = (zamky || [])
      .filter(z => z.inventory_id)
      .map(z => env.DB.prepare(
        `UPDATE inventory SET quantity = MAX(0, COALESCE(quantity, 0) - ?),
                              updated_at = datetime('now')
          WHERE id = ? AND user_id = ?`
      ).bind(Number(z.amount) || 0, z.inventory_id, session.sub));
    if (odecty.length) await env.DB.batch(odecty);

    await env.DB.prepare("UPDATE bookings SET state = 'done' WHERE id = ? AND user_id = ?")
      .bind(data.id, session.sub).run();
    // Zamky uz nejsou potreba - surovina je snedena, ne slibena.
    await env.DB.prepare('DELETE FROM reservations WHERE booking_id = ? AND user_id = ?')
      .bind(data.id, session.sub).run();

    return listBookings(env, session, origin, cors);
  }

  // -- Novy booking --
  const slug = text(data.slug, 120);
  const datum = text(data.date, 10);
  const cas = data.time ? text(data.time, 5) : null;

  if (!slug) return json({ error: 'Chybí recept.' }, origin, cors, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return json({ error: 'Neplatné datum.' }, origin, cors, 400);
  if (cas && !/^\d{2}:\d{2}$/.test(cas)) return json({ error: 'Neplatný čas.' }, origin, cors, 400);

  // Konflikt hlida i server, ne jen prohlizec (4.1). Uzivatel ho muze
  // potvrdit - proto `force`.
  if (cas && !data.force) {
    const srazka = await env.DB.prepare(
      `SELECT recipe_slug FROM bookings
        WHERE user_id = ? AND cook_date = ? AND cook_time = ? AND state = 'planned'`
    ).bind(session.sub, datum, cas).first();
    if (srazka) {
      return json({ konflikt: true, slug: srazka.recipe_slug }, origin, cors, 409);
    }
  }

  const vysledek = await env.DB.prepare(
    `INSERT INTO bookings (user_id, recipe_slug, cook_date, cook_time, servings)
          VALUES (?, ?, ?, ?, ?)`
  ).bind(session.sub, slug, datum, cas, Number(data.servings) || null).run();

  const bookingId = vysledek.meta && vysledek.meta.last_row_id;

  // Zamky vznikaji OKAMZITE pri bookingu, ne den predem (4.2) - jinak by
  // uzivatel kolizi objevil, az kdyz uz je pozde nakoupit.
  const zamky = Array.isArray(data.locks) ? data.locks.slice(0, 60) : [];
  if (bookingId && zamky.length) {
    const stmt = env.DB.prepare(
      `INSERT INTO reservations (booking_id, user_id, inventory_id, ingredient, amount, unit)
            VALUES (?, ?, ?, ?, ?, ?)`
    );
    await env.DB.batch(zamky
      .filter(z => z && z.ingredient)
      .map(z => stmt.bind(
        bookingId, session.sub,
        Number(z.inventory_id) || null,
        text(z.ingredient, 80),
        Number(z.amount) || 1,
        z.unit ? text(z.unit, 20) : null
      )));
  }

  return listBookings(env, session, origin, cors);
}
