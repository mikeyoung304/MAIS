/**
 * HANDLED Service Worker
 *
 * Security-aware caching with proper route handling:
 * - NEVER cache auth, agent, or chat endpoints
 * - Network-first for all API routes
 * - Stale-while-revalidate for pages and static assets
 * - Offline fallback page
 * - Background sync for pending bookings
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `handled-static-${CACHE_VERSION}`;
const PAGES_CACHE = `handled-pages-${CACHE_VERSION}`;

// URLs to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Routes that should NEVER be cached (security-critical)
const NEVER_CACHE_PATTERNS = [
  /\/api\/auth\//,              // Auth endpoints
  /\/api\/v1\/agent\//,         // Agent/AI endpoints
  /\/api\/v1\/public\/chat\//,  // Public chat endpoints
  /\/api\/.*\/webhooks/,        // Webhook endpoints
  /_next\/webpack-hmr/,         // HMR in development
];

// API routes (network-first)
const API_PATTERN = /\/api\//;

// Static assets (cache-first)
const STATIC_PATTERN = /\.(js|css|woff2?|ttf|otf|eot|ico|png|jpg|jpeg|gif|svg|webp)$/;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a request should never be cached.
 */
function shouldNeverCache(url) {
  return NEVER_CACHE_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Check if a request is an API call.
 */
function isAPIRequest(url) {
  return API_PATTERN.test(url);
}

/**
 * Check if a request is for a static asset.
 */
function isStaticAsset(url) {
  return STATIC_PATTERN.test(url);
}

/**
 * Log messages in development only.
 */
function log(message, ...args) {
  // Uncomment for debugging:
  // console.log(`[SW] ${message}`, ...args);
}

// ============================================================================
// Install Event
// ============================================================================

self.addEventListener('install', (event) => {
  log('Installing service worker');

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        // Cache precache URLs, ignoring failures for individual URLs
        await Promise.allSettled(
          PRECACHE_URLS.map(async (url) => {
            try {
              await cache.add(url);
              log('Precached:', url);
            } catch (error) {
              log('Failed to precache:', url, error);
            }
          })
        );
      } catch (error) {
        log('Install failed:', error);
      }

      // Skip waiting to activate immediately
      await self.skipWaiting();
    })()
  );
});

// ============================================================================
// Activate Event
// ============================================================================

self.addEventListener('activate', (event) => {
  log('Activating service worker');

  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      const validCaches = [STATIC_CACHE, PAGES_CACHE];

      await Promise.all(
        cacheNames
          .filter((name) => !validCaches.includes(name))
          .map(async (name) => {
            log('Deleting old cache:', name);
            await caches.delete(name);
          })
      );

      // Take control of all clients immediately
      await self.clients.claim();

      log('Service worker activated');
    })()
  );
});

// ============================================================================
// Fetch Event
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip requests that should never be cached
  if (shouldNeverCache(url)) {
    log('Never cache (security):', url);
    return;
  }

  // Handle different request types
  if (isAPIRequest(url)) {
    event.respondWith(networkFirst(request));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else {
    event.respondWith(staleWhileRevalidate(request, PAGES_CACHE));
  }
});

// ============================================================================
// Caching Strategies
// ============================================================================

/**
 * Network-first strategy.
 * Try network, fall back to cache.
 * Used for API routes.
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    log('Network response:', request.url);
    return networkResponse;
  } catch (error) {
    log('Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    throw error;
  }
}

/**
 * Cache-first strategy.
 * Try cache, fall back to network and update cache.
 * Used for static assets.
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    log('Cache hit:', request.url);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    // Only cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      log('Cached new resource:', request.url);
    }

    return networkResponse;
  } catch (error) {
    log('Cache and network failed:', request.url);
    throw error;
  }
}

/**
 * Stale-while-revalidate strategy.
 * Return cache immediately, update in background.
 * Used for pages.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Fetch in background
  const fetchPromise = (async () => {
    try {
      const networkResponse = await fetch(request);

      if (networkResponse.ok) {
        await cache.put(request, networkResponse.clone());
        log('Updated cache:', request.url);
      }

      return networkResponse;
    } catch (error) {
      log('Background fetch failed:', request.url);
      return null;
    }
  })();

  // Return cached response immediately if available
  if (cachedResponse) {
    log('Serving stale:', request.url);
    return cachedResponse;
  }

  // Wait for network if no cache
  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }

  // Fallback to offline page for navigation
  if (request.mode === 'navigate') {
    return cache.match('/offline.html');
  }

  throw new Error('Network and cache both unavailable');
}

// ============================================================================
// Background Sync
// ============================================================================

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-bookings') {
    log('Background sync: pending bookings');
    event.waitUntil(syncPendingBookings());
  }
});

/**
 * Sync pending bookings from IndexedDB.
 */
async function syncPendingBookings() {
  try {
    // Open IndexedDB
    const db = await openDB();
    const transaction = db.transaction('pending-bookings', 'readwrite');
    const store = transaction.objectStore('pending-bookings');

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = async () => {
        const bookings = request.result;
        log('Found pending bookings:', bookings.length);

        for (const booking of bookings) {
          try {
            // Attempt to sync booking
            const response = await fetch('/api/v1/bookings', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Key': booking.tenantKey,
              },
              body: JSON.stringify({
                packageId: booking.packageId,
                date: booking.date,
                customerName: booking.customerName,
                customerEmail: booking.customerEmail,
                customerPhone: booking.customerPhone,
                notes: booking.notes,
              }),
            });

            if (response.ok) {
              // Remove from pending
              store.delete(booking.id);
              log('Synced booking:', booking.id);

              // Notify client
              const clients = await self.clients.matchAll();
              clients.forEach((client) => {
                client.postMessage({
                  type: 'BOOKING_SYNCED',
                  bookingId: booking.id,
                });
              });
            } else {
              // Update sync attempts
              booking.syncAttempts = (booking.syncAttempts || 0) + 1;
              booking.lastSyncAttempt = Date.now();
              store.put(booking);
              log('Sync failed, will retry:', booking.id);
            }
          } catch (error) {
            log('Error syncing booking:', booking.id, error);
          }
        }

        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    log('Background sync failed:', error);
    throw error;
  }
}

/**
 * Open IndexedDB.
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('handled-offline', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// Message Handling
// ============================================================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(clearAllCaches());
      break;

    case 'CACHE_URLS':
      if (payload?.urls) {
        event.waitUntil(cacheUrls(payload.urls));
      }
      break;

    default:
      log('Unknown message type:', type);
  }
});

/**
 * Clear all caches.
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  log('All caches cleared');
}

/**
 * Check if a URL is same-origin (security validation).
 * Prevents caching arbitrary external URLs.
 */
function isSameOrigin(url) {
  try {
    const parsed = new URL(url, self.location.origin);
    return parsed.origin === self.location.origin;
  } catch {
    return false;
  }
}

/**
 * Cache specific URLs.
 * Only caches same-origin URLs for security.
 */
async function cacheUrls(urls) {
  // Filter to only same-origin URLs (security: prevent caching arbitrary external URLs)
  const safeUrls = urls.filter((url) => {
    const safe = isSameOrigin(url);
    if (!safe) {
      log('Rejected non-same-origin URL:', url);
    }
    return safe;
  });

  if (safeUrls.length === 0) {
    log('No valid same-origin URLs to cache');
    return;
  }

  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(safeUrls);
  log('Cached URLs:', safeUrls.length);
}

// ============================================================================
// Push Notifications (future)
// ============================================================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag || 'handled-notification',
      data: data.data,
      actions: data.actions,
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  } catch (error) {
    log('Push notification failed:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window' });

      // Try to focus an existing window
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }

      // Open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })()
  );
});
