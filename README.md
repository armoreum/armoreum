# Armoreum

Open-source application interfaces for creator protection, token launches, recovery, and registered-pair cross-chain transfers.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: Source preview](https://img.shields.io/badge/Status-Source%20preview-orange.svg)](docs/source-scope.md)

[Contracts](https://github.com/armoreum/armoreum-contracts) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Releases](https://github.com/armoreum/armoreum/releases) · [Support](mailto:support@armoreum.io)

## Release status

**This is a frontend source preview, not a complete, independently runnable application.** The supplied application archive did not include its API server, shared API packages, workspace dependency catalog, or lockfile. Those components have not been invented or replaced with simulated production behavior.

The source imports `@workspace/api-client-react` and `@workspace/api-zod` and retains `workspace:` / `catalog:` dependency references. A standalone `npm install`, full build, or complete browser test run is therefore not supported by this snapshot alone. See [source scope and missing components](docs/source-scope.md).

This release does not deploy an application, publish an npm package, deploy contracts, or change an existing service.

## What is included

- React and TypeScript application source, route pages, and reusable interface components.
- Creator authorization, recovery capsule handling, and offline recovery interfaces.
- Token launch and multichain launch interfaces.
- Registered-pair bridge interfaces, transfer tracking, and explorer views.
- Unit and browser test sources, Vite configuration, and public visual assets.

The contract implementation is maintained in [armoreum-contracts](https://github.com/armoreum/armoreum-contracts).

## Architecture

For the artifact-based seven-repository layout, source provenance, and missing runtime components, see [repository map](docs/repository-map.md). Seven source repositories do not imply a complete independently runnable system.

```text
Browser application
    ├── Shared API client and schemas       [not included]
    ├── API server and persistent state     [not included]
    ├── User-controlled wallet provider
    └── Contract interfaces
            └── armoreum-contracts
```

The application includes network-specific interfaces for Ethereum and Robinhood. Source availability is not evidence that a particular deployment, contract address, token pair, relay, or provider is currently active.

For authorization and recovery boundaries, read [architecture and security scope](docs/architecture.md) and [creator password authorization](docs/creator-password-authorization-qrc.md).

## Development

Use Node.js 24 or a compatible maintained version. The existing package scripts are preserved, but dependency-dependent commands require the missing workspace components first.

A dependency-free test can be run directly:

```sh
node --test src/lib/storage-key-migration.test.mjs
```

After restoring the original shared packages, dependency catalog, and compatible lockfile in a workspace:

```sh
pnpm install --frozen-lockfile
pnpm --dir path/to/armoreum run typecheck
pnpm --dir path/to/armoreum run build
```

`path/to/armoreum` means the application's actual directory within the restored workspace; it is not a directory supplied by this repository. Do not run the frozen-lockfile command until a reviewed lockfile exists.

The Vite development defaults are port `5173` and base path `/`. Override them with `PORT` and `BASE_PATH`. Browser-test source is in `tests/`; running it also requires the missing application dependencies and appropriate backend behavior.

## Sensitive information

Never commit live credentials, wallet private keys, seed phrases, creator passwords, recovery capsules, database contents, or customer data. Browser-visible configuration is public and must not contain secrets. Sensitive provider calls belong on a server.

A recovery capsule can contain unencrypted bearer credentials and authorization proofs. Do not attach a real capsule to an issue, pull request, release, or support email. Use synthetic fixtures only.

Generated builds, caches, private environment files, and operational deployment records are intentionally excluded. Public blockchain addresses and synthetic test hashes are not private signing keys.

## Releases and packages

GitHub Releases provide tagged source archives. `v0.1.0-source.1` is a prerelease for source review and contribution, not a production-readiness claim. This application is marked `private` in `package.json` to prevent accidental npm publication; that does not make the public GitHub source private.

## Contributing and support

Contributions are welcome through issues and pull requests. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

For general support, contact **support@armoreum.io**. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

Project-owned source is released under the [MIT License](LICENSE). Dependencies, third-party assets, names, and trademarks retain their own terms. See [NOTICE.md](NOTICE.md).
