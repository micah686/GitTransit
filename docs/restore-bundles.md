# Restoring a GitTransit bundle

GitTransit creates a verified Git bundle before a policy-approved destructive write. Bundles live below the configured data directory in `backups/<route-key>/`; the database `backup_artifacts` row records the SHA-256 digest, route, run, protected side, and relative path.

Restoration is deliberately an operator action. Stop or pause the affected pair, identify the artifact from the run, and verify it before changing a remote:

```sh
git bundle verify /data/backups/<route-key>/<run-key>-b.bundle
git clone --mirror /data/backups/<route-key>/<run-key>-b.bundle restored.git
git --git-dir=restored.git show-ref
```

Review the refs and current remote state. To restore one approved ref with a lease, use its object ID from the bundle and the currently observed remote object ID:

```sh
git --git-dir=restored.git push \
  --force-with-lease=refs/heads/main:<current-remote-oid> \
  <target-url> <bundle-oid>:refs/heads/main
```

Never use `push --mirror` for a forge repository: bundles can contain refs that the provider owns. Restore only reviewed `refs/heads/*` and `refs/tags/*` refspecs. Re-run GitTransit preview afterward so its next execution observes the restored reality.
