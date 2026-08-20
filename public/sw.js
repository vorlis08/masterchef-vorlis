// ==========================================================================
// sw.js  --  service worker
//
// Bezi mimo stranku a hlavne i tehdy, kdyz je appka zavrena. Prave proto
// muze prijmout oznameni - bez nej by push nemel kdo zobrazit.
//
// ZAMERNE tu neni zadne cachovani. Kucharka musi ukazovat aktualni data
// (spiz, bookingy) a service worker, ktery servíruje starou verzi
// stranky, je nejrychlejsi cesta k "proc mi tam ta surovina porad je".
// ==========================================================================

const ZAKLAD = '/masterchef-vorlis/';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  // Kdyby dorazila zprava bez obsahu (nebo v ni byl nesmysl), ukazeme
  // aspon neco. Prazdne oznameni prohlizec stejne nedovoli zahodit -
  // Android by misto nej ukazal "Tato stranka byla aktualizovana".
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }

  const titul = data.titul || 'MasterChef Vorlis';
  event.waitUntil(self.registration.showNotification(titul, {
    body: data.text || 'Mrkni do kuchařky.',
    icon: ZAKLAD + 'icons/ikona-192.png',
    badge: ZAKLAD + 'icons/oznameni.png',
    tag: data.slug ? 'vareni-' + data.slug : 'vareni',
    renotify: false,
    data: { slug: data.slug || null },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const slug = event.notification.data && event.notification.data.slug;
  const cil = ZAKLAD + (slug ? '#' + slug : '');

  // Kdyz uz je appka nekde otevrena, prepneme se do ni misto otevirani
  // dalsiho okna - jinak by uzivateli po tydnu zbylo pet zalozek.
  event.waitUntil((async () => {
    const okna = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const okno of okna) {
      if (okno.url.includes(ZAKLAD) && 'focus' in okno) {
        if (slug && 'navigate' in okno) { try { await okno.navigate(cil); } catch {} }
        return okno.focus();
      }
    }
    return self.clients.openWindow(cil);
  })());
});
