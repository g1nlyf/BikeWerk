# Booking -> Supabase -> CRM Finalization Audit (Session 5+)

Date: 2026-02-07
Inputs:
- `docs/CRMtest5.txt` (in-browser manager test)
- `docs/Booking_CRM_Audit.md` (previous audit)
- `docs/supabase_schema_snapshot_public.json` (schema source of truth)

Scope:
- Make Booking (client) -> persistence (Supabase) -> CRM (manager) linkage resilient long-term.
- Ensure CRM can render orders even when catalog bikes were deleted/changed.
- Move toward ImageKit-only images for orders (no third-party hotlinks as a dependency).

Hard constraints:
- No deploy scripts.
- No DB migration/backfill is applied automatically from this repo.
- Never print/commit secrets (including Supabase service role, ImageKit keys).

## 1) Current State (What Works Now)

Manager-facing (from `docs/CRMtest5.txt`):
- Login, dashboard, orders list/detail, tasks: reported as working and usable.
- Main remaining manager-blocker in Session 5 report: lead status change caused backend 500.
- Images intermittently missing due to legacy URLs + proxy/CORS behavior.

Repo changes already present (Session 5 implementation):
- Leads status update is hardened to avoid 500 for common failure modes:
  - invalid id -> 400
  - lead not found -> 404
  - Supabase unreachable/timeouts -> 503
  - enum mismatch error from Postgres -> 400 (with guidance)
- CRM image rendering is snapshot-first and resilient:
  - prefers `bike_snapshot.cached_images` (ImageKit URLs) when present
  - otherwise uses `bike_snapshot.main_photo_url` / `bike_snapshot.images[]`
  - otherwise shows placeholder + "archived bike" label
- Same-origin image proxy behavior is improved (to reduce browser blocking) and the frontend routes non-ImageKit external URLs through the proxy.
- Booking write path normalizes `bike_snapshot` so CRM does not depend on a live catalog lookup to show title/price/images.

Verification artifacts already in repo (paths may exist from prior runs):
- Playwright smoke spec: `frontend/tests/crm-smoke.spec.ts`
- Playwright output: `frontend/test-results/`
- Rolling log: `logs/crm-autofix-latest.txt`
- CRM fix plan: `docs/CRM_fixplan.md`
- API verifier script (safe, no writes unless enabled): `backend/scripts/verify-crm-leads-endpoint.js`

## 2) Canonical Bike Reference (Decision)

### Why this matters
Legacy orders were created when the catalog contained bikes that were later deleted/cleaned. Any system that relies on "live catalog bikes" to render existing orders will break over time.

### Supabase reality
Supabase snapshot does not contain a `bikes` table in `public` schema (`docs/supabase_schema_snapshot_public.json`).
Therefore, `orders.bike_id` cannot be a strict FK to a Supabase bikes table today.

### Recommended canonical reference (default)
Use a composite approach:
- `orders.bike_id` (nullable): internal catalog identifier when available (local DB id or any internal id).
- `orders.bike_url` (already exists): treat as `external_bike_ref` (immutable listing URL or similar external reference).
- `orders.bike_snapshot` (mandatory content, stored as jsonb): the primary render source for CRM.

This is future-proof:
- If catalog bike exists: CRM can link to it.
- If bike was deleted: CRM still renders from `bike_snapshot` (title/price/images).
- If listing is removed: CRM still renders from cached ImageKit URLs (once caching/backfill is done).

### Minimal snapshot contract (what MUST be stored)
Inside `orders.bike_snapshot` (jsonb):
- `title` (or `name`)
- `brand`, `model` (if present)
- `price_at_booking` (or reuse existing price fields; keep a snapshot value too)
- `bike_id` (if known)
- `external_bike_ref` (prefer `bike_url` / listing url)
- `main_photo_url`
- `images` (array of urls)
- `cached_images` (array of ImageKit urls) - target

## 3) Supabase Schema Reconciliation (Truth vs Assumptions)

This section is derived from `docs/supabase_schema_snapshot_public.json` and should be treated as authoritative.

### IDs and FK types (critical)
- `orders.id`: `text` readable id, default `generate_readable_id('ORD')`
- `leads.id`: `text` readable id, default `generate_readable_id('LEAD')`
- `customers.id`: `text` readable id, default `generate_readable_id('CUST')`
- `orders.customer_id`, `orders.lead_id`: `text`
- `shipments.order_id`, `tasks.order_id`, `inspections.order_id`, `order_status_events.order_id`: `text`
- `old_uuid_id` columns exist on several tables, but they are not the primary ids for routing.

Implication for backend:
- CRM routes must accept readable ids like `LEAD-...` / `ORD-...` and not assume UUID.

### Enums
- `orders.status`: `public.order_status_enum` (default `awaiting_payment`)
- `leads.status`: `public.lead_status_enum` (default `new`)

Implication for backend:
- Do not hardcode guessed status lists unless they are read from DB (enum values must match exactly).
- Validate shape/length, then map enum mismatch errors to 400 with guidance.

### Snapshot columns already available
- `orders.bike_snapshot`: `jsonb` (exists)
- `leads.bike_snapshot`: `jsonb` (exists)
- `orders.bike_url`: `text` (exists)
- `orders.bike_id`: `text` (exists)

### Columns NOT present (as of the snapshot)
These do not exist in `orders` right now:
- `external_bike_ref` (separate column)
- `cached_images` (separate column)
- `archived_bike` (boolean)

Important nuance:
- You can still ship ImageKit URLs today by storing them inside `orders.bike_snapshot.cached_images` (no schema change required).

## 4) Image Policy: ImageKit-Only (Target + Path There)

### Target behavior
CRM renders order images from ImageKit only:
- Primary: `bike_snapshot.cached_images[0]` (ImageKit)
- Secondary: `bike_snapshot.main_photo_url` if it is ImageKit
- Never rely on third-party hosts for long-term correctness.

### Current fallback behavior (acceptable temporarily)
To keep legacy orders usable until backfill is complete:
- If cached ImageKit image is missing, proxy external image through same-origin image proxy.
- If external image cannot be fetched/blocked, show a placeholder and do not crash the UI.

### What still remains to reach 100% ImageKit
P0 (no DB schema changes required):
1) Booking-time caching:
   - On booking/order creation, take up to N images from `bike_snapshot.images[]` (remote).
   - Download safely (timeout/size limits; SSRF protections).
   - Upload to ImageKit.
   - Store returned ImageKit URLs into `orders.bike_snapshot.cached_images`.
   - CRM UI already prefers `cached_images` when present.

P1 (legacy orders):
2) Backfill caching:
   - Dry-run report first (how many orders lack cached_images; which hosts; failures).
   - Then a real run that uploads images to ImageKit and updates `orders.bike_snapshot.cached_images`.
   - The repo already contains a DRY_RUN-first script placeholder; treat it as an operator runbook, not an automated step.

### Where ImageKit is configured
ImageKit integration exists in backend code via `backend/src/services/ImageKitService.js`.
Credentials must be provided by environment variables; do not keep fallback keys in repo.

## 5) Minimal DB Changes (If Any) + Migration/Backfill Plan

### Option A (minimal change, recommended first)
No schema change required:
- Use existing `orders.bike_snapshot` jsonb to store `cached_images` and `external_bike_ref`.
- Use `orders.bike_url` as the canonical external reference for now.

Pros:
- No migration required to deliver "ImageKit-only rendering" behavior.
- Fastest path to stable CRM rendering for legacy orders.

Cons:
- Harder to query/aggregate `cached_images` and `external_bike_ref` at SQL level.

### Option B (normalized schema, optional)
Apply migration (prepared, not applied automatically):
- Add `orders.external_bike_ref text`
- Add `orders.cached_images jsonb`
- Add `orders.archived_bike boolean default false`
- Add `lead_status_events` table for lead history

Prepared SQL exists at:
- `docs/supabase_migrations/crm_linkage.sql`

Backfill strategy:
1) Dry-run: produce a report of orders with missing cached images.
2) Apply migration (if choosing Option B).
3) Real run: upload images to ImageKit and write cached URLs (either into `bike_snapshot.cached_images` or into the normalized column).

## 6) Verification Plan (Repeatable)

### API-level checks
- Lead update should never return 500:
  - invalid id -> 400
  - non-existent -> 404
  - Supabase down -> 503
  Use: `backend/scripts/verify-crm-leads-endpoint.js` (no writes unless explicitly enabled).

### UI-level checks
- Playwright `@smoke`:
  - CRM login, dashboard, orders list + kanban
  - order detail renders image without console "NotSameOrigin" blocks
  - lead status update path responds cleanly and UI stays consistent
  Use: `frontend/tests/crm-smoke.spec.ts` and reports in `frontend/test-results/`.

## 7) What Is Still Open (Real Remaining Work)

P0:
- Booking-time ImageKit caching (write `bike_snapshot.cached_images` on order creation).
- Legacy image backfill runbook: DRY_RUN report -> operator-run backfill.

P1:
- Decide the canonical immutable external reference:
  - keep `orders.bike_url` as external ref, or add `orders.external_bike_ref`.
- Confirm enum values for `public.lead_status_enum` and `public.order_status_enum` and align frontend picklists.

P2:
- Optional: lead status history UI (based on `lead_status_events` if added).
- Optional: remove console noise (manifest icons) if still present.

## 8) Operator Inputs Needed (Minimal)

1) Confirm canonical bike reference preference:
   - internal catalog id vs listing URL vs listing id (or composite).
2) Confirm ImageKit folder/naming convention for cached order images:
   - example: `orders/<order_code>/img-1.jpg`.
3) Confirm bike lifecycle:
   - bikes deleted vs archived.
4) Provide enum values output:
   - run the "enums (bonus)" SQL query from `scripts/supabase_schema_dump.js` and share results for `lead_status_enum` and `order_status_enum`.

