/**
 * BlueTTool Service Worker
 * Enables offline PWA support by caching app shell and assets.
 */
const APP_VERSION = '1.1.0';
const CACHE_NAME = `bluettool-${APP_VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
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
  './icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (event.request.mode === 'navigate') {
        return fetch(event.request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached || caches.match('./index.html'));
      }

      if (cached) {
        if (isSameOrigin) {
          event.waitUntil(
            fetch(event.request)
              .then((response) => {
                if (response && response.ok) {
                  return caches
                    .open(CACHE_NAME)
                    .then((cache) => cache.put(event.request, response));
                }
                return null;
              })
              .catch(() => null),
          );
        }
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (isSameOrigin && response && response.ok) {
            const clone = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)),
            );
          }
          return response;
        })
        .catch(() => (event.request.mode === 'navigate' ? caches.match('./index.html') : cached));
    }),
  );
});
