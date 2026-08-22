/**
 * Zkontroluje kod uvnitr <script> v .astro souborech.
 *
 * ESLint umi jen .js. Kod v index.astro je ale prave to misto, kde se
 * preklepy delaji nejsnaz - je ho pres tri tisice radku a nikdo ho
 * nespousti driv nez uzivatel. Vytahneme ho tedy do docasneho souboru
 * v .lint/ a pustime na nej ESLint.
 *
 * Cisla radku sedi s originalem: pred vytazeny kod se doplni tolik
 * prazdnych radku, kolik jich bylo v .astro souboru pred nim. Chybu
 * tedy jde v editoru rovnou otevrit.
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { ESLint } from 'eslint';
import path from 'node:path';

const SOUBORY = ['src/pages/index.astro'];
const DOCASNE = 'lint-tmp';

/** Najde telo posledniho <script> bez atributu `type` (ten s kodem appky). */
function vytahniScript(zdroj) {
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let m, nalezeno = null;
  while ((m = re.exec(zdroj)) !== null) {
    // <script type="application/json"> nese data, ne kod - ten preskocime.
    if (m[1] && /type\s*=/.test(m[1])) continue;
    nalezeno = { telo: m[2], od: m.index + m[0].indexOf(m[2]) };
  }
  return nalezeno;
}

async function main() {
  await rm(DOCASNE, { recursive: true, force: true });
  await mkdir(DOCASNE, { recursive: true });

  const mapa = new Map();
  for (const soubor of SOUBORY) {
    const zdroj = await readFile(soubor, 'utf8');
    const nalez = vytahniScript(zdroj);
    if (!nalez) {
      console.error('Ve ' + soubor + ' zadny <script> s kodem není.');
      process.exit(1);
    }
    const radkuPred = zdroj.slice(0, nalez.od).split('\n').length - 1;
    const cil = path.join(DOCASNE, path.basename(soubor) + '.js');
    await writeFile(cil, '\n'.repeat(radkuPred) + nalez.telo, 'utf8');
    mapa.set(path.resolve(cil), soubor);
  }

  const eslint = new ESLint();
  const vysledky = await eslint.lintFiles([DOCASNE + '/**/*.js']);

  let chyb = 0, varovani = 0;
  for (const v of vysledky) {
    const puvodni = mapa.get(path.resolve(v.filePath)) || v.filePath;
    for (const m of v.messages) {
      const druh = m.severity === 2 ? 'CHYBA ' : 'pozor ';
      if (m.severity === 2) chyb++; else varovani++;
      console.log(`  ${druh} ${puvodni}:${m.line}:${m.column}  ${m.message}  (${m.ruleId || '-'})`);
    }
  }

  await rm(DOCASNE, { recursive: true, force: true });

  console.log(chyb === 0
    ? `\n=== .astro OK === (${varovani} varování)`
    : `\n=== ${chyb} CHYB v .astro ===`);
  process.exit(chyb === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
