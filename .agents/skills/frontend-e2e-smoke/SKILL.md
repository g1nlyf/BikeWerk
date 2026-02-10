---
name: frontend-e2e-smoke
description: Run Playwright smoke E2E tests in frontend; ensure browsers installed, run npx playwright test --project=chromium --grep @smoke, store report in frontend/test-results, summarize failing specs/selectors. Trigger when asked to run E2E or smoke tests.
---
# Frontend E2E Smoke

## Steps
1. `cd frontend`.
2. If `node_modules` missing, run `npm ci`.
3. Ensure browsers installed: `npx playwright install chromium` (idempotent).
4. Run: `npx playwright test --project=chromium --grep @smoke`.
5. After run:
   - Copy Playwright report (HTML or text) to `frontend/test-results/` (e.g., `smoke-report.html`).
   - Summarize failing tests: file, test title, first error/selector.
6. If failures look network/login related, suggest rerun with `--trace on` and save trace in same folder.

## Notes
- Tests live under `frontend/tests`; respect existing tags.
- Keep summaries concise; avoid embedding large logs unless requested.
