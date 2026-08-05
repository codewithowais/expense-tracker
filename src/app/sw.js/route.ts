export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cache schema version. Bump ONLY when this worker's caching logic changes —
 * NOT per deploy. Freshness across releases comes from the network-first
 * strategy below (when online we always pull from the server and refresh the
 * cache), so there's no need to invalidate caches on every deploy.
 */
const SCHEMA = "1";

const SERVICE_WORKER = `/*
 * Ledgerly service worker (schema ${SCHEMA}).
 *
 *  - When ONLINE: everything (pages, data payloads, icons, manifest) is fetched
 *    from the server and written back into the cache — you always get the latest.
 *  - When OFFLINE: requests fall back to the cache, so the app still opens and runs.
 *  - Immutable build assets (/_next/static/*, incl. fonts) are cache-first: their
 *    filenames change when they change, so re-downloading them online would be a
 *    redundant call — we serve them straight from cache and only fetch new ones.
 *  - /api/* (lock, sync) is never intercepted; it always hits the network.
 */
const SCHEMA = "${SCHEMA}";
const STATIC_CACHE = "ledgerly-static-" + SCHEMA;
const RUNTIME_CACHE = "ledgerly-runtime-" + SCHEMA;

const APP_SHELL = [
  "/",
  "/transactions",
  "/income",
  "/expenses",
  "/categories",
  "/budgets",
  "/analytics",
  "/reports",
  "/people",
  "/savings",
  "/settings",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.addAll(APP_SHELL);
      } catch (err) {
        // Best-effort: a missing route must not block installation.
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC_CACHE, RUNTIME_CACHE];
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.indexOf("ledgerly-") === 0 && keep.indexOf(k) === -1)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Immutable, content-hashed build output — safe and efficient to serve from cache.
function isImmutable(url) {
  return url.pathname.indexOf("/_next/static/") === 0;
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

// Everything else: pull fresh when online, refresh the cache, fall back when offline.
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok && req.method === "GET") {
      const copy = res.clone();
      caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === "navigate" || req.destination === "document") {
      const root = await caches.match("/");
      if (root) return root;
    }
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Offline</title><body style='font-family:system-ui;padding:2rem'>You are offline and this page is not cached yet. Reconnect once, then it will work offline.</body>",
      { headers: { "content-type": "text/html; charset=utf-8" }, status: 503 },
    );
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin alone
  if (url.pathname.indexOf("/api/") === 0) return; // never cache lock/sync

  event.respondWith(isImmutable(url) ? cacheFirst(req) : networkFirst(req));
});
`;

export function GET() {
  return new Response(SERVICE_WORKER, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      // Always revalidate the worker itself so logic changes are picked up.
      "cache-control": "no-cache, no-store, must-revalidate",
      "service-worker-allowed": "/",
    },
  });
}
