const CACHE_NAME = "medbio-v16-20260728";
const ASSETS = [
  "./",
  "./index.html?v=16",
  "./styles.css?v=16",
  "./app.js?v=16",
  "./manifest.webmanifest",
  "./icon-192.svg",
  "./icon-512.svg",
  "./data/modules.json?v=16",
  "./data/lessons.json?v=16",
  "./data/flashcards.json?v=16",
  "./data/tests.json?v=16"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const fresh = url.pathname.includes("/data/") ||
                url.pathname.endsWith("/index.html") ||
                url.pathname.endsWith("/app.js") ||
                url.pathname.endsWith("/styles.css") ||
                url.pathname.endsWith("/medbio-trainer/");

  event.respondWith(
    fresh
      ? fetch(event.request, { cache: "no-store" })
          .then(response => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
            return response;
          })
          .catch(() => caches.match(event.request))
      : caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
