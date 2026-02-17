# CRM CJM Digitalization (v2)

Updated: 2026-02-15
Scope: local SQLite-first CRM (`backend/database/eubike.db`)

## 1. Goal
Digitize the entire sales and post-sales path so AI ROP can control:
- each order stage
- each manager action
- each client contact
- each SLA breach and delay
- each refund/compensation branch

## 2. Canonical order flow
1. `booked`
2. `reserve_payment_pending` (optional)
3. `reserve_paid` (optional)
4. `seller_check_in_progress`
5. `check_ready`
6. `awaiting_client_decision`
7. `full_payment_pending`
8. `full_payment_received`
9. `bike_buyout_completed`
10. `seller_shipped`
11. `expert_received` (optional branch)
12. `expert_inspection_in_progress` (optional branch)
13. `expert_report_ready` (optional branch)
14. `awaiting_client_decision_post_inspection` (optional branch)
15. `warehouse_received`
16. `warehouse_repacked`
17. `shipped_to_russia`
18. `delivered`
19. `closed`
20. `cancelled`

## 3. Local-first digital model

### 3.1 Existing core
- `customers`
- `leads`
- `orders`
- `order_status_events`
- `payments`
- `shipments`
- `tasks`
- `order_cases`
- `refund_requests`
- `compensation_requests`

### 3.2 New digitalization layer
- `customer_preferences`
- `crm_contact_channels`
- `customer_manager_links`
- `crm_touchpoints`
- `crm_journey_events`
- `crm_sla_policies`
- `crm_order_stage_instances`
- `crm_manager_followups`
- `manager_kpi_daily_facts`
- `manager_kpi_period_scorecards`

### 3.3 Live AI/analytics views
- `crm_order_360_v`
- `crm_customer_360_v`
- `crm_manager_workload_live_v`

### 3.4 Holacracy management layer
- `crm_holacracy_circles`
- `crm_holacracy_roles`
- `crm_holacracy_role_assignments`
- `crm_holacracy_tensions`
- `crm_holacracy_tension_events`
- `crm_holacracy_parking_sessions`
- `crm_holacracy_member_profiles`
- `crm_holacracy_role_coverage_v`
- `crm_holacracy_tensions_live_v`

## 4. What is stored for each client
- profile (`customers`)
- preferences and constraints (`customer_preferences`)
- channel map (`crm_contact_channels`)
- full contact history (`crm_touchpoints`)
- manager ownership (`customer_manager_links`)
- orders/leads linkage (`orders`, `leads`)

## 5. What is stored for each manager action
- status/assignment/field updates (`manager_activity_events`)
- each touchpoint with channel and SLA (`crm_touchpoints`)
- each follow-up task and completion (`crm_manager_followups`)
- stage execution traces (`crm_order_stage_instances`)
- KPI daily facts and period scorecards (`manager_kpi_daily_facts`, `manager_kpi_period_scorecards`)

## 6. SLA instrumentation
- Policies are stored in `crm_sla_policies`.
- Stage transitions are tracked in `crm_order_stage_instances`.
- Touchpoint response windows are tracked in `crm_touchpoints.response_due_at`.
- Breaches are represented by `is_sla_breached` and `sla_breached_at`.

## 7. Automation/triggers
- On `orders` insert:
  - creates initial CJM event
  - opens first stage instance
  - sets stage SLA deadline
- On `orders.status` update:
  - closes previous stage instance
  - opens next stage instance
  - writes `status_changed` CJM event
- On `crm_touchpoints` insert:
  - updates customer contact aggregates
  - updates order manager-contact aggregates

## 8. API for the new layer
- `GET /api/v1/crm/orders/:orderId/cjm`
- `POST /api/v1/crm/orders/:orderId/touchpoints`
- `PATCH /api/v1/crm/followups/:followupId/complete`
- `POST /api/v1/crm/kpi/recompute`
- `GET /api/v1/crm/managers/:managerId/scorecard`
- `GET /api/v1/crm/holacracy/overview`
- `GET /api/v1/crm/holacracy/circles`
- `POST /api/v1/crm/holacracy/roles/:roleId/assign`
- `PATCH /api/v1/crm/holacracy/members/:userId/profile`
- `GET /api/v1/crm/holacracy/tensions`
- `POST /api/v1/crm/holacracy/tensions`
- `PATCH /api/v1/crm/holacracy/tensions/:tensionId`
- `GET /api/v1/crm/holacracy/parking`
- `POST /api/v1/crm/holacracy/parking`
- `PATCH /api/v1/crm/holacracy/parking/:parkingId/complete`

## 9. Rebuild and backfill
Run:

```bash
cd backend
npm run crm:digitalize
```

Script does:
- schema bootstrap (if missing)
- legacy `applications -> leads` mirror (best effort)
- CJM backfill from `orders` and `order_status_events`
- manager activity backfill
- stall flag refresh
- KPI recompute for recent horizon

## 10. KPI ownership note
`lead_to_booked_rate` is website KPI, not manager KPI.

Manager KPI starts from `booked` and evaluates execution quality, speed, and client care.
