# Phase 9 hardening review

## Threat model summary

Trust boundaries are the browser session, reverse proxy, SQLite/data volumes, worker process, Git subprocesses, provider APIs, notification endpoints, and artifact consumers. Primary threats are cross-tenant access, CSRF/XSS, SSRF, credential disclosure, command injection, stale-worker writes, remote ref races, malicious repository names/content, webhook replay, and destructive recovery mistakes.

Controls reviewed:

- Owner IDs are required in application queries and mutation predicates; admin maintenance is role-gated in UI and API.
- SvelteKit origin checks remain enabled. CSP uses generated script hashes, forms are same-origin, frames are denied, and sensitive responses are not embedded.
- Provider and notification URLs reject embedded credentials; notification HTTP requires explicit opt-in and redirects are rejected.
- Credentials and notification secrets use AES-256-GCM with owner/resource-bound associated data. Safe views expose no ciphertext or plaintext.
- Git commands use fixed binaries, argument arrays, bounded environments/timeouts, restricted credential files, strict SSH host verification, and redaction.
- Ref writes use leases/expected OIDs, destructive plans are immutable, and stale fencing tokens cannot finalize state.
- Signed webhooks cover timestamp plus exact body and include an idempotent delivery ID. Receiver replay-window enforcement is documented.
- Notification failures are isolated in their outbox and cannot alter mirror success.
- The container is nonroot and final stages exclude source/tests/dev dependencies. CI scans the image and emits an SBOM and provenance evidence.

Residual risks: private-network provider access is intentionally powerful; operators must isolate the deployment. Provider APIs can change independently and remain covered by deterministic contracts plus opt-in smoke tests. Release asset transfer preserves source references when native binary semantics are incompatible and reports that loss.

## Accessibility and responsive review

All primary actions use native links, buttons, labels, fieldsets, and forms. Alerts have semantic roles, navigation controls have accessible names, focus remains browser-native, color is not the only status signal, and layouts collapse to cards without fixed page width. The release browser suite exercises setup/authentication and 320 px navigation. Manual release review must keyboard-test pair creation, connection editing, conflict resolution, approvals, notifications, maintenance, and run inspection at 320 px and desktop widths with light/dark/high-contrast preferences.

## Secret-redaction review

Secrets are absent from URL fields, event payloads, plans, artifact manifests, safe endpoint DTOs, and structured request logs. Logger redaction covers authorization, cookies, passwords, tokens, credentials, signing secrets, and private keys. Provider and notification errors expose stable categories/status only and do not consume response bodies in error messages.
