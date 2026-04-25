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
- **Protected Shift Updates** — Once a shift has its first clock-in, time and assignee changes are locked to preserve attendance integrity
- **Real-time Sync** — Shift changes broadcast instantly to all org members via Socket.io
- **Shift Swapping** — Employees can request a swap on their assigned shifts, either to a specific teammate or the open pool; managers/admins approve or reject
- **Assignment Notifications** — Assigned or cancelled shifts trigger user-specific notifications in real time

### Attendance
- **Clock In/Out** — Employees clock into their assigned shifts; timestamps are tracked in the database
- **Location Capture** — Clock events can store latitude/longitude for attendance verification
- **Live Attendance View** — Managers and admins see who's currently clocked in, in real time
- **My Timesheet** — Employees see their completed shifts and total hours for the current period
- **Team Timesheets** — Admins and managers can review organisation-wide completed shifts, hours, and estimated earnings
- **Overtime Alerts** — If a shift exceeds 8 hours, a notification is triggered

### Team Management
- **Role-based Access** — Three roles (Admin, Manager, Employee) with escalating permissions
- **Organisation Registry** — Each organisation has a unique ID for invite-based onboarding
- **Multi-tenant Isolation** — All core queries are scoped to the signed-in member's organisation
- **Manager Rate Permissions** — Admins can toggle whether managers can edit employee hourly rates
- **Employee Rates** — Per-employee hourly rates with override support and effective-from dates
- **Skills** — Members can have skills tags for filtering and shift matching
- **Availability** — Members can store weekly availability by day and time window
- **Self-service Profile Updates** — Members can update their own profile details, skills, phone, and hourly rate where allowed

### Payroll
- **Pay Periods** — Create bi-weekly, weekly, semi-monthly or monthly pay periods
- **Pay Period Timesheets** — Review employee-by-employee worked hours inside a pay period before processing
- **Pay Period Summaries** — Live summary of employee count, base earnings, overtime earnings, and total labour cost
- **Process Period** — Generate payslips for all employees based on clock events within the period date range
- **Payroll Snapshots** — Processing freezes the active rates and overtime rules into snapshots for auditability
- **Idempotent Processing** — Re-processing a completed period returns cached payroll results instead of duplicating records
- **Reprocessing Support** — Admins can delete generated payslips/snapshots for a period and return it to DRAFT
- **Overtime Rules** — Configurable daily threshold (default 8h) and weekly threshold (default 40h), with custom multipliers
- **Employee Rate Overrides** — Set custom hourly rates per employee effective from a specific date
- **Payslip Status** — DRAFT → PROCESSED → DOWNLOADED → PAID lifecycle
- **PDF Payslips** — Downloadable official payslip documents with earnings breakdown
- **Total Cost Summary** — Live total labour cost for the active pay period
- **Organisation Currency** — Admins can configure the payroll currency used in payslips and totals

### Announcements
- **Broadcast Messages** — Admins post announcements to the whole organisation
- **Targeted Messages** — Send announcements to specific team members
- **Priority Levels** — NORMAL, HIGH, or URGENT priority with visual distinction
- **Real-time Delivery** — Socket.io pushes new announcements instantly to all members
- **Announcement Notifications** — Targeted and organisation-wide announcements generate notification records

### Direct Messaging
- **Peer-to-peer Chat** — Employees can message any team member
- **Real-time** — Messages delivered instantly via Socket.io
- **Unread Tracking** — Messages marked as read when conversation is opened
- **Encrypted Storage** — Message content is encrypted at rest with AES-256-GCM when `ENCRYPTION_KEY` is configured

### Analytics (Admin Only)
- **KPI Dashboard** — Total members, hours tracked, labour cost, efficiency score
- **Weekly Distribution Chart** — Bar chart of total vs completed shifts by day
- **Coverage Rate Chart** — Line chart showing shift completion percentage over the week
- **Live Staff Count** — How many employees are currently on shift

### Notifications & Event Feed
- **In-app Notifications** — Shift assignments, cancellations, announcements, and overtime alerts are stored per user
- **Read State** — Members can mark single notifications or all notifications as read
- **Event Replay API** — Clients can fetch events since a timestamp to recover missed real-time updates after reconnects
- **Typed Event History** — Organisation events are stored with event types for downstream UI refresh and audit workflows

### Audit Log (Admin/Manager)
- **All Actions Tracked** — CREATE, UPDATE, DELETE, CLOCK_IN, CLOCK_OUT, APPROVE, REJECT, REQUEST
- **State Diffs** — UPDATE and DELETE actions show before/after JSON for full traceability
- **Filterable** — Filter by action type, entity type, date range, and member
- **Paginated** — 50 entries per page with full navigation
- **IP & User Agent** — Full request metadata captured for each audit entry

### Onboarding
- **Create or Join** — New users create an organisation or join via an existing org ID
- **Auto Role Assignment** — First member becomes Admin; subsequent members default to Employee

### Security
- **Clerk-backed Authentication** — API access requires verified Clerk JWTs for authenticated routes
- **RBAC Enforcement** — Admin, Manager, and Employee permissions are enforced in backend middleware and route handlers
- **Secure HTTP Headers** — Helmet config enables CSP, HSTS, clickjacking protection, MIME sniffing protection, and referrer policy controls
- **CORS Restrictions** — API and Socket.io origins are restricted to the configured frontend URL
- **Global Rate Limiting** — `/api` is protected with per-IP throttling to slow abuse
- **Per-user Rate Limiting** — Sensitive route groups like shifts, attendance, payroll, and messages have member-scoped limits
- **Input Validation** — Shift create/update and swap workflows validate and sanitize request payloads with `express-validator`
- **Encrypted Messaging** — Direct message bodies can be encrypted using AES-256-GCM before storage
- **Audit Trail for Auth Failures** — Missing or invalid bearer tokens are written to the audit log with request metadata
- **Organisation-scoped Data Access** — Route queries and joins consistently restrict reads and writes to the caller's organisation

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
CLERK_JWT_KEY=-----BEGIN PUBLIC KEY-----...
ENCRYPTION_KEY=64_char_hex_key_for_aes_256_gcm
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

This creates all tables: `organisations`, `members`, `shifts`, `clock_events`, `swap_requests`, `pay_periods`, `payslips`, `payroll_snapshots`, `overtime_rules`, `employee_rates`, `announcements`, `messages`, `notifications`, `audit_logs`, `events`, and `availability`.

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

### Verified Core Workflow

ShiftSync has been exercised end-to-end across Admin, Manager, and Employee roles for the main operational path:

- **Organisation setup** — create organisation and onboard members via the join flow
- **Scheduling** — create, assign, and update shifts through the manager workflow
- **Swap handling** — employees request swaps and managers approve them
- **Attendance** — employees clock in and out against assigned shifts
- **Payroll** — create pay periods, process payroll, and generate payslips
- **Payout proof** — payslip PDF download succeeds after payroll processing

### Future Improvements

#### Showcase-Important

| Area | Why It Matters |
|---|---|
| **Automated test suite** | Add unit and integration tests for payroll calculations, overtime rules, and shift conflict detection so the most business-critical logic has explicit coverage |
| **Frontend reconnect** | Further harden socket reconnect + missed-event recovery so real-time UI state stays reliable after temporary connection drops |

#### Good Later

| Area | Why It Matters |
|---|---|
| **Payroll recompute path** | Add an explicit "recompute with current rules" override for cases where rule changes should apply retroactively |
| **Sentry integration** | Add production error tracking for unhandled Express exceptions and frontend runtime failures |
| **Request ID tracing** | Propagate `X-Request-ID` through API, logs, and downstream calls for easier correlation |

#### Future Scale

| Area | Why It Matters |
|---|---|
| **Cursor-based pagination** | Move audit log and event feed pagination away from offset-based queries for large datasets |
| **Redis adapter** | Add Redis pub/sub for multi-instance Socket.io fan-out when scaling beyond a single node |

---

## Database Management (For Database Owners)

### How the Audit System Works

ShiftSync records every action that changes data in your organisation. Every create, update, delete, clock-in, clock-out, approval, or rejection is logged with:

- **Who** did it (member name)
- **What** action was taken (CREATE, UPDATE, DELETE, etc.)
- **Which** record was affected (entity type + ID)
- **When** it happened (timestamp)
- **Before/After state** (for updates and deletes — shows exactly what changed)
- **Where** it came from (IP address, browser user agent)

This is called an **immutable audit log** — once a record is written, it cannot be altered or deleted. This is critical for:

- **Compliance** — proving data integrity to regulators, auditors, or legal proceedings
- **Debugging** — tracing exactly what happened when something goes wrong
- **Accountability** — knowing who changed what and when
- **Financial reconciliation** — payroll decisions can be verified against the audit trail

### Why the Triggers Exist

ShiftSync uses PostgreSQL triggers to enforce **append-only** behavior on two tables:

- `events` — the canonical event log
- `audit_logs` — the audit trail

The triggers block any UPDATE or DELETE on these tables:

```
RAISE EXCEPTION 'events table is append-only: UPDATE and DELETE are not permitted';
```

This means:
- You can **INSERT** new records (adding to the log)
- You cannot **UPDATE** existing records (cannot alter history)
- You cannot **DELETE** records (cannot erase history)

This is the same approach used by financial institutions, healthcare systems, and government databases where data integrity is legally required.

### Normal App Usage — No Action Needed

Everything in the ShiftSync app works normally. The triggers only block direct database edits — they do not affect the application.

### When You Need to Delete Data Directly in Neon

If you need to delete records directly from the Neon database editor (e.g., to clean up test data or remove a specific record), you must temporarily disable the triggers.

**Follow these steps exactly — in order — or you may leave the database in a broken state.**

#### Step 1 — Disable the triggers

Run this in Neon's SQL editor:

```sql
ALTER TABLE events DISABLE TRIGGER block_events_delete;
ALTER TABLE events DISABLE TRIGGER block_events_update;
ALTER TABLE audit_logs DISABLE TRIGGER block_audit_delete;
ALTER TABLE audit_logs DISABLE TRIGGER block_audit_update;
```

#### Step 2 — Delete what you need

```sql
-- Delete an organisation (cascades to all child records)
DELETE FROM organisations WHERE id = 'your-org-id-here';

-- Delete a specific member
DELETE FROM members WHERE id = 'your-member-id-here';

-- Delete a specific shift
DELETE FROM shifts WHERE id = 'your-shift-id-here';
```

#### Step 3 — Re-enable the triggers

```sql
ALTER TABLE events ENABLE TRIGGER block_events_delete;
ALTER TABLE events ENABLE TRIGGER block_events_update;
ALTER TABLE audit_logs ENABLE TRIGGER block_audit_delete;
ALTER TABLE audit_logs ENABLE TRIGGER block_audit_update;
```

### Why This Workflow Exists

The trigger is designed to block accidental or unauthorized deletions. The SQL editor workaround exists so that **you** (the database owner) can still manage your data when needed, while keeping the audit trail protected from tampering.

### What Happens If You Skip Step 3?

If you delete records but forget to re-enable the triggers, the next time the app tries to write an audit log entry, it will fail silently (the app logs this as non-blocking) and the triggers will remain disabled until you run the Step 3 commands.

### Emergency: Re-enable Everything at Once

If something goes wrong, run this to restore all triggers:

```sql
ALTER TABLE events ENABLE TRIGGER block_events_delete;
ALTER TABLE events ENABLE TRIGGER block_events_update;
ALTER TABLE audit_logs ENABLE TRIGGER block_audit_delete;
ALTER TABLE audit_logs ENABLE TRIGGER block_audit_update;
```

### Quick Reference

| Scenario | What happens |
|----------|--------------|
| Using ShiftSync app | Everything works normally — triggers never interfere |
| Deleting via Neon SQL editor without workaround | Error — triggers block the delete |
| Deleting via Neon SQL editor WITH triggers disabled | Works — follows the 3-step workflow above |
| App tries to write to events/audit_logs | Works — INSERT is allowed, UPDATE/DELETE blocked by triggers |

The audit system is your friend — it keeps your organisation's data honest and verifiable. Treat the triggers as a safety feature, not a limitation.
