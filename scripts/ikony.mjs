/**
 * Vyrobi ikony aplikace pro plochu telefonu a pro oznameni.
 *
 *   node scripts/ikony.mjs
 *
 * Poust se jen kdyz se meni vzhled ikony - vysledne PNG jsou v repu,
 * takze build je nepotrebuje.
 *
 * Emoji se sem kreslit neda: prevod SVG na PNG nema k dispozici emoji
 * font a vypadl by prazdny obrazek. Panev je proto nakreslena tvary.
 */

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const BG = '#14120f';
const ACCENT = '#e07850';
const TEXT = '#f2ede4';

/**
 * @param {number} p  odsazeni od kraje. Maskovana ikona ho potrebuje
 *   vetsi - Android si z ni vykroji kruh a bez rezervy by uriznul panev.
 */
const svg = (velikost, p) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${velikost}" height="${velikost}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${BG}"/>
  <g transform="translate(${p}, ${p}) scale(${(100 - 2 * p) / 100})">
    <circle cx="42" cy="52" r="30" fill="none" stroke="${ACCENT}" stroke-width="7"/>
    <circle cx="42" cy="52" r="19" fill="${ACCENT}" opacity="0.22"/>
    <path d="M70 40 L92 26" stroke="${ACCENT}" stroke-width="8" stroke-linecap="round"/>
    <path d="M30 22 q6 -9 0 -16" stroke="${TEXT}" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.75"/>
    <path d="M45 20 q6 -9 0 -16" stroke="${TEXT}" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.55"/>
  </g>
</svg>`;

await mkdir('public/icons', { recursive: true });

const kusy = [
  ['public/icons/ikona-192.png', 192, 8],
  ['public/icons/ikona-512.png', 512, 8],
  ['public/icons/ikona-maskovana.png', 512, 20],
  // Do oznameni na Androidu jde jednobarevna silueta - barvu si systém
  // dosadi sam, takze detaily by stejne zanikly.
  ['public/icons/oznameni.png', 96, 8],
  ['public/icons/apple-touch-icon.png', 180, 6],
];

for (const [cesta, velikost, odsazeni] of kusy) {
  await sharp(Buffer.from(svg(velikost, odsazeni))).png().toFile(cesta);
  console.log('  ' + cesta);
}
console.log('Hotovo.');
