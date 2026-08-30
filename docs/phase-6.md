# Phase 6 implementation

Phase 6 completes the destructive-write safety boundary and operational recovery path.

Destructive one-way plans are classified from their concrete ref actions. `fast-forward-only` and `never-delete` stop destructive writes, `backup-and-apply` creates and verifies a bundle before applying them, and `approve-destructive` pauses the durable run with an immutable SHA-256 plan digest. Approval resumes only the paused step. The worker re-fetches both endpoints and compares endpoint identities, expected OIDs, actions, and policy/capability generations before mutation; any difference invalidates the approval and no approved write occurs.

Verified bundles are recorded with a digest, manifest, size, protected side, creation time, and expiry. Run detail displays these artifacts. Owner-scoped retention cleanup supports preview and apply modes, retains the newest artifacts for every route, and never removes active runs, current baselines, open conflicts, or their artifacts. Restoration remains the explicit workflow documented in `restore-bundles.md`.

Startup recovery is idempotent. It fences expired claims, repairs stale `syncing` projections only when no live step owns the route, expires approvals, and removes old temporary artifact files. Push retries always re-observe remote state. Graceful shutdown stops new claims and allows the bounded current operation to finish before the worker heartbeat is marked stopped.

The scheduler now uses a database leadership lease. Readiness reports database, encryption key, writable storage, Git, worker heartbeat, and disk-pressure health. The authenticated Prometheus endpoint exposes owned queued/running/approval run counts, pending approvals, and recent worker count.
