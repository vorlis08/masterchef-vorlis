-- Treti druh suroviny: 'count' - pocita se na kusy (vejce, masox, konzervy).
--
-- SQLite neumi zmenit CHECK u existujiciho sloupce, takze se tabulka
-- postavi znovu a data se prelijou. Rezervace na inventory odkazuji,
-- proto se cizi klice na dobu prestavby vypinaji.
PRAGMA foreign_keys = OFF;

CREATE TABLE inventory_nova (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'exact' CHECK (kind IN ('exact', 'approx', 'count')),
  quantity    REAL,
  unit        TEXT,
  status      TEXT CHECK (status IN ('mam', 'dochazi', 'doslo')),
  staple      INTEGER NOT NULL DEFAULT 0 CHECK (staple IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);

INSERT INTO inventory_nova (id, user_id, name, kind, quantity, unit, status, staple, sort_order, updated_at)
  SELECT id, user_id, name, kind, quantity, unit, status, staple, sort_order, updated_at FROM inventory;

DROP TABLE inventory;
ALTER TABLE inventory_nova RENAME TO inventory;
CREATE INDEX idx_inventory_user ON inventory(user_id, sort_order);

PRAGMA foreign_keys = ON;
