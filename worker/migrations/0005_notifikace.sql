-- Nastaveni upozorneni a evidence odeslanych zprav.

-- Co komu posilat. Vychozi je zapnuto, krome souhrnu.
ALTER TABLE users ADD COLUMN notify_recipes  INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_wishlist INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_summary  INTEGER NOT NULL DEFAULT 1;

-- Tajny retezec do odhlasovaciho odkazu. Bez nej by staci znat cizi
-- e-mail a slo by odhlasit kohokoliv.
ALTER TABLE users ADD COLUMN unsub_token TEXT;

-- Co uz komu odeslo. Slouzi ke dvema vecem:
--   1. aby se tataz zprava neposlala dvakrat
--   2. aby souhrn vedel, od kdy ma pocitat
CREATE TABLE email_log (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  TEXT REFERENCES users(id) ON DELETE CASCADE,
  kind     TEXT NOT NULL,
  sent_at  TEXT NOT NULL DEFAULT (datetime('now')),
  note     TEXT
);
CREATE INDEX idx_email_log_user ON email_log(user_id, kind, sent_at);

-- Ktere recepty uz system videl. Diky tomu pozna, ktery je novy -
-- recipes.json zadne datum vzniku nenese.
CREATE TABLE known_recipes (
  slug        TEXT PRIMARY KEY,
  title       TEXT,
  first_seen  TEXT NOT NULL DEFAULT (datetime('now'))
);
