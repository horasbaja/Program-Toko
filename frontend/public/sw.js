const CACHE = "horasbaja-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

const put = (req, res) => caches.open(CACHE).then((c) => c.put(req, res));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.pathname.startsWith("/api")) return;
  const isFont = /fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (url.origin !== self.location.origin && !isFont) return;
  if (isFont) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { put(req, r.clone()); return r; })));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { put("/index.html", r.clone()); return r; }).catch(() => caches.match("/index.html")));
    return;
  }
  e.respondWith(fetch(req).then((r) => { if (r.ok) put(req, r.clone()); return r; }).catch(() => caches.match(req)));
});
