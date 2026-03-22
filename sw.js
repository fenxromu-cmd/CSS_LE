const CACHE = 'monjournal-v1';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Installation — mise en cache des ressources
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(ASSETS.filter(a => !a.includes('.png')));
    }).then(() => self.skipWaiting())
  );
});

// Activation — nettoyage des anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Interception des requêtes
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Laisser passer les requêtes Supabase (toujours en ligne)
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() => {
        return new Response(JSON.stringify({error: 'offline'}), {
          headers: {'Content-Type': 'application/json'}
        });
      })
    );
    return;
  }

  // Pour les autres ressources : cache en priorité, réseau en fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Hors ligne et pas en cache : retourner la page principale
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
