import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "ethers";
import { createQrcFile, openQrcCapsule } from "./qrc.ts";
import { buildQrcViewerModel } from "./qrc-view-model.ts";
import { derivePasswordAuthorizationProofChains } from "./creator-password-authorization.ts";

const creatorPrivateKey = `0x${"77".repeat(32)}`;
const context = {
  chainId: 4663,
  launchId: `0x${"11".repeat(32)}`,
  creatorAddress: new Wallet(creatorPrivateKey).address,
  vaultAddress: `0x${"66".repeat(20)}`,
};
const derived = await derivePasswordAuthorizationProofChains(new Uint8Array(32).fill(0x55), context);
const payload = {
  format: "armoreum-qrc",
  version: 2,
  protocol: "armoreum.creator.password.authorization.v2",
  authorizations: [{
    chainId: 4663,
    launchId: context.launchId,
    creatorAddress: context.creatorAddress,
    vaultAddress: context.vaultAddress,
    authorizationSigner: `0x${"66".repeat(20)}`,
    creatorPrivateKey,
    serverKeyId: `0x${"44".repeat(32)}`,
    authorizationSeed: `0x${"55".repeat(32)}`,
    creatorPassword: "123messi",
    tokenAddress: `0x${"77".repeat(20)}`,
    taxRouterAddress: `0x${"88".repeat(20)}`,
    curveAddress: `0x${"99".repeat(20)}`,
    authorizationEpochRoot: derived.authorizationEpochRoot,
    proofChains: derived.chains,
  }],
};

test("the viewer preserves password, private key, contracts, and all proof chains", async () => {
  const file = await createQrcFile(payload);
  const capsule = await openQrcCapsule(file);
  const model = buildQrcViewerModel(capsule);
  assert.equal(model.records[0].credentials.find((field) => field.id === "creator-key").value, creatorPrivateKey);
  assert.equal(model.records[0].credentials.find((field) => field.id === "creator-key").sensitive, true);
  assert.equal(model.records[0].credentials.find((field) => field.id === "creator-password").value, "123messi");
  assert.equal(model.records[0].authorization.find((field) => field.id === "authorization-seed").value, payload.authorizations[0].authorizationSeed);
  assert.equal(model.records[0].proofChains.length, 256);
  assert.equal(model.records[0].proofChains[0].fields.length, 101);
  assert.equal(model.records[0].metadata.find((field) => field.id === "token-address").value, payload.authorizations[0].tokenAddress);
  assert.equal(model.capsuleFields.find((field) => field.id === "format-version").value, "3.0");
  assert.equal(capsule.metadata.checksum, `0x${Buffer.from(file.subarray(file.length - 32)).toString("hex")}`);
});

test("the live on-chain authorization counter is not fabricated", async () => {
  const model = buildQrcViewerModel(await openQrcCapsule(await createQrcFile(payload)));
  assert.equal(model.records[0].credentials.find((field) => field.id === "creator-password").value, "123messi");
  assert.match(model.records[0].authorization.find((field) => field.id === "stored-hashes").value, /256 operation\/epoch chains/);
  assert.equal(model.records[0].authorization.find((field) => field.id === "authorization-state").value, null);
  assert.equal(model.records[0].metadata.find((field) => field.id === "vault-id").value, context.vaultAddress);
  assert.equal(model.capsuleFields.find((field) => field.id === "created-at").value, null);
});

test("opening and building the viewer require no network access", async () => {
  const file = await createQrcFile(payload);
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = () => {
    networkCalls += 1;
    throw new Error("Network unavailable");
  };
  try {
    const capsule = await openQrcCapsule(file);
    assert.deepEqual(capsule.payload, payload);
    assert.equal(buildQrcViewerModel(capsule).records.length, 1);
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    file.fill(0);
  }
});

test("plaintext JSON pretending to be a QRC file is rejected", async () => {
  await assert.rejects(openQrcCapsule(new TextEncoder().encode(JSON.stringify(payload))), /not an Armoreum recovery file/i);
});
