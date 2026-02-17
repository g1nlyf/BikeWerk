# CRM Order Status Lifecycle (Canonical)

## Core policy
- Source of calculation truth: `docs/BusinessRules/01_Core/CashflowLogic.md`
- Bike price compliance window: `€500..€5000`
- Orders above `€5000` are blocked at booking stage.
- Free booking is queue-based.
- Paid reserve is optional and supersedes free queue.

## Canonical internal statuses (English)
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
11. `expert_received`
12. `expert_inspection_in_progress`
13. `expert_report_ready`
14. `awaiting_client_decision_post_inspection`
15. `warehouse_received`
16. `warehouse_repacked`
17. `shipped_to_russia`
18. `delivered`
19. `closed`
20. `cancelled`

## Customer-visible path (RU labels in frontend)
- Бронь подтверждена
- Резерв: ожидание оплаты (опционально)
- Резерв оплачен (опционально)
- Проверка продавца
- Проверка завершена
- Ожидаем решение клиента
- Ожидаем полную оплату
- Полная оплата получена
- Велосипед выкуплен
- Отправлен продавцом
- Получен экспертом (опционально)
- Осмотр экспертом (опционально)
- Отчёт 130 пунктов готов (опционально)
- Решение клиента после отчёта (опционально)
- Получен на складе
- Переупакован на складе
- Отправлен в РФ
- Доставлен
- Закрыт

## Queue and reserve rules
- One customer can keep up to `3` active free bookings.
- One customer can keep up to `1` active paid reserve.
- Paid reserve amount is `2%` from full client total (RUB).
- If a paid reserve appears on a bike, all competing free bookings are moved to `cancelled` with reason code `superseded_by_paid_reserve`.

## Cancel reason codes (analytics-safe)
1. `superseded_by_paid_reserve`
2. `client_changed_mind`
3. `bike_unavailable`
4. `seller_unresponsive`
5. `seller_fraud_suspected`
6. `quality_mismatch`
7. `failed_seller_check`
8. `price_out_of_compliance`
9. `compliance_block`
10. `payment_not_received`
11. `duplicate_booking`
12. `internal_service_failure`
13. `logistics_impossible`
14. `client_unreachable`
15. `other`

## Refund and compensation model
- `compensation` is a separate process (not order terminal status).
- `refund` is a separate process tied to cancellation.
- If cancellation reason is not client fault:
  - reserve can be refunded OR transferred to another bike.
- If client simply changed mind:
  - reserve is non-refundable.
- `delivered` is not terminal from support perspective.
- `closed` means final closure, no active claims.

## Dedicated process statuses (separate tables)
### Refund
- `pending_review`
- `approved`
- `rejected`
- `payment_pending`
- `paid`

### Compensation
- `pending_review`
- `approved`
- `rejected`
- `settlement_pending`
- `settled`

## SLA defaults for manager operations
- First contact: `15 min`
- Response to client: `2 hours`
- Stage transition action: `24 hours`

These values are defaults and can be tuned later.
