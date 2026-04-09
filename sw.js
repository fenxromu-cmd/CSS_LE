// ============================================================
// sw.js — Service Worker LIA
// VERSION = timestamp du dernier build (change à chaque déploiement)
// ============================================================

const VERSION  = '202604091157';
const CACHE    = `lia-${VERSION}`;
const ASSETS   = [
  './index.html',
  './app.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── Installation : mise en cache des ressources ──────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activation : purger tous les anciens caches ──────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE)
          .map(k => {
            console.log('[SW] Suppression ancien cache :', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Notifier tous les onglets : nouvelle version active
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client =>
            client.postMessage({ type: 'SW_UPDATED', version: VERSION })
          );
        });
      })
  );
});

// ── Message depuis la page ────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (e.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => {
      e.source?.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase → réseau direct, jamais en cache
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // index.html et app.html → réseau en priorité (toujours la dernière version)
  if (e.request.mode === 'navigate' ||
      url.pathname.endsWith('index.html') ||
      url.pathname.endsWith('app.html') ||
      url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Autres ressources → cache en priorité, réseau en fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => null);
    })
  );
});
