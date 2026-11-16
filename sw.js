/* PCA Lab 0.3.0 — cache do shell e cache em runtime das bibliotecas externas usadas pelo leitor PDF/OCR. */
const CACHE_NAME = 'pca-lab-shell-v7';
const EXTERNAL_CACHE = 'pca-lab-external-v1';
const APP_SHELL = [
  './', './index.html', './styles.css', './plano.css', './app.js', './plano.js',
  './dashboard.js', './xlsx-export.js', './catalogo-itens.js', './manifest.webmanifest',
  './assets/pca-icon.svg', './assets/pca-icon-192.png', './assets/pca-icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('pca-lab-shell-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch (error) {
        if (request.mode === 'navigate') return cache.match('./index.html');
        throw error;
      }
    })());
    return;
  }

  // Cache em runtime de CDNs para permitir que PDF.js/Tesseract permaneçam disponíveis
  // após a primeira carga online. O suporte depende dos cabeçalhos CORS do provedor.
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'tessdata.projectnaptha.com') {
    event.respondWith((async () => {
      const cache = await caches.open(EXTERNAL_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response && (response.ok || response.type === 'opaque')) {
        try { await cache.put(request, response.clone()); } catch (_) { /* cache externo é uma otimização */ }
      }
      return response;
    })());
  }
});
