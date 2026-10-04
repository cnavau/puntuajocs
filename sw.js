// Service worker: deixa l'aplicació funcionar sense connexió.
// Si canvies algun fitxer de l'app, augmenta el número de VERSIO perquè els telèfons s'actualitzin.
const VERSIO = 'puntuajocs-v3';
const FITXERS = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIO).then(c => c.addAll(FITXERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSIO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primer la memòria cau (ràpid i offline); en segon pla s'actualitza des de la xarxa.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const xarxa = fetch(e.request).then(r => {
        if (r && r.ok && new URL(e.request.url).origin === location.origin) {
          const copia = r.clone();
          caches.open(VERSIO).then(c => c.put(e.request, copia));
        }
        return r;
      }).catch(() => cached);
      return cached || xarxa;
    })
  );
});
