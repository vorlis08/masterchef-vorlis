// ==========================================================================
// gcal.js  --  zapis naplanovaneho vareni do Google kalendare uzivatele
//
// Proc to neni jen "posli udalost": prihlaseni pres Google dava Workeru
// pristup jen na hodinu. Aby slo do kalendare zapsat i pozdeji (a z
// Cronu), potrebuje Worker OBNOVOVACI token - ten se ziska jen tehdy,
// kdyz se uzivatel prihlasuje s `access_type=offline` a projde
// souhlasnou obrazovkou.
//
// DULEZITE: pristup ke kalendari je nove opravneni. Kdo se prihlasil
// driv, ho nema - musi se odhlasit a prihlasit znovu. Proto ma appka
// tlacitko "Připojit Google kalendář", ktere posle uzivatele na
// /auth/start?consent=1.
//
// Co se sem zamerne NEDELA:
//   - necte se cizi kalendar. Rozsah je `calendar.events`, tedy jen
//     zapis udalosti; nikdo tu nekouka, co ma uzivatel v patek.
//   - nemaze se nic, co appka nezalozila. Maze se vyhradne udalost,
//     jejiz id mame ulozene u bookingu.
// ==========================================================================

const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GCAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/** Casove pasmo, ve kterem appka zije. Google si prepocet resi sam. */
export const PASMO = 'Europe/Prague';

/** Rozsah, o ktery si rikame u Googlu. Jen zapis udalosti, nic vic. */
export const SCOPE_KALENDAR = 'https://www.googleapis.com/auth/calendar.events';

/**
 * Vymeni obnovovaci token za hodinovy pristupovy.
 *
 * Vraci `null`, kdyz uz token neplati - uzivatel muze pristup kdykoliv
 * odebrat v nastaveni Googlu a my se to dozvime az takhle.
 */
export async function pristupovyToken(env, refresh) {
  if (!refresh || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;

  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refresh,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    console.error('gcal token ' + res.status + ': ' + (await res.text()).slice(0, 200));
    return null;
  }
  const data = await res.json();
  return data.access_token || null;
}

/** Posune 'HH:MM' o dany pocet minut. Pretece-li pres pulnoc, vrati i posun dne. */
function posunCas(cas, minut) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(cas || ''));
  if (!m) return null;
  const celkem = +m[1] * 60 + +m[2] + (Number(minut) || 0);
  const dni = Math.floor(celkem / 1440);
  const zbytek = ((celkem % 1440) + 1440) % 1440;
  return {
    cas: String(Math.floor(zbytek / 60)).padStart(2, '0') + ':' +
      String(zbytek % 60).padStart(2, '0'),
    dni: dni,
  };
}

/** Datum 'YYYY-MM-DD' posunuty o dny. Pres Date.UTC, at neresi pasma. */
function posunDatum(datum, dni) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum || ''));
  if (!m) return datum;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + (Number(dni) || 0)));
  return d.toISOString().slice(0, 10);
}

/** Z "35 min" udela 35. Bez cisla vrati vychozi hodinu. */
export function minutyZReceptu(text, vychozi) {
  const m = /(\d+)/.exec(String(text || ''));
  const cislo = m ? Number(m[1]) : 0;
  // Strop je tu kvuli receptum typu "12 h" (marinovani) - celodenni
  // udalost v kalendari nikomu nepomuze.
  if (!cislo || cislo > 480) return vychozi == null ? 60 : vychozi;
  return cislo;
}

/**
 * Slozi udalost pro Google kalendar.
 *
 * Cista funkce - jde otestovat bez site. To je zamer: chyba v datu nebo
 * pasmu se v kalendari projevi jako vareni v jinou hodinu, coz je presne
 * ten druh chyby, ktereho si clovek vsimne az kdyz mu ujede.
 *
 * @param {{cook_date: string, cook_time: ?string, servings: ?number}} booking
 * @param {{title: ?string, time: ?string, slug: ?string}} recept
 * @param {string} [odkaz]  adresa receptu v appce
 */
export function udalostZBookingu(booking, recept, odkaz) {
  const nazev = (recept && recept.title) || 'Vaření';
  const popis = [
    'Naplánováno v MasterChef Vorlis.',
    booking.servings ? 'Porcí: ' + booking.servings : null,
    odkaz || null,
  ].filter(Boolean).join('\n');

  const udalost = {
    summary: nazev,
    description: popis,
    source: odkaz ? { title: 'MasterChef Vorlis', url: odkaz } : undefined,
  };

  // Celodenni vareni: Google chce `date` a konec je DEN PO - u
  // celodennich udalosti je konec vylucny. Bez toho by udalost
  // v kalendari vubec nebyla videt.
  if (!booking.cook_time) {
    udalost.start = { date: booking.cook_date };
    udalost.end = { date: posunDatum(booking.cook_date, 1) };
    udalost.reminders = { useDefault: true };
    return udalost;
  }

  const konec = posunCas(booking.cook_time, minutyZReceptu(recept && recept.time));
  udalost.start = { dateTime: booking.cook_date + 'T' + booking.cook_time + ':00', timeZone: PASMO };
  udalost.end = {
    dateTime: posunDatum(booking.cook_date, konec.dni) + 'T' + konec.cas + ':00',
    timeZone: PASMO,
  };
  // Vlastni pripominka se zamerne nenastavuje - od toho je oznameni
  // v appce. Dve pripomínky na tutéž vec jsou otravovani.
  udalost.reminders = { useDefault: false, overrides: [] };
  return udalost;
}

/**
 * Zalozi udalost. Vraci jeji id, nebo `null` kdyz to neslo.
 *
 * Nikdy nevyhazuje: zapis do kalendare je doplnek. Kdyz selze, booking
 * v appce musi zustat - jinak by vypadl plan vareni kvuli tomu, ze
 * Google zrovna nejel.
 */
export async function vytvorUdalost(env, refresh, udalost) {
  try {
    const token = await pristupovyToken(env, refresh);
    if (!token) return null;

    const res = await fetch(GCAL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(udalost),
    });
    if (!res.ok) {
      console.error('gcal insert ' + res.status + ': ' + (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    return data.id || null;
  } catch (e) {
    console.error('gcal spadl: ' + String(e).slice(0, 200));
    return null;
  }
}

/**
 * Smaze udalost, kterou appka sama zalozila.
 *
 * 404/410 se bere jako uspech - uzivatel ji mohl smazat rucne a to je
 * jeho pravo, ne chyba.
 */
export async function smazUdalost(env, refresh, eventId) {
  if (!eventId) return false;
  try {
    const token = await pristupovyToken(env, refresh);
    if (!token) return false;

    const res = await fetch(GCAL + '/' + encodeURIComponent(eventId), {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token },
    });
    return res.ok || res.status === 404 || res.status === 410;
  } catch (e) {
    console.error('gcal delete spadl: ' + String(e).slice(0, 200));
    return false;
  }
}
