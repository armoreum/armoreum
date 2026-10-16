# Contributing to Armoreum

Contributions are welcome. Use issues for reproducible bugs and focused feature proposals, and pull requests for reviewable changes.

## Before starting

Read the README, [source scope](docs/source-scope.md), [security policy](SECURITY.md), and [Code of Conduct](CODE_OF_CONDUCT.md). Full application builds require workspace packages that are not included in this source preview.

For significant architectural or security changes, open an issue first. Do not post vulnerabilities publicly; email support@armoreum.io instead.

## Pull request workflow

1. Fork the repository and create a focused branch from `main`.
2. Make one coherent change. Keep product copy and documentation in English.
3. Add or update synthetic tests. Never use real wallet keys, recovery capsules, customer data, or production secrets.
4. Run the checks available in your environment and record the exact commands and results.
5. Open a pull request explaining the problem, solution, tests, limitations, and any compatibility impact.

For UI changes, include screenshots at phone and desktop widths and check keyboard navigation, labels, focus states, and error handling. Do not include sensitive screens or real user information.

## Available checks

```sh
node --test src/lib/storage-key-migration.test.mjs
```

Type checking, bundling, dependency audit, and browser tests must also be run when the missing workspace has been restored. Do not claim they passed when they were unavailable.

## Review expectations

Keep changes small, preserve public API compatibility when possible, and document security implications. Contract changes belong in https://github.com/armoreum/armoreum-contracts.

Contributions must be your own work or properly licensed. By submitting code, you agree to license your project-owned contribution under this repository's MIT License. Preserve required third-party notices.

General support: support@armoreum.io.
