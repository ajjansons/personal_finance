# Changelog

All notable changes to this project will be documented here.

## [0.1.0] - 2025-09-08
### Added
- Initial Phase 1 local-first SPA scaffold (React + TS + Vite).
- Dexie (IndexedDB) schema and repository pattern (local + cloud stub).
- Domain logic for valuation and aggregations.
- Dashboard with allocation (pie), category bar, and value-over-time line charts.
- Holdings and Categories CRUD UIs; manual price updates with history.
- Export/Import JSON with validation (Zod).
- Seed fixtures and seed bundler script (`seed:build`).
- Testing setup: Vitest (unit, component) and Playwright e2e smoke.
- Docs: TDD, README, CONTRIBUTING, ADRs, CODEX plan and prompts.
