// ==========================================================================
// mail.js  --  uvitaci e-mail po prvnim prihlaseni
//
// Proc pres HTTP a ne pres SMTP: Worker neumi otevrit SMTP spojeni.
// Posila se tedy pres API posilatele. Vybrano Brevo, protoze jako jedina
// bezna sluzba dovoli overit JEDNU adresu (treba gmail) a posilat z ni
// komukoli - ostatni (Resend, MailChannels) chteji vlastni domenu.
//
// Kdyz klic neni nastaveny, posilani se TISE preskoci. Prihlaseni se
// kvuli e-mailu nikdy nesmi rozbit.
// ==========================================================================

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const APP_URL = 'https://vorlis08.github.io/masterchef-vorlis/';

/** Text uvitaciho e-mailu. */
export function welcomeMail(user) {
  const jmeno = (user.name || '').split(' ')[0] || 'ahoj';
  return {
    subject: 'Vítej v MasterChef Vorlis 👨‍🍳',
    text:
      'Ahoj ' + jmeno + ',\n\n' +
      'vítej v MasterChef Vorlis — osobní kuchařce, ze které se pomalu stává\n' +
      'systém řízení kuchyně.\n\n' +
      'Co můžeš rovnou zkusit:\n' +
      '  • projít si recepty a přepnout si barevné téma\n' +
      '  • spustit režim vaření — krokuje recept a hlídá časovače\n' +
      '  • naplnit si spíž a zaškrtat, co máš doma\n\n' +
      'Kuchařka: ' + APP_URL + '\n\n' +
      'Dobrou chuť!\n',
    html:
      '<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#222;max-width:520px">' +
      '<h1 style="font-size:20px;margin:0 0 16px">Vítej v MasterChef Vorlis 👨‍🍳</h1>' +
      '<p>Ahoj ' + escapeHtml(jmeno) + ',</p>' +
      '<p>vítej v osobní kuchařce, ze které se pomalu stává systém řízení kuchyně.</p>' +
      '<p><strong>Co můžeš rovnou zkusit:</strong></p>' +
      '<ul>' +
        '<li>projít si recepty a přepnout si barevné téma</li>' +
        '<li>spustit režim vaření — krokuje recept a hlídá časovače</li>' +
        '<li>naplnit si spíž a zaškrtat, co máš doma</li>' +
      '</ul>' +
      '<p><a href="' + APP_URL + '" style="display:inline-block;background:#e07850;color:#fff;' +
      'padding:10px 18px;border-radius:8px;text-decoration:none">Otevřít kuchařku</a></p>' +
      '<p style="color:#777;font-size:13px">Dobrou chuť!</p>' +
      '</div>',
  };
}

function escapeHtml(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Posle uvitaci e-mail a teprve po uspechu si to poznamena do databaze.
 * Kdyz posilani selze, priste se zkusi znovu.
 *
 * Nikdy nevyhazuje vyjimku - prihlaseni na nem nesmi zaviset.
 */
export async function sendWelcome(env, user) {
  if (!env.MAIL_API_KEY || !env.MAIL_FROM) {
    console.log('Uvitaci e-mail preskocen: neni nastaveny MAIL_API_KEY/MAIL_FROM.');
    return false;
  }

  const mail = welcomeMail(user);
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
        to: [{ email: user.email, name: user.name || undefined }],
        subject: mail.subject,
        textContent: mail.text,
        htmlContent: mail.html,
      }),
    });

    if (!res.ok) {
      console.error('Uvitaci e-mail selhal ' + res.status + ': ' + (await res.text()).slice(0, 300));
      return false;
    }

    await env.DB.prepare("UPDATE users SET welcome_sent_at = datetime('now') WHERE id = ?")
      .bind(user.id).run();
    return true;
  } catch (e) {
    console.error('Uvitaci e-mail spadl: ' + String(e).slice(0, 200));
    return false;
  }
}
