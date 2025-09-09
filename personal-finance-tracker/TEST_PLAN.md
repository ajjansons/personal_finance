# Test Plan

## Unit Tests
- **valuations.test.ts**: verifies `marketValue = units * pricePerUnit`, allocation %, total value.
- **aggregations.test.ts**: verifies category/type groupings and time series sum logic.

## Component Tests
- **holdingsTable.test.tsx**: renders table with sample holdings; verifies totals and edit buttons presence.

## e2e (Playwright)
- **basic.spec.ts**:
  - Opens app (http://localhost:5173).
  - Navigates to Holdings.
  - Adds a simple holding.
  - Verifies row appears.

## Commands
```bash
npm run test          # unit + component (vitest)
npm run test:e2e      # playwright
```

## Environments

- Vitest: jsdom with @testing-library/jest-dom.
- Playwright: dev server on port 5173 with reuse.

