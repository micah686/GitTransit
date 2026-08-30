# Phase 2 implementation

Phase 2 establishes the durable control-plane core:

- versioned SQLite migrations for connections, encrypted credentials, discovery inventory, pairs, routes/endpoints, runs/steps, events, leases, baselines/observations, conflicts, artifacts, metadata mappings, rate limits, and worker heartbeats
- owner-scoped repositories and immediate transaction helpers
- ordered durable steps with atomic claims, database-time leases, fencing tokens, checkpoints, heartbeats, bounded retry, cooperative cancellation, idempotent enqueue, and startup recovery
- a separately compiled worker process with graceful shutdown and readiness heartbeats
- owner-scoped cursor events, resumable SSE with heartbeat/cursor-expiry handling, and per-tab client cursors that invalidate canonical resources without consuming events
- narrow provider, Git, and metadata contracts, a registry, a deterministic fake forge, and a generic Git skeleton
- responsive connection list/create/edit/test screens with encrypted credentials that are returned only as masked hints

## Processes

Build both entry points with `npm run build`. Run the web process with `npm start` and the worker with `npm run start:worker`. They share the configured SQLite database and data root, but the worker is never started from SvelteKit hooks.

The worker performs startup recovery before claiming work. Every checkpoint and finalization verifies the current worker ID, fencing token, and unexpired database-time lease. An interrupted push-oriented handler must still observe remote state before continuing; Phase 3 supplies those Git handlers.

The `fake` adapter exists to exercise Phase 2 connection and provider contracts without network access. The `generic-git` adapter defines manual endpoint capabilities, while actual `ls-remote`, credential injection, and synchronization arrive in Phase 3.
