// SELBSTZERSTÖRENDER Service Worker ("kill switch").
// Bricht die alte Cache-Schleife auf: löscht alle Caches, meldet sich ab
// und lädt offene Seiten frisch neu. Danach gibt es keinen SW mehr.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});

self.addEventListener('fetch', (event) => {
  // Immer aus dem Netz laden — nie mehr aus dem Cache.
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
