/**
 * Vyrobi znacku appky - favicon a ikony na plochu telefonu i pro oznameni.
 *
 *   node scripts/ikony.mjs
 *
 * Poust se jen kdyz se meni vzhled znacky - vysledne soubory jsou v repu,
 * takze build je nepotrebuje.
 *
 * ZNACKA: velke "V" (Vorlis) ze dvou tahu jako stetcem, se zaoblenymi
 * konci - stejny jazyk jako displejove pismo Fraunces, jen nakresleny
 * tvary, ne textem. Emoji a webfont se sem kreslit nedaji: prevod na
 * PNG nema k dispozici font ani emoji sadu a vypadl by prazdny obrazek
 * (na tohle uz appka jednou dosla, viz stary komentar u panve).
 *
 * Jiskra nahore je STEJNY zlatý odstin (`--f-gold` v global.css), jaky
 * ma ozdobny fleuron (✧) u Fancy receptu - znacka appky a jeji "sváteční"
 * rezim tak nesou stejnou barvu, misto aby to byly dve nesouvisejici
 * veci vedle sebe.
 *
 * DULEZITE: tenhle tvar uz neni zadny z 8 avataru v public/avatary/ (ty
 * kreslily hrnec, panev, vareku...). Kdyby ikona appky byla stejna jako
 * jeden z avataru, kdokoli by si tenhle avatar vybral, splynul by v
 * oznamenich a na plose s appkou samotnou.
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const BG = '#14120f';
const ACCENT = '#e07850';
const GOLD = '#d8b26a';

/**
 * @param {number} p  odsazeni od kraje. Maskovana ikona ho potrebuje
 *   vetsi - Android si z ni vykroji kruh a bez rezervy by uriznul znacku.
 * @param {boolean} [pozadi]  false = bez vyplne (znacka appky do <head>,
 *   kde barvu pozadi resi uz stranka sama).
 */
function znacka(velikost, p, pozadi = true) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${velikost}" height="${velikost}" viewBox="0 0 100 100">
  ${pozadi ? `<rect width="100" height="100" fill="${BG}"/>` : ''}
  <g transform="translate(${p}, ${p}) scale(${(100 - 2 * p) / 100})">
    <path d="M30 24 L50 72 L70 24" fill="none" stroke="${ACCENT}"
      stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M68 13 C68.8 19 71 21.2 77 22 C71 22.8 68.8 25 68 31
             C67.2 25 65 22.8 59 22 C65 21.2 67.2 19 68 13 Z" fill="${GOLD}"/>
  </g>
</svg>`;
}

await mkdir('public/icons', { recursive: true });

// Favicon: samostatny SVG, prohlizec si ho zmensi sam na cokoliv potrebuje.
await writeFile('public/favicon.svg', znacka(64, 6).trim() + '\n', 'utf8');
console.log('  public/favicon.svg');

const kusy = [
  ['public/icons/ikona-192.png', 192, 8],
  ['public/icons/ikona-512.png', 512, 8],
  ['public/icons/ikona-maskovana.png', 512, 20],
  // Do oznameni na Androidu jde jednobarevna silueta - barvu si systém
  // dosadi sam, takze detaily (zlata jiskra) by stejne zanikly.
  ['public/icons/oznameni.png', 96, 8],
  ['public/icons/apple-touch-icon.png', 180, 6],
];

for (const [cesta, velikost, odsazeni] of kusy) {
  await sharp(Buffer.from(znacka(velikost, odsazeni))).png().toFile(cesta);
  console.log('  ' + cesta);
}
console.log('Hotovo.');
