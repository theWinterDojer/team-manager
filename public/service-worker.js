const CACHE_NAME = 'team-manager-v2'
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-1024.png',
  '/fonts/BricolageGrotesque.woff2',
  '/fonts/IBMPlexSans.woff2',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS)
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const url = new URL(event.request.url)
  const isSameOrigin = url.origin === self.location.origin
  const isNavigation = event.request.mode === 'navigate'
  const isAsset =
    event.request.destination === 'style' ||
    event.request.destination === 'script' ||
    event.request.destination === 'image' ||
    event.request.destination === 'font' ||
    url.pathname.startsWith('/assets/')

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseClone))
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  if (isSameOrigin && isAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseClone = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
            }
            return response
          })
          .catch(() => cached)

        if (cached) {
          event.waitUntil(fetchPromise)
          return cached
        }

        return fetchPromise
      }),
    )
  }
})
