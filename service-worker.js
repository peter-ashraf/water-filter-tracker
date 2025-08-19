// service-worker.js
// This script runs in the background, separate from the main page.

// Update the cache name to force a new cache installation
const CACHE_NAME = 'water-filter-tracker-cache-v4';

self.addEventListener('install', event => {
    // Perform install steps and cache essential files
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Opened cache');
            return cache.addAll([
                '/',
                'index.html',
                'manifest.json',
                'https://cdn.tailwindcss.com',
                'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap'
            ]);
        })
    );
});

self.addEventListener('activate', event => {
    // Clear old caches
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => cacheName.startsWith('water-filter-tracker-cache-') && cacheName !== CACHE_NAME)
                .map(cacheName => caches.delete(cacheName))
            );
        })
    );
});

self.addEventListener('fetch', event => {
    // Check if the request is a navigation request (e.g., a user visiting the page)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            caches.match('index.html').then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request);
            })
        );
        return;
    }
    
    // For all other requests, try to serve from cache first
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request);
        })
    );
});

