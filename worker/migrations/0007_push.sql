-- Oznameni na telefon (Web Push).

-- Prihlasky k odberu. Jeden clovek muze mit vic zarizeni, proto neni
-- klicem user_id, ale adresa, kterou vrati prohlizec.
--
-- p256dh a auth jsou klice, kterymi se zprava sifruje. Bez nich push
-- server dorucit umi, ale telefon obsah neprecte. Nejsou to tajemstvi
-- uzivatele v tom smyslu jako heslo - platí jen pro tohle jedno
-- zarizeni a jdou kdykoli zahodit.
CREATE TABLE push_subs (
  endpoint    TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_push_subs_user ON push_subs(user_id);

-- Samostatny prepinac. Pripominka na telefon je jina vec nez e-mail:
-- kdo chce pipnout hodinu pred varenim, nemusi chtit tydenni souhrn.
-- Vychozi je vypnuto - oznameni si musi uzivatel zapnout sam, protoze
-- se u toho stejne musi odklepnout povoleni v prohlizeci.
ALTER TABLE users ADD COLUMN notify_push INTEGER NOT NULL DEFAULT 0;

-- Kolik minut pred varenim pipnout.
ALTER TABLE users ADD COLUMN push_predstih INTEGER NOT NULL DEFAULT 60;

-- Kdy uz na tenhle booking oznameni odeslo. Brani tomu, aby stejna
-- pripominka prisla kazdou hodinu znovu.
ALTER TABLE bookings ADD COLUMN push_sent TEXT;
