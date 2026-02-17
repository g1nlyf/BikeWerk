# Холакратический CJM-слой (дополнение к CRM_CJM_Digitalization_v2)

Обновлено: 2026-02-16

## Что добавлено
В CRM добавлен управленческий слой, который не дублирует этапы заказа, а управляет качеством исполнения:
- круги,
- роли,
- tensions,
- парковка,
- профили амбиций.

## Таблицы
- `crm_holacracy_circles`
- `crm_holacracy_roles`
- `crm_holacracy_role_assignments`
- `crm_holacracy_tensions`
- `crm_holacracy_tension_events`
- `crm_holacracy_parking_sessions`
- `crm_holacracy_member_profiles`

## Связь с CJM
- CJM фиксирует «что происходит с заказом».
- Holacracy-слой фиксирует «кто за это отвечает и где системное напряжение».

## Связь с AI signal layer
Каждый tension синхронизируется в `ai_signals`, поэтому action-center и AI-агенты видят единый приоритетный список проблем.

## API
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

## Практический результат
AI РОП получает не только статусы заказов, но и цифровую картину управленческих проблем, задержек ответственности и ротаций команды.
