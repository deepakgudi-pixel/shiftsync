# ShiftSync

A full-stack workforce management platform for frontline teams. Handles scheduling, real-time team sync, attendance tracking, shift swapping, payroll processing, and labour analytics.

## Quick Start

```bash
# Backend
cd backend && npm install && cp .env.example .env
# Fill in .env, then:
npm run db:setup && npm run db:seed && npm run db:seed:scenario

# Frontend
cd ../frontend && npm install && cp .env.example .env.local
# Fill in .env.local, then:
npm run dev

# Tests
cd ../backend && npm test
```

Visit `http://localhost:3000`

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | Node.js + Express |
| Auth | Clerk (multi-role: Admin, Manager, Employee) |
| Database | PostgreSQL on Neon (serverless) |
| Real-time | Socket.io |
| Data Fetching | TanStack Query v5 |
| Charts | Recharts |
| CI | GitHub Actions |

## Features

- **Scheduling** — SQL conflict detection prevents double-booking. Kanban columns: OPEN → ASSIGNED → IN_PROGRESS → COMPLETED. Shifts lock after first clock-in.
- **Attendance** — Clock in/out within shift context. Hours flow directly into payroll. Live attendance view for managers.
- **Payroll** — Pay periods with overtime rules, rate overrides, and frozen snapshots at processing time. PDF payslips with full earnings breakdown.
- **Shift Swapping** — Employee requests → manager approval → instant reassignment.
- **Real-time** — Socket.io broadcasts for shifts, attendance, announcements, and messages. Reconnect recovery via event feed.
- **Analytics** — Rolling 30-day window for shift distribution, coverage rates, and labour cost. Computed from real data, not mock values.
- **Audit Trail** — Every write operation logged with before/after diffs, IP, and user agent. Append-only via PostgreSQL triggers.
- **Security** — Clerk JWT auth, RBAC middleware, organisation-scoped queries, Helmet headers, CORS restrictions, rate limiting (global + per-user), input validation, encrypted messaging.

## Role Permissions

| Feature | Admin | Manager | Employee |
|---|---|---|---|
| Create/edit shifts | ✅ | ✅ | ❌ |
| Clock in/out | ✅ | ✅ | ✅ |
| View live attendance | ✅ | ✅ | ❌ |
| Process payroll | ✅ | ❌ | ❌ |
| Post announcements | ✅ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ❌ |
| View analytics | ✅ | ❌ | ❌ |

## Project Structure

```
shiftsync/
├── backend/
│   ├── src/
│   │   ├── index.js            # Express server + middleware chain
│   │   ├── db/client.js        # PostgreSQL connection pool
│   │   ├── routes/             # API handlers (shifts, attendance, payroll, etc.)
│   │   ├── middleware/         # Auth (Clerk JWT) + rate limiting
│   │   ├── lib/                # Payroll math, audit, events, encryption
│   │   └── socket/             # Socket.io room management
│   └── test/                   # Unit + integration tests (Node test runner)
├── frontend/
│   ├── src/app/                # Next.js App Router pages
│   ├── src/components/         # Shared UI (Sidebar, AppLayout)
│   ├── src/hooks/              # useApi, useSocket
│   ├── src/types/              # Shared TypeScript interfaces
│   └── middleware.ts            # Clerk route protection
└── .github/workflows/ci.yml    # Lint, typecheck, test, build
```

## Architecture

ShiftSync is a multi-tenant, event-driven workforce platform. Every mutation emits to a canonical event log; database state is derived from events; audit logs are event log queries; socket events are event broadcasts.

Key design decisions:
- **Payroll snapshots** freeze rates and rules at processing time for auditability
- **Shift locking** prevents time/assignee changes after first clock-in
- **Organisation scoping** enforced on every read and write query
- **Append-only tables** (events, audit_logs) protected by PostgreSQL triggers
- **Reconnect recovery** — clients replay missed events after socket disconnect

## Deploy

- **Backend** → Railway (set `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `FRONTEND_URL`)
- **Frontend** → Vercel (set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`)

## Demo

Run `npm run db:seed` then `npm run db:seed:scenario` to populate a realistic demo with 30+ completed shifts, live attendance, processed payroll, and pending swap requests.

Login as admin: `demo.admin.northstar+clerk_test@example.com`
