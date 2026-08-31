# Phase 9 completion

Phase 9 adds encrypted ntfy, Apprise, Gotify, and HMAC-signed webhook endpoints backed by an owner-scoped durable outbox. Delivery retries and failures are independent from mirror outcomes. Retention cleanup now has configurable dry-run/apply controls, admin enforcement, and audit history.

Release hardening is captured in the operator guide, security/accessibility/redaction review, provider smoke matrix, and release checklist. CI enforces a 400 MiB unpacked image ceiling, scans the final image, generates an SPDX SBOM and build manifest, and attests non-PR image archives. Fresh migration and transaction rollback are tested.
