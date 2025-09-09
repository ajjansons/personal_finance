# Codex Execution Plan (Idempotent)

1. **Bootstrap**  
   Create config files (package.json, tsconfig, vite config, eslint, prettier, tailwind/postcss, gitignore, env example), index.html, base README.

2. **Domain & Types**  
   Add `src/lib/repository/types.ts`, `src/lib/calculations.ts`, `src/lib/validation.ts`, `src/lib/constants.ts`.

3. **Dexie Repository**  
   Add `src/lib/db.ts`, `src/lib/repository/dexieRepository.ts`, `src/lib/repository/index.ts` and cloud stub.

4. **State & Hooks**  
   Add React Query client, Zustand UI store, hooks for holdings, categories, prices.

5. **UI Shell & Routing**  
   Create `main.tsx`, `App.tsx`, `router.tsx`, layout components.

6. **Pages & Components**  
   Holdings/Categories/Settings/Dashboard pages and simple forms, tables, charts.

7. **Export/Import + Demo Seed**  
   Implement export/import module + Settings wiring; add seed fixtures and seed bundler script.

8. **Tests**  
   Vitest setup + unit & component tests; Playwright config + e2e smoke.

9. **Docs & ADRs**  
   TDD, ADRs, CONTRIBUTING, CHANGELOG, CODEX prompts.

10. **Verification**  
   Run: `lint`, `typecheck`, `test`, `test:e2e`.
