# Cross-repository source inventory

## Conclusion

Two source repositories have been published because the supplied archives contain exactly two package manifests. That is an archive boundary, not proof that the system is complete or that two repositories are the final architecture.

A second inventory found additional server and shared-package dependencies. Those sources are not supplied. The selected publication layout instead organizes actual available source into seven repositories: the original application and contracts, four focused source modules, and documentation.

No empty repository or speculative backend/database implementation is used to reach the repository count. Module extractions include explicit provenance and source dependency closure.

## Published artifact-based repository layout

The first two repositories preserve the supplied package boundaries. The remaining five are source-backed module/documentation extractions, not recovered original workspace packages.

| Repository | Responsibility | Source evidence | Publication status |
| --- | --- | --- | --- |
| `armoreum` | React application, routes, wallet interfaces, authorization/recovery UI, launch interfaces, bridge and explorer views | Frontend archive and its package manifest | Published source preview; not independently buildable |
| `armoreum-contracts` | Core vaults, receipt tokens, factories, tax routing, bridge/relay contracts, V4 hooks, local fixtures, deployment/test scripts | Contract archive and its package manifest | Published source preview; production readiness not established |
| [`armoreum-authorization`](https://github.com/armoreum/armoreum-authorization) | Hash chains, creator/password authorization, EIP-712 signing, verifier contracts | Copied frontend libraries, tests, and verifier source | Published module source preview |
| [`armoreum-recovery`](https://github.com/armoreum/armoreum-recovery) | QRC creation/parsing and inspection models | Copied QRC libraries, shared dependency, and synthetic tests | Published toolkit source preview |
| [`armoreum-bridge`](https://github.com/armoreum/armoreum-bridge) | Bridge/relay contracts and retry/explorer/error helpers | Copied bridge contracts with relative dependency closure and helper tests | Published module source preview; no server relayer supplied |
| [`armoreum-launchpad`](https://github.com/armoreum/armoreum-launchpad) | Token deployment, V4/seeding and launch modules, routing/funding helpers | Copied contract dependency closure and helper tests | Published module source preview; no API orchestration supplied |
| [`armoreum-docs`](https://github.com/armoreum/armoreum-docs) | Supplied project reference, architecture, product/security/economic boundaries | Original supplied overview plus source-grounded guides | Published documentation source preview |

Shared copied files are recorded in each module's `SOURCE_MANIFEST.json`. Repository count is not a count of independent algorithms, audits, or running services.

The API server, `@workspace/api-client-react`, and `@workspace/api-zod` remain absent. PostgreSQL and OpenAPI responsibilities are described, but their source and original package boundaries are not established. The earlier proposed server/client/schema/database/specification split is not the implemented artifact-based layout.

## Directly verified missing dependencies

### Frontend shared packages

The supplied frontend `package.json` declares:

```json
{
  "@workspace/api-client-react": "workspace:*",
  "@workspace/api-zod": "workspace:*"
}
```

Neither package implementation is present in the uploads. The original manifest also contained 19 `catalog:` dependency references. Removing editor-specific tooling does not recover the missing dependency catalog or lockfile.

The original frontend TypeScript configuration referenced `../../lib/api-client-react`. The public source has a portable TypeScript configuration, but the actual shared package remains absent.

### API-server relay policy

`armoreum-contracts/scripts/activate-atomic-relay.cjs` imports:

```text
../../../artifacts/api-server/src/lib/bridgeRelayPolicy.ts
```

The source at that location is not included in either archive.

### Shared network configuration

`armoreum-contracts/scripts/upgrade-launch-mode-policy-mainnet.cjs` uses `readPonsFactoryFromApiConfig()` to read:

```text
../api-zod/src/network-config.ts
```

That file is also absent. The dependency matters even though the contract package manifest does not declare a workspace dependency.

## Archive-to-public-source coverage

The second inventory compared code file paths after excluding generated bundles, compiler artifacts, caches, deployment records, and editor-only metadata.

| Supplied source area | Source code files | Original code paths missing from public source |
| --- | --- | --- |
| Frontend | 174: 108 TSX, 43 TS, 21 MJS, 2 JS | 0 |
| Contracts and scripts | 96: 46 Solidity, 50 CJS | 0 |

Coverage means the code paths were retained, not that every byte is unchanged or every workflow works. The public source includes documented portability, branding/comment, metadata, documentation, and project-owned license edits. The two ZIP files contain no nested ZIP/TAR source archives and no additional package manifests.

Operational records, historical deployment reports, build outputs, caches, live credentials, recovery material, and customer/database records are not publication substitutes for missing source.

## What the current checks establish

- Six frontend storage-migration tests passed.
- Twenty-three contract-helper tests passed.
- Retained CommonJS scripts passed syntax checks.
- Source files were scanned for secrets; public 20-byte EVM addresses were classified separately.
- The initially published 231 frontend files and 115 contract-repository files matched their prepared Git blob hashes.

The counts above describe the first source-preview commit. Follow-up work adds inventory documentation and fixes one stale authorization-test error-message expectation without changing authorization algorithms. Module extraction does not recover the missing server, schemas, client, database source, or API specification.

## Full-stack limitations

The artifact-based seven-repository publication is source-backed. Restoring a complete independently runnable system would additionally require the original root package/workspace manifests, dependency catalog, compatible lockfile, API server, shared API packages, database schema/migrations, and API specification/generation inputs.

The source export must exclude actual environment values, signer keys, recovery files, database exports, user uploads, and generated operational state. Only source schemas and migrations belong in a public database repository.

The focused module repositories publish real implementation libraries/contracts and tests, not just UI-route names. They retain their actual integration limits. Full integration builds, current onchain state, vulnerability audits, and upstream dependency-license review are separate from source publication.

Support and contribution contact: **support@armoreum.io**.
