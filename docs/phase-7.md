# Phase 7 implementation

Phase 7 adds true two-way Git reconciliation. A route now has an explicit initialization marker in addition to per-ref A/B baselines, so an empty repository cannot be confused with an uninitialized route.

The worker observes both remotes and durably records the observations and immutable plan before writing. It evaluates every managed ref against its last successful baseline. A-only and B-only changes propagate in the correct direction, common descendants converge, and divergence, delete/modify, and incompatible tag changes create durable conflicts without modifying either endpoint. Initial routes support require-equality, seed A to B, seed B to A, and manual-conflict modes.

Two-sided execution uses expected-OID leases on every ref. Non-destructive groups run before destructive groups, every side receiving a destructive change gets a verified bundle, and both remotes are observed again before success. A second-host or LFS failure after a first-host write records an explicit partial result. A later run plans from actual remote state rather than replaying the old plan.

Baseline rows, route initialization, run success, route status, and conflict completion are finalized in one fenced database transaction. A failed, partial, conflicted, cancelled, stale, or policy-generation-mismatched worker can never advance the baseline.

The conflict queue and detail screen show baseline/current OIDs and provider identities. Side A, Side B, a reachable specified commit, keep-both under a new branch, and externally resolved outcomes create a new run with fresh observations; destructive outcomes still pass through Phase 6 approval and backup policy. Conflict and partial events provide the notification seam used by the later notification adapters.

Two-way LFS follows the direction of propagated refs. Readiness requires `git-lfs` whenever an enabled pair configures LFS as required.
