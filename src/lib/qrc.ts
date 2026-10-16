import { computeAddress } from "ethers";
import type { PasswordAuthorizationOperation, PasswordAuthorizationProofChain } from "./creator-password-authorization";

const MAGIC = new Uint8Array([0x41, 0x52, 0x51, 0x52, 0x43]); // ARQRC
const FORMAT_VERSION = [3, 0] as const;
const PREVIOUS_FORMAT_VERSION = [2, 0] as const;
const FILE_ONLY_CIPHER_SUITE = 0;
const FILE_ONLY_KDF = 0;
const FILE_ONLY_HEADER_SIZE = 13;
const CHECKSUM_SIZE = 32;
const MAX_CAPSULE_SIZE = 4 * 1024 * 1024;
const MAX_PAYLOAD_SIZE = MAX_CAPSULE_SIZE - FILE_ONLY_HEADER_SIZE - CHECKSUM_SIZE;
const AUTHORIZATION_OPERATIONS: PasswordAuthorizationOperation[] = ["claim", "redemption", "rotation", "recovery"];
const AUTHORIZATION_EPOCHS = 64;
const PROOFS_PER_CHAIN = 100;

export const QRC_PARAMETERS = {
  format: "QRC v3.0",
  access: "File-only bearer credential",
  encryption: "None",
  checksum: "SHA-256 (corruption check only)",
  maxFileBytes: MAX_CAPSULE_SIZE,
} as const;

const QRC_PROTOCOL = "armoreum.creator.password.authorization.v2";

export class QrcOpenError extends Error {
  readonly code: "PASSWORD_PROTECTED_LEGACY" | "INVALID_FILE";

  constructor(
    code: "PASSWORD_PROTECTED_LEGACY" | "INVALID_FILE",
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "QrcOpenError";
  }
}

export interface QrcAuthorizationRecord {
  chainId: 1 | 4663;
  launchId: string;
  creatorAddress: string;
  vaultAddress: string | null;
  authorizationSigner: string;
  creatorPrivateKey: string;
  serverKeyId: string;
  authorizationSeed: string;
  creatorPassword?: string;
  tokenAddress?: string;
  taxRouterAddress?: string;
  curveAddress?: string;
  authorizationEpochRoot?: string;
  proofChains?: PasswordAuthorizationProofChain[];
}

export interface QrcPayload {
  format: "armoreum-qrc";
  version: 1 | 2;
  protocol: typeof QRC_PROTOCOL;
  authorizations: QrcAuthorizationRecord[];
}

export interface QrcContainerMetadata {
  magic: "ARQRC";
  formatVersion: string;
  cipherSuiteId: number;
  kdfId: number;
  payloadLengthBytes: number;
  checksum: string;
}

export interface OpenedQrcCapsule {
  payload: QrcPayload;
  metadata: QrcContainerMetadata;
}

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  const output = new ArrayBuffer(value.length);
  new Uint8Array(output).set(value);
  return output;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function writeUint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function fromHex(value: string, bytes: number, label: string): Uint8Array {
  if (!new RegExp(`^0x[\\da-f]{${bytes * 2}}$`, "i").test(value)) {
    throw new Error(`${label} must be ${bytes} bytes of hexadecimal data.`);
  }
  const output = new Uint8Array(bytes);
  for (let index = 0; index < bytes; index += 1) {
    output[index] = Number.parseInt(value.slice(2 + index * 2, 4 + index * 2), 16);
  }
  return output;
}

function validatePayload(payload: unknown): asserts payload is QrcPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Recovery capsule payload is invalid.");
  }
  const candidate = payload as Partial<QrcPayload>;
  if (
    candidate.format !== "armoreum-qrc" ||
    (candidate.version !== 1 && candidate.version !== 2) ||
    candidate.protocol !== QRC_PROTOCOL ||
    !Array.isArray(candidate.authorizations) ||
    candidate.authorizations.length < 1 ||
    candidate.authorizations.length > 2
  ) {
    throw new Error("Recovery capsule version or authorization format is unsupported.");
  }

  const seen = new Set<string>();
  for (const record of candidate.authorizations) {
    if (!record || typeof record !== "object") throw new Error("Recovery record is invalid.");
    const legacyRecordKeys = [
      "chainId",
      "launchId",
      "creatorAddress",
      "vaultAddress",
      "authorizationSigner",
      "creatorPrivateKey",
      "serverKeyId",
      "authorizationSeed",
    ];
    const currentRecordKeys = [
      ...legacyRecordKeys,
      "creatorPassword",
      "tokenAddress",
      "taxRouterAddress",
      "curveAddress",
      "authorizationEpochRoot",
      "proofChains",
    ];
    const recordKeys = candidate.version === 1 ? legacyRecordKeys : currentRecordKeys;
    if (
      Object.keys(record).length !== recordKeys.length ||
      Object.keys(record).some((key) => !recordKeys.includes(key))
    ) {
      throw new Error("Recovery record contains unsupported fields.");
    }
    if (record.chainId !== 1 && record.chainId !== 4663) {
      throw new Error("Recovery record uses an unsupported chain.");
    }
    fromHex(record.launchId, 32, "Launch ID");
    fromHex(record.creatorPrivateKey, 32, "Creator private key");
    fromHex(record.serverKeyId, 32, "Server key ID");
    fromHex(record.authorizationSeed, 32, "Authorization seed");
    if (
      !/^0x[\da-f]{40}$/i.test(record.creatorAddress) ||
      (record.vaultAddress !== null && !/^0x[\da-f]{40}$/i.test(record.vaultAddress)) ||
      !/^0x[\da-f]{40}$/i.test(record.authorizationSigner)
    ) {
      throw new Error("Recovery record contains an invalid address.");
    }
    if (candidate.version === 2) {
      if (
        typeof record.creatorPassword !== "string" ||
        record.creatorPassword.length < 6 ||
        !/[a-z]/i.test(record.creatorPassword) ||
        !/\d/.test(record.creatorPassword) ||
        record.vaultAddress === null ||
        !/^0x[\da-f]{40}$/i.test(record.tokenAddress ?? "") ||
        !/^0x[\da-f]{40}$/i.test(record.taxRouterAddress ?? "") ||
        !/^0x[\da-f]{40}$/i.test(record.curveAddress ?? "") ||
        !Array.isArray(record.proofChains) ||
        record.proofChains.length !== AUTHORIZATION_OPERATIONS.length * AUTHORIZATION_EPOCHS
      ) {
        throw new Error("Recovery record is missing post-launch password, contract, or proof-chain data.");
      }
      fromHex(record.authorizationEpochRoot ?? "", 32, "Authorization epoch root");
      const chains = new Set<string>();
      for (const chain of record.proofChains as PasswordAuthorizationProofChain[]) {
        if (
          !chain ||
          !AUTHORIZATION_OPERATIONS.includes(chain.operation) ||
          !Number.isInteger(chain.epoch) ||
          chain.epoch < 1 ||
          chain.epoch > AUTHORIZATION_EPOCHS ||
          !Array.isArray(chain.h99ToH0) ||
          chain.h99ToH0.length !== PROOFS_PER_CHAIN
        ) {
          throw new Error("Recovery capsule contains an invalid hash-chain entry.");
        }
        fromHex(chain.h100, 32, "H100 commitment");
        for (const proof of chain.h99ToH0) fromHex(proof, 32, "One-time hash proof");
        const chainKey = `${chain.operation}:${chain.epoch}`;
        if (chains.has(chainKey)) throw new Error("Recovery capsule contains duplicate hash chains.");
        chains.add(chainKey);
      }
      if (chains.size !== AUTHORIZATION_OPERATIONS.length * AUTHORIZATION_EPOCHS) {
        throw new Error("Recovery capsule does not contain every authorization hash chain.");
      }
    }
    if (computeAddress(record.creatorPrivateKey).toLowerCase() !== record.creatorAddress.toLowerCase()) {
      throw new Error("Creator private key does not match the recovery wallet address.");
    }
    const uniqueKey = `${record.chainId}:${record.launchId.toLowerCase()}`;
    if (seen.has(uniqueKey)) throw new Error("Recovery capsule contains duplicate vault entries.");
    seen.add(uniqueKey);
  }

  const expectedKeys = ["format", "version", "protocol", "authorizations"];
  if (Object.keys(payload).some((key) => !expectedKeys.includes(key))) {
    throw new Error("Recovery capsule contains unsupported fields.");
  }
}

function makeHeader(payloadLength: number): Uint8Array {
  return concat(
    MAGIC,
    new Uint8Array(FORMAT_VERSION),
    new Uint8Array([FILE_ONLY_CIPHER_SUITE, FILE_ONLY_KDF]),
    writeUint32(payloadLength),
  );
}

export async function createQrcFile(payload: QrcPayload): Promise<Uint8Array> {
  validatePayload(payload);
  if (payload.version !== 2) {
    throw new Error("New recovery capsules must use the post-launch QRC v3 format.");
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure browser cryptography is not available.");
  }

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  if (payloadBytes.length > MAX_PAYLOAD_SIZE) {
    payloadBytes.fill(0);
    throw new Error("Recovery data is too large for a QRC file.");
  }
  const header = makeHeader(payloadBytes.length);
  const checksumInput = concat(header, payloadBytes);
  const checksumBuffer = asArrayBuffer(checksumInput);
  let checksum: Uint8Array | null = null;
  try {
    checksum = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", checksumBuffer));
    const capsule = concat(header, payloadBytes, checksum);
    if (capsule.length > MAX_CAPSULE_SIZE) {
      capsule.fill(0);
      throw new Error("Recovery capsule exceeds the file size limit.");
    }
    return capsule;
  } finally {
    payloadBytes.fill(0);
    header.fill(0);
    checksumInput.fill(0);
    new Uint8Array(checksumBuffer).fill(0);
    checksum?.fill(0);
  }
}

export async function openQrcFile(file: Uint8Array): Promise<QrcPayload> {
  if (!(file instanceof Uint8Array) || file.length < FILE_ONLY_HEADER_SIZE + CHECKSUM_SIZE || file.length > MAX_CAPSULE_SIZE) {
    throw new QrcOpenError("INVALID_FILE", "Recovery file size is invalid.");
  }
  if (!equalBytes(file.subarray(0, MAGIC.length), MAGIC)) {
    throw new QrcOpenError("INVALID_FILE", "This is not an Armoreum recovery file.");
  }

  const versionOffset = MAGIC.length;
  if (file[versionOffset] === 1 && file[versionOffset + 1] === 0) {
    throw new QrcOpenError(
      "PASSWORD_PROTECTED_LEGACY",
      "This is a password-encrypted QRC v1 file. File-only recovery cannot open or convert it.",
    );
  }
  const isCurrentFormat = file[versionOffset] === FORMAT_VERSION[0] && file[versionOffset + 1] === FORMAT_VERSION[1];
  const isPreviousFormat = file[versionOffset] === PREVIOUS_FORMAT_VERSION[0] && file[versionOffset + 1] === PREVIOUS_FORMAT_VERSION[1];
  if (!isCurrentFormat && !isPreviousFormat) {
    throw new QrcOpenError("INVALID_FILE", "This recovery file version is not supported.");
  }
  const suiteOffset = versionOffset + 2;
  if (file[suiteOffset] !== FILE_ONLY_CIPHER_SUITE || file[suiteOffset + 1] !== FILE_ONLY_KDF) {
    throw new QrcOpenError("INVALID_FILE", "This recovery file uses an unsupported format.");
  }
  const payloadLength = readUint32(file, suiteOffset + 2);
  if (
    payloadLength < 1 ||
    payloadLength > MAX_PAYLOAD_SIZE ||
    file.length !== FILE_ONLY_HEADER_SIZE + payloadLength + CHECKSUM_SIZE
  ) {
    throw new QrcOpenError("INVALID_FILE", "Recovery file length is invalid.");
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure browser cryptography is not available.");
  }
  const header = file.slice(0, FILE_ONLY_HEADER_SIZE);
  const payloadBytes = file.slice(FILE_ONLY_HEADER_SIZE, FILE_ONLY_HEADER_SIZE + payloadLength);
  const storedChecksum = file.slice(FILE_ONLY_HEADER_SIZE + payloadLength);
  const checksumInput = concat(header, payloadBytes);
  const checksumBuffer = asArrayBuffer(checksumInput);
  let expectedChecksum: Uint8Array | null = null;
  try {
    expectedChecksum = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", checksumBuffer));
    if (!equalBytes(expectedChecksum, storedChecksum)) {
      throw new QrcOpenError("INVALID_FILE", "Recovery file checksum does not match.");
    }
    const payload: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes));
    validatePayload(payload);
    if ((isCurrentFormat && payload.version !== 2) || (isPreviousFormat && payload.version !== 1)) {
      throw new QrcOpenError("INVALID_FILE", "Recovery file and payload versions do not match.");
    }
    if (payload.version === 2) await verifyProofChains(payload);
    return payload;
  } finally {
    payloadBytes.fill(0);
    storedChecksum.fill(0);
    header.fill(0);
    checksumInput.fill(0);
    new Uint8Array(checksumBuffer).fill(0);
    expectedChecksum?.fill(0);
  }
}

async function verifyProofChains(payload: QrcPayload): Promise<void> {
  if (!globalThis.crypto?.subtle) throw new Error("Secure browser cryptography is not available.");
  for (const record of payload.authorizations) {
    for (const chain of record.proofChains ?? []) {
      for (let index = 1; index < chain.h99ToH0.length; index += 1) {
        const current = fromHex(chain.h99ToH0[index], 32, "One-time hash proof");
        const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", asArrayBuffer(current)));
        current.fill(0);
        const expected = fromHex(chain.h99ToH0[index - 1], 32, "One-time hash proof");
        const valid = equalBytes(digest, expected);
        digest.fill(0);
        expected.fill(0);
        if (!valid) throw new QrcOpenError("INVALID_FILE", "A stored one-time hash chain is inconsistent.");
      }
      const h99 = fromHex(chain.h99ToH0[0], 32, "H99 proof");
      const h100 = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", asArrayBuffer(h99)));
      h99.fill(0);
      const storedH100 = fromHex(chain.h100, 32, "H100 commitment");
      const valid = equalBytes(h100, storedH100);
      h100.fill(0);
      storedH100.fill(0);
      if (!valid) throw new QrcOpenError("INVALID_FILE", "A stored hash chain does not match its H100 commitment.");
    }
  }
}

export async function openQrcCapsule(file: Uint8Array): Promise<OpenedQrcCapsule> {
  const payload = await openQrcFile(file);
  const payloadLength = readUint32(file, 9);
  const checksumStart = FILE_ONLY_HEADER_SIZE + payloadLength;
  const checksum = file.subarray(checksumStart);
  const checksumHex = `0x${Array.from(checksum, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;

  return {
    payload,
    metadata: {
      magic: "ARQRC",
      formatVersion: `${file[5]}.${file[6]}`,
      cipherSuiteId: file[7],
      kdfId: file[8],
      payloadLengthBytes: payloadLength,
      checksum: checksumHex,
    },
  };
}

export async function qrcFilename(payload: QrcPayload): Promise<string> {
  validatePayload(payload);
  const launchId = fromHex(payload.authorizations[0].launchId, 32, "Launch ID");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", asArrayBuffer(launchId));
  const shortId = Array.from(new Uint8Array(digest).slice(0, 4), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `armoreum-recovery-${shortId}.qrc`;
}
