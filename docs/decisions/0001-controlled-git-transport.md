# ADR 0001: Controlled Git process transport

- Status: accepted
- Date: 2026-08-29

## Decision

GitTransit owns Git-content transport through the installed `git` and optional `git-lfs` executables. Commands use argument arrays, explicit managed-ref refspecs, bounded execution, fresh observations, and per-ref `--force-with-lease` expectations. Provider adapters return endpoint descriptions but never shell commands.

HTTPS credentials are supplied through restricted askpass/credential-helper files. SSH uses a restricted wrapper, key file, and known-hosts file with strict host verification. Secrets are redacted before errors cross the process boundary and transient files are always removed.

## Consequences

This supports generic Git and avoids dependence on vendor-native mirror features. Git and LFS versions become readiness checks. A workspace is disposable cache, and destructive writes require verified bundles as defined by policy.
