# Password authorization and QRC v1

## Current boundary

The current deployed CreatorRewardVault authorization path still uses passkey/P-256 assertions and a 256-proof epoch. The new password-derived protocol uses a separate v2 namespace and 100 preimages per epoch. It is not compatible with the current onchain verifier until a reviewed implementation and versioned factory initialization are deployed. A QRC download must remain unavailable until an onchain read confirms the matching v2 root, signer, server-key ID, vault, and launch ID.

The current server endpoint returns a per-launch seed derived from the user's Argon2id output and the server-only `CREATOR_WALLET_ENCRYPTION_KEY`. The endpoint processes the KDF output in memory and does not store it. The API performs no transactions. This is a trusted-server design, not an OPRF: a compromised server can test guesses or derive authorization material. The password must be supplied again after a browser refresh; no password or seed is put in browser storage.

## Authorization derivation

- Normalize passwords with Unicode NFKC; require at least 6 Unicode code points and at least one letter and one number. There is no application-defined maximum.
- Use Argon2id with 65,536 KiB memory, 3 iterations, parallelism 1, and 32-byte output. The public, unique launch ID is the salt.
- The API derives a key from its server-only 32-byte secret using HKDF-SHA-256 with v2-specific salt/info, then HMAC-SHA-256s a length-framed protocol domain, launch ID, and KDF output. Only the resulting 32-byte per-launch seed and a key identifier are returned; raw password and server secret are never returned.
- The client derives operation-specific seeds and epoch commitments. Each epoch anchor is 100 SHA-256 applications from its seed: H100 is committed; the first submitted preimage is H99, and the last is H0. Proof reuse is prohibited. No password-derived signing key or onchain signer replacement is implemented here.
- Onchain adoption still needs explicit signer authorization and payload binding to chain, vault, launch, operation, nonce, epoch, amount, recipient, and deadline, along with atomic one-time proof consumption. The helper code alone does not enforce these properties.

## QRC v2 file-only format

QRC v2 is a binary container with a plaintext UTF-8 JSON payload. It is intentionally not encrypted so that the offline tool can open it from the file alone without the launch password.

| Field | Size | Value |
|---|---:|---|
| Magic | 5 bytes | ASCII `ARQRC` |
| Version | 2 bytes | `2, 0` |
| Cipher suite | 1 byte | `0` = none |
| KDF | 1 byte | `0` = none |
| Payload length | 4 bytes | Big-endian UTF-8 payload length |
| Payload | declared length | Creator authorization JSON, including creator private key and authorization seed |
| Checksum | 32 bytes | SHA-256 of header and payload |

The payload is capped at 16 KiB and the full file at 64 KiB. The checksum detects accidental corruption only; it is not a signature, authenticity check, or protection against deliberate edits. Anyone with the file can read the creator private key and authorization seed and control the creator wallet. Keep the file offline and do not share it.

The launch password is used for initial password-derived authorization, but is not stored in the QRC and is not needed to open QRC v2. The offline tool rejects password-encrypted QRC v1 files because they cannot be opened without their original password.

### Offline contents viewer

The `/offline-recovery` viewer opens a selected file automatically after static assets have been verified in the offline cache and the browser reports an offline connection. It performs no login, server verification, upload, or transaction, and does not hand recovered credentials to the online application.

Creator credentials, authorization material, and capsule/account metadata are displayed in expandable sections. Private keys and authorization seeds are masked until explicitly revealed; each actual value has a local copy action. Passwords, stored H100–H0 values, creation timestamps, and live proof counters are absent from the current generated schema and are displayed as “Not present in this capsule.” The viewer does not derive or invent missing hashes or a live on-chain state.

Only static tool assets are cached. Selected file contents and parsed credentials are not written to browser storage. Clear Recovery Data, page exit, and reconnecting discard the selected file reference and parsed state. Temporary file bytes are zeroed after parsing. Clearing cannot erase the downloaded file or the operating-system clipboard; JavaScript garbage collection does not guarantee cryptographic memory erasure.

## Recovery limitation

The offline tool parses and validates the file locally; this alone does not submit a transaction or authorize Unjail. Any on-chain recovery must query the relevant vault's live authorization epoch, proof counters, and current commitment. The client must derive only the next unused proof for the current context. It must not reset counters, replay proofs, or initialize a new root over an existing one. Until the v2 vault/factory path exists and has been tested against those live views, opening a QRC does not restore on-chain creator actions.
