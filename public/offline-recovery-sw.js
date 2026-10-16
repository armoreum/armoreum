// Build tooling replaces this marker so a new bundle also updates the worker.
// __OFFLINE_RECOVERY_BUILD_ID__
const CACHE_NAME = "armoreum-offline-recovery-v5";
const CACHE_VERSION = 5;
const MANIFEST_FILE = "offline-recovery-manifest.json";
const READY_FILE = "offline-recovery-ready.json";
const SHELL_FILE = "offline-recovery-shell.html";

function isInsideScope(url, scope) {
  return url.origin === scope.origin && url.href.startsWith(scope.href);
}

function isStaticRequest(request, url, scope) {
  if (!isInsideScope(url, scope)) return false;
  if (url.pathname.includes("/api/") || url.pathname.includes("/ws")) return false;
  if (request.destination === "script" || request.destination === "style" || request.destination === "image" || request.destination === "font") return true;
  return /\.(?:m?js|css|svg|png|webp|woff2?)$/i.test(url.pathname)
    || url.pathname.includes("/src/")
    || url.pathname.includes("/node_modules/")
    || url.pathname.includes("/@id/")
    || url.pathname.includes("/@fs/");
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const scope = new URL(self.registration.scope);
    const manifestUrl = new URL(MANIFEST_FILE, scope);

    const response = await fetch(manifestUrl, { credentials: "same-origin", cache: "no-store" });
    if (response.ok) {
      const manifest = await response.clone().json();
      if (manifest?.version !== CACHE_VERSION || !Array.isArray(manifest.assets) || manifest.assets.length === 0 || manifest.assets.length > 500) {
        throw new Error("Offline asset manifest is invalid.");
      }

      const assets = [...new Set(manifest.assets)];
      for (const asset of assets) {
        if (typeof asset !== "string" || asset.length > 512) throw new Error("Offline asset path is invalid.");
        const assetUrl = new URL(asset, scope);
        if (!isInsideScope(assetUrl, scope)) throw new Error("Offline asset is outside the application scope.");
        const assetResponse = await fetch(assetUrl, { credentials: "same-origin", cache: "reload" });
        if (!assetResponse.ok || assetResponse.type === "opaque") throw new Error("Offline asset could not be cached.");
        await cache.put(assetUrl, assetResponse.clone());
      }

      await cache.put(manifestUrl, response.clone());
      await cache.put(new URL(READY_FILE, scope), new Response(JSON.stringify({
        version: CACHE_VERSION,
        assets,
      }), { headers: { "content-type": "application/json" } }));
    } else if (response.status !== 404) {
      throw new Error("Offline asset manifest could not be read.");
    }

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const replacingPreviousVersion = names.some((name) => name.startsWith("armoreum-offline-recovery-v") && name !== CACHE_NAME);
    await Promise.all(names
      .filter((name) => name.startsWith("armoreum-offline-recovery-v") && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
    // An already-open recovery page can still be running the previous helper.
    // Reload that route once after an online worker upgrade, not other app pages.
    if (replacingPreviousVersion && self.navigator.onLine !== false) {
      const recoveryPath = new URL("offline-recovery", self.registration.scope).pathname.replace(/\/+$/, "");
      const windows = await self.clients.matchAll({ type: "window" });
      for (const client of windows) {
        if (new URL(client.url).pathname.replace(/\/+$/, "") === recoveryPath) {
          // Finish activation before waiting for the new navigation's fetch.
          void client.navigate(client.url).catch(() => null);
        }
      }
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  const recoveryPath = new URL("offline-recovery", scope).pathname;

  if (request.mode === "navigate" && url.origin === scope.origin && url.pathname.replace(/\/+$/, "") === recoveryPath.replace(/\/+$/, "")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      // An online visit must be able to recover from an outdated cached shell.
      // Offline visits remain cache-only and never need the app/API.
      if (self.navigator.onLine !== false) {
        try {
          const fresh = await fetch(new URL(SHELL_FILE, scope), { cache: "no-store", credentials: "same-origin" });
          if (fresh.ok && fresh.headers.get("content-type")?.includes("text/html")) {
            await cache.put(new URL(SHELL_FILE, scope), fresh.clone());
            return fresh;
          }
        } catch { /* Offline or unreachable: use the verified local shell below. */ }
      }
      const shell = await cache.match(new URL(SHELL_FILE, scope), { ignoreVary: true });
      if (shell?.ok) return shell;
      return fetch(request);
    })());
    return;
  }

  if (!isStaticRequest(request, url, scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached?.ok) return cached;

    const response = await fetch(request);
    if (response.ok && response.type !== "opaque") {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
