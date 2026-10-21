// Service worker de altoke.pe.
// - Archivos propios: primero red (así ves los cambios apenas vuelves a subir la app), y si no hay internet, copia guardada.
// - Generador de QR (cdnjs): copia guardada primero.
const V = 'altoke-v10';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/util.js', 'js/store.js', 'js/zip.js', 'js/site.js', 'js/nfc.js', 'js/core.js',
  'js/views-negocio.js', 'js/views-tarjetas.js', 'js/views-cards.js', 'js/views-resenas.js', 'js/views-menu.js', 'js/main.js',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon.svg', 'logo.svg',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' = bajar siempre la copia nueva del servidor al guardar la app para uso sin internet
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // cache: 'no-cache' = revalidar siempre con el servidor, para no mezclar versiones por la caché HTTP (GitHub Pages guarda ~10 min)
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
    );
  } else if (url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)); }
            return res;
          })
      )
    );
  }
});
