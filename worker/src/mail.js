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
//
// Text zacina u ctenare, ne u appky: prvni dva odstavce jsou o jeho vecerni
// lednici a jmeno appky padne az ve chvili, kdy se pozna.
//
// Vsechny styly jsou INLINE. Postovni programy hromadny <style> casto
// zahazuji - to, co je v hlavicce, je jen pro mobil a smi se ztratit.

const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

function karta(ikona, stitek, nadpis, text) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">' +
    '<tr><td bgcolor="#1d1a16" style="background:#1d1a16;border:1px solid #322c24;border-radius:14px;padding:20px 22px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>' +
    '<td width="40" valign="top" style="font-size:24px;line-height:1.2;">' + ikona + '</td>' +
    '<td valign="top">' +
    '<div style="font-family:' + SANS + ';font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#e07850;font-weight:bold;margin-bottom:5px;">' + stitek + '</div>' +
    '<div style="font-family:' + SERIF + ';font-size:19px;color:#f2ede4;margin-bottom:7px;">' + nadpis + '</div>' +
    '<div style="font-family:' + SANS + ';font-size:14px;line-height:1.6;color:#9a9083;">' + text + '</div>' +
    '</td></tr></table></td></tr></table>';
}

function polozkaLednice(ikona, popis) {
  return '<td width="33%" align="center" style="padding:4px;">' +
    '<div style="font-size:26px;line-height:1.4;">' + ikona + '</div>' +
    '<div style="font-family:' + SANS + ';font-size:12px;color:#9a9083;">' + popis + '</div></td>';
}

export function welcomeMail(user) {
  const kdo = esc(jmeno(user));

  const odstavec = t =>
    '<p style="margin:0 0 16px;font-family:' + SANS + ';font-size:16px;line-height:1.65;color:#cdc5b8;">' + t + '</p>';

  const html =
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">' +
      'Je šest hodin a v lednici tři věci. Tohle je pro tenhle moment.</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d0b09" style="background:#0d0b09;">' +
    '<tr><td align="center" style="padding:28px 12px 40px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">' +

    // hlavicka
    '<tr><td align="center" bgcolor="#e07850" style="background:#e07850;background:linear-gradient(135deg,#e07850 0%,#c96840 55%,#a4502f 100%);border-radius:20px 20px 0 0;padding:34px 24px 30px;">' +
      '<div style="font-size:40px;line-height:1;margin-bottom:6px;">🍳</div>' +
      '<div style="font-family:' + SERIF + ';font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#3a1e10;font-weight:bold;">MasterChef&nbsp;Vorlis</div>' +
    '</td></tr>' +

    // telo
    '<tr><td bgcolor="#14120f" style="background:#14120f;padding:38px 44px 10px;border-left:1px solid #322c24;border-right:1px solid #322c24;">' +
      '<h1 style="margin:0 0 22px;font-family:' + SERIF + ';font-weight:normal;font-size:36px;line-height:1.15;color:#f2ede4;">Tak co&nbsp;dneska?</h1>' +
      odstavec('Ahoj <strong style="color:#f2ede4;">' + kdo + '</strong>,') +
      odstavec('znáš to. Je šest, máš hlad, otevřeš lednici — a koukáš na kuřecí prsa, půlku smetany a cibuli.') +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 26px;"><tr>' +
        polozkaLednice('🍗', 'kuřecí prsa') +
        polozkaLednice('🥛', 'půlka smetany') +
        polozkaLednice('🧅', 'cibule') +
      '</tr></table>' +
      '<p style="margin:0 0 26px;font-family:' + SANS + ';font-size:16px;line-height:1.65;color:#cdc5b8;">A pak si stejně dáš toast.</p>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 34px;"><tr>' +
        '<td width="3" bgcolor="#e07850" style="background:#e07850;border-radius:2px;">&nbsp;</td>' +
        '<td style="padding-left:18px;"><p style="margin:0;font-family:' + SERIF + ';font-size:19px;line-height:1.5;color:#f2ede4;font-style:italic;">' +
        'MasterChef Vorlis existuje přesně kvůli téhle chvíli.</p></td>' +
      '</tr></table>' +
    '</td></tr>' +

    // karty
    '<tr><td bgcolor="#14120f" style="background:#14120f;padding:0 44px;border-left:1px solid #322c24;border-right:1px solid #322c24;">' +
      karta('🥫', 'Spíž', 'Ví, co máš doma',
        'Jednou proklikáš, co máš v kuchyni — a appka od té chvíle ví, co ti chybí a co zvládneš uvařit, ' +
        'aniž bys někam běžel. U masa se ptá na gramy, u soli jen na ' +
        '<em style="color:#cdc5b8;">mám / dochází / nemám</em>. Protože sůl nikdo neváží.') +
      karta('⏱️', 'Režim vaření', 'Vede tě krok za krokem',
        'Jeden krok přes celou obrazovku, časovače běží samy a displej nezhasne ve chvíli, kdy máš ruce od mouky.') +
      karta('👨‍🍳', 'Kuchařský kámoš', 'Poradí, když ti něco dojde',
        'Napíšeš, co máš, on vybere. A když v půlce receptu zjistíš, že smetana došla, vymyslí náhradu — bez povyšování.') +
    '</td></tr>' +

    // tlacitko
    '<tr><td bgcolor="#14120f" align="center" style="background:#14120f;padding:6px 44px 40px;border-left:1px solid #322c24;border-right:1px solid #322c24;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td align="center" bgcolor="#e07850" style="background:#e07850;background:linear-gradient(135deg,#e07850,#c96840);border-radius:12px;">' +
      '<a href="' + APP_URL + '?uvod=1" style="display:inline-block;padding:16px 40px;font-family:' + SANS + ';font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">' +
      'Pojď si vybrat večeři&nbsp;&rarr;</a></td></tr></table>' +
      '<p style="margin:20px 0 0;font-family:' + SANS + ';font-size:13px;line-height:1.6;color:#786f63;">' +
      'Uvnitř tě čeká krátký úvod a nabídka průvodce.<br>Kdo nechce, proklikne. Nikdo se neurazí.</p>' +
    '</td></tr>' +

    // paticka
    '<tr><td bgcolor="#1d1a16" align="center" style="background:#1d1a16;border:1px solid #322c24;border-top:none;border-radius:0 0 20px 20px;padding:24px 30px;">' +
      '<div style="font-family:' + SERIF + ';font-size:15px;color:#cdc5b8;margin-bottom:6px;">Ať to dneska dopadne jakkoliv, snad líp než ten toast.</div>' +
      '<div style="font-family:' + SANS + ';font-size:12px;color:#6b6357;">Dobrou chuť!</div>' +
    '</td></tr>' +

    '</table></td></tr></table>';

  const text =
    'Tak co dneska?\n\n' +
    'Ahoj ' + jmeno(user) + ',\n\n' +
    'znáš to. Je šest, máš hlad, otevřeš lednici — a koukáš na kuřecí prsa,\n' +
    'půlku smetany a cibuli. A pak si stejně dáš toast.\n\n' +
    'MasterChef Vorlis existuje přesně kvůli téhle chvíli.\n\n' +
    'SPÍŽ — ví, co máš doma\n' +
    '  Jednou proklikáš, co máš v kuchyni, a appka od té chvíle ví, co ti chybí\n' +
    '  a co zvládneš uvařit, aniž bys někam běžel. U masa se ptá na gramy,\n' +
    '  u soli jen na mám / dochází / nemám. Protože sůl nikdo neváží.\n\n' +
    'REŽIM VAŘENÍ — vede tě krok za krokem\n' +
    '  Jeden krok přes celou obrazovku, časovače běží samy a displej nezhasne\n' +
    '  ve chvíli, kdy máš ruce od mouky.\n\n' +
    'KUCHAŘSKÝ KÁMOŠ — poradí, když ti něco dojde\n' +
    '  Napíšeš, co máš, on vybere. A když v půlce receptu zjistíš, že smetana\n' +
    '  došla, vymyslí náhradu — bez povyšování.\n\n' +
    'Pojď si vybrat večeři: ' + APP_URL + '?uvod=1\n\n' +
    'Ať to dneska dopadne jakkoliv, snad líp než ten toast.\nDobrou chuť!\n';

  return { subject: 'Tak co dneska? 👨‍🍳', text: text, html: html };
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
