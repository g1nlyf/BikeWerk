# Booking -> CRM Final State

Date: 2026-02-07
Scope: Catalog -> Booking -> Backend -> Supabase/SQLite -> CRM Orders UI

## What changed

- Booking snapshot durability hardened in `backend/src/services/BookingService.js`:
  - normalized `bike_snapshot` now consistently keeps `bike_id`, `bike_url`, `external_bike_ref`, title/brand/model/year/size, price fields, `main_photo_url`, `images[]`, `cached_images[]`.
  - booking-time image caching path added (safe download + ImageKit upload) and snapshot enrichment persisted into order records.
- CRM order image rendering contract aligned in frontend:
  - `frontend/src/components/crm/OrderCard.tsx`, `frontend/src/components/crm/KanbanBoard.tsx`, `frontend/src/pages/crm/orders/OrderDetailPage.tsx` prefer `bike_snapshot.cached_images` and degrade to placeholder + archived marker.
- Leads status endpoint hardening in `backend/server.js`:
  - status enum validation, id validation, safe error mapping (`400` invalid input, `404` missing row, `503` backend unavailable), reduced business-case `500`s.
- Route conflict fixes for CRM order/shipment flows:
  - removed duplicate `GET /api/v1/crm/orders/:orderId` from `backend/src/routes/v1/modules/crm.ts` to avoid shadowing consolidated detail handler.
  - added `next()` fallback in CRM module shipments/transactions routes when Supabase is unavailable so local handlers in `backend/server.js` execute.
- Local SQLite compatibility fixes in `backend/server.js`:
  - removed SQL usage of absent `orders.bike_name` in local search filters.
  - fixed local shipments insert/update to schema (`provider` instead of missing `carrier` column).
  - customer details endpoint now falls back to local store when Supabase branch misses and avoids missing `total_price_rub` dependency.
  - status-event write now has fallback when `order_status_events.change_notes` column is absent.
- Customer UX reliability:
  - `frontend/src/pages/crm/customers/CustomersPage.tsx` row click behavior made stable for opening detail profile.

## Why these changes

- Legacy and mixed-source orders were breaking UI assumptions because some handlers used Supabase-only logic while runtime data came from local SQLite fallback.
- CRM list/detail/shipment/customer endpoints had split behavior and schema drift (`bike_name`, `carrier`, `total_price_rub`, `change_notes` missing in local DB).
- Image reliability required snapshot-first behavior so CRM never depends on mutable catalog entries or blocked third-party hosts.
- Leads update needed strict validation and deterministic non-500 behavior for manager workflows.

## Data flow (current)

1. Client booking UI sends `POST /api/v1/booking` with bike and customer payload.
2. Booking service normalizes snapshot, attempts ImageKit caching, writes lead/order records (Supabase-first with local fallback).
3. Orders store `bike_id` (nullable), immutable external reference (`bike_url`/`external_bike_ref`), and durable `bike_snapshot`.
4. CRM orders list/detail read orders from API and render bike from `bike_snapshot.cached_images` first.
5. CRM status/price/shipment/task actions update order-related records and are reloaded from persistent storage.

## Legacy backfill (ImageKit)

Prepared script: `backend/scripts/backfill_cached_images.js` (DRY_RUN default).

- DRY run:
  - scans orders missing `bike_snapshot.cached_images`.
  - validates snapshot image URLs.
  - simulates download/upload plan and writes report.
- Real run:
  - downloads first N snapshot images safely.
  - uploads to ImageKit.
  - writes cached URLs back into `orders.bike_snapshot.cached_images`.

Recommended run pattern:

1. `DRY_RUN=true node backend/scripts/backfill_cached_images.js`
2. inspect `backend/test-outputs/backfill-cached-images-report.json`
3. `DRY_RUN=false node backend/scripts/backfill_cached_images.js`

## Verification executed

- Frontend build: `cd frontend && npm run build` -> PASS.
- CRM smoke E2E: `cd frontend && npx playwright test --project=chromium --grep "@smoke"` -> PASS.
- Backend integration suite: `cd backend && npm test` -> FAIL (pre-existing failures outside CRM linkage flow):
  - missing `bikes` table in integration test DB path.
  - valuation assertion mismatch in non-CRM test.

## Supabase migration package

Prepared only, not applied:

- `docs/supabase_migrations/crm_linkage.sql`
- `backend/scripts/backfill_cached_images.js`

No DB migrations were executed in this session.

## Readiness summary

- CRM booking->order->manager critical flow is now stable in smoke coverage (status, price, shipment, tasks, customers, leads update).
- Remaining blocker to declare full repo readiness: backend integration suite has pre-existing unrelated failures and must be fixed separately.
