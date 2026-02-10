# CRM Sprint 2 Report

## Scope
Sprint 2 delivers the manager-facing CRM interface (dashboard, orders, customers, leads, tasks) with protected access, plus manager API endpoints for the same data. It builds on the existing CRM data in the local SQLite database and the existing auth stack.

## What Was Implemented

### Frontend (Manager CRM UI)
- Routes and access control
  - /crm/login public login page.
  - /crm/complete-profile for forced email + password reset.
  - /crm/* protected manager area (role guard: manager or admin).
- Core pages
  - Dashboard with KPIs, mini-kanban by status, and urgent tasks.
  - Orders list with filters, manager assignment, and status update.
  - Order detail view with inspection checklist, timeline, finance, and logistics blocks.
  - Customers list with search.
  - Leads list with status updates and conversion action.
  - Tasks list with create + status toggling.
- CRM UI shell
  - Dedicated layout with sidebar, header, and separate app shell (no store navigation/widgets).
  - BikeWerk minimal theme: black/white, soft shadows, rounded corners.

### Backend (Manager CRM API)
- Manager-only endpoints (JWT + role guard):
  - GET /api/v1/crm/customers
  - GET /api/v1/crm/customers/:customerId
  - PATCH /api/v1/crm/customers/:customerId
  - GET /api/v1/crm/leads
  - GET /api/v1/crm/leads/:leadId
  - PATCH /api/v1/crm/leads/:leadId
  - POST /api/v1/crm/leads/:leadId/convert
  - GET /api/v1/crm/tasks
  - POST /api/v1/crm/tasks
  - PATCH /api/v1/crm/tasks/:taskId
  - DELETE /api/v1/crm/tasks/:taskId
- Order management
  - PATCH /api/v1/crm/orders/:orderId/status
  - PATCH /api/v1/crm/orders/:orderId/manager
- Local DB support
  - Uses SQLite tables already present in backend/database/eubike.db (orders, customers, applications, tasks).

## How It Works (Logic)

### Authentication
- Manager logs in via /crm/login using email or phone + password.
- The frontend stores authToken and currentUser in localStorage.
- If the user is flagged with must_change_password or must_set_email, they are forced to /crm/complete-profile and must update email + password. After completion, a new JWT token is returned.

### Orders
- /crm/orders loads from /api/v1/crm/orders with filters (status, manager, dates, amount range).
- Managers can update status and assign themselves (or another manager) from the table.
- /crm/orders/:orderId fetches full detail, including inspection checklist, timeline events, and logistics.

### Customers
- /crm/customers displays customers and supports search by name/email/phone/city.

### Leads
- /crm/leads displays applications as leads; manager can update status or convert to order.

### Tasks
- /crm/tasks displays tasks; manager can create tasks and toggle completion.

## How It Works (Technical)

### Frontend
- React Router routes in frontend/src/routes/AppRouter.tsx.
- CRM app shell: frontend/src/pages/crm/CRMLayout.tsx with CRMSidebar + CRMHeader.
- Protected routing: frontend/src/components/crm/ProtectedRoute.tsx.
- CRM API client: frontend/src/api/crmManagerApi.ts.

### Backend
- CRM manager endpoints defined in backend/server.js with authenticateToken + requireManagerRole.
- Uses existing SQLite schema and data in backend/database/eubike.db.

## Known Limitations
- npm run lint currently fails due to pre-existing lint errors across the broader codebase. CRM files were typed to avoid new any errors.
- Full Playwright suite has multiple failures due to base URL mismatches and non-CRM UI expectations.

## How To Run

### Backend
```
node backend/server.js
```
Server defaults to http://localhost:8082.

### Frontend
```
cd frontend
npm run dev -- --host --port 5175
```
Frontend is available at http://localhost:5175.

### Manager Login
- Email: crm.manager@local
- Password: crmtest123

If a manager is flagged to reset profile, you will be redirected to /crm/complete-profile.

## Tests Executed
- npm run lint (frontend) - fails due to existing lint errors outside CRM.
- npx playwright test - 9 passed, 47 failed. Major failure reasons:
  - Several tests hardcode different base URLs (http://localhost:4174, http://localhost:5176) while the dev server runs on http://localhost:5175.
  - Some tests expect backend at http://localhost:8081 while the API is on http://localhost:8082.
  - Multiple UI selector expectations fail on catalog/product/landing pages (unrelated to CRM).
- npx playwright test tests/crm-login.spec.ts - passes.
- node backend/scripts/crm-sprint1-tests.js - passes (validates CRM endpoints).

## Files Added / Updated
- Frontend CRM UI: frontend/src/pages/crm/*, frontend/src/components/crm/*, frontend/src/api/crmManagerApi.ts.
- Backend CRM endpoints: backend/server.js.
- CRM Playwright test: frontend/tests/crm-login.spec.ts.
