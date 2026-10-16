# Source scope

## Included

This source preview contains the supplied frontend source, public assets, tests, and relevant frontend documentation. The companion smart-contract source is published separately at https://github.com/armoreum/armoreum-contracts.

## Missing dependencies

The archive did not contain:

- The API server implementation, persistent-state schema, or migrations.
- The implementation of `@workspace/api-client-react`.
- The implementation of `@workspace/api-zod`.
- The workspace manifest, dependency catalog, or lockfile.
- The complete documentation tree referenced by the separate historical project overview.

The package manifest retains the existing workspace dependencies rather than replacing them with speculative API schemas. Catalog versions cannot be resolved independently from this snapshot.

The original overview is not republished verbatim because its live-status statements and references to absent evidence documents cannot be established by this source archive. The public architecture guide summarizes the implementation without asserting a current live deployment.

## Excluded publication material

Generated browser bundles, build caches, environment values, platform-specific editor configuration, credentials, recovery files, and operational deployment records are not distributed in this source release. The archive did not include Git history.

## Verification limits

A source-publication check is not a production-readiness review. Full type checking, application compilation, dependency audit, API authorization tests, and end-to-end browser behavior remain blocked by the missing workspace components. The release must not be described as an independently runnable full-stack application.
