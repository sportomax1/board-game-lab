self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open('boardgames-pwa').then(function(cache) {
      return cache.addAll([
        'index.html',
        'manifest.json',
        // Add other pages as you build them
      ]);
    })
  );
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(response) {
      return response || fetch(e.request);
    })
  );
});
