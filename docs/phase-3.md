# Phase 3 implementation

Phase 3 adds an executable generic Git path:

- controlled, timeout-bounded Git subprocesses with argument arrays and redacted output
- deterministic route object caches plus isolated per-attempt control directories
- managed branch/tag inventory, namespaced fetches, local ancestry checks, immutable one-way plans, explicit refspec pushes, per-ref force-with-lease checks, and post-push verification
- scoped HTTPS token/basic credential helpers and SSH key/known-host wrappers with strict host verification
- generic endpoint preview and manual one-way route mapping between two different connection records
- durable `sync-one-way` worker steps whose mutation boundary checks the current database fencing token
- optional Git LFS detection and ref-scoped object transfer
- linked-route primitives for separately mapped wiki repositories
- verified SHA-256 Git bundle artifacts before policy-required destructive writes

Generic Git never provisions a target repository. The pair screen verifies that both entered endpoints exist, explains that the target must be pre-created, and previews all managed-ref actions without modifying either remote. Saving creates a ready route; running it queues work for the separately deployed worker.

The default managed set is `refs/heads/*` and `refs/tags/*`. Pushes are built exclusively from planned refspecs; GitTransit does not use `push --mirror`. A remote change after observation causes force-with-lease to reject the push, and a stale worker cannot cross the mutation boundary or finalize the route as synchronized.

See [restore-bundles.md](restore-bundles.md) for the explicit artifact verification and restoration workflow.
