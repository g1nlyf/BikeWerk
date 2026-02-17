# Refund and Compensation Statuses

Updated: 2026-02-15

## 1. Important separation
- Order lifecycle statuses (`orders.status`) do not store finance workflow states.
- Refund and compensation are tracked in dedicated tables:
  - `refund_requests`
  - `compensation_requests`

## 2. Refund pipeline (`refund_requests.status`)
1. `pending_review`
2. `approved`
3. `rejected`
4. `payment_pending`
5. `paid`

## 3. Compensation pipeline (`compensation_requests.status`)
1. `pending_review`
2. `approved`
3. `rejected`
4. `settlement_pending`
5. `settled`

## 4. Business rules
- If cancellation reason is client fault (`client_changed_mind`), reserve is non-refundable.
- If cancellation reason is not client fault, reserve action can be:
  - refund to client
  - transfer to another bike
- Compensation can exist after delivery (it is not tied to cancellation only).
- Refund finalizes cancellation branch; compensation can be ongoing service-quality branch.

## 5. Required links
- Every refund/compensation should point to:
  - `order_id`
  - optional `case_id` (`order_cases`)
  - reason code + note

## 6. Analytics requirements
- reason-code distribution
- approval rate
- payout cycle time (`created_at -> paid/settled`)
- manager-level correlation with complaints and SLA misses
