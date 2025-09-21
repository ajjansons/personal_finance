# Personal Finance Tracker (Phase 1)

Local-first portfolio tracker. Runs 100% in your browser (no servers, no telemetry). Store holdings across stocks, crypto, cash, real estate, and other categories. Manually enter prices, see allocation and portfolio trends, and export/import as JSON.

## Quick Start

```bash
# 1) install
npm i

# 2) run (dev)
npm run dev

# 3) build (prod)
npm run build && npm run preview
```

Open http://localhost:5173.

### Local Data Location

Data is stored in your browser’s IndexedDB under the app origin. To clear, use browser devtools → Application → Storage → Clear site data (or use Settings → Clear Data in the app).

### Export / Import

- Export: Settings → Export → downloads a JSON snapshot containing schemaVersion, holdings, pricePoints, categories, and meta.
- Import: Settings → Import → choose a previously exported JSON. Import is validated (Zod) and will not overwrite on error.

### Demo Data

Build demo seed JSON:

```bash
npm run seed:build
```

This generates `public/demo-seed.json`. Then open the app → Settings → Load Demo Data.

### Troubleshooting

- Nothing saves: ensure the browser allows IndexedDB/local storage.
- Import fails: check the error details and confirm schemaVersion matches (the importer will attempt basic migration).
- Charts blank: ensure you have price data or update today's prices.

### Scripts

- `npm run lint` — ESLint
- `npm run format` — Prettier write
- `npm run typecheck` — TypeScript
- `npm run test` — Vitest (unit + component)
- `npm run test:e2e` — Playwright (e2e smoke)
- `npm run seed:build` — produce `public/demo-seed.json` from `SEED/*`

### Accessibility & i18n

The app follows semantic markup and keyboard-accessible forms. Strings are centralized in a simple i18n utility (en-US). Currency and number formatting via `Intl.NumberFormat`.

### License

MIT (for this template).

## Live Prices & Currency

This app can optionally show live prices and a global USD/EUR toggle:

- Crypto quotes via CoinGecko
- Stock quotes via Twelve Data
- USD↔EUR FX via Twelve Data

Set API keys in your local environment (do not commit them):

```
VITE_TWELVE_DATA_KEY=your_twelve_data_key
VITE_COINGECKO_API_KEY=your_coingecko_key
```

Create `.env.local` (gitignored) or export variables in your shell. If keys are missing, the app still works with manual prices; a friendly note appears and network calls are skipped.

Notes:
- Free tiers are rate-limited. The app caches quotes/FX for ~10 minutes using React Query to stay within limits.
- Only latest quotes are fetched; no historical time-series.
- The display currency toggle affects all totals, tables, and charts. Stored data is not changed.
