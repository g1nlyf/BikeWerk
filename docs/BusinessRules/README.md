# Business Rules Docs

Updated: 2026-02-16

## Структура
- `01_Core/` — источник истины по бизнес-логике и расчетам.
- `02_CRM/` — CJM, CRM-пайплайны, статусы refund/compensation.
- `03_Management/` — менеджмент, KPI, мотивация, holacracy-подход.
- `04_AI_Agents/` — роли и архитектура AI-агентов.
- `90_Audits/` — техаудиты и cleanup findings.
- `99_Archive/` — устаревшие/черновые документы (не использовать как SoT).

## Canonical документы (использовать в первую очередь)
1. `01_Core/ProjectBibleLatest.md`
2. `01_Core/CashflowLogic.md`
3. `01_Core/OrderLifecycleAndCompliance.md`
4. `01_Core/CRM_Order_Status_Lifecycle.md`
5. `02_CRM/CRM_CJM_Digitalization_v2.md`
6. `02_CRM/Refund_Compensation_Statuses.md`
7. `03_Management/Manager_KPI_Motivation_Model.md`
8. `03_Management/Tochka_Holacracy_Adaptation.md`

## Что считается неактуальным
- Файлы в `99_Archive/`.
- Draft-документы, если они противоречат canonical списку выше.

## Правило обновлений
При изменении бизнес-логики сначала обновляются canonical файлы, затем связанные role/docs.
