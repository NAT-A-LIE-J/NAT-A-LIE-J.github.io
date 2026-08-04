const CACHE_NAME = 'swipebox-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/main.js',
  './js/auth.js',
  './js/gmail-api.js',
  './js/store.js',
  './js/card-stack.js',
  './js/config.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Only serve the cached app shell itself; every Gmail API call and any
// other request always goes to the network untouched.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
