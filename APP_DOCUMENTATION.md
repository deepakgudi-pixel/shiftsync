# Relay — Developer & Technical Documentation

## System Architecture

Relay is a multi-tenant, event-driven workforce management platform. Every mutation writes to a canonical event log; database state is derived from events; audit logs are event log queries; socket events are event broadcasts.

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 + TypeScript)                     │
│  App Router pages • TanStack Query • Socket.io client   │
│  Clerk auth • Tailwind CSS • Recharts                   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST + Socket.io
┌──────────────────────▼──────────────────────────────────┐
│  Backend (Node.js + Express)                            │
│  Clerk JWT verification • RBAC middleware               │
│  Route handlers • Event emitter • Audit logger          │
│  Socket.io server • Rate limiting • Helmet              │
└──────────────────────┬──────────────────────────────────┘
                       │ pg connection pool
┌──────────────────────▼──────────────────────────────────┐
│  PostgreSQL (Neon serverless)                           │
│  Core tables • events (append-only)                     │
│  audit_logs (append-only) • payroll_snapshots           │
│  DB triggers for immutability                           │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
relay/
├── backend/
│   ├── src/
│   │   ├── index.js                  # Express server, middleware chain
│   │   ├── db/
│   │   │   ├── client.js             # PostgreSQL pool (max 20 connections)
│   │   │   └── setup.js              # Schema creation + triggers
│   │   ├── routes/
│   │   │   ├── organisations.js      # Org settings, announcements, currency
│   │   │   ├── members.js            # Team CRUD, onboarding, availability
│   │   │   ├── shifts.js             # Shift CRUD + swap requests
│   │   │   ├── attendance.js         # Clock in/out + timesheets
│   │   │   ├── payroll.js            # Pay periods, processing, employee rates
│   │   │   ├── payslips.js           # Payslip listing + PDF generation
│   │   │   ├── overtime.js           # OT rule management
│   │   │   ├── messages.js           # Direct messaging (AES-256-GCM)
│   │   │   ├── notifications.js      # Per-user notifications
│   │   │   ├── analytics.js          # Workforce KPIs
│   │   │   ├── audit.js              # Audit log queries
│   │   │   ├── events.js             # Event feed for reconnect recovery
│   │   │   └── dev.js                # Demo access routes
│   │   ├── middleware/
│   │   │   ├── auth.js               # Clerk JWT verification + role guards
│   │   │   └── rateLimit.js          # Per-user sliding-window rate limiter
│   │   ├── lib/
│   │   │   ├── audit.js              # Audit logging utility
│   │   │   ├── payrollCalculations.js # OT math (daily/weekly thresholds)
│   │   │   ├── events.js             # Event type constants
│   │   │   ├── eventEmitter.js       # Transactional event emission
│   │   │   ├── shiftConflicts.js     # SQL overlap detection
│   │   │   └── encryption.js         # AES-256-GCM encrypt/decrypt
│   │   └── socket/
│   │       └── index.js              # Socket.io room management (org/user)
│   └── test/
│       ├── helpers/
│       │   ├── http.js               # In-process router test harness
│       │   └── moduleMocks.js        # Dependency mocking for routes
│       ├── payroll-calculations.test.js
│       └── routes.integration.test.js
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx            # Root layout (ClerkProvider, Toaster)
│   │   │   ├── page.tsx              # Landing page (WebGL hero)
│   │   │   ├── error.tsx             # Global error boundary
│   │   │   ├── (auth)/               # Sign-in, sign-up pages
│   │   │   ├── dashboard/            # KPIs, announcements, upcoming shifts
│   │   │   ├── schedule/             # Kanban board (OPEN/ASSIGNED/IN_PROGRESS/COMPLETED)
│   │   │   ├── team/                 # Member management + role editing
│   │   │   ├── attendance/           # Clock in/out + timesheets
│   │   │   ├── payroll/              # Pay periods, processing, payslips
│   │   │   ├── messages/             # Direct message conversations
│   │   │   ├── analytics/            # Admin KPI dashboard + charts
│   │   │   ├── audit/                # Audit log with filters + pagination
│   │   │   ├── invite/               # Organisation registry + share ID
│   │   │   ├── onboarding/           # Create or join organisation
│   │   │   └── demo-access/          # Demo account selection
│   │   ├── components/
│   │   │   └── layout/
│   │   │       ├── AppLayout.tsx     # Shared layout (sidebar + mobile header)
│   │   │       └── Sidebar.tsx       # Navigation with role-based visibility
│   │   ├── hooks/
│   │   │   ├── useApi.ts             # Axios instance with Clerk token
│   │   │   └── useSocket.ts          # Socket.io with reconnect recovery
│   │   ├── types/
│   │   │   └── index.ts              # Shared TypeScript interfaces
│   │   └── lib/
│   │       └── utils.ts              # Helpers (initials, formatters, colors)
│   ├── middleware.ts                  # Clerk route protection
│   └── tailwind.config.js
│
├── .github/workflows/ci.yml           # Lint, typecheck, test, build
├── README.md
├── APP_DOCUMENTATION.md
└── DEVELOPER_CONCEPTS_GUIDE.md
```

## Database Schema

### Core Tables

**organisations**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | Organisation name |
| currency | TEXT | ISO 4217 code (default: USD) |
| settings | JSONB | Org-level configuration |
| created_at | TIMESTAMPTZ | |

**members**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organisation_id | UUID | FK → organisations |
| clerk_user_id | TEXT | Unique Clerk identifier |
| name | TEXT | Display name |
| email | TEXT | |
| role | TEXT | ADMIN, MANAGER, or EMPLOYEE |
| hourly_rate | NUMERIC | Base hourly rate |
| can_manage_rates | BOOLEAN | Manager rate editing permission |
| created_at | TIMESTAMPTZ | |

**shifts**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organisation_id | UUID | FK → organisations |
| title | TEXT | |
| start_time | TIMESTAMPTZ | |
| end_time | TIMESTAMPTZ | |
| location | TEXT | |
| notes | TEXT | |
| color | TEXT | Hex colour tag |
| status | TEXT | OPEN, ASSIGNED, IN_PROGRESS, COMPLETED |
| assignee_id | UUID | FK → members (nullable) |
| version | INTEGER | Optimistic locking |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**clock_events**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| shift_id | UUID | FK → shifts |
| member_id | UUID | FK → members |
| type | TEXT | CLOCK_IN or CLOCK_OUT |
| timestamp | TIMESTAMPTZ | |
| latitude | NUMERIC | Optional location |
| longitude | NUMERIC | Optional location |

**swap_requests**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| shift_id | UUID | FK → shifts |
| requester_id | UUID | FK → members |
| target_id | UUID | FK → members (nullable) |
| reason | TEXT | |
| status | TEXT | PENDING, APPROVED, REJECTED |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**pay_periods**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organisation_id | UUID | FK → organisations |
| period_type | TEXT | WEEKLY, BIWEEKLY, SEMI_MONTHLY, MONTHLY |
| start_date | DATE | |
| end_date | DATE | |
| status | TEXT | DRAFT, PROCESSED, PAID |
| processed_at | TIMESTAMPTZ | |

**payslips**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| member_id | UUID | FK → members |
| pay_period_id | UUID | FK → pay_periods |
| organisation_id | UUID | FK → organisations |
| base_hours | NUMERIC | |
| overtime_hours | NUMERIC | |
| overtime_rate | NUMERIC | Multiplier applied |
| base_earnings | NUMERIC | |
| overtime_earnings | NUMERIC | |
| total_earnings | NUMERIC | |
| currency | TEXT | |
| status | TEXT | DRAFT, PROCESSED, DOWNLOADED, PAID |
| generated_by | UUID | FK → members |
| created_at | TIMESTAMPTZ | |

**payroll_snapshots**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| pay_period_id | UUID | FK → pay_periods |
| organisation_id | UUID | FK → organisations |
| member_id | UUID | FK → members |
| hourly_rate | NUMERIC | Frozen at processing time |
| effective_rate_id | UUID | FK → employee_rates (if override) |
| overtime_multiplier | NUMERIC | Frozen at processing time |
| rule_id | UUID | FK → overtime_rules |
| rule_daily_threshold_hours | NUMERIC | Frozen |
| rule_weekly_threshold_hours | NUMERIC | Frozen |
| rule_daily_multiplier | NUMERIC | Frozen |
| rule_weekly_multiplier | NUMERIC | Frozen |
| total_hours | NUMERIC | |
| base_hours | NUMERIC | |
| overtime_hours | NUMERIC | |
| base_earnings | NUMERIC | |
| overtime_earnings | NUMERIC | |
| total_earnings | NUMERIC | |
| generated_by | UUID | FK → members |
| created_at | TIMESTAMPTZ | |

**overtime_rules**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organisation_id | UUID | FK → organisations |
| name | TEXT | |
| daily_threshold_hours | NUMERIC | Default: 8 |
| weekly_threshold_hours | NUMERIC | Default: 40 |
| daily_multiplier | NUMERIC | Default: 1.5 |
| weekly_multiplier | NUMERIC | Default: 1.5 |
| is_active | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

**employee_rates**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| member_id | UUID | FK → members |
| hourly_rate | NUMERIC | |
| overtime_multiplier | NUMERIC | |
| effective_from | DATE | |
| created_at | TIMESTAMPTZ | |

**announcements**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| title | TEXT | |
| content | TEXT | |
| priority | TEXT | NORMAL, HIGH, URGENT |
| organisation_id | UUID | FK → organisations |
| author_id | UUID | FK → members |
| target_member_id | UUID | FK → members (nullable) |
| created_at | TIMESTAMPTZ | |

**messages**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| sender_id | UUID | FK → members |
| receiver_id | UUID | FK → members |
| content | TEXT | AES-256-GCM encrypted |
| read | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

**notifications**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| member_id | UUID | FK → members |
| type | TEXT | SHIFT_ASSIGNED, SHIFT_CANCELLED, etc. |
| title | TEXT | |
| body | TEXT | |
| read | BOOLEAN | |
| data | JSONB | |
| created_at | TIMESTAMPTZ | |

**audit_logs** (append-only via DB trigger)
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organisation_id | UUID | |
| member_id | UUID | FK → members |
| clerk_user_id | TEXT | |
| action | TEXT | CREATE, UPDATE, DELETE, CLOCK_IN, etc. |
| entity_type | TEXT | shift, member, pay_period, etc. |
| entity_id | UUID | |
| old_values | JSONB | Before state (UPDATE/DELETE) |
| new_values | JSONB | After state (CREATE/UPDATE) |
| ip_address | TEXT | |
| user_agent | TEXT | |
| created_at | TIMESTAMPTZ | |

**events** (append-only via DB trigger)
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| seq | BIGSERIAL | Monotonic ordering |
| organisation_id | UUID | |
| member_id | UUID | FK → members |
| event_type | TEXT | shift.created, attendance.clock_in, etc. |
| entity_type | TEXT | |
| entity_id | UUID | |
| payload | JSONB | |
| ip_address | TEXT | |
| user_agent | TEXT | |
| created_at | TIMESTAMPTZ | |

**availability**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| member_id | UUID | FK → members |
| day_of_week | INTEGER | 0-6 |
| start_time | TIME | |
| end_time | TIME | |

### Append-only Triggers

```sql
-- Blocks UPDATE and DELETE on events table
CREATE OR REPLACE FUNCTION block_events_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'events table is append-only: UPDATE and DELETE are not permitted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER block_events_delete
  BEFORE DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION block_events_modification();

CREATE TRIGGER block_events_update
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION block_events_modification();

-- Same pattern for audit_logs
```

## Authentication Flow

1. **Frontend**: Clerk manages sessions via `@clerk/nextjs`
2. **Route protection**: `middleware.ts` calls `auth().protect()` for non-public routes
3. **API requests**: Clerk token sent as `Authorization: Bearer <token>`
4. **Backend verification**: `requireAuth` middleware verifies JWT via `@clerk/backend`
5. **Member sync**: On first sign-in, `/onboard` creates member record
6. **Socket auth**: Token verified on handshake before room joins

### Dev Auth Bypass

In development (`NODE_ENV=development`), requests with `x-dev-clerk-user-id` header and `Host: localhost:*` skip JWT verification. Used for local testing and demo access.

## Middleware Chain (Backend)

```
helmet (security headers)
  → cors (origin restriction)
  → express.json (1mb limit)
  → io injection (req.io = socket server)
  → routes (each route has requireAuth + requireRole)
  → apiLimiter (global rate limit, admin bypass)
  → error handler (catches unhandled errors)
```

## API Endpoints

### Shifts

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/shifts` | All | List shifts (org-scoped, optional date/assignee filters) |
| GET | `/api/shifts/:id` | All | Get shift with clock events and swap requests |
| POST | `/api/shifts` | Manager+ | Create shift (validates title, times, conflict check) |
| PUT | `/api/shifts/:id` | Manager+ | Update shift (locks after clock-in, conflict check) |
| DELETE | `/api/shifts/:id` | Manager+ | Delete shift (emits event, notifies assignee) |
| POST | `/api/shifts/:id/swap` | All | Request shift swap |
| PATCH | `/api/shifts/:id/swap/:swapId` | Manager+ | Approve/reject swap (org-scoped verification) |
| GET | `/api/shifts/swaps/pending` | Manager+ | List pending swaps |

### Attendance

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/attendance/clock-in` | All | Clock into assigned shift (transaction with FOR UPDATE lock) |
| POST | `/api/attendance/clock-out` | All | Clock out (triggers OT alert if >8h) |
| GET | `/api/attendance/live` | Manager+ | Currently clocked-in members |
| GET | `/api/attendance/timesheet/me` | All | Personal completed shifts + hours |
| GET | `/api/attendance/timesheet` | Manager+ | Organisation-wide completed shifts |

### Payroll

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/payroll/pay-periods` | Manager+ | List pay periods with cost summary |
| POST | `/api/payroll/pay-periods` | Manager+ | Create pay period |
| GET | `/api/payroll/pay-periods/:id/timesheet` | All | Employee-by-employee timesheet with OT calc |
| GET | `/api/payroll/pay-periods/:id/summary` | All | Summary: employee count, base/OT earnings, total cost |
| POST | `/api/payroll/pay-periods/:id/process` | Admin | Generate payslips + snapshots (idempotent) |
| POST | `/api/payroll/pay-periods/:id/paid` | Admin | Mark period as paid |
| DELETE | `/api/payroll/pay-periods/:id/payslips` | Admin | Delete payslips/snapshots, reset to DRAFT |
| GET | `/api/payroll/employee-rates` | Manager+ | Get rate override for member (org-scoped) |
| POST | `/api/payroll/employee-rates` | Admin | Set rate override (org-scoped) |

### Other

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/members` | All | List organisation members |
| POST | `/api/members/onboard` | All | Create account + join/create org |
| GET | `/api/members/me` | All | My profile |
| PUT | `/api/members/me` | All | Update own profile |
| PATCH | `/api/members/:id` | Admin | Update member role/rate |
| DELETE | `/api/members/:id` | Admin | Remove member |
| GET | `/api/organisations/me` | All | My org details |
| GET | `/api/organisations/announcements` | All | List announcements |
| POST | `/api/organisations/announcements` | Admin | Post announcement (broadcast or targeted) |
| DELETE | `/api/organisations/announcements/:id` | Admin | Delete announcement |
| PUT | `/api/organisations/currency` | Admin | Update org currency |
| GET | `/api/messages` | All | Conversation with specific member |
| POST | `/api/messages` | All | Send message (org-scoped, encrypted) |
| GET | `/api/notifications` | All | My notifications |
| PATCH | `/api/notifications/:id/read` | All | Mark as read |
| POST | `/api/notifications/read-all` | All | Mark all as read |
| GET | `/api/analytics` | Admin | Workforce KPIs + shift distribution |
| GET | `/api/audit-logs` | Manager+ | Audit trail (filterable, paginated) |
| GET | `/api/overtime` | Manager+ | List OT rules |
| POST | `/api/overtime` | Manager+ | Create OT rule |
| PUT | `/api/overtime/:id` | Manager+ | Update OT rule |
| DELETE | `/api/overtime/:id` | Manager+ | Delete OT rule |
| GET | `/api/events/since` | All | Event replay (cursor: ISO timestamp) |
| GET | `/api/payslips` | All | My payslips |
| GET | `/api/payslips/:id/pdf` | All | Download PDF payslip |

## Key Business Logic

### Payroll Processing

1. Verify period is DRAFT (or return cached results if already processed)
2. Fetch active overtime rule and employee rate overrides
3. For each employee:
   - Fetch completed shifts within period date range
   - Calculate daily hours from clock-in/clock-out pairs
   - Apply overtime: `max(dailyOT, weeklyOT)` where dailyOT = sum of hours exceeding daily threshold per day
   - Calculate earnings: `baseHours * rate + overtimeHours * rate * multiplier`
   - Insert `payroll_snapshot` (frozen rates, rules, calculations)
   - Insert `payslip`
4. Update period status to PROCESSED
5. Emit `pay_period.processed` event

### Shift Conflict Detection

```sql
SELECT id FROM shifts WHERE assignee_id = $1
  AND status IN ('ASSIGNED', 'IN_PROGRESS')
  AND (
    (start_time <= $2 AND end_time > $2) OR
    (start_time < $3 AND end_time >= $3) OR
    (start_time >= $2 AND end_time <= $3)
  )
```

Prevents double-booking at creation and update time.

### Shift Lock After Clock-In

Once a shift has a `CLOCK_IN` event, PUT requests reject changes to `startTime`, `endTime`, and `assigneeId` with `409 SHIFT_LOCKED_AFTER_CLOCK_IN`.

### Event Emission

All write operations emit events. When inside a transaction, `emitEvent({ client, ... })` writes the event within the same transaction for atomicity.

Event types: `shift.created/updated/deleted/assigned`, `attendance.clock_in/clock_out`, `swap.requested/approved/rejected`, `pay_period.created/processed/paid`, `member.joined/role_changed`, `overtime_rule.created/updated/deleted`, `message.sent`, `announcement.created/deleted`

## Real-time Architecture

### Socket.io Rooms

- `org:${organisationId}` — org-wide broadcasts (shift updates, announcements, swap requests)
- `user:${memberId}` — private notifications (messages, shift assignments)

### Reconnect Recovery

1. Client stores `lastEventTimestamp` in localStorage on every non-system event
2. On reconnect: rejoin org/user rooms, emit `connected` to get server time
3. Fetch `/api/events/since?since=lastEventTimestamp` for missed events
4. Dispatch `SOCKET_RESYNC_EVENT` custom event to trigger page refresh
5. Update `lastEventTimestamp` baseline

## Security

| Layer | Implementation |
|---|---|
| Authentication | Clerk JWT verification on every API request and socket handshake |
| Authorization | RBAC middleware (`requireAuth`, `requireRole`) on all protected routes |
| Multi-tenant | Every query filtered by `organisation_id` |
| Headers | Helmet.js: CSP, HSTS (1yr), frame-ancestors: none, XSS filter, strict referrer |
| CORS | Restricted to `FRONTEND_URL` origin |
| Rate limiting | Global 1000 req/15min per IP (admin bypass) + per-user sliding window on sensitive routes |
| Input validation | express-validator on POST/PUT/PATCH (trim, escape, UUID check, enum check) |
| SQL injection | Parameterized queries only |
| Encryption | AES-256-GCM for message content at rest |
| Audit | All write operations logged; events and audit_logs are append-only via DB triggers |
| Proxy support | `trust proxy` enabled for correct client IP behind reverse proxies |

## Testing

- Node.js built-in test runner (`node --test`)
- Unit tests for payroll math and overtime calculations
- Integration tests for route handlers with mocked dependencies
- Tests cover: payroll calculations, overtime rules, shift conflict detection, cross-org isolation
- Run: `npm test`

## CI/CD

GitHub Actions workflow on push/PR to main:
- Backend: `npm run lint` → `npm run typecheck` → `npm test`
- Frontend: `npm run lint` → `npm run build`
