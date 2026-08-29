# Phase 0 dependency record

Measured 2026-08-29 with npm 11.7.0 on Linux and Node 26.7.0. Versions are exact in `package.json` and integrity-pinned in `package-lock.json`. Sizes are installed, unpacked KiB from `du -sk`; they include package-local native binaries but not shared transitive packages.

| Concern            | Selection                |        Version |     Installed KiB | Reason                                                         |
| ------------------ | ------------------------ | -------------: | ----------------: | -------------------------------------------------------------- |
| Password KDF       | `@node-rs/argon2`        |          2.1.0 |                60 | Argon2id, maintained native bindings, prebuilt runtime support |
| Validation         | `valibot`                |          1.4.2 |             1,824 | Strict inferred types and small runtime API surface            |
| Database mapping   | `drizzle-orm`            |         0.45.2 |            16,984 | Typed SQL/schema without hiding SQLite behavior                |
| SQLite driver      | `better-sqlite3`         |         13.0.3 |            26,876 | Transactions and WAL semantics; supports Node 26               |
| Structured logging | `pino`                   |         10.3.1 |             1,280 | JSON logging with low runtime overhead                         |
| Cron parsing       | `croner`                 |         10.0.1 |               172 | IANA timezone and cron support with no runtime dependencies    |
| CSS/components     | Tailwind CSS + `daisyui` | 4.3.0 / 5.7.22 | 4,172 for DaisyUI | One build-time CSS system and accessible component classes     |

The complete development `node_modules` tree measured 277,304 KiB. That is not the production image budget: Phase 1 CI must measure production-only dependencies and compressed/unpacked image sizes separately.

## Rejected starting choices

- Vendor provider SDKs: platform `fetch` plus narrow REST clients keep provider response types behind adapters.
- A portable ORM abstraction: PostgreSQL is a future repository implementation, not a reason to conceal SQLite leases today.
- bcrypt/scrypt as the primary KDF: Argon2id is selected for new local credentials; parameters and version remain stored with each hash.
- Multiple CSS suites: DaisyUI is the sole component layer over Tailwind.
