-- ==========================================================================
-- 0012_zamky_zpet.sql  --  oprava po 0011: zamky ztratily surovinu
--
-- CO SE STALO
--
-- Migrace 0011 prestavuje `inventory` (novy sloupec a jiny unikatni klic).
-- Prestavba znamena DROP TABLE, a `reservations.inventory_id` na tu tabulku
-- ukazuje cizim klicem `ON DELETE SET NULL`. Aby to prezilo, ma migrace
-- nahore `PRAGMA foreign_keys = OFF`.
--
-- Jenze **D1 pousti migraci v transakci a PRAGMA foreign_keys je uvnitr
-- transakce TICHY NO-OP.** Nic nespadne, nic nevarovalo - jen se pri
-- DROP TABLE vsem rezervacim nastavilo `inventory_id = NULL`.
--
-- Zamek bez suroviny nedela nic: neubira volne mnozstvi ve spizi a pri
-- "DOVAŘENO" se nema z ceho odecist. Samotny booking je v poradku.
--
-- PROC TO NEODCHYTILY TESTY
--
-- `test-kuchyne-api.mjs` pousti migrace pres `node:sqlite`, kde PRAGMA
-- funguje - a tam tedy vsechno proslo. Test ted D1 napodobuje verneji:
-- PRAGMA radky zahazuje, takze se chova stejne prisne jako ostrá databaze.
--
-- CO DELA TAHLE MIGRACE
--
-- Osirely zamek prilepi zpatky k surovine podle NAZVU v otevrene kuchyni
-- majitele. Id surovin migrace 0011 zachovala, takze se parovani trefi.
-- Kdyz se surovina nenajde, zamek zustane bez ni - presne jak je ted,
-- takze opakovane spusteni nic nezkazi.
-- ==========================================================================

UPDATE reservations
   SET inventory_id = (
     SELECT i.id
       FROM inventory i
      WHERE i.user_id = reservations.user_id
        AND i.name = reservations.ingredient
        AND i.kitchen_id = (SELECT u.active_kitchen_id FROM users u WHERE u.id = reservations.user_id)
      LIMIT 1
   )
 WHERE inventory_id IS NULL
   AND EXISTS (
     SELECT 1
       FROM inventory i
      WHERE i.user_id = reservations.user_id
        AND i.name = reservations.ingredient
        AND i.kitchen_id = (SELECT u.active_kitchen_id FROM users u WHERE u.id = reservations.user_id)
   );
