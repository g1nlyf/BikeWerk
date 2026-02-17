# Адаптация под модель «Точка» (Holacracy) для EUBike

Обновлено: 2026-02-16

## 1. Цель
Перевести управление продажами и клиентским сервисом с модели «должность + ручной контроль» на модель:
- `круги` (circles) вокруг клиентского пути,
- `роли` с явной ответственностью,
- `напряжения` (tensions) как обязательный вход в улучшения,
- `парковка` как безопасный механизм ротации без штрафов.

Принцип: максимум свободы в способе выполнения, максимум прозрачной ответственности за результат.

## 2. Как это реализовано в коде
Локальная SQLite (primary source) дополнена сущностями holacracy:
- `crm_holacracy_circles`
- `crm_holacracy_roles`
- `crm_holacracy_role_assignments`
- `crm_holacracy_tensions`
- `crm_holacracy_tension_events`
- `crm_holacracy_parking_sessions`
- `crm_holacracy_member_profiles`

Также добавлены аналитические представления:
- `crm_holacracy_role_coverage_v`
- `crm_holacracy_tensions_live_v`

Инициализация и seed встроены в `backend/src/js/mysql-config.js`.

## 3. Круги (структура EUBike)
По умолчанию создаются круги:
1. `brand_growth` — качество и предсказуемость входящего потока.
2. `sales_opening` — конверсия брони в оплату и качество коммуникации.
3. `delivery_ops` — выкуп, логистика, трекинг этапов.
4. `client_care` — поддержка, жалобы, удержание доверия.
5. `risk_compliance` — санкционно-таможенный и юридический контур.
6. `governance` — роли, tensions, парковка, эволюция правил.

## 4. Роли (пример базового набора)
- `circle_lead`
- `deal_owner`
- `sla_guardian`
- `flow_operator`
- `client_advocate`
- `compliance_partner`
- `tension_facilitator`

Важно: один сотрудник может нести несколько ролей одновременно.

## 5. Tensions: обязательный механизм улучшений
### 5.1 Что такое tension
Любой обнаруженный разрыв между «как есть» и «как должно быть»:
- процессный,
- клиентский,
- SLA,
- качественный,
- комплаенс,
- нагрузочный.

### 5.2 Pipeline tensions
Статусы:
- `open`
- `in_progress`
- `blocked`
- `resolved`
- `cancelled`

SLA по серьезности:
- `critical` — 15 минут
- `high` — 2 часа
- `medium` — 24 часа
- `low` — 72 часа

Каждый tension логируется в `crm_holacracy_tension_events`.

### 5.3 Связка с AI-контуром
При создании tension автоматически создается/обновляется `ai_signal` (`entity_type=tension`), чтобы AI ROP/AI CEO мог:
- видеть очереди напряжений,
- приоритизировать,
- контролировать закрытие.

## 6. Парковка (без штрафов)
Если роль не матчится с текущей нагрузкой/амбицией:
1. сотрудник переводится в `parking`;
2. формируется план поддержки/ротации;
3. по итогам — `reassigned` или `exited`.

Данные хранятся в `crm_holacracy_parking_sessions`.

## 7. Профили амбиций и Performance Review
Таблица `crm_holacracy_member_profiles` хранит:
- `ambition_statement`
- сильные стороны (`strengths_json`)
- предпочитаемые роли (`preferred_roles_json`)
- `growth_goal`
- `autonomy_level`
- `match_score` (0..100)
- даты ревью

Это связывает развитие человека с целями бизнеса (match-модель).

## 8. API (реализовано)
- `GET /api/v1/crm/holacracy/overview`
- `GET /api/v1/crm/holacracy/circles`
- `POST /api/v1/crm/holacracy/roles/:roleId/assign` (admin)
- `PATCH /api/v1/crm/holacracy/members/:userId/profile`
- `GET /api/v1/crm/holacracy/tensions`
- `POST /api/v1/crm/holacracy/tensions`
- `PATCH /api/v1/crm/holacracy/tensions/:tensionId`
- `GET /api/v1/crm/holacracy/parking`
- `POST /api/v1/crm/holacracy/parking` (admin)
- `PATCH /api/v1/crm/holacracy/parking/:parkingId/complete` (admin)

## 9. High-risk действия
Автономно (низкий риск):
- создание tension,
- обновление статусов tension,
- назначение follow-up,
- рутинные перераспределения задач.

Только с human approval (высокий риск):
- финансовые решения (refund/compensation payout),
- юридически чувствительные изменения,
- массовые статусные операции, влияющие на деньги/обязательства.

## 10. Что это дает бизнесу
- Нет «потерянных» проблем: все уходит в tensions.
- Нет микроменеджмента: ответственность закреплена ролями и прозрачными логами.
- Быстрая адаптация процессов без переписывания оргструктуры.
- AI-управление работает на данных, а не на чате/догадках.
