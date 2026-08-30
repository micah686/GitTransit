# Phase 1 implementation

Phase 1 adds the SvelteKit web foundation and local identity boundary:

- SQLite migrations for users, opaque sessions, and login throttles
- atomic first-administrator creation, Argon2id hashes, role-aware safe user data, login/logout, and protected route groups
- AES-256-GCM credential encryption with deployment-key validation and owner/credential associated data
- runtime configuration for base URL, data paths, encryption key, logs, and Git
- mobile-first authenticated shell, accessible navigation, setup/login pages, and an empty dashboard
- sanitized health/readiness routes, security headers, request IDs, structured redacted logs
- unit, integration, and Playwright coverage plus a nonroot multi-stage image and CI scanning

Generate a deployment key with `openssl rand 32 > credential.key` and restrict it to mode `0600`. Mount it at the configured `GITTRANSIT_ENCRYPTION_KEY_FILE`; GitTransit never stores this key in SQLite.

The runtime user is numeric UID/GID `10001`. Only `/data/db`, `/data/work`, `/data/backups`, and `/data/secrets` are declared writable/mounted. Configure `GITTRANSIT_BASE_URL` at build and runtime when deploying below a path prefix because SvelteKit compiles its asset base into the build.
