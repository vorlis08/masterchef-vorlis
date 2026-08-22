/**
 * Pusti vsechny sady `test-*.mjs` a shrne je do jednoho radku.
 *
 * Proc skript a ne `node test-*.mjs`: hvezdicku na Windows nerozbaluje
 * shell, takze prikaz z README fungoval jen v bashi. A hlavne - takhle
 * se to da pustit z CI jednim `npm test` a vratit spravny navratovy kod,
 * kdyz nekterá sada spadne.
 */

import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const sady = (await readdir('.'))
  .filter(f => /^test-.+\.mjs$/.test(f))
  .sort();

if (!sady.length) {
  console.error('Zadne testy jsem nenasel.');
  process.exit(1);
}

let spadlo = 0;
for (const sada of sady) {
  const v = spawnSync(process.execPath, [sada], { encoding: 'utf8' });
  const vypis = (v.stdout || '') + (v.stderr || '');
  const ok = v.status === 0;
  if (!ok) spadlo++;

  console.log((ok ? '  OK   ' : '  SPADLO ') + sada);
  // U spadle sady vypiseme, co se stalo - jinak by CI hlasilo jen cislo.
  if (!ok) console.log(vypis.split('\n').filter(r => /FAIL|Error|error/.test(r)).join('\n') || vypis);
}

console.log(spadlo === 0
  ? `\n=== ${sady.length} sad prošlo ===`
  : `\n=== ${spadlo} z ${sady.length} sad SPADLO ===`);
process.exit(spadlo === 0 ? 0 : 1);
