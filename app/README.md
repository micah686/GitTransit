# GitTransit

GitTransit is a self-hosted control plane for discovering, mapping, and synchronizing repositories between independently configured Git services. The repository contains the Phase 0 contract foundation, Phase 1 local-authenticated shell, and Phase 2 durable control-plane core from [GitTransit_Plan.MD](../GitTransit_Plan.MD).

## Project scaffold

The project was generated with the official Svelte CLI (the successor to `create-svelte`) using strict TypeScript, adapter-node, Vitest, Playwright, Tailwind CSS, and DaisyUI. To recreate the initial scaffold:

```sh
# recreate this project
npx sv@0.17.0 create --template minimal --types ts --add prettier eslint vitest="usages:unit" playwright tailwindcss="plugins:none" sveltekit-adapter="adapter:node" --no-download-check --install npm .
```

## Development

Install the exact lockfile and run all checks:

```sh
npm ci
npm test
npm run build
```

Start the development server with:

```sh
npm run dev
```

On a fresh database, open `/setup` and create the first administrator. Development data defaults to `.gittransit/`. Readiness additionally requires a 32-byte, mode-`0600` key at `.gittransit/secrets/credential.key`, or a path supplied through `GITTRANSIT_ENCRYPTION_KEY_FILE`.

The risk-focused spike suite is documented in [Phase 0](../docs/phase-0.md), the runtime/security contract in [Phase 1](../docs/phase-1.md), and durable jobs/events/providers in [Phase 2](../docs/phase-2.md). Architecture decisions live in [docs/decisions](../docs/decisions).

## Commands

- `npm run check` — strict Svelte and TypeScript diagnostics, failing on warnings
- `npm run lint` — formatting plus ESLint with zero warnings allowed
- `npm run test:unit` — unit and local integration spikes
- `npm run test:e2e` — isolated Playwright setup/auth/responsive tests
- `npm run build` — adapter-node production build with Rollup warnings treated as errors
- `npm start` — run the compiled web process
- `npm run start:worker` — run the separately compiled durable worker
- `npm run audit` — production dependency vulnerability audit

## Runtime configuration

Phase 1 accepts `GITTRANSIT_BASE_URL`, `GITTRANSIT_DATABASE_URL`, `GITTRANSIT_DATA_DIR`, `GITTRANSIT_ENCRYPTION_KEY_FILE`, `GITTRANSIT_LOG_LEVEL`, and optional `GITTRANSIT_GIT_PATH`. Supply a path-prefixed `GITTRANSIT_BASE_URL` during both build and runtime because SvelteKit compiles the asset base into the build.

Deployment, credentials, internal TLS, backup/restore, upgrades, notifications, and troubleshooting are documented in the [operator guide](../docs/operator-guide.md). Release security evidence and manual checks are defined in [security-review.md](../docs/security-review.md) and [release-checklist.md](../docs/release-checklist.md).

Node 26.7.0 and npm 11.7.0 are the pinned minimum toolchain for this Phase 0 snapshot.

The production image runs as numeric UID/GID `10001` and declares only `/data/db`, `/data/work`, `/data/backups`, and `/data/secrets` writable.
