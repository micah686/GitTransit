# Phase 0 verification

Phase 0 freezes the domain boundary and proves the risky mechanics before product implementation.

Run:

```sh
npm ci
npm test
npm run build
```

The Vitest suite includes:

- every row of the two-way decision table, tag rewrite handling, one-way direction, and destructive classification;
- capability, namespace precedence, and metadata-boundary contracts;
- an HTTPS/SSH credential injection and redaction probe;
- a real SQLite WAL takeover using two Node worker processes, proving that fencing rejects the stale finalizer;
- local bare repositories proving explicit-ref one-way transfer, baseline divergence detection without writes, and stale `--force-with-lease` rejection.

The Playwright scaffold is intentionally retained for Phase 1 UI behavior. Install a browser once with `npx playwright install chromium`, then use `npm run test:e2e`.
