# Модель KPI и мотивации менеджеров (v3)

Обновлено: 2026-02-16

## 1. Базовый принцип
`Относись к каждому клиенту как к единственному`.

## 2. Критичное разделение зон ответственности
`lead_to_booked_rate` не является KPI менеджера продаж.

- `lead -> booked` — зона сайта/маркетинга.
- KPI менеджера начинается с `booked` и качества исполнения заказа.

## 3. KPI менеджера продаж (операционный контур)
1. Конверсия и проведение сделки
- `booked_to_full_payment_rate`
- `full_payment_to_delivered_rate`

2. SLA-дисциплина
- `first_contact_sla_hit_rate`
- `response_sla_hit_rate`
- `stage_transition_sla_hit_rate`

3. Holacracy-ответственность
- `tension_sla_hit_rate` — доля tensions, закрытых в SLA
- `tension_backlog_ratio` — размер активного tension-бэклога

4. Надежность и клиентоцентричность
- `stale_orders_ratio`
- `complaint_rate`
- `post_delivery_support_touchpoints`

## 4. Без штрафов, но с прозрачной ответственностью
Штрафы не используются.
Вместо этого:
- полная цифровая трассировка действий менеджера,
- роль и владелец каждого этапа,
- scorecard по факту выполнения,
- tensions как формализованная обратная связь на провалы системы.

## 5. Слои оценки (scorecard)
1. Conversion layer
2. SLA layer
3. Reliability layer
4. Quality layer

Расчет ведется в:
- `manager_kpi_daily_facts`
- `manager_kpi_period_scorecards`
- `manager_kpi_snapshots`

## 6. Источники данных
- `orders`
- `crm_touchpoints`
- `crm_order_stage_instances`
- `order_cases`
- `crm_holacracy_tensions`
- `manager_activity_events`

## 7. Принцип выплаты
Сохраняется модель множителя от `score_total`:
- `>= 105`: `1.20`
- `>= 90`: `1.10`
- `>= 75`: `1.00`
- `>= 60`: `0.90`
- `< 60`: `0.80`

Guardrail:
- нет бонуса за «пустые» статусы без клиентских/операционных подтверждений в логах.

## 8. SLA по умолчанию
- первый контакт: `15 минут`
- ответ клиенту: `2 часа`
- переход этапа: `24 часа`
- tension critical: `15 минут`
- tension high: `2 часа`

## 9. Роль AI ROP / AI ROM
- AI ROP: SLA watchdog, контроль очередей, эскалации.
- AI ROM: качество исполнения ролей, причины провалов, предложения по ротации/парковке.

## 10. Текущее состояние реализации
Метрики и scorecards считаются в `backend/src/services/ManagerKpiService.js`.
Holacracy-метрики включены в расчет и попадают в period scorecard.
