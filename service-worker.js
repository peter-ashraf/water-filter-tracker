// service-worker.js
// This script runs in the background, separate from the main page.

// Cache static assets for offline use
const CACHE_NAME = 'water-filter-tracker-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap'
];

self.addEventListener('install', event => {
    // Perform install steps
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    // Clear old caches
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
                .map(cacheName => caches.delete(cacheName))
            );
        })
        .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // Serve from cache first, then fall back to network
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                // No cache hit - fetch from network
                return fetch(event.request).catch(() => {
                    // Offline fallback
                    return new Response('You appear to be offline.');
                });
            })
    );
});

// Logic for checking notifications and sending them
function getFilterStatus(filter) {
    const now = new Date();
    const nextReplacement = new Date(filter.lastReplaced);
    nextReplacement.setMonth(nextReplacement.getMonth() + filter.months);
    return {
        daysUntilReplacement: Math.ceil((nextReplacement - now) / (1000 * 60 * 60 * 24))
    };
}

function sendNotification(title, message, icon = '💧') {
    self.registration.showNotification(title, {
        body: message,
        icon: icon,
        badge: icon,
        vibrate: [200, 100, 200]
    });
}

// Check for overdue filters periodically.
// This is the core logic that will run in the background.
function checkAndSendNotifications() {
    // We can't access localStorage directly in the service worker, so we need to
    // get the data from the main page via a message or a cached file.
    // For this example, we will store a simple JSON file in the cache.
    // The main page will update this file.
    caches.open(CACHE_NAME).then(cache => {
        cache.match('/data/filters.json').then(response => {
            if (response) {
                response.json().then(filters => {
                    if (filters && Array.isArray(filters)) {
                        filters.forEach(filter => {
                            const status = getFilterStatus(filter);
                            // Standard advance notifications
                            if (status.daysUntilReplacement <= filter.notificationDays && status.daysUntilReplacement > 0) {
                                const message = `${filter.name} needs replacement in ${status.daysUntilReplacement} day(s)`;
                                sendNotification('Water Filter Reminder', message);
                            }
                            // Overdue notifications
                            if (status.daysUntilReplacement <= 0) {
                                const message = `${filter.name} is ${Math.abs(status.daysUntilReplacement)} day(s) overdue for replacement!`;
                                sendNotification('Water Filter URGENT', message, '🚨');
                            }
                        });
                    }
                });
            }
        });
    });
}

// Handle messages from the main page (index.html)
self.addEventListener('message', event => {
    if (event.data && event.data.action === 'start-periodic-check') {
        // This is a simplified periodic check. In a production app,
        // we'd use Periodic Sync or background fetch.
        // For this example, setInterval is a good demonstration.
        // It may not be reliable on all platforms due to battery saving.
        // We will call it once and then hope the browser's background sync takes over.
        checkAndSendNotifications();
    }
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    // This will open the app when the user clicks the notification
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === self.location.origin + '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(self.location.origin + '/');
            }
        })
    );
});
