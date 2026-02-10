# Booking → CRM Integration Audit (Session 5)

Date: 2026-02-07  
Sources: `docs/CRMtest5.txt`, code inspection (backend/server.js, backend/src/routes/v1/modules/{booking,crm,orders}.ts, backend/src/services/BookingService.js, frontend booking/CRM pages)

## 1) Executive Summary
- The lead status update endpoint (`PATCH /api/v1/crm/leads/:id`) returns 500 in production tests; Supabase update path likely fails on id/type mismatches or missing row when Supabase is unavailable (no local fallback).
- Image display remains brittle: the `/api/image-proxy` allowlist blocks many external listing domains, producing `net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`; deleted/legacy bikes rely on external URLs without cached copies.
- Conversion metric still shows 0% on dashboard; the formula now counts `closed + delivered`, but upstream status data may never be set for bookings that remain in `pending_manager/under_inspection`, so the KPI is misleading.
- Legacy orders can lose bike images/links when the catalog item is removed; only partial bike snapshots are stored, and CRM rendering depends on live URLs or the proxy allowlist.
- Leads endpoint has no history/timeline and no validation/normalization for status transitions.

## 2) Current Flow (UI → API → DB → CRM)
- **Client Booking UI**: `frontend/src/components/checkout/BookingOverlay.tsx` posts to `POST /api/v1/booking` with `bike_id`, `bike_details` (full snapshot), customer contact, pricing.
- **Backend Booking**: `backend/src/routes/v1/modules/booking.ts` → `BookingService.createBooking(...)`.
  - Upserts customer, creates Supabase (preferred) or local lead/order.
  - Generates `order_code`, `magic_link_token`.
  - Persists order with `bike_snapshot`, `bike_id`, `bike_url`, financials, `booking_meta` in Supabase table `orders` (or local `orders` table).
  - Optional background inspection write to Supabase `inspections`.
- **Orders Public/CRM API**:
  - Public tracking: `backend/src/routes/v1/modules/orders.ts` (`/api/v1/orders/:id|track/:token|search`), reading Supabase `orders` (or local) and returning `bike_snapshot`.
  - CRM manager API: `backend/server.js` + `backend/src/routes/v1/modules/crm.ts` expose list/detail/status/shipment/task endpoints, querying Supabase tables: `orders`, `shipments`, `tasks`, `inspections`, `payments`, `negotiations`, `order_status_events`, `customers`, `users`.
- **CRM Frontend**:
  - Orders list/detail/Kanban: `frontend/src/pages/crm/orders/*`, `frontend/src/components/crm/{KanbanBoard,OrderCard}` consume CRM endpoints and use `bike_snapshot` + `bike_id` for display and images.
  - Dashboard: `frontend/src/pages/crm/DashboardPage.tsx` → `/api/v1/crm/dashboard/stats`.
  - Tasks: `frontend/src/pages/crm/tasks/TasksPage.tsx` → `/api/v1/crm/tasks`.
  - Leads page: `frontend/src/pages/crm/leads/*` (uses `PUT/PATCH /api/v1/crm/leads/:id`).

## 3) Current Schema Map (in code; no repo migrations present)
- **orders** (Supabase/local): `id (uuid)`, `order_code`, `old_uuid_id`, `customer_id`, `lead_id`, `bike_id (text)`, `bike_snapshot (json)`, `bike_name`, `bike_url`, `status`, `assigned_manager`, `final_price_eur`, `total_price_rub`, `booking_amount_rub`, `booking_amount_eur`, `exchange_rate`, `delivery_method`, `magic_link_token`, `created_at`.
- **customers**: `id`, `full_name/name`, `email`, `phone`, `preferred_channel`, `city`, aggregates derived in code (`total_orders`, `total_spent` not persisted).
- **leads**: `id`, `customer_id`, `bike_url`, `source`, `status`, `application_notes`, optional `bike_snapshot` (inserted on booking lead), timestamps.
- **shipments**: `id`, `order_id`, `provider/carrier`, `tracking_number`, `delivery_status`, `estimated_delivery`, `warehouse_received`, `ruspost_status`, timestamps.
- **tasks**: `id`, `order_id`, `title`, `description`, `status/completed`, `due_at`, `assignee`.
- **inspections**: `id`, `order_id`, `stage`, `checklist`, `photos_status`, `next_action_suggestion`.
- **payments/order_status_events/negotiations/reviews/coupons**: referenced for history and payments in CRM.
- **bikes/catalog** (local MySQL): `bikes` table with `id`, `main_image`, `images`, inspection fields; Supabase catalog tables are not defined in repo (schema not present).

## 4) Failure Points
1) **Lead status 500** (`PATCH /api/v1/crm/leads/:id`):
   - Code path uses Supabase only; no local fallback. If Supabase is unreachable or the lead row is absent (id mismatch between UUID/string), update throws and bubbles 500.
   - No validation of allowed statuses; bad input can violate check constraint or enum.
   - No audit/history, so data loss not tracked.
2) **Image proxy / CORS**:
   - `/api/image-proxy` blocks non-allowlisted domains; legacy bike snapshots often reference removed classifieds (e.g., Kleinanzeigen) or other hosts not in allowlist, leading to 403 → browser `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`.
   - There is no cached download of remote images; `bike_snapshot.images` may be stale, and `/images` static serving is disabled in `backend/server.js` (line ~1458), so local fallbacks are not served.
3) **Conversion metric = 0%**:
   - Dashboard counts `closed + delivered` vs total; many orders stay in `pending_manager/under_inspection/deposit_paid`, never reaching terminal states, so numerator remains 0.
   - No automatic status progression or backfill of legacy orders.
4) **Legacy bike links/images**:
   - Orders store `bike_id` and `bike_snapshot` JSON at booking time, but CRM display still prefers live `bike_snapshot.images[0]` or proxy’d external URL; if host is blocked or images missing, Kanban/list cards show placeholders.
   - No archival of images to first-party storage at booking; no “archived bike” flag for snapshot-only orders.
5) **Leads UX gaps**:
   - No history/timeline; no “awaiting manager” calculation uses leads; dashboard widget `awaiting_manager` stays 0.

## 5) Proposed Target Model (resilient linking)
- **Canonical key**: keep `bike_id` (FK to catalog when available) + **immutable `external_bike_ref`** (source URL or listing id) + **mandatory `bike_snapshot`** (name, price, year, size, main_photo_url, gallery[]).
- **Order record always stores snapshot at creation** and is the primary render source; UI should never depend on live catalog for existing orders.
- **Image policy**: on booking, download first N images to storage (`/images/bikes/{order_code}/...`) or Supabase Storage bucket; store signed/public URLs in `bike_snapshot.cached_images`. CRM should try `cached_images -> snapshot.images -> placeholder`.
- **Status progression**: define status enum and transitions; conversion uses `delivered|closed|paid_out` as success; `pending_manager` counted in “Awaiting Manager”.
- **Leads**: include `bike_id`, `external_bike_ref`, `bike_snapshot` (optional) to preserve context; keep status history.

## 6) Migration / Backfill Strategy
- Add columns if missing (Supabase SQL, not in repo): `orders.external_bike_ref text`, `orders.cached_images jsonb`, `leads.bike_snapshot jsonb`, `orders.archived_bike boolean default false`.
- Backfill script (Supabase RPC or node script):
  1) For each order with `bike_snapshot.images` URLs, attempt to download first image to storage; write stored URL to `cached_images[0]`.
  2) Set `archived_bike=true` where `bike_id` not found in catalog.
  3) Set `external_bike_ref` from `bike_url` or snapshot `listing_url`.
  4) Recompute `awaiting_manager` and conversion stats for dashboard aggregates.
- Legacy orders lacking snapshot: fetch minimal details from market_history/bikes (if present) and populate `bike_snapshot` with title + price + placeholder image.

## 7) Fix Plan (minimal, ordered)
1) **Leads 500**: guard Supabase connectivity; when Supabase down or lead missing → return 404/503 instead of 500; add input validation for status enum; support both UUID and numeric ids; add basic history table (`lead_status_events`) or append to `audit_log`.
   - Verification: `PUT /api/v1/crm/leads/:id` with valid/invalid ids; assert 200/404, Supabase row updated; add integration test stub.
2) **Image proxy resilience**:
   - Expand allowlist to include marketplaces used in snapshots (e.g., kleinanzeigen, images.craigslist, bike-market hosts) OR add signed “open proxy” path restricted by referrer + size limit.
   - Re-enable safe static `/images` for locally cached assets; ensure `Content-Type` and CORS headers present.
   - Verification: load Kanban/order list with legacy orders referencing blocked hosts; no `ERR_BLOCKED_BY_RESPONSE`.
3) **Booking snapshot durability**:
   - In `BookingService.createOrder*`, ensure `bike_snapshot` includes `main_photo_url`, `images`, `external_bike_ref`, `bike_id`, `bike_url`, `price`, `brand`, `model`, `year`.
   - Persist `cached_images` after optional download worker; CRM UI uses `cached_images` first.
4) **Dashboard metrics**:
   - Define conversion as `delivered|closed|paid_out` / total orders; expose `awaiting_manager = count(status in ['pending_manager'])`; adjust query in `/api/v1/crm/dashboard/stats`.
   - Verification: seed sample statuses or mock Supabase rows; assert non-zero when delivered orders exist.
5) **Leads UX/history** (optional but low risk):
   - Add `lead_status_events` insertion on PATCH; surface in CRM lead detail if present.
6) **Transliteration search (clients)**:
   - Add transliterated name index (server-side fallback using simple mapping) to search function; optional but noted in report.

## Data Flow Diagram (text)
- **User (BookingOverlay)** → `POST /api/v1/booking` → `BookingService.createBooking`  
    → Supabase `customers` (upsert)  
    → Supabase `leads` (source=website_booking, bike_url, status=new)  
    → Supabase `orders` (bike_id + bike_snapshot + financials + booking_meta)  
    → optional `inspections` insert  
    → returns `order_code`, `magic_link_token`.
- **CRM UI** (orders list/detail/kanban) → `/api/v1/crm/orders|/api/v1/orders/:id` → Supabase `orders` + `shipments` + `tasks` + `inspections` → renders using `bike_snapshot`/`cached_images`.
- **Leads page** → `GET /api/v1/crm/leads` (Supabase) → `PATCH /api/v1/crm/leads/:id` (Supabase update) → should append history.
- **Image render** → tries `bike_snapshot.cached_images[0]` → else `bike_snapshot.images[0]` via `/api/image-proxy?url=...` → falls back to placeholder.

---

**Open questions for data owners (if available):**
- Confirm canonical bike identifier (internal `bikes.id` vs external listing id) for long-term references.
- Provide Supabase schema export for `orders`, `leads`, `shipments`, `tasks`, `inspections`, `customers`, `bikes` to align migrations.
- Where are photos stored in production (Supabase Storage bucket name/path)? Do we have permission to download/copy remote images?
- Are bikes deleted or only archived? Should orders referencing deleted bikes display “archived bike” label?
