// ==========================================================================
// tour.js  --  cast "mozku"
//
// Prohlidka aplikace. Drzi POradi kroku a to, co se ma u kazdeho rict -
// nevi nic o tom, jak se zvyrazneni kresli.
//
// `akce` je pokyn pro vzhled, co musi udelat, aby bylo na co ukazovat
// (otevrit recept, prepnout na mrizku, otevrit nastaveni). Nazvy akci
// jsou dohodnute mezi timhle souborem a index.astro.
// ==========================================================================

/**
 * Kroky prohlidky v poradi, v jakem se aplikace prochazi:
 * nejdriv seznam receptu, pak jeden recept zevnitr, pak nastroje kolem.
 */
export const KROKY = [
  // -- Seznam receptu --
  {
    cil: '#search',
    nadpis: 'Hledání',
    text: 'Piš název jídla nebo surovinu. Zvládne i skloňování — „slanina" najde i recept, kde je „se slaninou".',
  },
  {
    cil: '#filter-area',
    nadpis: 'Filtry',
    text: 'Kategorie, typ jídla a čas. Když máš čtvrt hodiny, klikni na „do 20 min" a zbytek zmizí.',
  },
  {
    cil: '#view-toggle',
    nadpis: 'Dva pohledy',
    text: 'Rejstřík je seznam pro rychlé hledání, mřížka ukazuje fotky. Přepínej podle nálady.',
  },
  {
    cil: '#hero',
    nadpis: 'Dnešní volba',
    text: 'Když se ti nechce vybírat, appka vybere za tebe. Každý den jiný recept.',
  },

  // -- Detail receptu --
  {
    akce: 'otevriRecept',
    cil: '#modal-title',
    nadpis: 'Detail receptu',
    text: 'Ingredience, postup a všechno kolem. Tohle je místo, kde strávíš nejvíc času.',
  },
  {
    cil: '#modal-controls',
    nadpis: 'Porce',
    text: 'Vaříš pro dva místo čtyř? Přepni počet a všechna množství se přepočítají sama.',
  },
  {
    cil: '#mode-toggle',
    nadpis: 'Basic a Fancy',
    text: 'Basic je strohý postup na rychlé vaření. Fancy je rozšířená verze s tipy — a vypadá jako stránka z kuchařky.',
  },
  {
    cil: '#cook-mode-btn',
    nadpis: 'Režim vaření',
    text: 'Jeden krok přes celou obrazovku. Časovače v receptu se pustí ťuknutím, běží klidně tři najednou a displej mezitím nezhasne.',
  },
  {
    cil: '#nutrition-btn',
    nadpis: 'Nutriční hodnoty',
    text: 'Kalorie, bílkoviny, tuky i vitamíny. Vždycky na jednu porci — nepřepočítávají se s počtem porcí.',
  },
  {
    cil: '#subst-btn',
    nadpis: 'Náhrada suroviny',
    text: 'Došla ti smetana uprostřed vaření? Řekni, co máš místo toho, a poradí ti, jestli to projde a v jakém poměru.',
  },
  {
    cil: '#add-shop-btn',
    nadpis: 'Do nákupního seznamu',
    text: 'Jedním klikem hodíš všechny suroviny receptu do nákupního seznamu.',
  },
  {
    cil: '#wish-btn',
    nadpis: 'Chci vyzkoušet',
    text: 'Zaujal tě recept, ale dneska na něj nemáš? Označ ho — a až budeš mít suroviny, appka ti dá vědět.',
  },
  {
    cil: '#cooked-btn',
    nadpis: 'Uvařil jsem to',
    text: 'Počítá, kolikrát jsi recept vařil. Podle toho pak poznáš svoje stálice.',
  },
  {
    cil: '#star-row',
    nadpis: 'Hodnocení',
    text: 'Pět hvězdiček. Za měsíc už si nevzpomeneš, jestli to stálo za to — tohle si vzpomene za tebe.',
  },
  {
    cil: '#personal-note',
    nadpis: 'Poznámky',
    text: '„Příště míň soli." „Dát tam dvakrát tolik česneku." Přesně tyhle věci se jinak ztratí.',
  },

  // -- Kolem receptu --
  {
    akce: 'zavriRecept',
    cil: '#nav-fav',
    nadpis: 'Oblíbené',
    text: 'Srdíčko u receptu si ho uloží mezi oblíbené. Odsud se k nim dostaneš.',
  },
  {
    cil: '#shopping-btn',
    nadpis: 'Nákupní seznam',
    text: 'Co ti chybí. Odškrtáváš při nákupu a jde zkopírovat do zprávy, kdyby nakupoval někdo jiný.',
  },
  {
    cil: '#pantry-btn',
    nadpis: 'Spíž',
    text: 'Srdce celé appky. Zaškrtáš, co máš doma — a od té chvíle ví, co ti chybí a co zvládneš uvařit hned.',
  },
  {
    akce: 'otevriSpiz',
    cil: '#checklist-open',
    nadpis: 'Dlouhý seznam',
    text: 'Přes sto surovin seřazených podle kuchyně, ne podle abecedy. U masa se ptá na gramy, u soli jen mám / dochází / nemám.',
  },
  {
    akce: 'zavriSpiz',
    cil: '#chef-btn',
    nadpis: 'Kuchařský kámoš',
    text: 'Napíšeš, co máš v lednici, a on vybere. Odpovídá jako kámoš, ne jako příručka.',
  },

  // -- Nastaveni --
  {
    cil: '#settings-btn',
    nadpis: 'Nastavení',
    text: 'Profil, barvy a to, co ti má chodit e-mailem.',
  },
  {
    akce: 'otevriNastaveni',
    cil: '#theme-grid',
    nadpis: 'Barevné palety',
    text: 'Čtyři barevná témata. Vyber si, co ti sedne — appka si to bude pamatovat.',
  },
  {
    cil: '#notify-section',
    nadpis: 'Co ti má chodit',
    text: 'Tady si řekneš, o čem chceš vědět e-mailem. Nejvýš jedna zpráva denně a v noci nic nechodí.',
  },
  {
    akce: 'zavriNastaveni',
    cil: '#auth-btn',
    nadpis: 'Tvůj účet',
    text: 'Odsud se dostaneš k profilu a odhlášení. A to je všechno — teď už si běž něco uvařit. 👨‍🍳',
  },
];

/** Kolik kroku prohlidka ma. */
export function pocetKroku() {
  return KROKY.length;
}

/** Krok podle poradi. Mimo rozsah vraci null. */
export function krok(i) {
  return KROKY[i] || null;
}

/** Srovna cislo kroku do platneho rozsahu. */
export function omez(i) {
  if (!(i > 0)) return 0;
  return i > KROKY.length - 1 ? KROKY.length - 1 : i;
}

export function jePrvni(i) {
  return i <= 0;
}

export function jePosledni(i) {
  return i >= KROKY.length - 1;
}

/** Popisek postupu: "4 / 24". */
export function popisPostupu(i) {
  return (omez(i) + 1) + ' / ' + KROKY.length;
}

/** Co ma stat na tlacitku dopredu. */
export function popisekDopredu(i) {
  return jePosledni(i) ? 'Hotovo' : 'Dál';
}

/**
 * Akce, ktere musi vzhled provest pri prechodu na dany krok.
 * Vraci nazev akce, nebo null.
 */
export function akceKroku(i) {
  const k = krok(omez(i));
  return k && k.akce ? k.akce : null;
}
