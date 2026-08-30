# Phase 5 implementation

Phase 5 turns discovered provider inventory into an executable one-way product.

The pair wizard negotiates credential-observed capabilities, applies selection and namespace policy, and previews create/reuse/manual/collision outcomes without calling a mutating provider operation. Saving persists the policy and upserts route proposals while preserving route-level overrides.

Target provisioning is provider-neutral and idempotent: the worker searches for the planned canonical path before calling `createEmpty`, then persists the provider-returned stable identity and Git endpoints transactionally. Generic Git and adapters without repository administration are blocked with a pre-creation instruction. Existing named endpoints are revalidated before sync; only an explicit provider not-found result marks a route missing. An incomplete discovery merely changes inventory entries to `not-observed` and never treats omission as deletion.

Pair execution creates separately leaseable route jobs, enforces the saved batch size and route-concurrency budget, avoids overlapping pair work, and honors retry limits. The worker scheduler advances enabled due pairs before enqueueing work. Duration and timezone-aware cron schedules persist their next UTC instant.

The authenticated UI now includes:

- responsive desktop/mobile pair cards and explicit one-way/two-way labels
- a staged pair wizard with dry-run mapping results
- pair detail, inventory refresh, enable/pause, and manual-run controls
- URL-filtered repository inventory with owner-authorized bulk runs
- repository endpoint detail and run step timelines

Two-way pairs can be modeled and capability-previewed, but execution remains intentionally blocked until the Phase 7 reconciliation engine is present.
