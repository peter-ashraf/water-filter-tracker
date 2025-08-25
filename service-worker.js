
const CACHE_VERSION = "v2";
const CACHE_NAME = "filter-tracker-" + CACHE_VERSION;

// derive base path (works on GitHub Pages subpaths)
const BASE = self.registration.scope;
const ASSETS = [
  BASE,
  BASE + "index.html",
  BASE + "manifest.json",
  BASE + "service-worker.js",
  BASE + "icons/icon-192.png",
  BASE + "icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))\n    .then(() => self.clients.claim())\n  );\n});\n\nself.addEventListener(\"fetch\", (event) => {\n  const { request } = event;\n  // Network-first for navigation/HTML\n  if (request.mode === \"navigate\" || request.headers.get(\"accept\")?.includes(\"text/html\")) {\n    event.respondWith(\n      fetch(request)\n        .then((resp) => {\n          const copy = resp.clone();\n          caches.open(CACHE_NAME).then((c) => c.put(request, copy));\n          return resp;\n        })\n        .catch(() => caches.match(request).then(r => r || caches.match(BASE + \"index.html\")))\n    );\n    return;\n  }\n  // Cache-first for everything else\n  event.respondWith(\n    caches.match(request).then((cached) => {\n      if (cached) return cached;\n      return fetch(request).then((resp) => {\n        const copy = resp.clone();\n        caches.open(CACHE_NAME).then((c) => c.put(request, copy));\n        return resp;\n      });\n    })\n  );\n});\n\n// Optional: basic push handler (no subscription code here)\nself.addEventListener(\"push\", (event) => {\n  const data = event.data?.json?.() || { title: \"Water Filter Tracker\", body: \"You have a filter reminder.\" };\n  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: BASE + \"icons/icon-192.png\" }));\n});\n\nself.addEventListener(\"notificationclick\", (event) => {\n  event.notification.close();\n  event.waitUntil(\n    clients.matchAll({ type: \"window\", includeUncontrolled: true }).then(list => {\n      const url = BASE;\n      for (const c of list) { if (c.url.startsWith(url)) { c.focus(); return; } }\n      clients.openWindow(url);\n    })\n  );\n});\n


// PATCH: Push event listener for notifications
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Reminder', {
      body: data.body || 'Time to check your filter!',
      icon: BASE + 'icons/icon-192.png'
    })
  );
});
