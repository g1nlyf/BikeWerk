# CRM Autofix Plan (CRMtest4)

Date: 2026-02-07
Source report: `docs/CRMtest4.txt`
Scope: CRM manager flows in frontend + backend API persistence

## Session 5 linkage checklist (`docs/CRMtest5.txt`, `docs/Booking_CRM_Audit.md`)

- [x] A) Leads endpoint hardening (PATCH/PUT `/api/v1/crm/leads/:id`) with status enum, ID validation, 400/404/503 responses.
- [x] A) Added verifier script for lead endpoint behavior (`backend/scripts/verify-crm-leads-endpoint.js`).
- [x] B) Image resilience: hardened same-origin proxy + safe static `/images` serving + CRM snapshot-first image rendering.
- [x] B) Kanban/order cards show graceful fallback + archived bike label when image is unavailable.
- [x] C) Booking snapshot durability: normalized snapshot persisted on order create (`main_photo_url`, `images[]`, `external_bike_ref`, `bike_url`, `bike_id`, pricing fields).
- [x] D) Dashboard stats updated: awaiting manager includes pending leads/orders; conversion returns `N/A` when insufficient data.
- [x] Additional console hygiene: added missing manifest icons (`android-chrome-192x192.png`, `android-chrome-512x512.png`).
- [x] E) Supabase package prepared only (not applied): `docs/supabase_migrations/crm_linkage.sql` + `backend/scripts/backfill_cached_images.js` (dry-run default).

## Checklist from report

- [x] 1. Tasks: deleting one task must not clear the whole list.
- [x] 2. Order detail: price must be editable and persisted.
- [x] 3. Order detail: shipment/provider/tracking must be saved and shown after refresh.
- [x] 4. Order detail: status change must persist after refresh.
- [x] 5. Orders list search must find existing bikes/orders (example: "Santa").
- [x] 6. Tasks created from order pages must appear in global tasks page.
- [x] 7. Dashboard urgent task links must not render `undefined`.
- [x] 8. Customer detail stats must show correct `Total orders`.
- [x] 9. Customer detail stats must show `Total spent`.
- [x] 10. Dashboard "Orders last week" chart must show real data.
- [x] 11. Dashboard conversion should be meaningful (not misleading 0% with data).
- [x] 12. Kanban cards should show bike image preview when available (not always "No image").
- [x] 13. UX request: add explicit quick contact action (WhatsApp/Telegram) on order/customer flow.

## Suspected root causes and code targets

1) Tasks list wipe after delete
- Suspected cause: frontend state replacement from DELETE response shape mismatch, or optimistic update bug.
- Frontend targets: `frontend/src/pages/crm/tasks/TasksPage.tsx`, `frontend/src/api/crmManagerApi.ts`.
- Backend targets: task delete endpoint in `backend/src/routes/v1/modules/crm.ts` and `backend/server.js` route overlays.

2) Price not editable / not persisted
- Suspected cause: read-only field in order detail or missing PATCH endpoint wire-up.
- Frontend targets: `frontend/src/pages/crm/orders/OrderDetailPage.tsx`, `frontend/src/api/crmManagerApi.ts`.
- Backend targets: order update endpoints in `backend/src/routes/v1/modules/crm.ts` and/or `backend/server.js`.

3) Shipment/tracking not persisted
- Suspected cause: create shipment request uses wrong order id key or backend stores by different id column (`id` vs `order_code` vs `old_uuid_id`).
- Frontend targets: `frontend/src/pages/crm/orders/OrderDetailPage.tsx`, `frontend/src/api/crmManagerApi.ts`.
- Backend targets: shipment endpoints in `backend/src/routes/v1/modules/crm.ts`, `backend/server.js`.

4) Order status reverts after refresh
- Suspected cause: optimistic UI update only; backend update not writing, or list/detail load uses another status field.
- Frontend targets: `frontend/src/pages/crm/orders/OrderDetailPage.tsx`, `frontend/src/pages/crm/orders/OrdersListPage.tsx`.
- Backend targets: `/crm/orders/:orderId/status` handlers and data mapper in `backend/server.js` and `backend/src/routes/v1/modules/crm.ts`.

5) Orders search misses existing bikes
- Suspected cause: search query excludes `bike_name` in one code path, or frontend query reset/race.
- Frontend targets: `frontend/src/pages/crm/orders/OrdersListPage.tsx`.
- Backend targets: `/api/v1/crm/orders` filtering in `backend/server.js` and `backend/src/routes/v1/modules/crm.ts`.

6) Task cross-view sync (order -> global tasks)
- Suspected cause: order task create sets wrong `order_id`/`entity_id`/`assigned_to`, global tasks query filters out linked tasks.
- Frontend targets: `frontend/src/pages/crm/orders/OrderDetailPage.tsx`, `frontend/src/pages/crm/orders/OrdersListPage.tsx`, `frontend/src/pages/crm/tasks/TasksPage.tsx`.
- Backend targets: task create/list in `backend/src/routes/v1/modules/crm.ts` and `backend/server.js`.

7) Dashboard urgent task links undefined
- Suspected cause: using missing `task.order_id` or wrong field name in link builder.
- Frontend targets: `frontend/src/pages/crm/DashboardPage.tsx`.

8-9) Customer stats wrong
- Suspected cause: customer query missing aggregate join/count/sum mapping.
- Frontend targets: `frontend/src/pages/crm/customers/CustomerDetailPage.tsx`.
- Backend targets: customer details endpoint in `backend/src/routes/v1/modules/crm.ts` and/or `backend/server.js`.

10-11) Dashboard chart and conversion issues
- Suspected cause: daily bucket window mismatch/timezone, status mapping mismatch for closed orders.
- Frontend targets: `frontend/src/pages/crm/DashboardPage.tsx`.
- Backend targets: `/api/v1/crm/dashboard/stats` in `backend/server.js` and/or `backend/src/routes/v1/modules/crm.ts`.

12) Kanban image preview missing
- Suspected cause: card uses wrong property path from bike snapshot/images.
- Frontend targets: `frontend/src/components/crm/KanbanBoard.tsx`, `frontend/src/components/crm/OrderCard.tsx`.

13) Quick contact action
- Suspected cause: phone rendered as text only in some CRM screens.
- Frontend targets: `frontend/src/pages/crm/orders/OrderDetailPage.tsx`, `frontend/src/pages/crm/customers/CustomerDetailPage.tsx`.

## Verification loop (repeat after each fix cluster)

1. Baseline checks
- `(cd backend) npm test`
- `(cd frontend) npm run lint`
- `(cd frontend) npm run build`

2. Browser smoke flow (Playwright)
- Preferred: existing `@smoke` CRM tests.
- If missing coverage, add minimal CRM smoke tests in `frontend/tests/*crm*.spec.ts` tagged `@smoke`.
- Run: `(cd frontend) npx playwright test --project=chromium --grep @smoke`
- Save traces/screenshots/report under `frontend/test-results/`.

3. Evidence/logging
- Append each major action to `logs/crm-autofix-latest.txt` (command, result, fix summary).
- Keep logs redacted; never print secrets.

## Exit criteria

- Checklist items above are checked as done. Status: PASS.
- Playwright smoke confirms critical manager flows and persistence after refresh. Status: PASS (`frontend/tests/crm-smoke.spec.ts`, run with `--grep @smoke`).
- Frontend build on current tree. Status: PASS (`frontend/test-results/build-after-final-loop.log`).
- Focused CRM lint on changed CRM files. Status: PASS (`frontend/test-results/crm-eslint-final.log`).
- Full frontend lint on repo. Status: FAIL due pre-existing non-CRM issues (`frontend/test-results/lint-after-final-loop.log`).
- Full backend integration tests. Status: FAIL due pre-existing missing module `../../scrapers/kleinanzeigen-collector` (`backend/test-outputs/latest.txt`).

## Session 5 verification snapshot

- Leads endpoint verifier: PASS (`backend/test-outputs/verify-crm-leads-endpoint.log`, `backend/test-outputs/verify-crm-leads-endpoint-write.log`).
- Playwright CRM smoke (includes leads status update + image-blocking console guard): PASS (`frontend/test-results/crm-smoke-session5.log`).
- Focused frontend lint for changed Session 5 files: PASS (`frontend/test-results/crm-eslint-session5.log`).
- Frontend build after Session 5 fixes: PASS (`frontend/test-results/build-session5.log`).
- Full frontend lint: FAIL due pre-existing issues outside this scope (`frontend/test-results/lint-session5-full.log`).
- Backend integration tests: FAIL due pre-existing missing module (`backend/test-outputs/latest.txt`).

## Booking -> CRM finalization snapshot (Session 5+)

- Supabase schema snapshot reconciled: readable text primary ids for `orders/leads/customers` and enum status fields (`docs/supabase_schema_snapshot_public.json`).
- Finalization audit: `docs/Booking_CRM_Finalization_Audit.md` (canonical bike reference, schema truth, ImageKit-only target, minimal migration options).
- Supabase schema export how-to: `docs/SUPABASE_SCHEMA_HOWTO.md` + query generator `scripts/supabase_schema_dump.js`.
- Remaining P0 work (operator + optional code): booking-time ImageKit caching into `orders.bike_snapshot.cached_images`, legacy backfill runbook (DRY_RUN report -> real run).

## Session completion update (2026-02-07, follow-up)
- [x] Resolved route shadowing for CRM order detail (ackend/src/routes/v1/modules/crm.ts duplicate detail route removed).
- [x] Resolved local CRM SQL schema mismatches for orders search, shipments create/update, customer detail totals (ackend/server.js).
- [x] Resolved customer detail navigation flow from customers list (rontend/src/pages/crm/customers/CustomersPage.tsx + backend customer fallback).
- [x] Playwright smoke (@smoke) now passes end-to-end after fixes.
- [ ] Full backend integration suite remains red due pre-existing non-CRM failures (ackend/tests/integration/full-system-test.js).
