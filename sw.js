const CACHE_NAME = "medbio-v14-20260727";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=14",
  "./app.js?v=14",
  "./manifest.webmanifest",
  "./icon-192.svg",
  "./icon-512.svg",
  "./data/modules.json?v=14",
  "./data/lessons.json?v=14",
  "./data/flashcards.json?v=14",
  "./data/tests.json?v=14"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const freshFirst =
    url.pathname.includes("/data/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/styles.css") ||
    url.pathname.endsWith("/medbio-trainer/");

  if (freshFirst) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
