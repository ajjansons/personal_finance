# Goal
Provide demo fixtures and bundler script to produce `public/demo-seed.json`.

# Files
- `SEED/*.json`
- `scripts/build-seed.mjs`
- `public/demo-seed.json` (generated)
- `src/components/settings/DemoDataButton.tsx`

# Acceptance
```bash
npm run seed:build && npm run dev
```

Settings → Load Demo Data imports the demo.
