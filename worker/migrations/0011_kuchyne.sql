-- ==========================================================================
-- 0011_kuchyne.sql  --  spiz se meni na KUCHYN a muze jich byt vic
--
-- Kuchyn NENI nova vrstva uvnitr spize. Kuchyn JE spiz - jen jich clovek
-- muze mit vic a kazda ma jmeno. Duvod: chata a byt maji jinou vybavu
-- a jeden spolecny seznam pro obojí je horsi nez zadny.
--
-- Kdo uz neco ulozeneho ma, o zadnou zmenu nezakopne: dostane jednu
-- kuchyn "Moje kuchyň" a vsechny jeho suroviny se do ni presunou.
--
-- POZOR na prestavbu `inventory`: unikatnost nazvu se posouva
-- z (user_id, name) na (kitchen_id, name). Bez toho by clovek nemohl
-- mit maslo v byte i na chate. SQLite neumi zmenit klic u existujici
-- tabulky, takze se stavi znovu a data se prelijou - stejne jako
-- v migraci 0004.
-- ==========================================================================

-- -- Kuchyne ---------------------------------------------------------------
CREATE TABLE kitchens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);
CREATE INDEX idx_kitchens_user ON kitchens(user_id, sort_order);

-- Kazdemu stavajicimu uzivateli jednu. I tomu, kdo jeste nic neulozil -
-- prazdna kuchyn nikomu nevadi, ale chybejici by znamenala, ze prvni
-- surovinu nema kam dat.
INSERT INTO kitchens (user_id, name) SELECT id, 'Moje kuchyň' FROM users;

-- Ktera kuchyn je prave otevrena. Drzi se u uzivatele, ne v prohlizeci:
-- podle ni pocita i Cron, co komu chybi do nakupu, a ten do prohlizece
-- nevidi.
ALTER TABLE users ADD COLUMN active_kitchen_id INTEGER REFERENCES kitchens(id) ON DELETE SET NULL;
UPDATE users SET active_kitchen_id =
  (SELECT k.id FROM kitchens k WHERE k.user_id = users.id ORDER BY k.id LIMIT 1);

-- -- Prestavba spize --------------------------------------------------------
PRAGMA foreign_keys = OFF;

CREATE TABLE inventory_nova (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Do ktere kuchyne surovina patri. Se smazanou kuchyni mizi i obsah -
  -- prazdne polozky bez domova by jinak zustaly viset navzdy.
  kitchen_id  INTEGER NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'exact' CHECK (kind IN ('exact', 'approx', 'count')),
  quantity    REAL,
  unit        TEXT,
  status      TEXT CHECK (status IN ('mam', 'dochazi', 'doslo')),
  staple      INTEGER NOT NULL DEFAULT 0 CHECK (staple IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  -- Tohle je ta zmena: tentyz nazev smi byt v kazde kuchyni jednou.
  UNIQUE (kitchen_id, name)
);

INSERT INTO inventory_nova
    (id, user_id, kitchen_id, name, kind, quantity, unit, status, staple, sort_order, updated_at)
  SELECT i.id, i.user_id,
         (SELECT k.id FROM kitchens k WHERE k.user_id = i.user_id ORDER BY k.id LIMIT 1),
         i.name, i.kind, i.quantity, i.unit, i.status, i.staple, i.sort_order, i.updated_at
    FROM inventory i;

DROP TABLE inventory;
ALTER TABLE inventory_nova RENAME TO inventory;
CREATE INDEX idx_inventory_user ON inventory(user_id, sort_order);
CREATE INDEX idx_inventory_kitchen ON inventory(kitchen_id, sort_order);

PRAGMA foreign_keys = ON;
