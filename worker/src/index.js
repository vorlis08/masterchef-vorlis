// ==========================================================================
// vorlis - AI proxy pro MasterChef Vorlis
//
// Duvod, proc tenhle Worker existuje: klic k Anthropicu nesmi do prohlizece.
// Appka posle Workeru jen to, CO chce ("doporuc recept"), a Worker sam
// slozi text dotazu a doplni klic ze secrets.
//
// Tri vrstvy ochrany - kazda sama o sobe se da obejit, dohromady drzi:
//   1. ALLOWED_ORIGINS - pusti dovnitr jen appku, ne cizi stranku
//   2. pevne dany model a delka odpovedi + Worker si sklada dotaz sam
//      -> nejde ho pouzit jako AI zdarma na libovolny text
//   3. RATE_LIMITER - strop na pocet dotazu z jedne IP
// ==========================================================================

import { startLogin, finishLogin } from './google.js';
import { verifySession, bearerToken } from './session.js';

const ALLOWED_ORIGINS = [
  'https://vorlis08.github.io',   // ostra appka
  'http://localhost:4321',        // `npm run dev`
];

const MODEL = 'claude-sonnet-4-6';

// Stropy na vstup. Bez nich by slo Workeru poslat megabajt textu
// a zaplatil bys to ty.
const LIMITS = {
  ingredients: 500,   // co ma uzivatel doma
  recipes: 300,       // kolik receptu se vejde do dotazu
  text: 200,          // nazev receptu, ingredience, nahrada
};

function clip(value, max) {
  return String(value == null ? '' : value).slice(0, max);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function deny(status, message, origin) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin || 'null') },
  });
}

// -- Skladani dotazu: tohle je jadro ochrany c. 2 --------------------------
// Uzivatelsky text se dostane dovnitr jen na presne danych mistech,
// nikdy jako cely dotaz.

function buildRecommendPrompt(data) {
  const ingredients = clip(data.ingredients, LIMITS.ingredients);
  const recipeList = (Array.isArray(data.recipes) ? data.recipes : [])
    .slice(0, LIMITS.recipes)
    .map(r => `SLUG=${clip(r.slug, LIMITS.text)} NAZEV=${clip(r.title, LIMITS.text)} INGREDIENCE=${clip((r.ingredients || []).join(', '), 1000)}`)
    .join('\n');

  if (!ingredients || !recipeList) return null;

  return `Jsi kuchařský kámoš – přímej, drzej, vtipnej. Tykáš, nebereš rukavičky, klidně se rýpneš. Žádný formality. Odpovídáš česky s šarmem a emojis 😏

Kámoš má doma: ${ingredients}

Jeho recepty (každý má SLUG):
${recipeList}

Napiš doporučení volným textem – vtipně, s osobností. U každého doporučeného receptu popiš proč to dává smysl, co mu chybí a jeden tip.

POVINNĚ: na absolutní konec odpovědi napiš tento řádek se slugy receptů které doporučuješ:
%%SLUGS:slug1,slug2%%

Příklad: %%SLUGS:kure-na-paprice,caramelised-onion-pasta%%
Slug vezmi přesně z pole SLUG= u každého receptu. Tento řádek musí být POSLEDNÍ.`;
}

function buildSubstitutePrompt(data) {
  const recipeTitle = clip(data.recipeTitle, LIMITS.text) || 'neznámý';
  const ingredient = clip(data.ingredient, LIMITS.text);
  const replacement = clip(data.replacement, LIMITS.text);

  if (!ingredient || !replacement) return null;

  return `Jsi kuchařský kámoš – přímej, vtipnej, trochu drzej. Tykáš, klidně se do uživatele rýpneš, ale vždy mu skutečně pomůžeš. Odpovídáš česky, krátce, s emojis 😄

Recept: ${recipeTitle}
Chce nahradit: ${ingredient}
Má místo toho: ${replacement}

Odpověz ve 3 bodech, používej **tučné písmo** pro klíčové věci:
1. **Funguje to?** – řekni rovnou jestli jo nebo ne, a proč (klidně ironicky pokud je to blbý nápad)
2. **Poměr** – kolik použít místo toho (pokud se liší)
3. **Co se změní** – chuť, textura, výsledek – buď konkrétní

Krátce, vtipně, jako zpráva od kámoše v kuchyni.`;
}

const ACTIONS = {
  recommend:  { build: buildRecommendPrompt,  maxTokens: 1024 },
  substitute: { build: buildSubstitutePrompt, maxTokens: 600 },
};

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;

    // -- Prihlaseni ------------------------------------------------------
    // Sem uzivatel prijde presmerovanim, ne z kodu appky, takze hlavicku
    // Origin nema. Kontrola puvodu se proto na /auth/* nevztahuje;
    // chrani je misto toho podepsany stav a seznam povolenych navratu.
    if (path === '/auth/start')    return startLogin(request, env, ALLOWED_ORIGINS);
    if (path === '/auth/callback') return finishLogin(request, env, ALLOWED_ORIGINS);

    const origin = request.headers.get('Origin');
    const allowed = ALLOWED_ORIGINS.includes(origin);

    if (request.method === 'OPTIONS') {
      // Neznamemu puvodu nedavame povoleni ani na predbeznou otazku.
      if (!allowed) return new Response(null, { status: 403 });
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (!allowed) return deny(403, 'Tenhle Worker obsluhuje jen MasterChef Vorlis.', null);
    if (request.method !== 'POST' && path !== '/api/me') return deny(405, 'Jen POST.', origin);

    // -- Strop na pocet dotazu z jedne IP --
    if (env.RATE_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') || 'neznama';
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return deny(429, 'Moc dotazů za sebou. Dej si chvilku pauzu. 🍳', origin);
    }

    // -- Kdo jsem --------------------------------------------------------
    if (path === '/api/me') {
      const session = await verifySession(bearerToken(request), env.SESSION_SECRET);
      if (!session) return deny(401, 'Nepřihlášeno.', origin);
      const user = await env.DB
        .prepare('SELECT id, email, name, role FROM users WHERE id = ?')
        .bind(session.sub).first();
      if (!user) return deny(401, 'Účet už neexistuje.', origin);
      return new Response(JSON.stringify(user), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return deny(400, 'Nečitelný požadavek.', origin);
    }

    const action = ACTIONS[data && data.action];
    if (!action) return deny(400, 'Neznámá akce.', origin);

    const prompt = action.build(data);
    if (!prompt) return deny(400, 'Chybí údaje pro dotaz.', origin);

    // Model, delka i podoba dotazu jsou nase - z prohlizece je nastavit nejde.
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: action.maxTokens,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!upstream.ok) {
      // Chybu od Anthropicu nepredavame doslova - mohla by prozradit
      // podrobnosti o uctu. Do logu Workeru se zapise cela.
      console.error('Anthropic ' + upstream.status + ': ' + (await upstream.text()).slice(0, 500));
      return deny(502, 'AI je zrovna nedostupná, zkus to za chvíli.', origin);
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...corsHeaders(origin),
      },
    });
  },
};
