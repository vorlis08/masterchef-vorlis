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
