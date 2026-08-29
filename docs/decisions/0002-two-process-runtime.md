# ADR 0002: Web and worker processes with SQLite fencing

- Status: accepted
- Date: 2026-08-29

## Decision

The deployment uses one adapter-node web process and one independently started worker from the same build/image. The worker is never started from SvelteKit hooks. SQLite runs in WAL mode with foreign keys, a busy timeout, atomic claims, expiring leases, and monotonically increasing fencing tokens.

Every final job mutation includes the worker identity and fencing token. An expired worker cannot record success or advance a baseline after another worker claims the work.

## Consequences

The initial deployment needs no Redis. Operators must supervise both entry points and persist the database/work/backup roots. Additional workers remain disabled until contention and rate-limit suites pass.
