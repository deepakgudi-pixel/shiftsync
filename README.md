# ShiftSync

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
| Backend | Node.js + Express |
| Auth | Clerk (multi-role JWT) |
| Database | PostgreSQL (Neon serverless) |
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
shiftsync/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server · security middleware · rate limiter · route registry
│   │   ├── routes/
│   │   │   ├── index.js          # Route registry (base-path → router map)
│   │   │   ├── shifts.js         # Shift CRUD + swap workflow
│   │   │   ├── attendance.js     # Clock-in/out + timesheets
│   │   │   ├── payroll.js        # Pay periods + processing + rates
│   │   │   ├── members.js        # Member management + availability
│   │   │   ├── organisations.js  # Org settings + announcements
│   │   │   └── ...               # analytics, audit, messages, etc.
│   │   ├── services/
│   │   │   ├── payrollService.js   # Payroll data access + processing logic
│   │   │   ├── shiftService.js     # Shift queries + conflict detection
│   │   │   └── attendanceService.js # Clock transactions + timesheet aggregation
│   │   ├── middleware/auth.js    # Clerk JWT verification + RBAC
│   │   ├── lib/
│   │   │   ├── payrollCalculations.js  # Pure OT math (daily + weekly)
│   │   │   ├── audit.js          # logAudit() — before/after diffs
│   │   │   ├── eventEmitter.js   # emitEvent() — writes to event log
│   │   │   └── events.js         # EVENT_TYPES constants
│   │   ├── db/
│   │   │   ├── client.js         # pg connection pool
│   │   │   ├── setup.js          # Schema DDL
│   │   │   └── seed.js           # Demo data seeder
│   │   └── socket/index.js       # Socket.io room auth + membership
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

ShiftSync is a multi-tenant, event-driven workforce platform. Every mutation:

1. Writes to the **canonical event log** (`events` table — append-only)
2. Updates application state in the relevant domain table
3. Writes a **before/after audit record** (`audit_logs` — append-only)
4. Broadcasts a **Socket.io event** to the relevant org/user rooms

Key design decisions:

- **Payroll snapshots** freeze rates and rules at processing time for auditability — results don't change if rates are updated later
- **Shift locking** — once a clock-in exists, `startTime`, `endTime`, and `assigneeId` are immutable
- **Organisation scoping** — enforced on every read and write query; cross-org data leakage is architecturally impossible
- **Append-only tables** — `events` and `audit_logs` are protected by PostgreSQL triggers that block UPDATE and DELETE
- **Reconnect recovery** — clients store `lastEventTimestamp`; on reconnect they replay missed events from `/api/events/since`
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
| Frontend | Vercel | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` |

Set `NODE_ENV=production` on the backend to disable the `/api/attendance/debug` endpoints.

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
# 18 integration tests — all routes, RBAC, conflict detection, payroll processing
```

Tests use the real PostgreSQL driver against a test database. Module cache is cleared between test suites to prevent state bleed.

---

## CI

GitHub Actions runs on every push to `main` and every PR:

- **Backend**: lint → JSDoc typecheck → 18 integration tests
- **Frontend**: lint → TypeScript typecheck (`tsc --noEmit`) → production build

Both jobs run in parallel and cancel on new pushes (via `concurrency`).
