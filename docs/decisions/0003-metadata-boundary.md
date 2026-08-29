# ADR 0003: One-way, capability-gated forge metadata

- Status: accepted
- Date: 2026-08-29

## Decision

Forge metadata is separate from Git reconciliation. Components are independently `off`, `on`, or `required`, execute in dependency order, and use provider-specific adapters plus durable provenance mappings. Unsupported optional content produces a warning; unsupported required content fails the route.

Two-way Git does not imply two-way metadata. Metadata stays disabled unless side A is explicitly confirmed as the authority, in which case it flows A to B only.

## Consequences

Retries can checkpoint per component without duplicating earlier items. Lossy conversions are visible. The schema may reserve identities and tombstones for future work, but alternating one-way copies are prohibited.
