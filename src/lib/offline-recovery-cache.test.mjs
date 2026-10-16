import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OFFLINE_RECOVERY_CACHE_NAME,
  canEnterOfflineRecovery,
  isCacheableRecoveryAsset,
  verifyRecoveryAssets,
} from "./offline-recovery-cache.ts";

test("offline recovery uses a fresh cache namespace for the current recovery UI", () => {
  assert.equal(OFFLINE_RECOVERY_CACHE_NAME, "armoreum-offline-recovery-v5");
});

test("cached public static assets with Vary Origin remain verifiable after offline reload", async () => {
  const scope = new URL("https://armoreum.example/");
  const cache = {
    async match(url, options) {
      if (url.pathname === "/src/main.tsx" && options?.ignoreVary === true) {
        return new Response("cached static module", { headers: { Vary: "Origin" } });
      }
      return undefined;
    },
  };
  assert.deepEqual(await verifyRecoveryAssets(cache, scope, ["src/main.tsx"]), {
    ready: true,
    verifiedAssetCount: 1,
    missingAssetCount: 0,
  });
  assert.deepEqual(await verifyRecoveryAssets(cache, scope, ["src/main.tsx", "assets/missing.js"]), {
    ready: false,
    verifiedAssetCount: 1,
    missingAssetCount: 1,
  });
});

test("offline recovery requires verified assets, an offline browser signal, acknowledgement, and local checks", () => {
  const ready = {
    assetsReady: true,
    networkStatus: "offline",
    acknowledged: true,
    localChecksReady: true,
  };
  assert.equal(canEnterOfflineRecovery(ready), true);
  assert.equal(canEnterOfflineRecovery({ ...ready, assetsReady: false }), false);
  assert.equal(canEnterOfflineRecovery({ ...ready, networkStatus: "online" }), false);
  assert.equal(canEnterOfflineRecovery({ ...ready, networkStatus: "unknown" }), false);
  assert.equal(canEnterOfflineRecovery({ ...ready, acknowledged: false }), false);
  assert.equal(canEnterOfflineRecovery({ ...ready, localChecksReady: false }), false);
});

test("recovery cache allows only same-origin static resources inside the app scope", () => {
  const scope = new URL("https://armoreum.example/app/");
  assert.equal(isCacheableRecoveryAsset("https://armoreum.example/app/assets/recovery.js", scope), true);
  assert.equal(isCacheableRecoveryAsset("https://armoreum.example/app/offline-recovery-shell.html", scope), true);
  assert.equal(isCacheableRecoveryAsset("https://armoreum.example/app/@vite/client", scope), true);
  assert.equal(isCacheableRecoveryAsset("https://armoreum.example/api/secret", scope), false);
  assert.equal(isCacheableRecoveryAsset("https://armoreum.example/app/api/launch", scope), false);
  assert.equal(isCacheableRecoveryAsset("https://armoreum.example.evil.test/app/assets/x.js", scope), false);
  assert.equal(isCacheableRecoveryAsset("https://cdn.example.test/recovery.js", scope), false);
  assert.equal(isCacheableRecoveryAsset("https://armoreum.example/app/offline-recovery-sw.js", scope), false);
});
