// Service Worker for Logo Caching
// This file is optional and provides offline support for token logos

const CACHE_NAME = 'token-logos-v1';
const LOGO_CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Install event - nothing to do on install
self.addEventListener('install', (event) => {
  console.log('[SW] Logo cache service worker installed');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('token-logos-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  console.log('[SW] Logo cache service worker activated');
});

// Fetch event - cache logo requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only handle logo requests
  if (url.pathname.startsWith('/coin-logos/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          // Return cached response if available and fresh
          if (cachedResponse) {
            const cachedDate = new Date(cachedResponse.headers.get('date'));
            const now = new Date();
            
            // If cache is still fresh, return it
            if (now - cachedDate < LOGO_CACHE_DURATION) {
              return cachedResponse;
            }
          }
          
          // Fetch from network and cache
          return fetch(event.request)
            .then((response) => {
              // Don't cache if request failed
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone the response
              const responseToCache = response.clone();
              
              // Cache the response
              cache.put(event.request, responseToCache);
              
              return response;
            })
            .catch(() => {
              // If network fails and we have a cache (even stale), return it
              if (cachedResponse) {
                return cachedResponse;
              }
              
              // Return default logo as last resort
              return caches.match('/coin-logos/default.svg');
            });
        });
      })
    );
  }
});

