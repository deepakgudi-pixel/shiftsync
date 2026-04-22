# ShiftSync

A full-stack workforce management platform for frontline teams. Handles scheduling, real-time team sync, attendance tracking, shift swapping, payroll processing, and labour analytics — all in one place.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Node.js + Express |
| Auth | Clerk (multi-role: Admin, Manager, Employee) |
| Database | PostgreSQL on Neon (serverless) |
| Real-time | Socket.io (instant shift & message updates) |
| Charts | Recharts |

---

## ✨ Features

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

## 🚀 Getting Started

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

## 🔐 Role Permissions

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

## 📁 Project Structure

```
shiftsync/
├── backend/
│   └── src/
│       ├── db/
│       │   ├── client.js       # PostgreSQL connection pool
│       │   └── setup.js       # Schema creation script
│       ├── lib/
│       │   └── audit.js        # Audit logging utility
│       ├── middleware/
│       │   └── auth.js         # Clerk JWT verification + role guards
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
        ├── components/layout/
        │   └── Sidebar.tsx     # Navigation sidebar
        ├── hooks/
        │   ├── useApi.ts       # Axios instance with Clerk token injection
        │   └── useSocket.ts    # Socket.io connection scoped per org/user
        └── lib/
            ├── utils.ts         # Helpers (initials, formatters, role colors)
            └── api.ts           # Shared API utilities
```

---

## 🌍 Deploy

### Backend → Railway
1. Push backend to GitHub
2. Connect to Railway, add env vars (`DATABASE_URL`, `CLERK_SECRET_KEY`, `FRONTEND_URL`)
3. Railway auto-detects Node.js — deploy

### Frontend → Vercel
1. Push frontend to GitHub
2. Connect to Vercel, add env vars (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`)
3. Vercel auto-detects Next.js — deploy

---

## 💡 Architecture Notes

**Real-time rooms** — Socket.io uses two room types: `org:${id}` for org-wide broadcasts (shift updates, announcements, swap requests) and `user:${id}` for private notifications (messages, shift assignments).

**Auth flow** — Clerk handles the session on the frontend. On every API request, the backend verifies the Clerk JWT with `verifyToken` and syncs the user to the local `members` table on first sign-in via the `/onboard` endpoint.

**Payroll logic** — Processing a pay period pulls all completed shifts whose clock_in falls within the period's `start_date` and `end_date`. Overtime is calculated against the configured rules (daily threshold 8h, weekly 40h default). Processing can happen at any time after the period ends — the date range is the source of truth, not the processing date.

**Audit logging** — Every write operation logs to `audit_logs` with old/new state diffs. Audit failures are caught silently (non-blocking) so they never break the main operation.