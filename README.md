# ShiftSync

A full-stack workforce management platform for frontline teams. Handles scheduling, real-time team sync, attendance tracking, shift swapping, payroll processing, and labour analytics — all in one place.

---

## The Problem

Frontline teams — retail, logistics, healthcare, hospitality — run on shifts, not desks. Yet almost every workforce tool is built for office workers and bolted onto shift work as an afterthought.

**The pain points nobody talks about:**

- **Scheduling is a nightmare** — Spreadsheets or whiteboards. No visibility into who requested time off, who double-booked, who picked up extra hours
- **Clock in/out is disconnected** — Time clocks and scheduling live in separate systems. Payroll is a manual reconciliation nightmare at the end of every cycle
- **Shift swaps break down** — WhatsApp messages, sticky notes, nobody knows if coverage is confirmed until the shift starts
- **Payroll math is opaque** — Employees don't know how their pay was calculated. Managers can't explain it. Overtime rules change mid-period and nobody updates the spreadsheet
- **No real accountability** — Managers approve schedules but have no audit trail of who changed what, when, and why
- **Announcements die in email** — Important updates get buried in group chats nobody reads anymore

---

## What ShiftSync Solves

| Problem | ShiftSync Solution |
|---|---|
| Scheduling chaos | SQL-conflict checking prevents double-booking at creation. Kanban columns (OPEN / ASSIGNED / IN_PROGRESS / COMPLETED) give instant status visibility |
| Disconnected attendance | Clock in/out happens inside the shift context. Hours flow directly into payroll — no manual export |
| Broken shift swaps | Employees request a swap with a reason. Managers see the full request card and approve/reject in one click. Assignee updates instantly for everyone |
| Opaque payroll | Every pay period shows the exact OT rules applied, hours worked, base vs OT split, and total cost before processing. Payslips are downloadable PDFs |
| Zero accountability | Every write operation — CREATE, UPDATE, DELETE, CLOCK_IN/OUT — is logged with before/after state diffs, IP, and user agent |
| Announcements get ignored | High-priority announcements surface with visual urgency. Socket.io delivers them in real time, not as background notifications |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Node.js + Express |
| Auth | Clerk (multi-role: Admin, Manager, Employee) |
| Database | PostgreSQL on Neon (serverless) |
| Real-time | Socket.io (instant shift & message updates) |
| Data Fetching | TanStack Query (caching, background refetch, loading states) |
| Charts | Recharts |
| Calendar | React Big Calendar |
| Rate Limiting | express-rate-limit (1000 req/15min per IP) |
| Validation | express-validator (sanitized, schema-validated inputs) |

---

## Features

### Scheduling
- **Shift Management** — Create, assign, and track shifts with title, time, location, notes, and colour tags
- **Conflict Detection** — SQL-level overlap check prevents double-booking the same employee
- **Status Columns** — Shifts flow through: OPEN → ASSIGNED → IN_PROGRESS → COMPLETED
- **Real-time Sync** — Shift changes broadcast instantly to all org members via Socket.io
- **Shift Swapping** — Employees can request a swap on their assigned shifts; managers/admins approve or reject

### Attendance
- **Clock In/Out** — Employees clock into their assigned shifts; timestamps are tracked in the database
- **Live Attendance View** — Managers and admins see who's currently clocked in, in real time
- **My Timesheet** — Employees see their completed shifts and total hours for the current period
- **Overtime Alerts** — If a shift exceeds 8 hours, a notification is triggered

### Team Management
- **Role-based Access** — Three roles (Admin, Manager, Employee) with escalating permissions
- **Organisation Registry** — Each organisation has a unique ID for invite-based onboarding
- **Manager Rate Permissions** — Admins can toggle whether managers can edit employee hourly rates
- **Employee Rates** — Per-employee hourly rates with override support and effective-from dates
- **Skills** — Members can have skills tags for filtering and shift matching

### Payroll
- **Pay Periods** — Create bi-weekly, weekly, semi-monthly or monthly pay periods
- **Process Period** — Generate payslips for all employees based on clock events within the period date range
- **Overtime Rules** — Configurable daily threshold (default 8h) and weekly threshold (default 40h), with custom multipliers
- **Employee Rate Overrides** — Set custom hourly rates per employee effective from a specific date
- **Payslip Status** — DRAFT → PROCESSED → DOWNLOADED → PAID lifecycle
- **PDF Payslips** — Downloadable official payslip documents with earnings breakdown
- **Total Cost Summary** — Live total labour cost for the active pay period

### Announcements
- **Broadcast Messages** — Admins post announcements to the whole organisation
- **Targeted Messages** — Send announcements to specific team members
- **Priority Levels** — NORMAL, HIGH, or URGENT priority with visual distinction
- **Real-time Delivery** — Socket.io pushes new announcements instantly to all members

### Direct Messaging
- **Peer-to-peer Chat** — Employees can message any team member
- **Real-time** — Messages delivered instantly via Socket.io
- **Unread Tracking** — Messages marked as read when conversation is opened

### Analytics (Admin Only)
- **KPI Dashboard** — Total members, hours tracked, labour cost, efficiency score
- **Weekly Distribution Chart** — Bar chart of total vs completed shifts by day
- **Coverage Rate Chart** — Line chart showing shift completion percentage over the week
- **Live Staff Count** — How many employees are currently on shift

### Audit Log (Admin/Manager)
- **All Actions Tracked** — CREATE, UPDATE, DELETE, CLOCK_IN, CLOCK_OUT, APPROVE, REJECT, REQUEST
- **State Diffs** — UPDATE and DELETE actions show before/after JSON for full traceability
- **Filterable** — Filter by action type, entity type, date range, and member
- **Paginated** — 50 entries per page with full navigation
- **IP & User Agent** — Full request metadata captured for each audit entry

### Onboarding
- **Create or Join** — New users create an organisation or join via an existing org ID
- **Auto Role Assignment** — First member becomes Admin; subsequent members default to Employee

---

## Getting Started

### 1. Install Dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Environment Variables

**Backend — `backend/.env`**
```env
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_test_...
PORT=4000
FRONTEND_URL=http://localhost:3000
```

**Frontend — `frontend/.env.local`**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### 3. Database Setup

```bash
cd backend
node src/db/setup.js
```

This creates all tables: `organisations`, `members`, `shifts`, `clock_events`, `swap_requests`, `pay_periods`, `payslips`, `overtime_rules`, `employee_rates`, `announcements`, `messages`, `notifications`, `audit_logs`, and `availability`.

### 4. Run the App

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Visit `http://localhost:3000`

---

## Role Permissions

| Feature | Admin | Manager | Employee |
|---|---|---|---|
| Create shifts | ✅ | ✅ | ❌ |
| Edit/delete own org shifts | ✅ | ✅ (employees only) | ❌ |
| Clock in/out | ✅ | ✅ | ✅ |
| View own timesheet | ✅ | ✅ | ✅ |
| View live attendance | ✅ | ✅ | ❌ |
| Process pay periods | ✅ | ❌ | ❌ |
| Mark periods paid | ✅ | ❌ | ❌ |
| Set overtime rules | ✅ | ✅ | ❌ |
| Override employee rates | ✅ | ✅ (if enabled) | ❌ |
| Post announcements | ✅ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ❌ |
| Change member roles | ✅ | ❌ | ❌ |
| Delete members | ✅ | ❌ | ❌ |
| View analytics | ✅ | ❌ | ❌ |

---

## Project Structure

```
shiftsync/
├── backend/
│   └── src/
│       ├── db/
│       │   ├── client.js       # PostgreSQL connection pool
│       │   └── setup.js       # Schema creation script
│       ├── lib/
│       │   ├── audit.js        # Audit logging utility
│       │   ├── events.js       # Event type constants
│       │   └── eventEmitter.js # Transactional event emission
│       ├── middleware/
│       │   ├── auth.js         # Clerk JWT verification + role guards
│       │   └── rateLimit.js    # Per-user sliding-window rate limiter
│       ├── routes/
│       │   ├── organisations.js # Org settings, announcements, currency
│       │   ├── members.js      # Team CRUD, onboarding, availability
│       │   ├── shifts.js       # Shift CRUD + swap requests
│       │   ├── attendance.js   # Clock in/out + timesheets
│       │   ├── payroll.js      # Pay periods, processing, employee rates
│       │   ├── payslips.js     # Payslip listing + PDF generation
│       │   ├── overtime.js     # OT rule management
│       │   ├── messages.js     # Direct messaging
│       │   ├── notifications.js
│       │   ├── analytics.js    # Workforce KPIs
│       │   └── audit.js        # Audit log queries
│       ├── socket/
│       │   └── index.js        # Socket.io room management (org/user)
│       └── index.js            # Express server entry point
└── frontend/
    └── src/
        ├── app/                # Next.js App Router pages
        │   ├── (auth)/         # Clerk auth pages (sign-in, sign-up)
        │   ├── dashboard/      # Home dashboard + announcements
        │   ├── schedule/       # Shift roster with Kanban columns
        │   ├── team/           # Member management + role editing
        │   ├── attendance/     # Clock in/out + personal timesheet
        │   ├── payroll/         # Pay periods + payslips
        │   ├── messages/       # Direct message conversations
        │   ├── analytics/      # Admin KPI dashboard + charts
        │   ├── audit/          # Audit log with filters + pagination
        │   ├── invite/         # Organisation info + share ID
        │   └── onboarding/     # Create or join organisation
        ├── components/
        │   ├── auth/           # Auth-related components
        │   └── layout/         # Layout components (sidebar, etc.)
        ├── hooks/
        │   ├── useApi.ts       # Axios instance with Clerk token injection
        │   └── useSocket.ts    # Socket.io connection scoped per org/user
        └── lib/
            ├── utils.ts         # Helpers (initials, formatters, role colors)
            └── api.ts           # Shared API utilities
```

---

## Landing Page

The landing page features a futuristic WebGL hero with animated canvas effects, momentum scrolling, and a Bento-style feature grid. It contrasts ShiftSync's architecture against legacy workforce tools, highlighting advantages in SQL-level conflict resolution, real-time sync, and immutable audit logging.

---

## Deploy

### Backend → Railway
1. Push backend to GitHub
2. Connect to Railway, add env vars (`DATABASE_URL`, `CLERK_SECRET_KEY`, `FRONTEND_URL`)
3. Railway auto-detects Node.js — deploy

### Frontend → Vercel
1. Push frontend to GitHub
2. Connect to Vercel, add env vars (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`)
3. Vercel auto-detects Next.js — deploy

---

## Architecture Notes

**Data fetching** — TanStack Query wraps all API calls, handling caching, background refetching, and loading/error states so components stay fast and responsive without manual boilerplate.

**Real-time rooms** — Socket.io uses two room types: `org:${id}` for org-wide broadcasts (shift updates, announcements, swap requests) and `user:${id}` for private notifications (messages, shift assignments).

**Auth flow** — Clerk handles the session on the frontend. On every API request, the backend verifies the Clerk JWT with `verifyToken` and syncs the user to the local `members` table on first sign-in via the `/onboard` endpoint.

**Payroll logic** — Processing a pay period pulls all completed shifts whose clock_in falls within the period's `start_date` and `end_date`. Overtime is calculated against the configured rules (daily threshold 8h, weekly 40h default). Processing can happen at any time after the period ends — the date range is the source of truth, not the processing date.

**Audit logging** — Every write operation logs to `audit_logs` with old/new state diffs. Audit failures are caught silently (non-blocking) so they never break the main operation.

---

## Security

- **API Rate Limiting** — Global 1000 requests per 15 minutes per IP on all `/api` routes, plus per-user sliding-window limits on high-traffic routes (60/min shifts, 30/min payroll/attendance, 60/min messages); ADMIN role bypasses global limiter
- **Socket Authentication** — Clerk JWT required on socket handshake; `join:org` verifies member belongs to authenticated user before allowing room join
- **Input Validation** — All POST/PUT/PATCH endpoints use express-validator with sanitized, schema-validated inputs (strings trimmed & escaped, UUIDs validated, enum values checked)
- **Failed Auth Audit** — All authentication failures (missing token, invalid token) are logged to `audit_logs` with IP and reason for security monitoring
- **Parameterized SQL** — All database queries use parameterized statements preventing SQL injection
- **Role-based Access** — Middleware enforces role checks on every protected route; socket room joins verified server-side
- **Security Headers** — Helmet.js enforces CSP, HSTS (1yr + includeSubDomains + preload), frame-ancestors: none, XSS filter, strict-referrer-policy on all responses

---

## System Design (Startup-Grade Upgrade)

ShiftSync is a **multi-tenant, event-driven workforce state machine with financial reconciliation** — not a CRUD SaaS. Every mutation writes to a canonical event log first; database state is derived from events; audit logs are event log queries; socket events are event broadcasts.

### Completed

#### Event Core
- **`events` table** — canonical event log with `event_type`, `entity_type`, `entity_id`, `payload` (JSONB), `ip_address`, `user_agent`, `created_at`. Indexes on (org, type), (entity), (member), (created_at DESC)
- **Event emitter** — `emitEvent()` accepts an optional DB transaction client for atomic event+state writes; falls back to fire-and-forget on non-transactional calls
- **Event types** — `shift.created/updated/deleted/assigned/clock_in/clock_out`, `swap.requested/approved/rejected`, `pay_period.created/processed/paid`, `attendance.clock_in/clock_out`, `member.joined/role_changed`, `overtime_rule.created/updated/deleted`
- **Transactional clock-in/out** — attendance endpoints use `pool.connect()` transactions with `FOR UPDATE` row locks; events emitted inside the transaction so event log and entity state are always in sync

#### Payroll Snapshot Engine
- **`payroll_snapshots` table** — immutable calculation results frozen at processing time; stores hourly_rate, overtime_multiplier, rule thresholds, base/OT hours and earnings, plus `generated_by` member. `UNIQUE(pay_period_id, member_id)` prevents duplicates
- **Idempotent processing** — reprocessing an already-processed period returns `{ cached: true, snapshots, payslips }` without recomputation
- **Rule freeze** — overtime rules and employee rate overrides are captured into local variables before the loop; payslips always reflect the rules that existed at processing time, not current rules

#### Concurrency Control
- **`shifts.version` column** — optimistic locking field; incremented on every UPDATE
- **Conflict detection** — shift PUT includes `WHERE version=$N` predicate; 0 rows returned = `409 VERSION_MISMATCH` with `conflictType` field so clients can refresh and retry
- **Row-level locks** — clock-in uses `FOR UPDATE` to prevent concurrent clock-in race conditions; already-clocked-in check inside transaction

#### Security Hardening
- **Helmet.js** — CSP (block everything except self), HSTS (1yr + includeSubDomains + preload), frame-ancestors: none, XSS filter, strict-referrer-policy
- **Per-user rate limiting** — sliding window limiter keyed by `req.member.id`; different limits per route (60/min shifts, 30/min payroll/attendance, 60/min messages); `429` response with `Retry-After` and `X-RateLimit-*` headers
- **ADMIN bypass** — global IP rate limiter skips ADMIN role
- **Middleware chain order** — helmet → cors → express.json({ limit: '1mb' }) → userRateLimit → apiLimiter → routes

#### Event Immutability
- **DB-level triggers** — `block_events_modification()` and `block_audit_modification()` functions raise exceptions on UPDATE or DELETE for `events` and `audit_logs` tables; both tables are strictly append-only
- **`events.seq` BIGSERIAL** — monotonic ordering column on events table for cursor-based pagination; indexed `(organisation_id, seq DESC)`

#### State Reconciliation
- **`/api/events/since?since=<ISO>`** — event feed endpoint; returns up to 500 events after given timestamp; `hasMore` flag when results are capped
- **`connected` socket event** — server emits `{ serverTime }` on every socket connect; clients use this to compute the `lastEventTimestamp` gap for rehydration
- **Client reconnect protocol** — on reconnect: rejoin org room, fetch `/api/events/since?since={localStorage.lastEventTimestamp}`, replay events into local store, update baseline timestamp

#### Event Emission (All Routes)
All write operations emit events inside DB transactions. No route mutates state without emitting an event via `emitEvent({ client, ... })`:

| Route | Events Emitted |
|---|---|
| `shifts.js` | `shift.created`, `shift.updated`, `shift.deleted`, `shift.assigned`, `shift.clock_in`, `shift.clock_out` |
| `attendance.js` | `attendance.clock_in`, `attendance.clock_out`, `shift.clock_in`, `shift.clock_out` |
| `payroll.js` | `pay_period.processed` |
| `members.js` | `member.joined`, `member.updated`, `member.role_changed`, `member.deleted` |
| `organisations.js` | `announcement.created`, `announcement.deleted` |
| `overtime.js` | `overtime_rule.created`, `overtime_rule.updated`, `overtime_rule.deleted` |
| `messages.js` | `message.sent` |

#### Shift Lock After Clock-In
- **Lock enforcement** — after first `CLOCK_IN` event exists for a shift, PUT rejects changes to `startTime`, `endTime`, and `assigneeId` with `409 SHIFT_LOCKED_AFTER_CLOCK_IN`
- **Locked fields reported** — response includes `{ lockedFields: ["startTime", "endTime"] }` so clients can highlight what needs unlocking

### Remaining

| Area | Gap | Priority |
|---|---|---|
| **Frontend reconnect** | `useSocket.ts` hook needs to implement full reconnection protocol with event replay on socket `connect` | High |
| **Payroll recompute path** | No explicit "recompute with current rules" override for cases where rule change legitimately should apply retroactively | Medium |
| **Sentry integration** | No error tracking for unhandled exceptions in Express handlers | Medium |
| **Request ID tracing** | No `X-Request-ID` header propagated through the call chain for log correlation | Medium |
| **Cursor-based pagination** | Audit log and event feed use offset pagination; degrades at large offsets | Low |
| **Test suite** | Zero unit or integration tests; payroll calculation, overtime logic, shift conflict detection all untested | High |
| **Redis adapter** | Socket.io fan-out for org-wide broadcasts won't scale past ~1000 concurrent without Redis pubsub | Low |

---

