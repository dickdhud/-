/* =====================================================================
   آتلیه نُوار — Service Worker (PWA)
   • فایل‌های استاتیک (صفحات، استایل، فونت، تصاویر) → اول از کش، پس‌زمینه تازه
   • API (/api/...) → همیشه از شبکه (دیتای تازه سفارش/محصول)
   ===================================================================== */
'use strict';

const CACHE = 'noir-v2';

/* فایل‌های پوسته که بلافاصله کش می‌شوند */
const SHELL = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './data.js',
  './app.js',
  './admin.js',
  './Vazirmatn.woff2',
  './Vazirmatn-Medium.woff2',
  './Vazirmatn-SemiBold.woff2',
  './Cormorant.ttf',
  './Cormorant-Italic.ttf',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;                 // POST/... فقط شبکه
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;        // منابع خارجی (درگاه پرداخت و…)
  if (url.pathname.includes('/api/')) return;             // دیتای زنده فروشگاه

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const fetcher = fetch(e.request).then(res => {
        if (res && res.ok) {
          const cp = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, cp));
        }
        return res;
      }).catch(() => hit);
      return hit || fetcher;
    })
  );
});
