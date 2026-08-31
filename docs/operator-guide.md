# GitTransit operator guide

## Installation

Build the image from `app/` and run the web and worker processes from the same image. Both processes must share `/data/db`, `/data/work`, `/data/backups`, and `/data/secrets`. Generate the encryption key before first start:

```sh
install -d -m 0700 data/secrets
openssl rand 32 > data/secrets/credential.key
chmod 0600 data/secrets/credential.key
docker build -t gittransit:local app
```

Run `node build` for the web process and `node worker-build/main.js` for the worker. Publish web port 3000 only; the worker has no listener. Set `GITTRANSIT_BASE_URL` during build and runtime when serving under a path prefix. Behind a reverse proxy, set adapter-node `ORIGIN` to the exact public origin and configure forwarded host/protocol headers according to the adapter-node documentation.

The image runs as UID/GID 10001. Use a read-only root filesystem and writable mounts only for the four declared `/data` paths plus a bounded temporary filesystem.

## Credentials and scopes

Use one least-privilege credential per connection. Source credentials need repository/metadata read access; targets need repository creation only when provisioning is enabled, Git push, and writes for explicitly enabled metadata. GitTransit encrypts credentials at rest and never displays stored values. Rotate credentials by replacing them in the connection screen, then test the connection before the next run.

GitHub tokens normally need repository contents and selected issues/releases permissions. GitLab tokens need `read_api`/`read_repository` for sources and API/repository write access for targets. Gitea and Forgejo tokens need repository read/write plus organization creation only when requested. Bitbucket Cloud requires repository and pull-request/issue scopes matching enabled components. Provider editions can narrow capabilities after probing; the UI result is authoritative.

## Internal TLS and network policy

Install private CA roots in the container trust store or mount a PEM bundle and set `NODE_EXTRA_CA_CERTS=/data/secrets/internal-ca.pem` before Node starts. Readiness verifies that configured file is readable. Never disable TLS verification globally. Connection URLs must not embed credentials. Private-network targets and insecure HTTP notification endpoints require an explicit per-record opt-in; use insecure HTTP only on a trusted isolated network.

## Backup and restore

Back up the SQLite database, encryption key, and `/data/backups` together. Losing the key makes encrypted credentials and notification secrets unrecoverable. Pause scheduling or stop the worker, checkpoint SQLite with `PRAGMA wal_checkpoint(TRUNCATE)`, then copy the database and key with restrictive permissions. Restore all files to the same paths and ownership before starting the web process, then worker. Verified Git bundle restoration is documented in [restore-bundles.md](restore-bundles.md).

## Upgrades

1. Back up the database, key, and artifacts.
2. Stop the worker, then web process.
3. Pull/build the new image and retain the previous image tag.
4. Start the web process once; startup applies migrations transactionally.
5. Verify `/health` and `/ready`, then start the worker.
6. Test one connection and run one non-destructive route.

If startup migration fails, the migration transaction rolls back. Return to the previous image and database backup; never manually mark a migration complete. Application downgrades after a successful schema upgrade are unsupported unless the release notes explicitly permit them.

## Notifications

ntfy accepts a topic URL and optional access token. Apprise accepts its stateless API notification URL and optional bearer token. Gotify requires the server base URL and application token. Signed webhooks use `HMAC-SHA256(secret, timestamp + "." + raw_body)` and send `X-GitTransit-Timestamp`, `X-GitTransit-Signature`, `X-GitTransit-Event`, and `X-GitTransit-Delivery`. Consumers should reject timestamps older than five minutes and deduplicate delivery IDs.

Notification delivery is an independent durable outbox. A notification outage never changes a mirror result. Failed deliveries retry up to five times and remain visible in settings.

## Troubleshooting

- `403 Cross-site POST`: use one browser-visible hostname and set `ORIGIN` only when a proxy prevents host inference.
- Readiness failure: verify the SQLite path, writable data directories, Git executable, key length, and key mode `0600`.
- Provider unauthorized/forbidden: test the connection and compare required scopes with enabled components.
- Stuck run: check worker heartbeat/readiness; interrupted leases are recovered on worker startup.
- Disk pressure: preview retention cleanup, preserve required bundles, and expand `/data/backups` before resuming destructive policies.
- Notification failure: test the endpoint, inspect its safe error code, and verify outbound DNS/TLS without placing secrets in logs.

## Supported identity boundary

The release supports local email/password identity only. OIDC, SAML, OAuth login, and trusted-header authentication have no active routes or configuration switches; their future seam is documented in [future-auth.md](future-auth.md).
