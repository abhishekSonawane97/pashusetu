/* PashuSetu service worker — NFR-11.
 * - Precache the app shell (offline page + core routes) on install.
 * - Navigations: network-first, falling back to cache, then the branded
 *   /offline page (never the browser's default error).
 * - Listing images (R2 CDN): stale-while-revalidate with a 50-entry LRU.
 * - Writes are never cached; the app disables mutations offline (no queue in MVP).
 */
const VERSION = 'v1'
const SHELL_CACHE = `pashusetu-shell-${VERSION}`
const IMAGE_CACHE = `pashusetu-img-${VERSION}`
const IMAGE_LRU_MAX = 50
const SHELL_ASSETS = ['/', '/listings', '/offline']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL_CACHE && k !== IMAGE_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isImage(url) {
  return url.hostname.startsWith('img.') || url.hostname.startsWith('img-dev.')
}

async function trimLru(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > max) await cache.delete(keys[0])
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // never touch writes

  const url = new URL(request.url)

  // Never cache API responses (freshness matters; listings/interest are live).
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy))
          return res
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match('/offline'))),
    )
    return
  }

  if (isImage(url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((res) => {
            cache.put(request, res.clone())
            trimLru(IMAGE_CACHE, IMAGE_LRU_MAX)
            return res
          })
          .catch(() => cached)
        return cached ?? network
      }),
    )
  }
})
