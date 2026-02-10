---
name: backend-integration-test
description: Run backend Mocha integration suite for eubike; ensure deps, execute npm test in backend, capture failing output to backend/test-outputs/latest.txt, summarize failures and likely causes when tests fail. Trigger when asked to run backend tests or validate parsers.
---
# Backend Integration Test

## Steps
1. `cd backend`.
2. If `node_modules` missing, run `npm ci` (fail fast on error).
3. Run `npm test` (Mocha entry is `tests/integration/full-system-test.js`).
4. On failure:
   - Capture full console output to `backend/test-outputs/latest.txt`.
   - Extract failing test titles and errors; summarize likely causes (network to Buycycle/Klein, missing env vars, DB path).
5. On success: report pass and runtime.
6. Always surface next actions (rerun with `DEBUG=*` or with `--grep <name>` for flake isolation).

## Notes
- Tests may hit live sites; ensure network allowed or mock.
- DB path defaults via `.env`; verify before running destructive scripts.
