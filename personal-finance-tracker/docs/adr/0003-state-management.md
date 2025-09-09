# ADR 0003 — State Management

## Context
We need async data fetching/caching and minimal global UI state.

## Decision
- **React Query** for repository calls (even though local) to standardize future HTTP migration.
- **Zustand** for small UI preferences (theme, currency, compact mode).

## Consequences
- Clean separation between server/cache data and UI prefs.
- Easy invalidation on mutations; minimal boilerplate.

## Alternatives Considered
- Redux Toolkit: more ceremony than needed here.
- Context only: acceptable but requires custom caching and invalidation.
