-- Uvodni okno se ukazuje jen po registraci. Az ho uzivatel odklikne
-- (nebo dojde prohlidku), zapise se sem a uz se samo neotevre.
ALTER TABLE users ADD COLUMN intro_done INTEGER NOT NULL DEFAULT 0;
