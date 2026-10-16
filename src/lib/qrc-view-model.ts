import type { OpenedQrcCapsule } from "./qrc";

export interface QrcViewerField {
  id: string;
  label: string;
  value: string | null;
  sensitive?: boolean;
}

export const QRC_MISSING_VALUE = "Not present in this capsule.";

export function buildQrcViewerModel(capsule: OpenedQrcCapsule) {
  const { payload, metadata } = capsule;
  const capsuleFields: QrcViewerField[] = [
    { id: "magic", label: "File identifier", value: metadata.magic },
    { id: "format-version", label: "Format version", value: metadata.formatVersion },
    { id: "payload-format", label: "Payload format", value: payload.format },
    { id: "payload-version", label: "Payload schema version", value: String(payload.version) },
    { id: "protocol", label: "Authorization protocol version", value: payload.protocol },
    { id: "created-at", label: "Creation timestamp", value: null },
    { id: "cipher-suite", label: "Cipher suite identifier", value: `${metadata.cipherSuiteId} · no encryption` },
    { id: "kdf", label: "File-opening KDF identifier", value: `${metadata.kdfId} · no password required` },
    { id: "payload-length", label: "Payload length", value: `${metadata.payloadLengthBytes} bytes` },
    { id: "checksum", label: "SHA-256 checksum", value: metadata.checksum },
  ];

  return {
    capsuleFields,
    records: payload.authorizations.map((record) => ({
      id: `${record.chainId}:${record.launchId}`,
      network: record.chainId === 1 ? "Ethereum" : "Robinhood",
      credentials: [
        { id: "creator-address", label: "Creator public address", value: record.creatorAddress },
        { id: "creator-key", label: "Creator private key", value: record.creatorPrivateKey, sensitive: true },
        { id: "creator-password", label: "Creator authorization password", value: record.creatorPassword ?? null, sensitive: true },
      ] satisfies QrcViewerField[],
      authorization: [
        { id: "authorization-seed", label: "Authorization seed (not a password)", value: record.authorizationSeed, sensitive: true },
        {
          id: "stored-hashes",
          label: "Stored H100 through H0 hash chains",
          value: record.proofChains ? `${record.proofChains.length} operation/epoch chains · 100 one-time proofs per chain` : null,
        },
        { id: "authorization-state", label: "Current on-chain authorization index / state", value: null },
      ] satisfies QrcViewerField[],
      metadata: [
        { id: "chain-id", label: "Chain ID", value: String(record.chainId) },
        { id: "launch-id", label: "Launch identifier", value: record.launchId },
        { id: "vault-id", label: "Vault / account identifier", value: record.vaultAddress },
        { id: "authorization-signer", label: "Authorization signer", value: record.authorizationSigner },
        { id: "server-key-id", label: "Server key identifier (not a server secret)", value: record.serverKeyId },
        { id: "token-address", label: "Launched token", value: record.tokenAddress ?? null },
        { id: "tax-router-address", label: "TaxRouter", value: record.taxRouterAddress ?? null },
        { id: "curve-address", label: "Pons curve", value: record.curveAddress ?? null },
        { id: "authorization-root", label: "On-chain authorization epoch root", value: record.authorizationEpochRoot ?? null },
      ] satisfies QrcViewerField[],
      proofChains: (record.proofChains ?? []).map((chain) => ({
        id: `${chain.operation}:${chain.epoch}`,
        operation: chain.operation,
        epoch: chain.epoch,
        fields: [
          { id: "h100", label: "H100 · on-chain commitment", value: chain.h100, sensitive: true },
          ...chain.h99ToH0.map((value, index) => ({
            id: `h${99 - index}`,
            label: `H${99 - index} · one-time proof`,
            value,
            sensitive: true,
          })),
        ] satisfies QrcViewerField[],
      })),
    })),
  };
}
