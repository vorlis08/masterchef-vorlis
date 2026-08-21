-- Uvitaci oznameni a pripomenuti po neaktivite.

-- Kdy uzivatel naposledy otevrel appku. Zapisuje se pri /api/me, coz
-- appka vola pri kazdem nacteni - je to tedy "naposledy viden", ne
-- "naposledy varil". Zamerne: kdo se tyden ani nepodival, je presne
-- ten, komu ma pripomenuti prijit.
ALTER TABLE users ADD COLUMN last_seen TEXT;

-- Kdy odeslo uvitaci oznameni. NULL = jeste neodeslo. Stejny princip
-- jako u welcome_sent_at - kdyz se poslani nepovede, zkusi se priste.
ALTER TABLE users ADD COLUMN push_welcome_at TEXT;
