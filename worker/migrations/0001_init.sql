-- ==========================================================================
-- 0001_init.sql  --  zaklad databaze MasterChef Vorlis
--
-- Vychazi ze sekce 4 v PROJEKT.md. Dve rozhodnuti, ktera se snadno spletou
-- a proto jsou tady napsana nahlas:
--
-- 1. BOOKING SUROVINU NEODECTE (4.2). Vznikne radek v `reservations`, ktery
--    surovinu "zamkne". Skutecne odecteni nastane az pri DOVARENO. Proto
--    `inventory.quantity` zustava a volne mnozstvi = quantity - rezervace.
--
-- 2. PRESNE vs PRIBLIZNE suroviny (4.4). Presne se vazi (quantity+unit),
--    priblizne maji jen stav mam/dochazi/doslo a mnozstvi se u nich
--    ZAMERNE nevyplnuje.
-- ==========================================================================

-- -- Uzivatele -----------------------------------------------------------
-- Recepty jsou spolecne a nahrava je vyhradne admin (4.8).
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -- Spiz ----------------------------------------------------------------
CREATE TABLE inventory (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  -- 'exact' = vazi se v gramech/ml, 'approx' = jen mam/dochazi/doslo
  kind        TEXT NOT NULL DEFAULT 'exact' CHECK (kind IN ('exact', 'approx')),
  quantity    REAL,
  unit        TEXT,
  -- jen pro kind='approx'
  status      TEXT CHECK (status IN ('mam', 'dochazi', 'doslo')),
  -- "mam doma standardne" (4.5) - nikdy se nepridava do nakupniho seznamu
  staple      INTEGER NOT NULL DEFAULT 0 CHECK (staple IN (0, 1)),
  -- poradi ve spizi podle fyzickeho usporadani, ne abecedne (4.9)
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);
CREATE INDEX idx_inventory_user ON inventory(user_id, sort_order);

-- -- Bookingy ("TO UVARIM!") ---------------------------------------------
CREATE TABLE bookings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_slug TEXT NOT NULL,
  cook_date   TEXT NOT NULL,             -- 'YYYY-MM-DD'
  -- NULL = na cely den, jinak 'HH:MM'. All-day nespousti notifikaci (4.1).
  cook_time   TEXT,
  servings    INTEGER,
  state       TEXT NOT NULL DEFAULT 'planned'
              CHECK (state IN ('planned', 'done', 'cancelled')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Cron chodi na "bookingy na zitrek" (4.6), proto index na datum.
CREATE INDEX idx_bookings_user_date ON bookings(user_id, cook_date);

-- -- Rezervace surovin = ZAMEK, ne odecet (4.2) --------------------------
-- Vznika okamzite pri bookingu, ne den predem.
CREATE TABLE reservations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id    INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- muze byt NULL: recept chce neco, co uzivatel vubec nema ve spizi
  inventory_id  INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
  ingredient    TEXT NOT NULL,
  amount        REAL,
  unit          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reservations_booking ON reservations(booking_id);
CREATE INDEX idx_reservations_inventory ON reservations(inventory_id);

-- -- Nakupni seznam ------------------------------------------------------
-- Plni ho Cron ve Workeru, aby to fungovalo i pri zavrene appce (4.6).
CREATE TABLE shopping_list (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  amount      REAL,
  unit        TEXT,
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  -- 'auto' = doplnil Cron, 'manual' = pridal uzivatel rucne
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('auto', 'manual')),
  booking_id  INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_shopping_user ON shopping_list(user_id, done);

-- -- Vztah uzivatele k receptu -------------------------------------------
-- Nahrazuje dnesni localStorage: `favorites` a `review_<slug>` (8.5).
-- V 4.10 tahle tabulka nebyla, ale 4.8 vyzaduje per-uzivatele wishlist,
-- uvareno, hodnoceni a poznamky - musi mit kde byt.
CREATE TABLE recipe_state (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_slug  TEXT NOT NULL,
  favorite     INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  -- 4.7: neuvareno / wishlist (chci vyzkouset) / uvareno
  status       TEXT NOT NULL DEFAULT 'neuvareno'
               CHECK (status IN ('neuvareno', 'wishlist', 'uvareno')),
  stars        INTEGER NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 5),
  note         TEXT,
  cooked       INTEGER NOT NULL DEFAULT 0,
  last_cooked  TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, recipe_slug)
);
