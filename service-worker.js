// service-worker.js
// This script runs in the background, separate from the main page.

// Update the cache name to force a new cache installation
const CACHE_NAME = 'water-filter-tracker-cache-v2';
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
    // Intercept fetch requests
    const url = new URL(event.request.url);

    // Always go to the network for the main page to avoid caching issues
    if (url.pathname === '/index.html' || url.pathname === '/') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // For all other requests, serve from cache first, then fall back to network
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

// A function to check and send notifications based on the filter data
function checkAndSendNotifications() {
    // Fetch the filter data from the cache (or network if updated)
    caches.open(CACHE_NAME).then(cache => {
        cache.match('/data/filters.json').then(response => {
            if (response) {
                response.json().then(filters => {
                    const now = new Date();
                    filters.forEach(filter => {
                        const lastReplaced = new Date(filter.lastReplaced);
                        const nextReplacement = new Date(lastReplaced);
                        nextReplacement.setMonth(nextReplacement.getMonth() + filter.months);
                        const daysUntilReplacement = Math.ceil((nextReplacement - now) / (1000 * 60 * 60 * 24));

                        // Standard notifications for when a filter is due soon
                        if (daysUntilReplacement <= filter.notificationDays && daysUntilReplacement > 0) {
                            const message = `${filter.name} needs replacement in ${daysUntilReplacement} day(s)`;
                            sendNotification('Water Filter Reminder', message);
                        }

                        // Overdue notifications
                        if (daysUntilReplacement <= 0) {
                            const message = `${filter.name} is ${Math.abs(daysUntilReplacement)} day(s) overdue for replacement!`;
                            sendNotification('Water Filter URGENT', message, '🚨');
                        }

                        // Advanced notifications (day before, replacement day)
                        if (filter.dayBeforeNotifications && daysUntilReplacement === 1) {
                            const hoursUntil = Math.floor((nextReplacement - now) / (1000 * 60 * 60));
                            if (hoursUntil % filter.dayBeforeInterval === 0) {
                                sendNotification('Water Filter Reminder', `${filter.name} needs replacement tomorrow!`);
                            }
                        }

                        if (filter.replacementDayNotifications && daysUntilReplacement === 0) {
                            const hoursOverdue = Math.floor((now - nextReplacement) / (1000 * 60 * 60));
                            if (hoursOverdue % filter.replacementDayInterval === 0) {
                                sendNotification('Water Filter Reminder', `${filter.name} is due for replacement today!`);
                            }
                        }
                    });
                });
            }
        });
    });
}

// A simple helper function to send a notification
function sendNotification(title, body, icon = '💧') {
    if ('Notification' in self && Notification.permission === 'granted') {
        const options = {
            body: body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-512x512.png',
        };
        self.registration.showNotification(title, options);
    }
}

// Handle messages from the main page (index.html)
self.addEventListener('message', event => {
    if (event.data && event.data.action === 'start-periodic-check') {
        // This is a simplified periodic check. In a production app,
        // we'd use Periodic Sync or background fetch.
        // For this example, we'll call it once. The browser's OS
        // will handle background tasks if the app is used regularly.
        checkAndSendNotifications();
    }
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
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
