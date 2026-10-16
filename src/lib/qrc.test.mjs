import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "ethers";
import { createQrcFile, openQrcFile, QRC_PARAMETERS, QrcOpenError } from "./qrc.ts";
import {
  derivePasswordAuthorizationProofChains,
  derivePasswordAuthorizationProof,
} from "./creator-password-authorization.ts";

const creatorPrivateKey = `0x${"77".repeat(32)}`;
const context = {
  chainId: 4663,
  launchId: `0x${"11".repeat(32)}`,
  creatorAddress: new Wallet(creatorPrivateKey).address,
  vaultAddress: `0x${"66".repeat(20)}`,
};
const seed = new Uint8Array(32).fill(0x55);
const derived = await derivePasswordAuthorizationProofChains(seed, context);
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

const capsule = await createQrcFile(payload);

test("post-launch QRC v3 has a versioned header and a bounded payload", () => {
  assert.equal(Buffer.from(capsule.subarray(0, 5)).toString("ascii"), "ARQRC");
  assert.deepEqual(Array.from(capsule.subarray(5, 9)), [3, 0, 0, 0]);
  const payloadLength = new DataView(capsule.buffer, capsule.byteOffset, capsule.byteLength).getUint32(9, false);
  assert.equal(capsule.length, 13 + payloadLength + 32);
  assert.equal(QRC_PARAMETERS.format, "QRC v3.0");
  assert.equal(QRC_PARAMETERS.encryption, "None");
  assert.ok(capsule.length <= QRC_PARAMETERS.maxFileBytes);
});

test("post-launch QRC v3 opens offline without a password and validates all proof chains", async () => {
  assert.deepEqual(await openQrcFile(capsule), payload);
});

test("the file contains password, private key, seed, and H100-H0 proof material", () => {
  const encoded = Buffer.from(capsule).toString("utf8");
  assert.ok(encoded.includes(creatorPrivateKey));
  assert.ok(encoded.includes(payload.authorizations[0].creatorPassword));
  assert.ok(encoded.includes(payload.authorizations[0].authorizationSeed));
  assert.ok(encoded.includes(payload.authorizations[0].proofChains[0].h100));
});

test("each stored proof chain matches its H100 commitment and the live proof derivation", async () => {
  const chain = payload.authorizations[0].proofChains.find(({ operation, epoch }) => operation === "claim" && epoch === 1);
  assert.equal(chain.h99ToH0.length, 100);
  assert.equal(chain.h99ToH0[0], await derivePasswordAuthorizationProof(seed, context, "claim", 1, 100));
  assert.equal(chain.h99ToH0[99], await derivePasswordAuthorizationProof(seed, context, "claim", 1, 1));
});

test("checksum catches accidental payload corruption", async () => {
  const modified = capsule.slice();
  modified[modified.length - 33] ^= 0x80;
  await assert.rejects(openQrcFile(modified), /checksum does not match/i);
});

test("unsupported suite and invalid length changes are rejected", async () => {
  const modified = capsule.slice();
  modified[7] = 1;
  await assert.rejects(openQrcFile(modified), /unsupported format/i);

  const invalidLength = capsule.slice();
  invalidLength[12] ^= 1;
  await assert.rejects(openQrcFile(invalidLength), /length is invalid/i);
});

test("legacy password-encrypted QRC v1 cannot be opened in file-only mode", async () => {
  const legacy = new Uint8Array(61);
  legacy.set(Buffer.from("ARQRC", "ascii"));
  legacy.set([1, 0, 1, 1], 5);
  await assert.rejects(openQrcFile(legacy), (error) => {
    assert.ok(error instanceof QrcOpenError);
    assert.equal(error.code, "PASSWORD_PROTECTED_LEGACY");
    assert.match(error.message, /file-only recovery cannot open or convert/i);
    return true;
  });
});

test("the payload still binds the creator private key to its wallet address", async () => {
  const modifiedPayload = structuredClone(payload);
  modifiedPayload.authorizations[0].creatorAddress = `0x${"88".repeat(20)}`;
  await assert.rejects(createQrcFile(modifiedPayload), /does not match the recovery wallet address/i);
});
