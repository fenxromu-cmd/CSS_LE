// ============================================================
// sw.js — Service Worker avec mise à jour automatique
// Le numéro de version DOIT correspondre à APP_VERSION dans index.html
// bump_version.py met à jour les deux fichiers simultanément
// ============================================================

const VERSION  = '7.0.0';          // ← synchronisé avec APP_VERSION
const CACHE    = `lia-v${VERSION}`;
const ASSETS   = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── Installation ─────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())   // activer immédiatement sans attendre
  );
});

// ── Activation : supprimer les anciens caches ────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE)     // tous les caches sauf le nouveau
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // prendre le contrôle immédiatement
      .then(() => {
        // Notifier tous les onglets ouverts qu'une mise à jour est active
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client =>
            client.postMessage({ type: 'SW_UPDATED', version: VERSION })
          );
        });
      })
  );
});

// ── Fetch : réseau en priorité pour index.html ───────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase → toujours réseau direct
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

  // index.html → réseau EN PRIORITÉ (pour toujours avoir la dernière version)
  // Si hors ligne : fallback vers le cache
  if (e.request.mode === 'navigate' ||
      url.pathname.endsWith('index.html') ||
      url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          // Mettre à jour le cache avec la version réseau
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Autres ressources (icônes, manifest) → cache en priorité
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
