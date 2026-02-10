# Catalog Final State

Date: 2026-02-08

## 1) Public routes
- `GET /catalog`
  - New PLP UI with URL-synced filters/sort/pagination.
- `GET /product/:id`
  - New PDP UI with gallery/specs/condition/logistics/booking CTA.

## 2) Backend API contract

### `GET /api/v1/catalog/bikes`
Returns normalized list data + pagination + facets.

Query params:
- Search: `q`
- Pagination: `page`, `page_size`
- Sort: `sort` in `relevance | price_asc | price_desc | year_desc | condition_desc | hot_desc`
- Equality list filters (comma-separated):
  - `category`, `discipline`, `sub_category`
  - `brand`, `model`
  - `condition_status`, `condition_grade`
  - `wheel_size`, `frame_size`
  - `suspension_type`, `frame_material`
  - `seller_type`, `country`, `location`
- Range filters:
  - `min_price`, `max_price`
  - `min_year`, `max_year`
- Boolean filters:
  - `is_hot_offer`, `is_super_deal`, `is_negotiable`, `is_pickup_available`, `ready_to_ship`
- Exclusion:
  - `exclude_id`

Response shape:
```json
{
  "success": true,
  "items": ["BikeDTO"],
  "pagination": {
    "page": 1,
    "page_size": 24,
    "total": 55,
    "total_pages": 3,
    "has_prev": false,
    "has_next": true
  },
  "facets": {
    "category": [{ "value": "mtb", "count": 55 }],
    "brand": [{ "value": "Canyon", "count": 10 }],
    "...": [],
    "flags": {
      "is_hot_offer": 12,
      "is_super_deal": 3,
      "is_negotiable": 7,
      "is_pickup_available": 15,
      "ready_to_ship": 42
    },
    "ranges": {
      "price_eur": { "min": 900, "max": 6550 },
      "year": { "min": 2016, "max": 2026 }
    }
  },
  "sort": "relevance",
  "filters_applied": { "...": "..." }
}
```

### `GET /api/v1/catalog/bikes/:id`
Returns one normalized `BikeDTO` with extra detail payloads.

Response shape:
```json
{
  "success": true,
  "bike": "BikeDTO"
}
```

## 3) BikeDTO shape (current)
Key fields used by frontend:
- Identity: `id`, `name`, `brand`, `model`
- Classification: `category`, `discipline`, `sub_category`
- Price: `price_eur`, `original_price_eur`, `currency`
- Condition: `condition_status`, `condition_grade`, `condition_score`, `condition_rationale`
- Fit/spec basics: `frame_size`, `wheel_size`, `frame_material`, `suspension_type`
- Location/seller: `location`, `country`, `seller_type`
- Flags: `is_hot_offer`, `is_super_deal`, `is_negotiable`, `is_pickup_available`, `ready_to_ship`
- Ranking: `relevance_score`, `hotness_score`
- Media: `main_image`, `images[]` (ImageKit-first ordering when available)
- Detail extras: `highlights[]`, `specs{}`, `logistics{}`
- Source: `source_url`, `source_platform`, `source_ad_id`
- Booking contract helper:
  - `booking_payload.bike_id`
  - `booking_payload.external_bike_ref`
  - `booking_payload.bike_url`
  - `booking_payload.bike_snapshot`

## 4) Frontend filter model
PLP (`/catalog`) keeps filter state in URL (`useSearchParams`):
- Includes all query params listed in API contract.
- UI controls update URL and reset `page=1` on filter changes.
- Page reload/deeplink restores identical catalog state.
- Saved searches persist querystring snapshots in localStorage.

## 5) Booking handoff from PDP
PDP (`/product/:id`) sends to `POST /api/v1/booking`:
- `bike_id`
- `external_bike_ref`
- `bike_details` containing canonical snapshot fields and nested `bike_snapshot`
- `customer` with normalized contact method/value (email/phone/telegram)
- `booking_form` with city/comment/delivery + login-note acknowledgement

This keeps order snapshot durability independent from live catalog updates.

## 6) How to extend

### Add a new filter
1. Add parsing to `buildFilters` in `backend/src/services/catalog-v1-service.js`.
2. Add matching logic in `matchesBike`.
3. Add optional facet in `buildFacets`.
4. Add UI control and URL binding in `frontend/src/pages/CatalogPage.tsx`.

### Add a new DTO field
1. Extend `normalizeBikeRow` in `backend/src/services/catalog-v1-service.js`.
2. Add TypeScript typing in frontend pages where needed.
3. Render in PLP/PDP.

### Change sort behavior
1. Update `SORT_VALUES` + `sortBikes` in `backend/src/services/catalog-v1-service.js`.
2. Update `SORT_OPTIONS` in `frontend/src/pages/CatalogPage.tsx`.

## 7) Verification snapshot
Passed for this catalog refactor:
- `frontend` build
- targeted eslint on changed frontend files
- Playwright `@catalog` smoke
- backend unit-ish test for catalog normalization/filter parsing

Not passed (pre-existing unrelated debt):
- full backend integration suite (`npm test`)
- repo-wide frontend lint (`npm run lint`)
