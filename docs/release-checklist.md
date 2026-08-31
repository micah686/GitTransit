# Release checklist

- [ ] `npm ci && npm test && npm audit --omit=dev --audit-level=high` passes.
- [ ] Fresh install creates exactly one administrator and readiness passes.
- [ ] Upgrade from the previous release applies migrations; simulated migration failure rolls back.
- [ ] Four required example flows and the recorded provider smoke matrix pass.
- [ ] Keyboard and 320 px/desktop review from `security-review.md` is complete.
- [ ] Credential, event, plan, logs, process arguments, artifacts, and notification DTO redaction tests pass.
- [ ] Worker SIGTERM during Git and metadata work recovers without false success.
- [ ] Backup bundle restore drill and full database/key restore drill succeed.
- [ ] Container runs as 10001 with read-only root and only documented writable mounts.
- [ ] Unpacked image is at most 400 MiB; any exception is documented and approved.
- [ ] Trivy has no unaccepted HIGH/CRITICAL findings.
- [ ] SPDX SBOM, build manifest, image archive digest, and GitHub provenance attestation are attached.
- [ ] OIDC, SAML, OAuth login, and trusted-header auth remain absent from runtime routes/configuration.
- [ ] Release notes call out migrations, provider capability changes, known lossy metadata, and rollback limits.
