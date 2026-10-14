// Offline support. Bump VERSION whenever index.html or any shell file changes,
// so phones pick up the new copy.
const VERSION = "v68";
const SHELL = "shell-" + VERSION;
const FONTS = "fonts";
const SHELL_FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "assets/acca-logo-white.png",
  "assets/acca-dragon-red.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts: serve from cache, refresh in the background
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // App pages: try the network first so updates land, but fall back to the cached
  // copy after 3 seconds or when offline, so weak signal at the dock never blocks it
  if (req.mode === "navigate") {
    const net = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put("index.html", copy)); }
      return res;
    });
    const slow = new Promise(r => setTimeout(r, 3000)).then(() => caches.match("index.html"));
    e.respondWith(
      Promise.race([net.catch(() => caches.match("index.html")), slow.then(hit => hit || net)])
    );
    return;
  }

  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
