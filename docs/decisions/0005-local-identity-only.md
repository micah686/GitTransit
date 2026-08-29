# ADR 0005: Local identity only for the first release

- Status: accepted
- Date: 2026-08-29

## Decision

The first release uses local email/password users, explicit admin/member roles, and opaque database sessions containing only a hash of the browser token. Argon2id is the password KDF. Every application service receives an explicit authenticated actor ID.

The internal auth-provider contract and inactive `authExtensionConfig` namespace are extension seams only. OIDC, SAML, OAuth, and trusted-header routes or controls are not created.

## Consequences

First-user creation and setup closure must be one transaction. A later identity provider must integrate behind the existing guard/session boundary instead of replacing ownership checks.
