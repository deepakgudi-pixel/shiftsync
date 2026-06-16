# Relay — Developer Concepts Guide

This guide covers the architecture, patterns, and conventions needed to work confidently on the Relay codebase.

---

## Prerequisites

- JavaScript/TypeScript (ES2020+, async/await, modules)
- Node.js (event loop, npm, CommonJS)
- HTTP/REST (status codes, methods, headers, middleware)
- SQL (SELECT, INSERT, UPDATE, JOIN, transactions)
- React fundamentals (components, hooks, effects)
- Git basics

---

## Frontend

### Next.js 14 (App Router)

- File-based routing: folders in `src/app/` become routes
- `'use client'` directive marks components that run in the browser
- Layouts in `layout.tsx` wrap all child pages automatically
- `error.tsx` handles runtime errors; `middleware.ts` gates entire route groups
- All authenticated pages live under the root layout which includes `<ClerkProvider>`

Key files:
- `src/app/layout.tsx` — root layout with ClerkProvider + AppLayout wrapper
- `src/app/dashboard/page.tsx` — composes `useDashboard` hook + sub-components
- `src/app/payroll/page.tsx` — composes `usePayroll` hook + payroll components
- `middleware.ts` — protects all `/app/**` routes via Clerk session check

### Feature-Slice Architecture

Pages are kept thin (< 170 lines). Each feature owns its code in `src/features/<feature>/`:

```
features/
├── payroll/
│   ├── constants.ts          # Tab/modal IDs + currency list
│   ├── utils.ts              # formatMoney(), getCurrencySymbol()
│   ├── hooks/usePayroll.ts   # ALL data fetching + actions for payroll
│   └── components/           # OverviewTab, PayPeriodsTab, PayrollModals, …
├── dashboard/
│   ├── hooks/useDashboard.ts # ALL data fetching + socket + actions
│   └── components/           # AdminStats, AnalyticsChart, UpcomingShifts, …
└── landing/
    └── components/           # WebGLHero, BentoGrid, Comparison, …
```

**Rule**: If a component needs data, the hook fetches it. The component receives it as props and renders it. No fetching inside leaf components.

### TypeScript

- All shared API interfaces live in `src/types/index.ts`
- Backend source lives in `backend/src/**/*.ts` and compiles to `backend/dist/`
- Use typed interfaces over `any` — `any` is treated as a lint violation
- `catch (err: unknown)` with typed narrowing: `const e = err as { response?: ... }`
- New shared types: `PayPeriodTimesheet`, `PayPeriodSummary`, `TimesheetEmployee`, `PayslipWithPeriod`, `EmployeeRate`, `ProcessPayPeriodResult`

### Custom Hooks

- **`useApi()`** — Axios instance with automatic Clerk JWT injection on every request
- **`useSocket(orgId, memberId)`** — Socket.io connection with room join + reconnect recovery + `SOCKET_RESYNC_EVENT` broadcast

### Shared Components

- `AppLayout` — wraps all authenticated pages with Sidebar and mobile header
- `Sidebar` — navigation with Clerk auth, org-scoped delete modal, demo-user guards

---

## Backend

### Request Lifecycle

```
HTTP Request
  → Rate limiter (global 1000 req/15min, skips ADMIN)
  → routes/index.ts (route registry)
    → middleware/auth.ts (Clerk JWT → req.member + req.clerkUserId)
      → requireRole() (RBAC check)
        → express-validator (input validation)
          → service layer (DB queries, business logic)
            → emitEvent() (event log write)
              → logAudit() (audit log write)
                → Socket.io broadcast
                  → HTTP response
```

### Service Layer (Added in May 2026 Refactor)

Domain logic lives in `src/services/`, not in route files:

| Service | Responsibility |
|---|---|
| `payrollService.ts` | Pay period CRUD, payroll processing, snapshot insertion, employee rate queries |
| `shiftService.ts` | Shift CRUD, conflict detection, swap requests, permission helpers |
| `attendanceService.ts` | Clock-in/out transactions, timesheet aggregation, live attendance |

**Rule**: Route files handle HTTP concerns only (auth, validation, status codes, req/res). Service files handle all database interaction and domain logic.

### Route Registry

`src/routes/index.ts` is the single source of truth for base paths:

```javascript
const routes = [
  { path: '/api/shifts',     router: require('./shifts') },
  { path: '/api/attendance', router: require('./attendance') },
  { path: '/api/payroll',    router: require('./payroll') },
  // ...
];
// Registered in index.ts with: for (const route of routes) app.use(route.path, route.router)
```

To add a new API domain: create `src/routes/myfeature.ts`, then add it to this array.

### PostgreSQL (node-postgres)

- Connection pool: `src/db/client.ts` — exports `{ query, pool }`
- Always use parameterised queries: `$1`, `$2` — never string interpolation
- Transactions for multi-step writes:
  ```javascript
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // ... queries
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();   // ← always release, even on error
  }
  ```
- `FOR UPDATE` row locks in `attendanceService` prevent race conditions on clock-in

### Auth Middleware

- `requireAuth` — verifies Clerk JWT, attaches `req.member` (full DB row) and `req.clerkUserId`
- `requireRole('ADMIN', 'MANAGER')` — checks `req.member.role`; returns 403 if not satisfied
- Dev bypass: `x-dev-clerk-user-id` header accepted on localhost with `NODE_ENV=development`

### Event System

- `events` table — canonical, append-only event log (DB trigger blocks UPDATE/DELETE)
- `emitEvent({ client, organisationId, memberId, eventType, entityType, entityId, payload, req })` — writes to event log, optionally within an open transaction
- Event type constants: `src/lib/events.ts`
- Downstream: Socket.io broadcasts events to `org:${id}` and `user:${id}` rooms

### Audit Logging

- `logAudit({ organisationId, memberId, clerkUserId, action, entityType, entityId, oldValues, newValues, req })` — writes a structured record with before/after state, IP, and user agent
- Non-blocking: errors in audit logging are caught and logged but never propagate to the main operation
- Append-only: `audit_logs` has the same DB trigger protection as `events`

### Payroll Calculations

- `src/lib/payrollCalculations.ts` — pure, side-effect-free math functions
- `calculatePayrollTotals({ dailyHours, hourlyRate, overtimeMultiplier, rule })` — handles both daily and weekly OT thresholds, picks the larger result
- `roundToCents()` for financial-safe rounding
- `normalizeOvertimeRule()` — ensures consistent field types regardless of DB/default source

---

## Database

### Multi-tenant Design

Every core table has `organisation_id`. All queries must filter by `req.member.organisation_id`. Cross-org data access is architecturally prevented — never trust a client-supplied org ID.

### Immutable Tables

`events` and `audit_logs` have DB triggers that block UPDATE and DELETE:

```sql
CREATE TRIGGER block_events_delete
BEFORE DELETE ON events
FOR EACH ROW EXECUTE FUNCTION block_events_modification();
```

### Key Relationships

```
organisations
  ├── members (one-to-many)
  ├── shifts (one-to-many)
  │     ├── clock_events (one-to-many)
  │     └── swap_requests (one-to-many)
  ├── pay_periods (one-to-many)
  │     ├── payslips (one-to-many)
  │     └── payroll_snapshots (one-to-many)
  ├── employee_rates (via members)
  ├── overtime_rules (one-to-many)
  ├── announcements (one-to-many)
  └── events / audit_logs (append-only)
```

### Payroll Snapshot Pattern

When a pay period is processed, a `payroll_snapshot` is written for each employee containing:
- The hourly rate **at that moment** (`hourly_rate`, `effective_rate_id`)
- The overtime rule **at that moment** (all threshold/multiplier fields)
- Computed hours and earnings

This means re-processing is idempotent (returns cached result) and historical payslips reflect the rates that were actually in effect — not current rates.

---

## Real-time

### Socket.io Rooms

- `org:${id}` — org-wide broadcasts: shift updates, announcements, attendance events
- `user:${id}` — private: notifications, messages, shift assignments

### Connection Auth

Every socket handshake requires a Clerk JWT in `socket.handshake.auth.token`. The socket server verifies it and stores `socket.clerkUserId`. On `join:org`, the member's org ownership is verified against the DB before room admission.

### Reconnect Recovery

1. Client stores `lastEventTimestamp` in localStorage on every event
2. On reconnect: client rejoins rooms, fetches `/api/events/since?since=<timestamp>`
3. Replays missed events, then refreshes from authoritative API endpoints
4. `SOCKET_RESYNC_EVENT` (custom DOM event) triggers `loadDashboard()` silently

---

## Security Model

| Layer | Mechanism |
|---|---|
| Auth | Clerk JWT verified on every API request AND socket handshake |
| RBAC | `requireRole()` middleware on every mutating route |
| Org scoping | Every query filters `organisation_id = req.member.organisation_id` |
| Headers | Helmet.js: CSP, HSTS (1yr + preload), X-Frame-Options: DENY, noSniff |
| CORS | Restricted to `FRONTEND_URL` plus optional `FRONTEND_URLS` origins |
| Rate limiting | 1000 req/15min globally; per-user keyed by `member.id`; ADMIN role skipped |
| Input validation | `express-validator` on all POST/PUT/PATCH routes |
| SQL injection | Parameterised queries only — no string interpolation ever |
| Encryption | AES-256-GCM for message content (`src/lib/encryption.ts`) |
| Debug endpoints | `/api/attendance/debug*` require non-production `NODE_ENV` and `ATTENDANCE_DEBUG_ENDPOINTS_ENABLED=true` |
| Demo access | `/api/dev/demo-*` routes are unavailable in `NODE_ENV=production`, even if `DEMO_ACCESS_ENABLED=true` |
| Shift concurrency | Schedule updates send `If-Match` using `shifts.version`; stale updates return `409 SHIFT_VERSION_CONFLICT` |
| Demo protection | Demo org deletion blocked server-side by email allowlist check |

---

## Development Workflow

```bash
# Install
cd backend  && npm install
cd frontend && npm install

# One-time setup (creates DB schema + demo data)
cd backend && npm run demo:seed

# Run
cd backend  && npm run dev    # → http://localhost:4000
cd frontend && npm run dev    # → http://localhost:3000

# Test (backend integration tests)
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Browser UX verification
cd frontend && npm run verify:ux

# Lint
cd backend  && npm run lint
cd frontend && npm run lint

# Typecheck
cd frontend && npx tsc --noEmit
```

---

## Key Files to Read First

| File | Why |
|---|---|
| `backend/src/index.ts` | Server setup, middleware chain, rate limiter placement |
| `backend/src/routes/index.ts` | Route registry — add new APIs here |
| `backend/src/middleware/auth.ts` | Clerk JWT flow, dev bypass |
| `backend/src/services/payrollService.ts` | Most complex domain logic in the codebase |
| `backend/src/lib/payrollCalculations.ts` | Pure OT math — modify with care |
| `frontend/src/types/index.ts` | All shared interfaces — source of truth for API shapes |
| `frontend/src/hooks/useApi.ts` | Auth-injecting Axios wrapper |
| `frontend/src/hooks/useSocket.ts` | Socket connection + reconnect recovery |
| `frontend/src/features/payroll/hooks/usePayroll.ts` | Pattern for all complex hooks |

---

## Conventions & Standards

### Route files
- HTTP layer only: auth checks, input validation, call a service, return status + JSON
- All `catch` blocks must `console.error('ROUTE context:', err)` before returning 500
- Use descriptive error messages in `res.json({ error: '...' })` — never just `"Failed"`

### Service files
- One file per domain aggregate (shifts, attendance, payroll)
- Export named async functions — no classes
- Accept a `client` parameter for transaction-aware queries; fall back to `query()` if null
- Never emit Socket.io events or log audit entries from services — that belongs in routes

### Frontend hooks
- One hook per page/feature — `usePayroll`, `useDashboard`
- State: `useState` for UI state; `useCallback` for stable fetch functions; `useEffect` to trigger on mount/deps
- All API errors surface via `toast.error()` — never swallow silently
- Never use `any` — use typed interfaces from `src/types/index.ts`

---

## Common Gotchas

- `FRONTEND_URL` in backend `.env` must match exactly — no trailing slash
- Frontend env vars must be prefixed `NEXT_PUBLIC_` to be browser-visible
- Socket rooms must be explicitly rejoined after reconnect
- Payroll processing is **idempotent** — calling `/process` twice returns cached snapshots, not duplicates
- Shifts **lock after first clock-in** — `startTime`, `endTime`, `assigneeId` changes are rejected with `SHIFT_LOCKED_AFTER_CLOCK_IN`
- `events` and `audit_logs` are **append-only** — DB triggers prevent UPDATE/DELETE
- `employee_rates.effective_rate_id` in payroll snapshots stores the `employee_rates.id` FK — not the member ID
- The rate limiter must be registered **before** the routes loop in `index.ts`
- Debug endpoints in `attendance.ts` are wrapped in non-production + feature-flag guards — don't remove them
