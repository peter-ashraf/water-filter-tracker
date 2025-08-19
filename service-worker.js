// service-worker.js
// This script runs in the background, separate from the main page.

// Cache static assets for offline use
const CACHE_NAME = 'water-filter-tracker-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap',
    '/manifest.json',
    // We will dynamically cache the filter data later
    '/data/filters.json' 
];

self.addEventListener('install', event => {
    // Perform install steps
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache and added base URLs');
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
                    // This is a fallback for offline use, you can serve a simple offline page here
                    return new Response('You appear to be offline.');
                });
            })
    );
});

function sendNotification(title, message, emoji = '💧') {
    self.registration.showNotification(title, {
        body: message,
        icon: 'icons/icon-192x192.png',
        badge: 'icons/icon-512x512.png',
        tag: 'filter-reminder',
        renotify: true
    });
}

function getFilterStatus(filter, now) {
    const nextReplacement = new Date(filter.lastReplaced);
    nextReplacement.setMonth(nextReplacement.getMonth() + filter.months);
    const daysUntilReplacement = Math.ceil((nextReplacement - now) / (1000 * 60 * 60 * 24));
    return { daysUntilReplacement, nextReplacement };
}

function checkAndSendNotifications() {
    const now = new Date();
    // Use caches.match to get the latest filters.json from the cache
    caches.open(CACHE_NAME).then(cache => {
        return cache.match('/data/filters.json');
    }).then(response => {
        if (response) {
            return response.json();
        }
        return Promise.resolve([]); // Return an empty array if not found
    }).then(filters => {
        if (filters.length > 0) {
            filters.forEach(filter => {
                const status = getFilterStatus(filter, now);
                
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
                
                // Check advanced notifications
                const hoursUntilReplacement = Math.ceil((status.nextReplacement - now) / (1000 * 60 * 60));
                
                // Day before notifications
                if (filter.dayBeforeNotifications && hoursUntilReplacement <= 24 && hoursUntilReplacement > 0) {
                    if (hoursUntilReplacement % filter.dayBeforeInterval === 0) {
                        sendNotification('Water Filter Reminder', `${filter.name} is due tomorrow!`);
                    }
                }
                
                // Replacement day notifications
                if (filter.replacementDayNotifications && status.daysUntilReplacement <= 0 && status.daysUntilReplacement > -1) {
                    if (hoursUntilReplacement % filter.replacementDayInterval === 0) {
                        sendNotification('Water Filter URGENT', `${filter.name} is due today!`, '🚨');
                    }
                }
            });
        }
    }).catch(error => {
        console.error('Failed to get filter data from cache:', error);
    });
}

// Handle messages from the main page (index.html)
self.addEventListener('message', event => {
    if (event.data && event.data.action === 'start-periodic-check') {
        // We will call it once and then rely on the browser's background sync.
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
