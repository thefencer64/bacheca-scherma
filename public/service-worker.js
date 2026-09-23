/* eslint-disable */
/* service-worker.js — Bacheca Scherma PWA */

const CACHE_NAME = 'bacheca-scherma-v2';

// Workbox manifest placeholder (richiesto da CRA/InjectManifest)
// eslint-disable-next-line no-undef
const WB_MANIFEST = self.__WB_MANIFEST || [];

// Assets statici da cachare
const ASSETS_STATICI = [
  '/',
  '/index.html',
  '/manifest.json',
  ...WB_MANIFEST.map(e => e.url || e),
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_STATICI).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate — rimuove cache vecchie
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomi) =>
      Promise.all(
        nomi.filter(nome => nome !== CACHE_NAME).map(nome => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

// Fetch — strategia conservativa
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignora tutto tranne GET
  if (event.request.method !== 'GET') return;

  // Ignora richieste Firebase, API esterne, chrome-extension
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('google') ||
      url.hostname.includes('googleapis') ||
      url.protocol === 'chrome-extension:') return;

  // Per le navigazioni (pagine HTML) — network first, fallback index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Per assets statici (JS, CSS, immagini) — cache first
  if (url.pathname.startsWith('/static/') ||
      url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const copia = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copia));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Tutto il resto — network only, nessuna cache
});

// Push notification ricevuta
// I messaggi arrivano come data-only (campo webpush.data) per garantire
// che il push event venga sempre invocato su tutte le piattaforme (incluso Android).
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let dati;
  try { dati = event.data.json(); }
  catch { dati = {}; }

  // Legge da webpush.data (invio data-only) o da notification (fallback)
  const title = dati.title || dati.notification?.title || 'Bacheca Scherma';
  const body  = dati.body  || dati.notification?.body  || '';
  const url   = dati.url   || dati.notification?.data?.url || dati.data?.url || '/scegli-societa';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-72.png',
      vibrate: [200, 100, 200],
      data:    { url },
    })
  );
});

// Click su notifica
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/scegli-societa';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.endsWith(url) && 'focus' in client) { client.focus(); return; }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
