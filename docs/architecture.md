# Architecture and security scope

Armoreum's application source presents creator protection, launch, recovery, and registered-pair bridge workflows. Sensitive transaction behavior also depends on an API server and contracts; frontend code alone is not an authorization boundary.

## Creator protection

The supplied password-authorization documentation describes a memory-hard password derivation followed by per-launch server-assisted derivation. The server participates in a trust boundary; the construction is not browser-only or zero knowledge.

The contract-side authorization mechanism uses operation-specific one-time hash proofs, vault context, signatures, epochs, and pending actions. ECDSA and conventional cryptography still apply to several parts of the system. Using SHA-256 does not establish blanket post-quantum security.

## Recovery

Recovery capsules can contain a creator password, private key, authorization seed, and one-time proof material. They are unencrypted bearer files. A checksum is corruption detection, not encryption or proof of authenticity.

Only synthetic recovery fixtures should be used in public tests and bug reports. Offline file inspection does not establish current onchain commitments, account balance, or payout availability.

## Bridge and launches

Bridge interfaces target registered token pairs rather than arbitrary token bridging. A wallet approval is not a completed transfer. A submitted hash is not a verified source receipt, and a confirmed source receipt is not destination delivery.

Launch stages, receipts, chain-specific outcomes, and retries must be reconciled against authoritative state. An application error must not be treated as evidence that an onchain transaction failed.

## Not established by this release

This source preview does not verify live RPC configuration, deployed addresses or bytecode, upgrade roles, production availability, relayer finality, economic outcomes, or an independent security audit. The missing API implementation must be reviewed separately.
