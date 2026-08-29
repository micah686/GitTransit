# ADR 0004: Bitbucket Cloud only in the initial rollout

- Status: accepted
- Date: 2026-08-29

## Decision

The initial product adapter is `bitbucket-cloud`. Bitbucket Data Center is a distinct future adapter because its authentication, URLs, pagination, and feature contracts differ. The `bitbucket-data-center` identifier remains reserved in the closed provider type but is not registered or advertised.

Data Center repositories can be configured as generic Git endpoints when only Git transport is needed. The UI must ask for an edition and never infer one from a failed request.

## Consequences

GitTransit does not claim self-hosted Bitbucket inventory or metadata support in the first release. Adding it requires its own official-contract fixtures and provider matrix.
