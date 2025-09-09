# ADR 0001 — Local Database Choice (IndexedDB via Dexie)

## Context
We need persistent local-first storage with good browser support, indexing, and schema versioning.

## Decision
Use **IndexedDB** through **Dexie**. Dexie provides a friendly API, transactions, and versioned schemas.

## Consequences
- Fast client-side persistence without servers.
- Simple migration path: bump Dexie version for schema changes.
- For Cloud phases, swap repository implementation to HTTP without UI/domain changes.

## Alternatives Considered
- LocalStorage: insufficient capacity, no indexing.
- WebSQL: deprecated.
- PouchDB: heavier and sync-focused; our Phase 1 scope is simpler.
