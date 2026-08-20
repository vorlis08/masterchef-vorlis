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
// VZHLED: e-mail zamerne vypada JAKO RECEPT - papirova karta, metadata pod
// nadpisem, sekce Ingredience a Postup, na konci Tip. Je to jiny svet nez
// tmava uvitaci obrazovka v aplikaci, a pritom to nemuze byt od nikoho
// jineho: appka presne takhle sazi recepty uvnitr.
//
// Svetly podklad ma jeste jednu vyhodu - postovni programy, ktere si
// prevraceji barvy, nemaji co zkazit.
//
// Vsechny styly jsou INLINE. Hromadny <style> postovni programy casto
// zahazuji, takze se na nej nesmi nic podstatneho vazat.

const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

// Papirova paleta. Akcent je proti aplikaci o neco tmavsi, aby na svetlem
// podkladu drzel kontrast.
const PAPIR = '#f6f1e7';
const INKOUST = '#2a2118';
const TLUMENY = '#6f6253';
const LINKA = '#e2d8c6';
const AKCENT = '#b8532b';

/** Polozka v "ingrediencich": mnozstvi vlevo, popis vpravo. */
function ingredience(mnozstvi, popis) {
  return '<tr>' +
    '<td width="76" valign="top" align="right" style="font-family:' + SANS + ';font-size:14px;' +
      'color:' + AKCENT + ';font-weight:600;padding:5px 12px 5px 0;white-space:nowrap;">' + mnozstvi + '</td>' +
    '<td valign="top" style="font-family:' + SANS + ';font-size:15px;line-height:1.6;color:' + INKOUST + ';padding:5px 0;">' + popis + '</td>' +
    '</tr>';
}

/** Krok postupu. Cislice v krouzku, jako v Basic rezimu aplikace. */
function krokPostupu(cislo, text) {
  return '<tr>' +
    '<td width="34" valign="top" style="padding:7px 0 7px 0;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td width="24" height="24" align="center" valign="middle" bgcolor="' + AKCENT + '" ' +
        'style="background:' + AKCENT + ';border-radius:12px;font-family:' + SANS + ';font-size:12px;' +
        'font-weight:700;color:#ffffff;line-height:24px;">' + cislo + '</td>' +
      '</tr></table>' +
    '</td>' +
    '<td valign="top" style="font-family:' + SANS + ';font-size:15px;line-height:1.65;color:' + INKOUST + ';padding:7px 0;">' + text + '</td>' +
    '</tr>';
}

export function welcomeMail(user) {
  const kdo = esc(jmeno(user));

  const html =
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">' +
      'Recept na dnešní večer. Doba přípravy: deset vteřin.</div>' +

    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#efe7d8" style="background:#efe7d8;">' +
    '<tr><td align="center" style="padding:32px 12px 44px;">' +

    // Karta receptu
    '<table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" ' +
      'bgcolor="' + PAPIR + '" style="width:580px;max-width:580px;background:' + PAPIR + ';border:1px solid ' + LINKA + ';">' +

    // Horni lista karty
    '<tr><td bgcolor="' + AKCENT + '" style="background:' + AKCENT + ';height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>' +

    '<tr><td style="padding:30px 46px 0;">' +
      // Hlavicka receptu
      '<div style="font-family:' + SANS + ';font-size:10px;letter-spacing:3px;text-transform:uppercase;color:' + TLUMENY + ';">' +
        'MasterChef Vorlis &nbsp;·&nbsp; recept na dnešní večer' +
      '</div>' +

      '<h1 style="margin:14px 0 10px;font-family:' + SERIF + ';font-weight:normal;font-size:42px;' +
        'line-height:1.08;color:' + INKOUST + ';">Tak co&nbsp;dneska?</h1>' +

      // Metadata jako u receptu v aplikaci
      '<div style="font-family:' + SANS + ';font-size:13px;color:' + TLUMENY + ';padding-bottom:20px;">' +
        'Příprava 10 vteřin &nbsp;/&nbsp; 1 večeře &nbsp;/&nbsp; snadné' +
      '</div>' +

      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
        '<tr><td style="border-top:1px solid ' + LINKA + ';font-size:0;line-height:0;">&nbsp;</td></tr>' +
      '</table>' +

      // Uvod
      '<p style="margin:22px 0 14px;font-family:' + SANS + ';font-size:16px;line-height:1.7;color:' + INKOUST + ';">' +
        'Ahoj <strong>' + kdo + '</strong>, znáš to. Je šest, máš hlad, otevřeš lednici — ' +
        'a koukáš na kuřecí prsa, půlku smetany a jednu cibuli.</p>' +
      '<p style="margin:0 0 26px;font-family:' + SANS + ';font-size:16px;line-height:1.7;color:' + INKOUST + ';">' +
        'A pak si stejně dáš toast.</p>' +
    '</td></tr>' +

    // Ingredience
    '<tr><td style="padding:0 46px;">' +
      '<div style="font-family:' + SANS + ';font-size:11px;letter-spacing:2px;text-transform:uppercase;' +
        'color:' + AKCENT + ';font-weight:700;padding-bottom:8px;">Ingredience</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
        ingredience('1 ks', 'spíž, která ví, co máš doma — a u soli se neptá na gramy') +
        ingredience('1 ks', 'režim vaření, co tě vede krok za krokem a nenechá zhasnout displej') +
        ingredience('1 ks', 'kuchařský kámoš na chvíle, kdy ti něco dojde uprostřed vaření') +
        ingredience('dle chuti', 'recepty, které někdo doopravdy uvařil') +
      '</table>' +
    '</td></tr>' +

    // Postup
    '<tr><td style="padding:26px 46px 0;">' +
      '<div style="font-family:' + SANS + ';font-size:11px;letter-spacing:2px;text-transform:uppercase;' +
        'color:' + AKCENT + ';font-weight:700;padding-bottom:6px;">Postup</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
        krokPostupu('1', 'Klikni na tlačítko níž. Čeká tě krátký úvod a nabídka průvodce — kdo nechce, proklikne.') +
        krokPostupu('2', 'Zaškrtej, co máš doma. Zabere to chvíli, ale od té chvíle appka počítá za tebe.') +
        krokPostupu('3', 'Vař. O zbytek se postará ona.') +
      '</table>' +
    '</td></tr>' +

    // Tlacitko
    '<tr><td align="center" style="padding:30px 46px 0;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td align="center" bgcolor="' + AKCENT + '" style="background:' + AKCENT + ';border-radius:10px;">' +
      '<a href="' + APP_URL + '?uvod=1" style="display:inline-block;padding:15px 38px;font-family:' + SANS + ';' +
        'font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Otevřít kuchařku</a>' +
      '</td></tr></table>' +
    '</td></tr>' +

    // Tip - stejny prvek, jaky ma aplikace u receptu
    '<tr><td style="padding:30px 46px 0;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
        'bgcolor="#f0e7d5" style="background:#f0e7d5;border-left:3px solid ' + AKCENT + ';">' +
        '<tr><td style="padding:14px 18px;font-family:' + SANS + ';font-size:14px;line-height:1.65;color:' + INKOUST + ';">' +
          '<strong style="color:' + AKCENT + ';">Tip</strong> — Ať to dneska dopadne jakkoliv, ' +
          'snad líp než ten toast.' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +

    // Paticka karty
    '<tr><td style="padding:26px 46px 30px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td style="border-top:1px solid ' + LINKA + ';padding-top:16px;font-family:' + SANS + ';' +
        'font-size:12px;color:' + TLUMENY + ';">Dobrou chuť!</td>' +
      '</tr></table>' +
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

// -- Pripominka na zitrejsi vareni (4.6) ----------------------------------

export function reminderMail(user, plan, odhlasit) {
  const radky = plan.map(p => {
    const chybi = p.chybi.length
      ? '<div style="font-family:' + SANS + ';font-size:13px;color:#9a9083;margin-top:3px">Chybí: ' +
        esc(p.chybi.join(', ')) + '</div>'
      : '<div style="font-family:' + SANS + ';font-size:13px;color:#2a9d5c;margin-top:3px">Máš všechno.</div>';
    return '<li style="margin-bottom:14px"><strong>' + esc(p.title) + '</strong>' +
      '<span style="color:#888"> — ' + esc(p.kdy) + '</span>' + chybi + '</li>';
  }).join('');

  const neco = plan.some(p => p.chybi.length);
  const nadpis = neco ? 'Zítra vaříš — něco ti chybí 🛒' : 'Zítra vaříš 🍳';

  const telo =
    '<p>Ahoj ' + esc(jmeno(user)) + ', zítra podle plánu vaříš:</p>' +
    '<ul style="padding-left:18px">' + radky + '</ul>' +
    (neco
      ? '<p>Chybějící suroviny jsem ti hodil do nákupního seznamu v aplikaci.</p>'
      : '<p>Nakupovat nemusíš. To se povedlo.</p>');

  return {
    subject: nadpis,
    text: 'Ahoj ' + jmeno(user) + ',\n\nzítra podle plánu vaříš:\n' +
      plan.map(p => '  • ' + p.title + ' (' + p.kdy + ')' +
        (p.chybi.length ? '\n    chybí: ' + p.chybi.join(', ') : '\n    máš všechno')).join('\n') +
      '\n\n' + APP_URL + '\n',
    html: layout(nadpis, telo, odhlasit),
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
