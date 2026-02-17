# Order Lifecycle and Compliance (Source of Truth)

Updated: 2026-02-15

## 1) Compliance limits

- BikeWerk accepts bikes in range: `EUR 500` to `EUR 5,000` (inclusive).
- Any bike with price `> EUR 5,000` must be blocked.
- Compliance reason label: `sanction-customs compliance`.

## 2) Booking and reserve model

- Order is created on free booking.
- Free booking is queue-based and unlimited by time.
- One client may hold up to `3` active free bookings.
- One client may hold at most `1` active paid reserve.
- Paid reserve amount: `2%` of full client total, stored in `RUB`.
- Paid reserve can be made by any queue position and supersedes all free bookings for that bike.
- Superseded bookings are cancelled with reason: `superseded_by_paid_reserve`.
- If cancellation is not client fault: reserve can be refunded or moved to another bike.
- API placeholder reserve payment marks order as `reserve_paid` and returns `superseded_orders` for frontend explanation.

## 3) Canonical order statuses (internal codes)

1. `booked`
2. `reserve_payment_pending`
3. `reserve_paid`
4. `seller_check_in_progress`
5. `check_ready`
6. `awaiting_client_decision`
7. `full_payment_pending`
8. `full_payment_received`
9. `bike_buyout_completed`
10. `seller_shipped`
11. `expert_received` (optional route)
12. `expert_inspection_in_progress` (optional route)
13. `expert_report_ready` (optional route)
14. `awaiting_client_decision_post_inspection` (optional route)
15. `warehouse_received`
16. `warehouse_repacked`
17. `shipped_to_russia`
18. `delivered`
19. `closed`
20. `cancelled`

## 4) Terminal statuses

- `delivered` (business delivery complete)
- `closed` (manually closed by manager only)
- `cancelled`

## 5) Cancellation reason codes

- `superseded_by_paid_reserve`
- `client_changed_mind`
- `bike_unavailable`
- `seller_unresponsive`
- `seller_fraud_suspected`
- `quality_mismatch`
- `failed_seller_check`
- `price_out_of_compliance`
- `compliance_block`
- `payment_not_received`
- `duplicate_booking`
- `internal_service_failure`
- `logistics_impossible`
- `client_unreachable`
- `other`

## 6) Refund and compensation

- Refund is not an order status.
- Refund uses finance pipeline: `refund_pending -> refunded`.
- Compensation is a separate claims/finance process (not order status).
