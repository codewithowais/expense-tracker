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

// Precache the shell pages AND the JS/CSS/font assets they reference, so a
// SINGLE online visit is enough to run fully offline afterwards. (The worker
// can't cache assets from the very first page load — it takes control only
// after that load's requests were already made — so we fetch them here.)
async function precacheShell() {
  const pageCache = await caches.open(RUNTIME_CACHE);
  const staticCache = await caches.open(STATIC_CACHE);
  const assetUrls = new Set();
  const assetRe = /\\/_next\\/static\\/[^"'()\\s]+?\\.(?:js|css|woff2?)/g;

  await Promise.all(
    APP_SHELL.map(async (route) => {
      try {
        const res = await fetch(route, { cache: "no-cache" });
        if (!res || !res.ok) return;
        await pageCache.put(route, res.clone());
        const html = await res.text();
        let m;
        while ((m = assetRe.exec(html)) !== null) assetUrls.add(m[0]);
      } catch (err) {
        // A missing route must not block installation.
      }
    }),
  );

  await Promise.all(
    Array.from(assetUrls).map(async (url) => {
      try {
        const res = await fetch(url);
        if (res && res.ok) await staticCache.put(url, res.clone());
      } catch (err) {
        // Best-effort per asset.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
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

// A branded, auto-reconnecting loader shown only when a navigation fails AND
// nothing (not even "/") is cached yet — instead of the browser's error page.
const OFFLINE_HTML =
  "<!doctype html><html lang='en'><head><meta charset='utf-8'>" +
  "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
  "<title>Reconnecting - Ledgerly</title><style>" +
  "*{box-sizing:border-box}html,body{height:100%;margin:0}" +
  "body{display:flex;align-items:center;justify-content:center;background:#12211a;color:#e8efe9;" +
  "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
  ".card{text-align:center;padding:2rem}" +
  ".spin{width:38px;height:38px;margin:0 auto 1.25rem;border:3px solid rgba(255,255,255,.16);" +
  "border-top-color:#8fd3a8;border-radius:50%;animation:s .9s linear infinite}" +
  "@keyframes s{to{transform:rotate(360deg)}}" +
  "h1{font-size:1.05rem;font-weight:600;margin:0 0 .4rem}" +
  "p{margin:0;font-size:.85rem;color:#9fb3a6;max-width:22rem}</style></head>" +
  "<body><div class='card'><div class='spin'></div><h1>Reconnecting...</h1>" +
  "<p>You appear to be offline. Ledgerly will open automatically as soon as the connection is back.</p></div>" +
  "<script>function r(){location.reload()}addEventListener('online',r);" +
  "setInterval(function(){if(navigator.onLine)r()},3000)</script></body></html>";

// Fetch that rejects if the network hangs, so a stalled request falls back to
// cache quickly instead of leaving the page spinning.
function fetchWithTimeout(req, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(req, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// Everything else: pull fresh when online, refresh the cache, fall back when offline.
async function networkFirst(req) {
  const isNavigation = req.mode === "navigate" || req.destination === "document";
  try {
    const res = await fetchWithTimeout(req, 10000);
    if (res && res.ok && req.method === "GET") {
      const copy = res.clone();
      caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (isNavigation) {
      const root = await caches.match("/");
      if (root) return root;
      return new Response(OFFLINE_HTML, {
        headers: { "content-type": "text/html; charset=utf-8" },
        status: 503,
      });
    }
    throw err;
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
