# ADR 0002 — Charting Library

## Context
We need basic charts (pie, line, bar), responsiveness, accessibility hooks.

## Decision
Use **Recharts**.

## Consequences
- Declarative API fits React.
- Acceptable bundle size for 3 chart types.
- Easy responsive containers and tooltips.

## Alternatives Considered
- Chart.js: great defaults; adapters required for React.
- Visx: lower-level primitives; more code.
- ECharts: powerful but heavier.
