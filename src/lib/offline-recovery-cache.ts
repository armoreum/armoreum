export const OFFLINE_RECOVERY_CACHE_NAME = "armoreum-offline-recovery-v5";
const MANIFEST_FILE = "offline-recovery-manifest.json";
const READY_FILE = "offline-recovery-ready.json";
const SHELL_FILE = "offline-recovery-shell.html";
const CACHE_VERSION = 5;

export type RecoveryNetworkStatus = "online" | "offline" | "unknown";

export type RecoveryCacheStatus = {
  ready: boolean;
  verifiedAssetCount: number;
  missingAssetCount: number;
  source: "build-manifest" | "current-session" | "none";
};

type RecoveryManifest = {
  version: number;
  assets: string[];
};

export function canEnterOfflineRecovery(input: {
  assetsReady: boolean;
  networkStatus: RecoveryNetworkStatus;
  acknowledged: boolean;
  localChecksReady: boolean;
}) {
  return input.assetsReady
    && input.networkStatus === "offline"
    && input.acknowledged
    && input.localChecksReady;
}

export function isCacheableRecoveryAsset(candidate: string, scope: URL): boolean {
  try {
    const url = new URL(candidate, scope);
    if (url.origin !== scope.origin || !url.href.startsWith(scope.href)) return false;

    const path = url.pathname.slice(scope.pathname.length - 1);
    if (
      path.startsWith("/api/")
      || path.startsWith("/ws")
      || path.includes("/__open-in-editor")
      || path.endsWith(".map")
      || path === "/offline-recovery-sw.js"
      || path === `/${MANIFEST_FILE}`
    ) {
      return false;
    }

    return path === `/${SHELL_FILE}`
      || path === "/index.html"
      || path.startsWith("/assets/")
      || path.startsWith("/src/")
      || path.startsWith("/node_modules/")
      || path.startsWith("/@id/")
      || path.startsWith("/@fs/")
      || path.startsWith("/@react-refresh")
      || path === "/@vite/client"
      || /\.(?:m?js|css|svg|png|webp|woff2?)$/i.test(path);
  } catch {
    return false;
  }
}

function getBaseUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.origin);
}

function getStatusFromNavigator(): RecoveryNetworkStatus {
  if (typeof navigator.onLine !== "boolean") return "unknown";
  return navigator.onLine ? "online" : "offline";
}

function parseManifest(value: unknown): RecoveryManifest | null {
  if (!value || typeof value !== "object") return null;
  const manifest = value as Partial<RecoveryManifest>;
  if (
    manifest.version !== CACHE_VERSION
    || !Array.isArray(manifest.assets)
    || manifest.assets.length < 1
    || manifest.assets.length > 500
    || manifest.assets.some((asset) => typeof asset !== "string" || asset.length > 512)
  ) {
    return null;
  }
  return { version: CACHE_VERSION, assets: [...new Set(manifest.assets)] };
}

async function readCachedManifest(cache: Cache, base: URL): Promise<RecoveryManifest | null> {
  const response = await cache.match(new URL(MANIFEST_FILE, base), { ignoreVary: true });
  if (!response?.ok) return null;
  try {
    return parseManifest(await response.json());
  } catch {
    return null;
  }
}

async function cacheResponse(url: URL, cache: Cache): Promise<boolean> {
  const current = await cache.match(url, { ignoreVary: true });
  if (current?.ok) return true;

  const response = await fetch(url, { credentials: "same-origin", cache: "reload" });
  if (!response.ok || response.type === "opaque") return false;
  await cache.put(url, response.clone());
  return true;
}

export async function verifyRecoveryAssets(cache: Cache, base: URL, assets: string[]) {
  let verifiedAssetCount = 0;
  for (const asset of assets) {
    // Only public, same-origin static tool assets enter this cache. Vite responses
    // vary on Origin, while a URL-only Cache.match request has no Origin header.
    const response = await cache.match(new URL(asset, base), { ignoreVary: true });
    if (response?.ok) verifiedAssetCount += 1;
  }
  return {
    ready: assets.length > 0 && verifiedAssetCount === assets.length,
    verifiedAssetCount,
    missingAssetCount: Math.max(0, assets.length - verifiedAssetCount),
  };
}

async function waitForActiveWorker(registration: ServiceWorkerRegistration): Promise<boolean> {
  const installing = registration.installing || registration.waiting;
  if (!installing && registration.active?.state === "activated") return true;
  if (!installing) return Boolean(registration.active);

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      installing.removeEventListener("statechange", onStateChange);
      resolve(registration.active?.state === "activated");
    }, 30_000);
    const onStateChange = () => {
      if (installing.state === "activated") {
        window.clearTimeout(timeout);
        installing.removeEventListener("statechange", onStateChange);
        resolve(true);
      } else if (installing.state === "redundant") {
        window.clearTimeout(timeout);
        installing.removeEventListener("statechange", onStateChange);
        resolve(false);
      }
    };
    installing.addEventListener("statechange", onStateChange);
  });
}

function collectCurrentSessionAssets(base: URL): string[] {
  const assets = new Set<string>([
    new URL(SHELL_FILE, base).href,
    new URL("armoreum-logo-light.png", base).href,
  ]);

  for (const entry of performance.getEntriesByType("resource")) {
    const name = (entry as PerformanceResourceTiming).name;
    if (isCacheableRecoveryAsset(name, base)) {
      assets.add(new URL(name, base).href);
    }
  }

  return [...assets];
}

async function verifyReadyMarker(cache: Cache, base: URL, assets: string[]): Promise<RecoveryCacheStatus> {
  const result = await verifyRecoveryAssets(cache, base, assets);
  const markerUrl = new URL(READY_FILE, base);
  if (result.ready) {
    await cache.put(markerUrl, new Response(JSON.stringify({
      version: CACHE_VERSION,
      verifiedAt: Date.now(),
      assets,
    }), { headers: { "content-type": "application/json" } }));
  } else {
    await cache.delete(markerUrl);
  }
  return { ...result, source: "current-session" };
}

export async function verifyOfflineRecoveryCache(): Promise<RecoveryCacheStatus> {
  if (!("caches" in window)) {
    return { ready: false, verifiedAssetCount: 0, missingAssetCount: 0, source: "none" };
  }
  const base = getBaseUrl();
  const cache = await caches.open(OFFLINE_RECOVERY_CACHE_NAME);
  const manifest = await readCachedManifest(cache, base);
  if (manifest) {
    const marker = await cache.match(new URL(READY_FILE, base));
    if (!marker?.ok) {
      return { ready: false, verifiedAssetCount: 0, missingAssetCount: manifest.assets.length, source: "build-manifest" };
    }
    const result = await verifyRecoveryAssets(cache, base, manifest.assets);
    return { ...result, source: "build-manifest" };
  }
  return { ready: false, verifiedAssetCount: 0, missingAssetCount: 0, source: "none" };
}

export async function prepareOfflineRecoveryCache(): Promise<RecoveryCacheStatus> {
  const base = getBaseUrl();
  if (!("serviceWorker" in navigator) || !("caches" in window)) {
    throw new Error("This browser cannot cache the offline recovery tool.");
  }

  let registration = await navigator.serviceWorker.getRegistration(base.href);
  if (!registration && getStatusFromNavigator() === "online") {
    registration = await navigator.serviceWorker.register(
      new URL("offline-recovery-sw.js", base).href,
      { scope: base.href, updateViaCache: "none" },
    );
  } else if (registration && getStatusFromNavigator() === "online") {
    await registration.update();
  }
  if (!registration) {
    return verifyOfflineRecoveryCache();
  }

  if (!await waitForActiveWorker(registration)) {
    throw new Error("The offline recovery service worker could not be activated.");
  }

  const cache = await caches.open(OFFLINE_RECOVERY_CACHE_NAME);
  let manifest = await readCachedManifest(cache, base);
  if (getStatusFromNavigator() === "online") {
    try {
      const response = await fetch(new URL(MANIFEST_FILE, base), { credentials: "same-origin", cache: "no-store" });
      if (response.ok) {
        const fresh = parseManifest(await response.clone().json());
        if (!fresh) throw new Error("Offline asset manifest is invalid.");
        manifest = fresh;
        await cache.put(new URL(MANIFEST_FILE, base), response);
      }
    } catch {
      // Preserve a previously verified local installation if the network is unavailable.
      if (!manifest) throw new Error("The offline recovery manifest could not be loaded.");
    }
  }
  let source: RecoveryCacheStatus["source"] = manifest ? "build-manifest" : "current-session";

  if (!manifest) {
    if (getStatusFromNavigator() !== "online") {
      return { ready: false, verifiedAssetCount: 0, missingAssetCount: 0, source: "none" };
    }

    const assets = collectCurrentSessionAssets(base);
    const prepared: string[] = [];
    for (const asset of assets) {
      if (await cacheResponse(new URL(asset), cache)) prepared.push(asset);
    }
    manifest = { version: CACHE_VERSION, assets: prepared };
    await cache.put(new URL(MANIFEST_FILE, base), new Response(JSON.stringify(manifest), {
      headers: { "content-type": "application/json" },
    }));
  } else if (getStatusFromNavigator() === "online") {
    for (const asset of manifest.assets) {
      await cacheResponse(new URL(asset, base), cache);
    }
  }

  const result = await verifyReadyMarker(cache, base, manifest.assets);
  return { ...result, source };
}
