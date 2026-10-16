# Cross-repository source inventory

## Conclusion

Two source repositories have been published because the supplied archives contain exactly two package manifests. That is an archive boundary, not proof that the system is complete or that two repositories are the final architecture.

A second inventory found additional server and shared-package dependencies. The supplied overview also describes database and OpenAPI responsibilities. A seven-area repository layout is a reasonable proposed target, but the evidence does not establish that seven original standalone packages already exist.

No empty repository or speculative implementation has been created to represent missing source.

## Proposed repository layout

The first two names are existing public repositories. The other five names are proposed publication boundaries, not existing repositories or recovered implementations.

| Repository / proposed repository | Responsibility | Source evidence | Publication status |
| --- | --- | --- | --- |
| `armoreum` | React application, routes, wallet interfaces, authorization/recovery UI, launch interfaces, bridge and explorer views | Frontend archive and its package manifest | Published source preview; not independently buildable |
| `armoreum-contracts` | Core vaults, receipt tokens, factories, tax routing, bridge/relay contracts, V4 hooks, local fixtures, deployment/test scripts | Contract archive and its package manifest | Published source preview; production readiness not established |
| `armoreum-api` | Express routes, password-derived seed service, launch orchestration, indexing, fee jobs, verification, bridge provisioning and reconciliation | Overview describes these services; relay activation script imports an API-server policy file | Server implementation absent |
| `armoreum-api-client` | Generated React API hooks, query keys, and API data types | Application imports `@workspace/api-client-react`; original TypeScript project references its sibling package | Client package source absent |
| `armoreum-api-schemas` | Shared Zod contracts, network configuration, launch modes, presets, public integration constants | Application imports `@workspace/api-zod`; launch-mode operator script reads its `network-config.ts` | Schema/configuration package source absent |
| `armoreum-database` | Schema, migrations, database access, durable job and transfer state | Overview describes PostgreSQL persistence; no package manifest or schema source was supplied | Responsibility documented; a separate original package is not confirmed |
| `armoreum-api-spec` | OpenAPI contract and code-generation inputs/configuration for clients and validation schemas | Overview describes OpenAPI/generated libraries; no specification or generator configuration was supplied | Responsibility documented; a separate original package is not confirmed |

Database schema and OpenAPI inputs might live inside another original package. Their final repository boundaries should be confirmed from the complete source workspace, rather than inferred from a description.

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

The counts above describe the first source-preview commit. This follow-up adds inventory documentation; it does not recover the missing server, schemas, client, database source, or API specification.

## Remaining completion work

Obtain the complete original workspace source before splitting and publishing the remaining repositories. It should include the root package/workspace manifests, dependency catalog, compatible lockfile, API server, shared API packages, database schema/migrations, and API specification/generation inputs.

The source export must exclude actual environment values, signer keys, recovery files, database exports, user uploads, and generated operational state. Only source schemas and migrations belong in a public database repository.

After obtaining the source, confirm real package boundaries, repair cross-repository imports/build configuration, inspect dependency licenses and audit results, run package-specific tests, and only then create source-backed repositories and versioned releases. Product modules such as recovery, bridging, and launching should not be counted as independent packages merely because they have separate UI routes.

Support and contribution contact: **support@armoreum.io**.
