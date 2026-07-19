self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Passthrough: no cacheamos nada todavía (todo el contenido depende de datos
// en vivo del usuario), pero un service worker registrado es requisito para
// que Chrome/Android considere la app instalable como PWA.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
