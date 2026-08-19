// ==========================================================================
// mail.js  --  odchozi e-maily
//
// Proc pres HTTP a ne pres SMTP: Worker neumi otevrit SMTP spojeni.
// Posila se pres Brevo, protoze jako jedina bezna sluzba dovoli overit
// JEDNU adresu (gmail) misto cele domeny.
//
// Pravidlo pro cely soubor: **posilani nikdy nesmi shodit to, co ho
// vyvolalo.** Kazda funkce chybu zaloguje a vrati false.
// ==========================================================================

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
export const APP_URL = 'https://vorlis08.github.io/masterchef-vorlis/';

const BARVA = '#e07850';

function esc(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Spolecny vzhled. Zamerne strizlivy: zadne obrazky, zadne sledovaci
 * pixely, jedno tlacitko. Cim jednodussi e-mail, tim mensi sance,
 * ze skonci ve spamu.
 */
function layout(nadpis, telo, odhlasit) {
  return '<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#222;max-width:540px">' +
    '<h1 style="font-size:20px;margin:0 0 16px">' + nadpis + '</h1>' +
    telo +
    '<p style="margin-top:24px"><a href="' + APP_URL + '" style="display:inline-block;background:' + BARVA +
      ';color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Otevřít kuchařku</a></p>' +
    (odhlasit
      ? '<p style="color:#999;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:12px">' +
        'Nechceš tyhle zprávy? <a href="' + odhlasit + '" style="color:#999">Vypni si je</a>.</p>'
      : '') +
    '</div>';
}

/** Odesle jeden e-mail. Vraci true/false, nikdy nevyhazuje vyjimku. */
export async function sendMail(env, zprava) {
  if (!env.MAIL_API_KEY || !env.MAIL_FROM) {
    console.log('E-mail preskocen: chybi MAIL_API_KEY nebo MAIL_FROM.');
    return false;
  }
  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.MAIL_API_KEY,
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: env.MAIL_FROM, name: 'MasterChef Vorlis' },
        to: [{ email: zprava.to, name: zprava.name || undefined }],
        subject: zprava.subject,
        textContent: zprava.text,
        htmlContent: zprava.html,
      }),
    });
    if (!res.ok) {
      console.error('E-mail selhal ' + res.status + ': ' + (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error('E-mail spadl: ' + String(e).slice(0, 200));
    return false;
  }
}

/** Odkaz na vypnuti konkretniho druhu zprav. */
export function unsubUrl(workerOrigin, user, kind) {
  return workerOrigin + '/unsub?u=' + encodeURIComponent(user.id) +
    '&t=' + encodeURIComponent(user.unsub_token || '') + '&k=' + encodeURIComponent(kind);
}

function jmeno(user) {
  return (user.name || '').split(' ')[0] || 'ahoj';
}

// -- 1. Uvitani -----------------------------------------------------------

export function welcomeMail(user) {
  const telo =
    '<p>Ahoj ' + esc(jmeno(user)) + ',</p>' +
    '<p>vítej v osobní kuchařce, ze které se pomalu stává systém řízení kuchyně.</p>' +
    '<p><strong>Co můžeš rovnou zkusit:</strong></p>' +
    '<ul>' +
      '<li>projít recepty a přepnout si barevné téma</li>' +
      '<li>spustit režim vaření — krokuje recept a hlídá časovače</li>' +
      '<li>naplnit si spíž a zaškrtat, co máš doma</li>' +
    '</ul>';
  return {
    subject: 'Vítej v MasterChef Vorlis 👨‍🍳',
    text: 'Ahoj ' + jmeno(user) + ',\n\nvítej v MasterChef Vorlis — osobní kuchařce, ze které se\n' +
      'pomalu stává systém řízení kuchyně.\n\nCo můžeš rovnou zkusit:\n' +
      '  • projít recepty a přepnout si barevné téma\n' +
      '  • spustit režim vaření — krokuje recept a hlídá časovače\n' +
      '  • naplnit si spíž a zaškrtat, co máš doma\n\n' + APP_URL + '\n\nDobrou chuť!\n',
    html: layout('Vítej v MasterChef Vorlis 👨‍🍳', telo, null),
  };
}

// -- 5. Nove recepty ------------------------------------------------------

export function newRecipesMail(user, recepty, odhlasit) {
  const seznam = recepty.map(r =>
    '<li><strong>' + esc(r.title) + '</strong>' +
    (r.category ? ' <span style="color:#888">— ' + esc(r.category) + '</span>' : '') + '</li>'
  ).join('');

  const kolik = recepty.length === 1 ? 'Přibyl nový recept' : 'Přibyly nové recepty';
  const telo =
    '<p>Ahoj ' + esc(jmeno(user)) + ', v kuchařce ' +
    (recepty.length === 1 ? 'je něco nového:' : 'jich je ' + recepty.length + ':') + '</p>' +
    '<ul>' + seznam + '</ul>';

  return {
    subject: kolik + ' 🍳',
    text: 'Ahoj ' + jmeno(user) + ',\n\n' + kolik + ':\n' +
      recepty.map(r => '  • ' + r.title).join('\n') + '\n\n' + APP_URL + '\n',
    html: layout(kolik + ' 🍳', telo, odhlasit),
  };
}

// -- 6. Z wishlistu jde uvarit --------------------------------------------

export function wishlistMail(user, polozky, odhlasit) {
  const seznam = polozky.map(p =>
    '<li><strong>' + esc(p.title) + '</strong>' +
    (p.chybi === 0
      ? ' <span style="color:#2a9d5c">— máš všechno</span>'
      : ' <span style="color:#888">— chybí ' + p.chybi + '×</span>') + '</li>'
  ).join('');

  const telo =
    '<p>Ahoj ' + esc(jmeno(user)) + ', koukal jsem ti do spíže a tohle z tvého ' +
    '„chci vyzkoušet" jde uvařit hned:</p>' +
    '<ul>' + seznam + '</ul>' +
    '<p style="color:#888;font-size:13px">Počítám podle toho, co máš zapsané ve spíži. ' +
    'Jestli to nesedí, spíž bude potřebovat doladit.</p>';

  return {
    subject: 'Tohle můžeš uvařit hned 🥘',
    text: 'Ahoj ' + jmeno(user) + ',\n\nz tvého "chci vyzkoušet" jde uvařit hned:\n' +
      polozky.map(p => '  • ' + p.title + (p.chybi ? ' (chybí ' + p.chybi + ')' : ' (máš všechno)')).join('\n') +
      '\n\n' + APP_URL + '\n',
    html: layout('Tohle můžeš uvařit hned 🥘', telo, odhlasit),
  };
}

// -- 8. Souhrn ------------------------------------------------------------

export function summaryMail(user, s, odhlasit) {
  const radky = [
    ['Uvařeno jídel', s.uvareno],
    ['Různých receptů', s.ruznych],
    ['Nejčastěji', s.nejcastejsi || '—'],
    ['Nejlíp hodnocené', s.nejlepsi || '—'],
    ['Ve spíži', s.spiz + ' surovin'],
  ].map(([k, v]) =>
    '<tr><td style="padding:6px 12px 6px 0;color:#888">' + esc(k) + '</td>' +
    '<td style="padding:6px 0"><strong>' + esc(v) + '</strong></td></tr>'
  ).join('');

  const telo =
    '<p>Ahoj ' + esc(jmeno(user)) + ', takhle vypadal tvůj měsíc v kuchyni:</p>' +
    '<table style="border-collapse:collapse;margin:12px 0">' + radky + '</table>' +
    (s.uvareno === 0
      ? '<p style="color:#888">Zatím nic — buď jsi nevařil, nebo jsi zapomněl mačkat „uvařeno". ' +
        'To druhé se stává častěji. 😉</p>'
      : '');

  return {
    subject: 'Tvůj měsíc v kuchyni 📊',
    text: 'Ahoj ' + jmeno(user) + ',\n\nTvůj měsíc v kuchyni:\n' +
      '  Uvařeno jídel: ' + s.uvareno + '\n' +
      '  Různých receptů: ' + s.ruznych + '\n' +
      '  Nejčastěji: ' + (s.nejcastejsi || '—') + '\n' +
      '  Nejlíp hodnocené: ' + (s.nejlepsi || '—') + '\n' +
      '  Ve spíži: ' + s.spiz + ' surovin\n\n' + APP_URL + '\n',
    html: layout('Tvůj měsíc v kuchyni 📊', telo, odhlasit),
  };
}

// -- 9. + 10. Zpravy pro spravce ------------------------------------------
// Chodi jen tobe, takze bez odhlasovaciho odkazu a bez cukrovani.

export async function adminNewUser(env, user, pocetUzivatelu) {
  const telo =
    '<p><strong>' + esc(user.email) + '</strong>' + (user.name ? ' (' + esc(user.name) + ')' : '') + '</p>' +
    '<p>Uživatelů celkem: <strong>' + pocetUzivatelu + '</strong></p>';
  return sendMail(env, {
    to: env.MAIL_FROM,
    subject: 'Nový uživatel: ' + user.email,
    text: 'Nový uživatel v MasterChef Vorlis\n\n' + user.email +
      (user.name ? ' (' + user.name + ')' : '') + '\nUživatelů celkem: ' + pocetUzivatelu + '\n',
    html: layout('Nový uživatel 👋', telo, null),
  });
}

export async function adminError(env, kde, podrobnosti) {
  const telo =
    '<p>Něco ve Workeru selhalo.</p>' +
    '<p><strong>Kde:</strong> ' + esc(kde) + '</p>' +
    '<pre style="background:#f5f5f5;padding:12px;border-radius:6px;font-size:12px;' +
    'white-space:pre-wrap;word-break:break-word">' + esc(String(podrobnosti).slice(0, 800)) + '</pre>';
  return sendMail(env, {
    to: env.MAIL_FROM,
    subject: '⚠️ MasterChef: ' + kde,
    text: 'Chyba ve Workeru\n\nKde: ' + kde + '\n\n' + String(podrobnosti).slice(0, 800) + '\n',
    html: layout('⚠️ Něco se rozbilo', telo, null),
  });
}

// -- Uvitani (posila se pri prvnim prihlaseni) ----------------------------

/**
 * Posle uvitaci e-mail a teprve po uspechu si to poznamena.
 * Kdyz posilani selze, priste se zkusi znovu.
 */
export async function sendWelcome(env, user) {
  const mail = welcomeMail(user);
  const ok = await sendMail(env, { to: user.email, name: user.name, ...mail });
  if (ok) {
    await env.DB.prepare("UPDATE users SET welcome_sent_at = datetime('now') WHERE id = ?")
      .bind(user.id).run();
  }
  return ok;
}
