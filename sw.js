/**
 * BlueTTool Service Worker
 * Enables offline PWA support by caching app shell and assets.
 */
const CACHE_NAME = 'bluettool-v6';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/logger.js',
  './js/delight.js',
  './js/browser-compat.js',
  './js/call-history.js',
  './js/macros.js',
  './js/bluetooth-scanner.js',
  './js/serial-bluetooth.js',
  './js/announcements.js',
  './js/audio-player.js',
  './js/vulnerability.js',
  './js/advanced.js',
  './js/sharing.js',
  './js/voice-commands.js',
  './js/app.js',
  './audio/dtmf-fax-tones.wav',
  './manifest.json',
  './icons/icon-180.svg',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      // Network-first for HTML, cache-first for everything else
      if (event.request.mode === 'navigate') {
        return fetch(event.request)
          .then(response => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            return response;
          })
          .catch(() => cached);
      }
      return cached || fetch(event.request);
    })
  );
});
