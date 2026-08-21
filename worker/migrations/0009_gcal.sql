-- Ukladani naplanovaneho vareni do Google kalendare uzivatele.

-- Obnovovaci token od Googlu. Bez nej jde ke kalendari sahnout jen
-- hodinu po prihlaseni - s nim kdykoliv, tedy i z Cronu.
--
-- POZOR: je to dlouhodoby pristup k CIZIMU kalendari. Uklada se jen
-- tem, kdo si funkci vyslovne zapnou, a maze se ve chvili, kdy si ji
-- vypnou. Nikdy se neposila do prohlizece.
ALTER TABLE users ADD COLUMN google_refresh TEXT;

-- Prepinac. Vychozi vypnuto - do ciziho kalendare se nezapisuje,
-- dokud o to clovek vyslovne nerekne.
ALTER TABLE users ADD COLUMN gcal_on INTEGER NOT NULL DEFAULT 0;

-- Id udalosti v Google kalendari. Diky nemu jde udalost pri zruseni
-- bookingu smazat - jinak by v kalendari zustalo viset vareni, ktere
-- se v appce uz nekona.
ALTER TABLE bookings ADD COLUMN gcal_event_id TEXT;
