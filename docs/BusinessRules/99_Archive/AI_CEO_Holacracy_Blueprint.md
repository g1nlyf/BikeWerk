# AI-CEO + Holacratic AI Network Blueprint (EUBike)

Статус: Draft v1 (для согласования)  
Дата: 2026-02-15  
Основание: текущая код-база `frontend/backend/telegram-bot/manager-bot/client-telegram-bot` + документы `docs/BusinessRules/ProjectBibleLatest.md`, `docs/BusinessRules/ProjectBible.md`, `docs/BusinessRules/CashflowLogic.md`.

## Пакет документов по ролям

Детализация ролей, связей и тестирования вынесена в отдельные файлы:
- `docs/BusinessRules/AIAgents/Holacracy_Final_System_Architecture.md`
- `docs/BusinessRules/AIAgents/AI_ROP_MVP.md`
- `docs/BusinessRules/AIAgents/AI_CEO.md`
- `docs/BusinessRules/AIAgents/AI_ROM.md`
- `docs/BusinessRules/AIAgents/AI_CRO.md`
- `docs/BusinessRules/AIAgents/AI_Traffic_Lead.md`
- `docs/BusinessRules/AIAgents/AI_CFO.md`
- `docs/BusinessRules/AIAgents/AI_Head_of_Quality.md`
- `docs/BusinessRules/AIAgents/AI_CTO_SRE.md`
- `docs/BusinessRules/AIAgents/AI_GRC.md`

---

## 1. Цель системы

Построить не просто “чат-ассистента”, а операционную систему компании:
- AI-CEO как управляющий интеллект по прибыли, рискам и скорости.
- Сеть специализированных AI-ролей (круги холакратии), где каждый отвечает за свою метрику и зону риска.
- Прозрачная ответственность: у каждого сигнала есть владелец, SLA, статус исполнения.
- Единый контур управления: Admin Dashboard + Telegram (для уведомлений и команд).

---

## 2. Почему не один AI-CEO, а сеть AI-ролей

Рекомендация: **гибридная модель**.

- Один “толстый” AI-CEO быстро превращается в узкое горлышко и теряет фокус на деталях.
- Отдельные AI-РОП / AI-РОМ / AI-CFO / AI-CTO дают глубину в своей доменной зоне.
- AI-CEO должен быть не исполнителем всего, а:
1. Арбитром при конфликте приоритетов.
2. Приоритизатором задач между кругами.
3. Контролером общего P&L, скорости и надежности системы.

Итог: **сеть AI-сотрудников + AI-CEO как уровень управленческого синтеза**.

---

## 3. Контекст текущей системы (что уже есть)

### 3.1 Admin и метрики
- Переключатель persona: `Упрощенный / CEO / CTO` уже реализован в `frontend/src/pages/AdminDashboard/AdminMobileDashboard.tsx`.
- Единый backend endpoint: `/api/admin/workspace` (собирает `ceo` + `cto` payload).
- В `workspace` уже есть:
  - KPI, comparison, narrative, action_center, simple_pulse.
  - finance daily + cashflow forecast.
  - funnel, loss points, traffic, partners/referrals.
  - mini CRM (orders, leads, tasks).
  - margin leak detector, deal risk radar.
  - cto health, anomalies, incidents, test logs.

### 3.2 CRM и статусы
- Управление статусами: `/api/v1/crm/orders/:orderId/status`, bulk update, bulk assign.
- Набор статусов уже стандартизован (`pending_manager`, `under_inspection`, `awaiting_payment`, `in_transit`, `delivered`, etc).
- Ведется `order_status_events`.

### 3.3 Боты
- `ManagerBotService` (backend): уведомления менеджерам, принятие заявки, перевод статусов, AI-инспекция, AI-анализ переписки с продавцом.
- `telegram-bot/AdminBotService`: admin команды, alert/digest framework.
- `client-telegram-bot`: клиентские уведомления по заказам.

### 3.4 Бизнес-правила
- `ProjectBibleLatest.md`: детально про миссию, риски, проверки, оплату, гарантии, компенсации, compliance.
- `CashflowLogic.md`: источник формул ценообразования и маржинальности.
- В `ProjectBibleLatest.md` оглавление содержит разделы 14–22, но текущая версия файла фактически обрывается на 13 (нужно дозаполнить как отдельную задачу контента).

---

## 4. Архитектура AI-организации (холакратия)

## 4.1 Circle Map

1. **Circle A: Strategy (AI-CEO)**
- Роль: главный оркестратор.
- North Star: прибыльность + предсказуемый рост + низкий операционный риск.

2. **Circle B: Revenue (AI-CRO + AI-Traffic Lead)**
- Отвечает за входящий поток, воронку, конверсию, attribution.

3. **Circle C: Sales Operations (AI-РОП + AI-РОМ)**
- Отвечает за скорость обработки лидов/заказов, дисциплину статусов, SLA менеджеров.

4. **Circle D: Unit Economics (AI-CFO)**
- Отвечает за маржу, утечки, cashflow, forecast, ценообразование по правилам CashflowLogic.

5. **Circle E: Trust & Quality (AI-Head of Quality)**
- Отвечает за качество проверки, компенсации, клиентские риски, соответствие ProjectBible.

6. **Circle F: Platform Reliability (AI-CTO / AI-SRE)**
- Отвечает за uptime, аномалии, деградации, техдолг, guardrails.

7. **Circle G: Knowledge & Compliance (AI-GRC)**
- Отвечает за санкционное соответствие, регуляторные ограничения, актуальность внутренних правил.

---

## 4.2 Подробно по каждой AI-роли

## AI-CEO (Strategy Circle Lead)
**Цель:** максимизировать “здоровую прибыль” и скорость оборота без нарушения рисковых границ.  
**Входы:** `workspace.ceo`, `workspace.cto`, action center, anomalies, CRM queue, growth overview.  
**Решения:**
- Приоритизация кризисов (`critical/high/medium`).
- Назначение владельцев задач в круги.
- Эскалация в Telegram по уровню критичности.
**Выходы:**
- Daily CEO Brief.
- План 24h / 7d / 30d.
- Decision Log (что решили, почему, ожидаемый эффект).

## AI-РОП (Sales Performance)
**Цель:** скорость прохождения заказов по pipeline.  
**KPI:** waiting_manager_orders, time-to-next-status, доля “застрявших” >72h.  
**Действия:**
- Авто-раскидка очереди, рекомендации по приоритетам менеджеров.
- Контроль соблюдения SLA обновления статусов.
- Список “горящих” заказов с шаблонами действий.

## AI-РОМ (Manager Operations)
**Цель:** качество работы менеджеров и стандартизация коммуникаций.  
**KPI:** throughput per manager, error rate в статусах, возвраты из-за операционных ошибок.  
**Действия:**
- Персональные scorecards менеджеров.
- AI-подсказки для next best action по каждому заказу.
- Контроль полноты данных перед сменой статуса.

## AI-CRO (Conversion Optimization)
**Цель:** рост конверсии от сессии до брони/заказа.  
**KPI:** loss points, booking success reach, checkout errors, contract coverage funnel.  
**Действия:**
- Выявление главного drop-off.
- Генерация гипотез и планов A/B.
- Запуск и анализ экспериментов через существующий experiment контур.

## AI-Traffic Lead
**Цель:** качество входящего трафика и attribution.  
**KPI:** channel quality, partner conversion, CAC surrogate, campaign efficiency.  
**Действия:**
- Рекомендации по отключению “пустых” источников.
- Развитие referral каналов.
- Ежедневная приоритизация каналов с лучшим ROI.

## AI-CFO (Unit Economics)
**Цель:** контроль экономики каждого заказа и общего cashflow.  
**KPI:** margin_pct, margin_leak_count, realized/booked gap, forecast confidence.  
**Действия:**
- Поиск утечек сервисной маржи.
- Выявление аномальных заказов по финансовой структуре.
- Рекомендации изменения тарифов/доставки/опций по правилам `CashflowLogic.md`.

## AI-Head of Quality
**Цель:** минимизация клиентских потерь и претензий.  
**KPI:** компенсации, серьезные дефекты, доля споров, причины возвратов.  
**Действия:**
- Контроль соответствия сделок принципам ProjectBible.
- Триггеры на дефекты, delayed delivery, риск-компенсации.
- Раннее предупреждение “сделка токсична”.

## AI-CTO / AI-SRE
**Цель:** стабильность платформы и достоверность данных.  
**KPI:** api p95, error rate, anomaly count, funnel contract health.  
**Действия:**
- Incident triage.
- Контроль деградаций и data quality.
- Рекомендации по runbooks/тестам/авто-проверкам.

## AI-GRC (Governance, Risk, Compliance)
**Цель:** соответствие ограничениям и внутренним правилам.  
**KPI:** число compliance-рисков, полнота документов, своевременность обновления правил.  
**Действия:**
- Контроль правил “< €5000” и санкционных ограничений.
- Проверка, что контент/скрипты/процессы не расходятся с Source of Truth.
- Ежеквартальный compliance digest.

---

## 5. Механика работы системы

## 5.1 Единый “Decision Engine”

Слой над `workspace` формирует:
- `signal` (проблема/возможность),
- `owner_circle`,
- `priority`,
- `expected_impact`,
- `deadline/SLA`,
- `autonomous_action` или `requires_approval`.

Структура сигнала:
1. `id`
2. `source`
3. `metric`
4. `actual vs target`
5. `root-cause hypothesis`
6. `recommended action`
7. `owner`
8. `due_at`
9. `status`
10. `result`

## 5.2 RACI (кратко)
- AI-CEO: A (Accountable) за итоговую прибыль и приоритеты.
- Circle-агенты: R (Responsible) за исполнение в зоне.
- Человек-оператор/руководитель: финальное утверждение high-risk действий.

## 5.3 SLA
- `critical`: реакция ≤ 15 мин.
- `high`: ≤ 2 часа.
- `medium`: ≤ 24 часа.
- `low`: в weekly review.

---

## 6. Admin Dashboard: целевая реализация

## 6.1 Новый режим persona
Добавить 4-й переключатель:
- `Упрощенный | CEO | CTO | AI CEO`

`AI CEO` должен показывать:
1. Executive Brief (короткий диагноз дня).
2. Crisis Panel (критичные сигналы с owner/SLA).
3. Profit Engine (маржа, утечки, forecast, realized gap).
4. Funnel Command (main drop, prioritized fixes).
5. Team Performance (manager load / bottlenecks).
6. Trust & Risk (компенсации, спорные сделки, риск-профиль).
7. AI Decisions Log (что предложено/принято/отклонено).

## 6.2 Командный центр действий
Для каждого сигнала:
- кнопка `Принять`,
- `Назначить`,
- `Отложить`,
- `Отклонить (с причиной)`,
- `Открыть связанный модуль`.

## 6.3 Что можно автоматизировать сразу
- Авто-генерация ежедневного CEO-нарратива.
- Авто-ранжирование top-10 проблем.
- Авто-план на 24 часа.
- Авто-Telegram digest (morning/evening).

---

## 7. Telegram интеграция (admin + manager)

## 7.1 Каналы уведомлений
1. **Admin channel** (для AI-CEO и AI-CFO/AI-CTO critical alerts).
2. **Manager channel(s)** (операционные задачи и SLA).
3. **Личные уведомления** ответственным менеджерам.

## 7.2 Формат AI-CEO уведомления
- Заголовок: `[CRITICAL][AI-CEO] ...`
- Факт: метрика + отклонение.
- Риск в деньгах/конверсии.
- Рекомендованное действие.
- Кнопки: `Approve / Reassign / Snooze / Open Dashboard`.

## 7.3 Команды управления
- `/ceo_brief` — краткий свод.
- `/ceo_signals` — активные сигналы.
- `/ceo_decide <signal_id> approve|reject|snooze`.
- `/ceo_assign <signal_id> <owner>`.
- `/ceo_kpi` — ключевые KPI.
- `/ceo_risks` — риск-радар.

---

## 8. Данные и хранилище (что добавить)

Новые таблицы (минимум):
1. `ai_signals`
2. `ai_decisions`
3. `ai_assignments`
4. `ai_digest_history`
5. `ai_agent_health`
6. `ai_playbook_versions`

Опционально:
7. `ai_postmortems`
8. `ai_hypotheses` (для CRO экспериментов)
9. `ai_sla_violations`

---

## 9. Правила автономии и безопасность

## 9.1 Что AI может делать сам
- Формировать рекомендации.
- Готовить задания и расстановку приоритетов.
- Обновлять “AI-внутренние” статусы в своих таблицах.

## 9.2 Что только через подтверждение человека
- Изменение статуса заказа в рискованных стадиях.
- Финансовые корректировки, влияющие на деньги клиента.
- Массовые изменения политик/цен.
- Любые действия, затрагивающие compliance/санкции.

## 9.3 Guardrails
- Kill switch: полное отключение автодействий.
- Scope limiter по ролям.
- Полный audit trail по каждому решению.

---

## 10. Roadmap внедрения

## Phase 0 (1–2 дня) — Design freeze
- Согласовать роли, KPI, SLA, правила автономии.
- Утвердить таксономию сигналов и статусы сигналов.

## Phase 1 (3–5 дней) — AI-CEO Read-Only
- Новый режим `AI CEO` в админке (только чтение + объяснения).
- Генерация daily brief и signal list из `/admin/workspace`.
- Telegram digest без кнопок управления.

## Phase 2 (5–7 дней) — Action Layer
- `ai_signals` + `ai_decisions`.
- Кнопки approve/reject/reassign в админке.
- Telegram командный слой.

## Phase 3 (7–10 дней) — Circle Agents
- Запуск AI-РОП, AI-РОМ, AI-CFO, AI-CRO, AI-CTO как отдельных execution модулей.
- Owner routing, SLA monitor, escalation.

## Phase 4 (7–10 дней) — Полуавтономия
- Ограниченные автодействия низкого риска.
- Self-check loop и weekly postmortem.

## Phase 5 (постоянно) — Оптимизация
- Улучшение точности рекомендаций.
- Расширение playbooks.
- Ретроспективы “сигнал → действие → финансовый эффект”.

---

## 11. KPI системы AI-сотрудников

## Бизнес
- Net margin EUR.
- Margin %.
- Realized/Booked revenue ratio.
- Lead-to-order conversion.
- Checkout-to-booking conversion.

## Операции
- Median time in status.
- SLA breach rate.
- Queue aging >72h.
- Manager throughput.

## Риски и качество
- Compensation count/amount.
- High-risk order share.
- Anomaly count (critical/high).
- Data contract violations.

## Эффективность AI
- Accepted recommendation rate.
- Decision-to-impact cycle time.
- False positive signal rate.
- Profit uplift attributable to AI actions.

---

## 12. Готовые playbooks (первые 10)

1. Падение маржи ниже порога.
2. Рост queue waiting_manager.
3. Spike cancellation/refund.
4. Checkout failure spike.
5. API latency degradation.
6. Attribution coverage collapse.
7. Partner channel quality drop.
8. Повышенный риск по сделке > threshold.
9. Рост компенсаций > baseline.
10. Просадка delivered velocity.

Для каждого playbook: trigger, owner, SLA, steps, rollback, success criteria.

---

## 13. Что сделать сразу после утверждения этого документа

1. Добавить в админку persona `AI CEO` (UI + связка с текущим `workspace`).
2. Добавить backend слой `ai-signals` (read/write).
3. Подключить Telegram workflow (digest + команды + approve/reassign).
4. Включить RACI/SLA board внутри админки.
5. Запустить MVP кругов: AI-РОП + AI-CFO + AI-CTO + AI-CEO.

---

## 14. Отдельное замечание по документации Source of Truth

`ProjectBibleLatest.md` сейчас логически ключевой документ, но в текущем состоянии фактическое содержание обрывается после раздела 13, хотя в оглавлении заявлены 14–22.  
Рекомендуется как отдельная задача:
- синхронизировать полный контент 14–22 (возможно из `ProjectBible.md`),
- после синхронизации зафиксировать новую версию как единую правду для AI-GRC.

---

## 15. Финальное решение по вопросу “AI-CEO или AI-РОП/AI-РОМ + AI-CEO сверху”

Рекомендуемая целевая модель:
1. **Да, делать отдельных AI-РОП/AI-РОМ/AI-CFO/AI-CRO/AI-CTO.**
2. **Да, ставить AI-CEO над ними как арбитра и стратега.**
3. **Да, строить это как холакратию кругов с явной ответственностью за прибыль.**

Это даст масштабируемость, прозрачность и реальную управляемость бизнеса, а не “еще один чат-бот”.
