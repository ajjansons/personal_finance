# Contributing

## Commit Messages
Use **Conventional Commits**:
- `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `build:`, `ci:`, `perf:`
Examples:
- `feat(holdings): add bulk price update dialog`
- `fix(repo): correct date sorting of price points`

## Branching
- `main` — stable
- `feat/<topic>` — features
- `fix/<topic>` — bug fixes

## Coding Standards
- TypeScript strict mode; no `any` (unless justified with comment).
- ESLint + Prettier must pass before PR.
- Unit tests for domain; component tests for critical UI.

## Running Quality Gates

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

## UI

Use Tailwind utility classes.

shadcn/ui components are vendored as local minimal stubs in `src/components/ui` to ensure compilation; in future, we can replace with generated shadcn components.
