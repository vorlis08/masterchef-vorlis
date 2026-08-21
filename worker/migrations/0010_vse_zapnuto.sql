-- Vsechno chodi od zacatku.
--
-- Duvod: prepinace v nastaveni appky zmizely. Kdo neco nechce, vypne si
-- to tam, kde to opravdu hleda - e-maily odhlasovacim odkazem v e-mailu,
-- oznameni v nastaveni telefonu, kalendar v uctu Google.

UPDATE users SET
  notify_recipes  = 1,
  notify_wishlist = 1,
  notify_summary  = 1,
  gcal_on         = 1;

-- notify_push se ZAMERNE nezapina hromadne. Oznameni bez prihlasky
-- v `push_subs` stejne nikam nedojdou a prohlizec o povoleni musi
-- pozadat sam uzivatel. Zapisuje ho az `/api/push` pri prihlaseni
-- odberu.
