# GitTransit

GitTransit is a self-hosted control plane for discovering, mapping, and synchronizing repositories between independently configured Git services. The repository currently contains the completed Phase 0 contract and technical-spike foundation from [GitTransit_Plan.MD](./GitTransit_Plan.MD).

## Project scaffold

The project was generated with the official Svelte CLI (the successor to `create-svelte`) using strict TypeScript, adapter-node, Vitest, Playwright, Tailwind CSS, and DaisyUI. To recreate the initial scaffold:

```sh
# recreate this project
npx sv@0.17.0 create --template minimal --types ts --add prettier eslint vitest="usages:unit" playwright tailwindcss="plugins:none" sveltekit-adapter="adapter:node" --no-download-check --install npm .
```

## Development

Install the exact lockfile and run all Phase 0 checks:

```sh
npm ci
npm test
npm run build
```

Start the development server with:

```sh
npm run dev
```

The risk-focused spike suite and its guarantees are documented in [docs/phase-0.md](./docs/phase-0.md). Architecture decisions live in [docs/decisions](./docs/decisions), and the pinned dependency rationale/size record is in [docs/architecture/dependency-record.md](./docs/architecture/dependency-record.md).

## Commands

- `npm run check` — strict Svelte and TypeScript diagnostics, failing on warnings
- `npm run lint` — formatting plus ESLint with zero warnings allowed
- `npm run test:unit` — unit and local integration spikes
- `npm run test:e2e` — scaffolded Playwright browser tests
- `npm run build` — adapter-node production build with Rollup warnings treated as errors

Node 26.7.0 and npm 11.7.0 are the pinned minimum toolchain for this Phase 0 snapshot.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
