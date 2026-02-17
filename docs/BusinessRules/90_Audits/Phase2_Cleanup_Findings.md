# Phase-2 Cleanup Findings (AI-ROP / CRM)

## Scope
This document tracks architecture inconsistencies and code cleanliness risks discovered while implementing Phase-2 action layer.

## Implemented in this pass
1. Added Phase-2 action-layer storage in local CRM DB:
- `ai_signals`
- `ai_decisions`
- `ai_assignments`
- `ai_sla_violations`

2. Introduced unified signal service:
- `backend/src/services/AiSignalService.js`
- deduplicated signal creation (`createOrTouchSignal`)
- decision workflow (`approve/reject/reassign/snooze/resolve`)
- SLA/compliance signal recording helpers

3. Connected AI-ROP autopilot to action layer:
- SLA breaches now generate `ai_signals`
- compliance blocks now generate `ai_signals`

4. Added Admin API for action workflow:
- `GET /api/admin/ai-signals`
- `GET /api/admin/ai-signals/:signalId/decisions`
- `POST /api/admin/ai-signals/:signalId/decision`

5. Extended Admin Workspace payload:
- `ceo.ai_signals`
- `ceo.action_center` now includes AI signals + heuristics

6. Enforced pipeline transition discipline:
- `PATCH /api/v1/crm/orders/:orderId/status` now validates status transitions via canonical lifecycle (`canTransition`).

7. Admin dashboard status cleanup:
- migrated mini-CRM status selector to canonical order lifecycle set
- removed legacy status list from selector options
- added action buttons in Action Center for AI signal decisions

8. Stabilized CRM browser smoke E2E:
- `frontend/playwright.config.ts` now auto-starts backend + frontend for smoke run.
- Added `frontend` script: `npm run test:e2e:smoke`.
- Smoke spec was de-flaked from text-coupled selectors to structural selectors/API-assisted navigation.
- Added deterministic auth fallbacks (including primary CRM bootstrap account).

9. Runtime compatibility hardening:
- `backend/server.js` auth limiter is now configurable with `AUTH_RATE_LIMIT_MAX` (default unchanged).
- startup migration now ensures `users.is_active` exists.
- `AiRopAutopilotService` manager loader now has robust column-drift fallback (`active`/`is_active` optional).
- inspection fetch fallbacks now tolerate missing `stage`, `bike_id`, `quality_score` in legacy `inspections` schema.
- `telegram-bot/AdminBotService.js` polling can be disabled by env (`ADMIN_BOT_POLLING` / `BOT_POLLING`) for test runs.

## Critical inconsistencies still present

### P0 (high impact / should be next)
1. Local-first policy is still mixed in some CRM paths.
- Some endpoints/services still prioritize Supabase-first behavior.
- Risk: behavior divergence and non-deterministic reads/writes.

2. Massive frontend lint debt.
- `npm run lint` reports hundreds of violations across many unrelated legacy files.
- Risk: static quality gates cannot be enforced; regressions hide in noise.

3. `backend/server.js` remains monolithic.
- Business logic, metrics, admin APIs, and CRM logic are tightly coupled.
- Risk: regression probability is high for each change.

### P1 (important)
4. Multiple historical compatibility branches still active.
- Fallback branches for old schemas/statuses are spread across modules.
- Risk: hidden path drift and difficult debugging.

5. Encoding inconsistency in some files.
- Mixed character encoding history introduces readability and patching issues.
- Risk: broken diffs/patch tooling and accidental corruption.

6. Orchestrator side-effects still coupled to backend startup.
- `backend/server.js` instantiates orchestrator modules from `telegram-bot`, which can create noisy runtime side-effects.
- Risk: non-CRM subsystems impact CRM test/runtime stability.

7. Workspace action-center logic is partially heuristic and partially persisted.
- Signals are now persisted, but heuristic actions are still generated ad-hoc.
- Risk: duplicate priorities and inconsistent action ownership.

### P2 (optimization)
8. KPI and signal ownership model is not fully normalized.
- `manager_kpi_*` exists, but signal-to-manager ownership analytics is still basic.

9. Full local<->remote two-way sync for all new entities is incomplete.
- CRM core sync exists, but action-layer tables are local-only for now.

## Recommended cleanup sequence (next sprint)
1. Extract Admin AI routes from `backend/server.js` into dedicated module.
2. Move CRM status mutation into shared service (single write path, reused by all routes).
3. Normalize source-of-truth mode flags (`local_primary`, `remote_fallback`) across all CRM writes.
4. Introduce incremental lint-baseline strategy (module-by-module cleanup, start with CRM/admin surface).
5. Add integration tests for:
- single status transition guard
- bulk transition guard
- AI signal decision workflow
- CRM checklist fallback against legacy `inspections` schema
6. Add periodic KPI snapshots linked to assignment/signal outcomes.

## Acceptance target for "clean pipeline"
- All CRM writes go through one canonical status-transition service.
- No endpoint can bypass transition rules.
- Action-center decisions always persist as `ai_decisions` and are queryable.
- Admin UI status options and backend status lifecycle use the same canonical dictionary.
- Local-first behavior is explicit and observable on every response (`storage_mode`).
