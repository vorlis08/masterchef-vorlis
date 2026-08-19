-- Kdy uzivateli odesel uvitaci e-mail. NULL = jeste neodesel, takze se
-- pri pristim prihlaseni zkusi znovu (napr. kdyz posilatel zrovna nejel).
ALTER TABLE users ADD COLUMN welcome_sent_at TEXT;
