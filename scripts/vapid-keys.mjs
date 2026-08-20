// Vyrobi par klicu pro oznameni na telefon (VAPID).
//
// Poust se rucne, jednou za zivot appky:
//
//   node scripts/vapid-keys.mjs
//
// Vypadnou dva klice:
//   VEREJNY  - patri do worker/wrangler.toml jako VAPID_PUBLIC_KEY.
//              Verejny je doslova, vidi ho kazdy v prohlizeci.
//   SOUKROMY - NIKAM se necopy-pastuje do souboru ani do chatu.
//              Vlozi se prikazem, ktery skript vypise, a pak zavri okno.
//
// Kdyz klice jednou zmenis, vsechna uz prihlasena zarizeni prestanou
// oznameni dostavat a musi se prihlasit znovu. Delej to jen tehdy,
// kdyz soukromy klic nekomu unikne.

const par = await crypto.subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
);

const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

const verejny = b64url(await crypto.subtle.exportKey('raw', par.publicKey));
const soukromy = (await crypto.subtle.exportKey('jwk', par.privateKey)).d;

console.log('\n1) Do worker/wrangler.toml:\n');
console.log('   VAPID_PUBLIC_KEY = "' + verejny + '"\n');
console.log('2) Do secrets Workeru (spust a vloz hodnotu, az se zepta):\n');
console.log('   cd worker && npx.cmd wrangler secret put VAPID_PRIVATE_KEY\n');
console.log('   hodnota: ' + soukromy + '\n');
console.log('3) Zavri tohle okno terminalu, at soukromy klic nezustane v historii.\n');
