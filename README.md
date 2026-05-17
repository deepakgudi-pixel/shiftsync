# Relay

A full-stack, production-grade workforce management platform for frontline teams. Handles scheduling, real-time team sync, attendance tracking, shift swapping, payroll processing, and labour analytics.

## Quick Start

```bash
# Backend
cd backend && npm install && cp .env.example .env
# Fill in .env (see Environment Variables below), then:
npm run demo:seed   # creates schema, seeds demo workspace
npm run dev         # port 4000

# Frontend
cd ../frontend && npm install && cp .env.example .env.local
# Fill in .env.local, then:
npm run dev         # port 3000
```

Visit `http://localhost:3000` — or try the one-click demo at `http://localhost:3000/demo-access`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Auth | Clerk (multi-role JWT) |
| Database | PostgreSQL (Neon serverless) |
| Jobs | pg-boss + PostgreSQL |
| Real-time | Socket.io |
| Charts | Recharts |
| CI | GitHub Actions |

---

## Features

- **Scheduling** — Drag-and-drop shift calendar. SQL conflict detection prevents double-booking. Status lifecycle: `OPEN → ASSIGNED → IN_PROGRESS → COMPLETED`. Shifts lock after first clock-in.
- **Attendance** — Transactional clock-in/out with optional GPS coordinates. Hours flow directly into payroll. Live attendance view for managers and admins.
- **Payroll** — Pay periods with configurable overtime rules (daily + weekly thresholds). Rates can be overridden per-employee. Snapshots freeze all rates and rules at processing time for auditability. PDF payslips with full earnings breakdown.
- **Shift Swapping** — Employee swap request → manager approval → instant reassignment with real-time notification.
- **Real-time** — Socket.io broadcasts for shifts, attendance, announcements, swap requests, and messages. Clients recover missed events on reconnect via event replay.
- **Analytics** — Rolling 30-day window: shift distribution, coverage rates, labour cost, live staff count. Computed from real data.
- **Audit Trail** — Every write operation logged with before/after diffs, IP, and user agent. Append-only via PostgreSQL triggers — cannot be tampered with.
- **Security** — Clerk JWT auth, RBAC middleware, organisation-scoped queries, Helmet security headers, CORS, per-user rate limiting, input validation (express-validator), AES-256-GCM message encryption.

---

## Role Permissions

| Feature | Admin | Manager | Employee |
|---|---|---|---|
| Create / edit shifts | ✅ | ✅ | ❌ |
| Clock in / out | ✅ | ✅ | ✅ |
| View live attendance | ✅ | ✅ | ❌ |
| Process payroll | ✅ | ❌ | ❌ |
| Post announcements | ✅ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ❌ |
| View analytics | ✅ | ❌ | ❌ |
| Invite team members | ✅ | ✅ | ❌ |

---

## Project Structure

```
relay/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server · security middleware · rate limiter · route registry
│   │   ├── routes/
│   │   │   ├── index.ts          # Route registry (base-path → router map)
│   │   │   ├── shifts.ts         # Shift CRUD + swap workflow
│   │   │   ├── attendance.ts     # Clock-in/out + timesheets
│   │   │   ├── payroll.ts        # Pay periods + processing + rates
│   │   │   ├── members.ts        # Member management + availability
│   │   │   ├── organisations.ts  # Org settings + announcements
│   │   │   └── ...               # analytics, audit, messages, etc.
│   │   ├── services/
│   │   │   ├── payrollService.ts   # Payroll data access + processing logic
│   │   │   ├── shiftService.ts     # Shift queries + conflict detection
│   │   │   ├── attendanceService.ts # Clock transactions + timesheet aggregation
│   │   │   └── jobQueueService.ts  # Durable job records + pg-boss publishing
│   │   ├── workers/queueWorker.ts # pg-boss payroll fan-out worker
│   │   ├── middleware/auth.ts    # Clerk JWT verification + RBAC
│   │   ├── lib/
│   │   │   ├── payrollCalculations.ts  # Pure OT math (daily + weekly)
│   │   │   ├── audit.ts          # logAudit() — before/after diffs
│   │   │   ├── eventEmitter.ts   # emitEvent() — writes to event log
│   │   │   └── events.ts         # EVENT_TYPES constants
│   │   ├── db/
│   │   │   ├── client.ts         # pg connection pool
│   │   │   ├── setup.ts          # Schema DDL
│   │   │   └── seed.ts           # Demo data seeder
│   │   └── socket/index.ts       # Socket.io room auth + membership
│   └── test/
│       └── routes.integration.test.js
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js App Router pages
│   │   ├── components/layout/    # Sidebar + AppLayout
│   │   ├── features/
│   │   │   ├── payroll/          # usePayroll hook + all payroll components
│   │   │   ├── dashboard/        # useDashboard hook + dashboard components
│   │   │   └── landing/          # Landing page sections + WebGL hero
│   │   ├── hooks/                # useApi, useSocket
│   │   └── types/index.ts        # Shared TypeScript interfaces
│   └── middleware.ts             # Clerk route protection
└── .github/workflows/ci.yml      # Lint · typecheck · test · build
```

---

## Architecture

Relay is a multi-tenant, event-driven workforce platform. Every mutation:

1. Writes to the **canonical event log** (`events` table — append-only)
2. Updates application state in the relevant domain table
3. Writes a **before/after audit record** (`audit_logs` — append-only)
4. Broadcasts a **Socket.io event** to the relevant org/user rooms

Key design decisions:

- **Payroll snapshots** freeze rates and rules at processing time for auditability — results don't change if rates are updated later
- **Rule snapshots** are also stored as JSONB on payroll snapshots so future overtime rule fields can evolve without widening the table every time
- **Shift locking** — once a clock-in exists, `startTime`, `endTime`, and `assigneeId` are immutable
- **Optimistic shift concurrency** — the schedule UI sends `If-Match` with `shifts.version` so stale edits get a `409 SHIFT_VERSION_CONFLICT`
- **Organisation scoping** — enforced on every read and write query; cross-org data leakage is architecturally impossible
- **Append-only tables** — `events` and `audit_logs` are protected by PostgreSQL triggers that block UPDATE and DELETE
- **Reconnect recovery** — clients store `lastEventTimestamp`; on reconnect they replay missed events from `/api/events/since`
- **Background jobs** — payroll fan-out records durable `background_jobs` rows and publishes to pg-boss for async notification work
- **Thin routes, fat services** — route files handle HTTP concerns only (auth, validation, status codes); all domain logic lives in `src/services/`

---

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=           # PostgreSQL connection string
CLERK_SECRET_KEY=       # From Clerk dashboard
CLERK_JWT_KEY=          # From Clerk dashboard (JWT verification key)
CLERK_PUBLISHABLE_KEY=  # From Clerk dashboard
FRONTEND_URL=http://localhost:3000   # Exact origin (no trailing slash)
PORT=4000
NODE_ENV=development
DEMO_PASSWORD=          # Password for seeded demo accounts
DEMO_ACCESS_ENABLED=false
ATTENDANCE_DEBUG_ENDPOINTS_ENABLED=false
ENCRYPTION_KEY=         # 32-char hex string for AES-256-GCM message encryption
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=   # From Clerk dashboard
CLERK_SECRET_KEY=                    # From Clerk dashboard
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

---

## Deploy

| Target | Platform | Required env vars |
|---|---|---|
| Backend | Railway / Render | `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `FRONTEND_URL`, `ENCRYPTION_KEY` |
| Worker | Railway / Render background process | same env as backend; run `npm run worker` after `npm run build` |
| Frontend | Vercel | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` |

Demo access and `/api/attendance/debug*` are disabled in `NODE_ENV=production`. Debug attendance endpoints also require `ATTENDANCE_DEBUG_ENDPOINTS_ENABLED=true` in non-production environments.

Run the backend API and worker as separate processes in deployed environments:

```bash
cd backend && npm run build
npm start
npm run worker
```

---

## Demo

```bash
cd backend && npm run demo:seed
```

Validates the environment, runs schema setup, creates Clerk demo accounts, and populates a realistic workspace with 30+ completed shifts, live attendance, processed payroll, and pending swap requests.

**Demo accounts** (all use `DEMO_PASSWORD` from `.env`):

| Role | Email |
|---|---|
| Admin | `demo.admin.northstar+clerk_test@example.com` |
| Manager | `demo.manager.northstar+clerk_test@example.com` |
| Employee | `demo.leah.northstar+clerk_test@example.com` |

---

## Testing

```bash
cd backend && npm test
# 93 backend tests — routes, RBAC, conflict detection, payroll, tenancy, demo safety
```

Tests use the real PostgreSQL driver against a test database. Module cache is cleared between test suites to prevent state bleed.

---

## CI

GitHub Actions runs on every push to `main` or `master` and every PR:

- **Backend**: lint → TypeScript typecheck → build → integration tests
- **Frontend**: lint → TypeScript typecheck → production build

Both jobs run in parallel and cancel on new pushes (via `concurrency`).
