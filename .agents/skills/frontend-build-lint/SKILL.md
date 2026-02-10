---
name: frontend-build-lint
description: Run frontend lint and build for eubike Vite/React; ensure deps, execute npm run lint then npm run build in frontend, summarize errors with file paths and fixes. Trigger when asked to verify frontend or before PR.
---
# Frontend Lint & Build

## Steps
1. `cd frontend`.
2. If `node_modules` missing, run `npm ci`.
3. Run `npm run lint` (ESLint).
4. Run `npm run build` (Vite).
5. On any failure:
   - Save combined stdout/stderr to `frontend/test-results/lint-build.log`.
   - List top offending files and rules.
   - Suggest concise fixes (imports, types, unused vars, tailwind issues).
6. On success: report pass and build time; note output dir `frontend/dist`.

## Notes
- Uses React 19 + Vite 7; TypeScript strictness per project config.
- Ensure `NODE_ENV` not set to production unless intended; build is side-effect free.
