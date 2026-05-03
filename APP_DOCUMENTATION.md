# ShiftSync - Complete Application Documentation

## Table of Contents
1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Authentication & Authorization](#authentication--authorization)
6. [Core Features](#core-features)
7. [API Reference](#api-reference)
8. [Real-time Communication](#real-time-communication)
9. [Security](#security)
10. [Deployment](#deployment)

---

## Overview

**ShiftSync** is a full-stack workforce management platform designed for frontline teams in retail, logistics, healthcare, and hospitality. It provides comprehensive tools for scheduling, attendance tracking, payroll processing, and team coordination.

### Key Capabilities
- **Smart Scheduling**: Create, assign, and track shifts with Kanban-style status columns
- **Attendance Tracking**: Clock in/out with optional location data and live attendance views
- **Shift Swapping**: Employees can request shift swaps with manager approval workflow
- **Automated Payroll**: Calculate hours, overtime, and generate PDF payslips
- **Real-time Updates**: Socket.io-powered instant updates across the organization
- **Analytics Dashboard**: Workforce KPIs, shift distribution charts, coverage rates
- **Audit Trail**: Immutable audit logs for compliance and transparency

---

## Technology Stack

### Frontend (`/frontend`)
| Technology | Purpose | Version |
|------------|---------|---------|
| Next.js 14 (App Router) | React framework with SSR | ^14.x |
| TypeScript | Type-safe development | ^5.x |
| Tailwind CSS | Utility-first styling | ^3.x |
| TanStack Query v5 | Data fetching and caching | ^5.x |
| Socket.io-client | Real-time communication | ^4.x |
| Recharts | Analytics charts | ^2.x |
| React Big Calendar | Calendar views | ^1.x |
| Axios | HTTP client | ^1.x |
| Clerk (@clerk/nextjs) | Authentication | ^4.x |
| react-hot-toast | Notifications | ^2.x |
| lucide-react | Icon library | ^0.x |

### Backend (`/backend`)
| Technology | Purpose | Version |
|------------|---------|---------|
| Node.js + Express | Web server framework | ^20.x |
| PostgreSQL (Neon) | Primary database | ^15.x |
| Socket.io | Real-time communication | ^4.x |
| Clerk (@clerk/backend) | JWT verification | ^1.x |
| PDFKit | Payslip PDF generation | ^0.13 |
| Helmet | Security headers | ^7.x |
| express-rate-limit | API rate limiting | ^7.x |
| express-validator | Input validation | ^7.x |
| crypto (Node.js) | AES-256-GCM encryption | Built-in |
| date-fns | Date formatting | ^3.x |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  App Router Pages  │  Components  │  Hooks/Utils     │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↕                                │
│                    Clerk Authentication                     │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST
                            ↕ Socket.io
┌─────────────────────────────────────────────────────────────┐
│                        Backend (Express)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Route Handlers  │  Middleware  │  Business Logic    │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↕                                │
│                    Clerk JWT Verification                   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL (Neon Serverless)               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Core Tables  │  Audit Logs  │  Event Store        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
shiftsync/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server entry point
│   │   ├── db/
│   │   │   ├── client.js         # PostgreSQL connection pool
│   │   │   ├── setup.js         # Database schema creation
│   │   │   └── seed.js          # Database seeding
│   │   ├── routes/               # API route handlers
│   │   │   ├── organisations.js
│   │   │   ├── members.js
│   │   │   ├── shifts.js
│   │   │   ├── attendance.js
│   │   │   ├── payroll.js
│   │   │   ├── payslips.js
│   │   │   ├── overtime.js
│   │   │   ├── messages.js
│   │   │   ├── notifications.js
│   │   │   ├── analytics.js
│   │   │   ├── audit.js
│   │   │   ├── events.js
│   │   │   └── dev.js
│   │   ├── middleware/
│   │   │   ├── auth.js          # Clerk JWT verification + RBAC
│   │   │   └── rateLimit.js     # Per-user rate limiter
│   │   ├── lib/
│   │   │   ├── audit.js          # Audit logging utility
│   │   │   ├── payrollCalculations.js
│   │   │   ├── events.js         # Event type constants
│   │   │   ├── eventEmitter.js   # Transactional event emission
│   │   │   ├── shiftConflicts.js
│   │   │   └── encryption.js     # AES-256-GCM encrypt/decrypt
│   │   ├── socket/
│   │   │   └── index.js         # Socket.io room management
│   │   └── test/
│   │       ├── helpers/
│   │       ├── payroll-calculations.test.js
│   │       └── routes.integration.test.js
│   ├── .env                      # Backend environment variables
│   ├── package.json
│   └── vercel.json               # Railway deployment config
│
└── frontend/
    ├── src/
    │   ├── app/                  # Next.js App Router
    │   │   ├── layout.tsx
    │   │   ├── page.tsx          # Landing page
    │   │   ├── (auth)/
    │   │   ├── dashboard/
    │   │   ├── schedule/
    │   │   ├── team/
    │   │   ├── attendance/
    │   │   ├── payroll/
    │   │   ├── messages/
    │   │   ├── analytics/
    │   │   ├── audit/
    │   │   ├── onboarding/
    │   │   ├── invite/
    │   │   └── demo-access/
    │   ├── components/
    │   │   ├── auth/
    │   │   └── layout/
    │   │       └── Sidebar.tsx
    │   ├── hooks/
    │   │   ├── useApi.ts         # Axios instance with Clerk token
    │   │   └── useSocket.ts      # Socket.io connection management
    │   └── lib/
    │       ├── utils.ts
    │       └── api.ts
    ├── .env.local
    ├── package.json
    ├── middleware.ts              # Clerk auth middleware
    └── vercel.json                # Vercel deployment config
```

---

## Database Schema

### Core Tables

#### organisations
```sql
CREATE TABLE organisations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### members
```sql
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    clerk_user_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT CHECK (role IN ('ADMIN', 'MANAGER', 'EMPLOYEE')) DEFAULT 'EMPLOYEE',
    hourly_rate NUMERIC(10,2),
    onboarded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### shifts
```sql
CREATE TABLE shifts (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    title TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    assigned_to INTEGER REFERENCES members(id),
    status TEXT CHECK (status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED')) DEFAULT 'OPEN',
    created_by INTEGER REFERENCES members(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### clock_events
```sql
CREATE TABLE clock_events (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    member_id INTEGER REFERENCES members(id),
    shift_id INTEGER REFERENCES shifts(id),
    type TEXT CHECK (type IN ('CLOCK_IN', 'CLOCK_OUT')) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    location JSONB,
    note TEXT
);
```

#### swap_requests
```sql
CREATE TABLE swap_requests (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    shift_id INTEGER REFERENCES shifts(id),
    requester_id INTEGER REFERENCES members(id),
    target_member_id INTEGER REFERENCES members(id),
    status TEXT CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### pay_periods
```sql
CREATE TABLE pay_periods (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT CHECK (status IN ('DRAFT', 'PROCESSING', 'COMPLETED', 'PAID')) DEFAULT 'DRAFT',
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### payslips
```sql
CREATE TABLE payslips (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    member_id INTEGER REFERENCES members(id),
    pay_period_id INTEGER REFERENCES pay_periods(id),
    base_hours NUMERIC(10,2),
    overtime_hours NUMERIC(10,2),
    base_pay NUMERIC(10,2),
    overtime_pay NUMERIC(10,2),
    total_pay NUMERIC(10,2),
    pdf_url TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### payroll_snapshots
```sql
CREATE TABLE payroll_snapshots (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    pay_period_id INTEGER REFERENCES pay_periods(id),
    member_id INTEGER REFERENCES members(id),
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### overtime_rules
```sql
CREATE TABLE overtime_rules (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    daily_threshold NUMERIC(4,2) DEFAULT 8,
    weekly_threshold NUMERIC(5,2) DEFAULT 40,
    multiplier NUMERIC(3,2) DEFAULT 1.5,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### employee_rates
```sql
CREATE TABLE employee_rates (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    member_id INTEGER REFERENCES members(id),
    hourly_rate NUMERIC(10,2) NOT NULL,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### announcements
```sql
CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    author_id INTEGER REFERENCES members(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### messages
```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    sender_id INTEGER REFERENCES members(id),
    recipient_id INTEGER REFERENCES members(id),
    encrypted_body TEXT NOT NULL,
    iv TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
```

#### notifications
```sql
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    member_id INTEGER REFERENCES members(id),
    type TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### audit_logs
```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    member_id INTEGER REFERENCES members(id),
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### events
```sql
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    type TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### availability
```sql
CREATE TABLE availability (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),
    member_id INTEGER REFERENCES members(id),
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Immutable Triggers

The `events` and `audit_logs` tables are protected by database triggers that prevent UPDATE and DELETE operations:

```sql
CREATE OR REPLACE FUNCTION block_events_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'events table is immutable - no modifications allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_no_update
BEFORE UPDATE OR DELETE ON events
FOR EACH ROW EXECUTE FUNCTION block_events_modification();
```

---

## Authentication & Authorization

### Authentication Flow

1. **Frontend**: Clerk handles user sessions via `@clerk/nextjs`
   - `frontend/src/app/layout.tsx` wraps the app with `ClerkProvider`
   - Middleware (`frontend/middleware.ts`) protects routes

2. **Backend**: JWT verification via `backend/src/middleware/auth.js`
   - `requireAuth` middleware extracts and verifies Clerk JWT
   - Development mode supports bypass header `x-dev-user-id`

3. **Socket.io**: Token verification on handshake
   - `backend/src/socket/index.js` verifies token during connection

### Role-Based Access Control (RBAC)

**Roles**: `ADMIN`, `MANAGER`, `EMPLOYEE`

**Permission Matrix**:

| Feature | Admin | Manager | Employee |
|---------|-------|---------|----------|
| Create/edit/delete shifts | ✅ | ✅ | ❌ |
| Assign shifts | ✅ | ✅ | ❌ |
| Clock in/out | ✅ | ✅ | ✅ |
| Request shift swap | ✅ | ✅ | ✅ |
| Approve/reject swaps | ✅ | ✅ | ❌ |
| Process payroll | ✅ | ❌ | ❌ |
| View all timesheets | ✅ | ✅ | ❌ |
| View own timesheet | ✅ | ✅ | ✅ |
| Post announcements | ✅ | ❌ | ❌ |
| Manage team members | ✅ | ✅ | ❌ |
| View audit logs | ✅ | ✅ | ❌ |
| Configure overtime rules | ✅ | ❌ | ❌ |
| Send messages | ✅ | ✅ | ✅ |
| View analytics | ✅ | ✅ | ❌ |

### requireRole Middleware

```javascript
const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.member?.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
};
```

---

## Core Features

### 1. Scheduling System

**Shift Status Flow**: `OPEN` → `ASSIGNED` → `IN_PROGRESS` → `COMPLETED`

**Key Files**:
- Backend: `backend/src/routes/shifts.js`
- Frontend: `frontend/src/app/schedule/page.tsx`

**Features**:
- Create shifts with title, start/end times
- Assign shifts to team members
- Kanban board view with drag-and-drop status updates
- Shift conflict detection (`backend/src/lib/shiftConflicts.js`)
- Lock shift details after clock-in (prevents tampering)

**API Endpoints**:
- `GET /api/shifts` - List shifts with filtering
- `POST /api/shifts` - Create new shift
- `PUT /api/shifts/:id` - Update shift
- `DELETE /api/shifts/:id` - Delete shift
- `POST /api/shifts/:id/swap` - Request shift swap
- `PATCH /api/shifts/:id/swap/:swapId` - Approve/reject swap

### 2. Attendance Tracking

**Key Files**:
- Backend: `backend/src/routes/attendance.js`
- Frontend: `frontend/src/app/attendance/page.tsx`

**Features**:
- Clock in/out with timestamp
- Optional location data (latitude/longitude)
- Optional notes on clock events
- Live attendance view for managers
- Timesheet generation (individual and team-wide)
- Automatic break detection

**API Endpoints**:
- `POST /api/attendance/clock-in` - Clock in
- `POST /api/attendance/clock-out` - Clock out
- `GET /api/attendance/live` - Live attendance view
- `GET /api/attendance/timesheet/me` - My timesheet
- `GET /api/attendance/timesheet` - Team timesheet

### 3. Payroll Processing

**Key Files**:
- Backend: `backend/src/routes/payroll.js`, `backend/src/lib/payrollCalculations.js`
- Frontend: `frontend/src/app/payroll/page.tsx`

**Features**:
- Configurable overtime rules (daily/weekly thresholds, multiplier)
- Per-employee rate overrides
- Automatic payroll calculations
- Pay period management
- PDF payslip generation using PDFKit
- Idempotent processing (re-processing returns cached results)

**Overtime Calculation** (`backend/src/lib/payrollCalculations.js`):
- Default: 8 hours daily / 40 hours weekly threshold
- Overtime multiplier: 1.5x (configurable)
- Both daily and weekly overtime supported

**API Endpoints**:
- `GET /api/payroll/pay-periods` - List pay periods
- `POST /api/payroll/pay-periods` - Create pay period
- `POST /api/payroll/pay-periods/:id/process` - Process payroll
- `GET /api/payslips` - List payslips
- `GET /api/payslips/:id/pdf` - Download PDF

### 4. Shift Swapping

**Workflow**:
1. Employee requests swap on a shift
2. Target employee is specified
3. Manager approves or rejects request
4. On approval, shift is reassigned

**API Endpoints**:
- `POST /api/shifts/:id/swap` - Request swap
- `PATCH /api/shifts/:id/swap/:swapId` - Approve/reject
- `GET /api/shifts/swaps/pending` - List pending swaps

### 5. Real-time Updates

**Key Files**:
- Backend: `backend/src/socket/index.js`
- Frontend: `frontend/src/hooks/useSocket.ts`

**Socket Rooms**:
- `org:{orgId}` - Organization-wide updates
- `user:{userId}` - User-specific notifications

**Event Types** (`backend/src/lib/events.js`):
- `SHIFT_CREATED`, `SHIFT_UPDATED`, `SHIFT_DELETED`
- `CLOCK_IN`, `CLOCK_OUT`
- `SWAP_REQUESTED`, `SWAP_APPROVED`, `SWAP_REJECTED`
- `PAYROLL_PROCESSED`, `PAYSLIP_GENERATED`
- `ANNOUNCEMENT_POSTED`
- `MEMBER_ONBOARDED`

**Reconnection Recovery**:
- Frontend stores last event timestamp in localStorage
- On reconnect, fetches missed events via `/api/events/since`
- Replays events to resync UI state

### 6. Analytics Dashboard

**Key Files**:
- Backend: `backend/src/routes/analytics.js`
- Frontend: `frontend/src/app/analytics/page.tsx`

**Metrics**:
- Total shifts, completed shifts, completion rate
- Total hours worked
- Overtime hours
- Shift distribution by day/week
- Coverage rates
- Employee productivity

**Visualization**: Recharts library for bar charts, line charts, pie charts

### 7. Audit Trail

**Key Files**:
- Backend: `backend/src/routes/audit.js`, `backend/src/lib/audit.js`

**Features**:
- Immutable audit logs (database triggers prevent modification)
- All actions logged with: action type, member ID, timestamp, details
- Queryable with filtering by action type, date range, member

**Event Store** (`events` table):
- Canonical event log for real-time reconnection
- Also immutable (no UPDATE/DELETE allowed)

---

## API Reference

### Base URL
- Development: `http://localhost:4000/api`
- Production: Configured via `NEXT_PUBLIC_API_URL`

### Authentication Header
```
Authorization: Bearer <Clerk JWT token>
```

### Common Response Format
```json
{
    "data": { ... },
    "error": "Error message if applicable"
}
```

### Route Summary

#### Organisations
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/organisations/me` | Get my organization | All |
| PUT | `/api/organisations/me` | Update organization | Admin |
| GET | `/api/organisations/announcements` | List announcements | All |
| POST | `/api/organisations/announcements` | Post announcement | Admin |

#### Members
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/members/onboard` | Create/join org | All |
| GET | `/api/members/me` | Get my profile | All |
| PUT | `/api/members/me` | Update my profile | All |
| GET | `/api/members` | List team members | Manager+ |
| GET | `/api/members/:id` | Get member details | Manager+ |
| PUT | `/api/members/:id` | Update member | Admin |
| DELETE | `/api/members/:id` | Remove member | Admin |

#### Shifts
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/shifts` | List shifts | All |
| GET | `/api/shifts/:id` | Get shift details | All |
| POST | `/api/shifts` | Create shift | Manager+ |
| PUT | `/api/shifts/:id` | Update shift | Manager+ |
| DELETE | `/api/shifts/:id` | Delete shift | Manager+ |
| POST | `/api/shifts/:id/swap` | Request swap | Employee+ |
| PATCH | `/api/shifts/:id/swap/:swapId` | Approve/reject swap | Manager+ |
| GET | `/api/shifts/swaps/pending` | Pending swaps | Manager+ |

#### Attendance
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/attendance/clock-in` | Clock in | All |
| POST | `/api/attendance/clock-out` | Clock out | All |
| GET | `/api/attendance/live` | Live attendance | Manager+ |
| GET | `/api/attendance/timesheet/me` | My timesheet | All |
| GET | `/api/attendance/timesheet` | Team timesheet | Manager+ |

#### Payroll
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/payroll/pay-periods` | List pay periods | Manager+ |
| POST | `/api/payroll/pay-periods` | Create period | Manager+ |
| GET | `/api/payroll/pay-periods/:id/timesheet` | Period timesheet | Manager+ |
| GET | `/api/payroll/pay-periods/:id/summary` | Period summary | Manager+ |
| POST | `/api/payroll/pay-periods/:id/process` | Process payroll | Admin |
| POST | `/api/payroll/pay-periods/:id/paid` | Mark as paid | Admin |
| DELETE | `/api/payroll/pay-periods/:id/payslips` | Reset period | Admin |

#### Messages
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/messages` | List messages | All |
| POST | `/api/messages` | Send message | All |
| PATCH | `/api/messages/:id/read` | Mark as read | All |

#### Notifications
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/notifications` | List notifications | All |
| PATCH | `/api/notifications/:id/read` | Mark as read | All |
| POST | `/api/notifications/read-all` | Mark all as read | All |

---

## Real-time Communication

### Socket.io Setup

**Backend** (`backend/src/socket/index.js`):
```javascript
io.on('connection', (socket) => {
    const { orgId, userId } = verifyToken(socket.handshake.auth.token);
    
    socket.join(`org:${orgId}`);
    socket.join(`user:${userId}`);
    
    // Broadcast online status
    socket.to(`org:${orgId}`).emit('member:online', { userId });
});
```

**Frontend** (`frontend/src/hooks/useSocket.ts`):
```typescript
const useSocket = () => {
    const { getToken } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    
    useEffect(() => {
        const token = await getToken();
        const s = io(SOCKET_URL, { auth: { token } });
        
        s.on('connect', () => {
            // Fetch missed events on reconnect
            const lastEventTime = localStorage.getItem('lastEventTime');
            if (lastEventTime) {
                fetchMissedEvents(lastEventTime);
            }
        });
        
        setSocket(s);
        return () => s.disconnect();
    }, []);
    
    return socket;
};
```

### Event Flow Example (Shift Created)

1. Manager creates shift via API
2. Backend saves shift to database
3. Backend emits `SHIFT_CREATED` event to `org:{orgId}` room
4. All connected clients receive the event
5. Frontend updates UI (adds shift to schedule)

---

## Security

### Security Measures

1. **Helmet.js** - Security headers (CSP, HSTS, etc.)
   - Location: `backend/src/index.js` lines 19-36

2. **Rate Limiting**
   - Global: 1000 requests per 15 minutes
   - Per-user sliding window for sensitive endpoints
   - Location: `backend/src/middleware/rateLimit.js`

3. **Input Validation**
   - express-validator on all POST/PUT endpoints
   - Parameterized SQL queries (prevents SQL injection)

4. **Message Encryption**
   - AES-256-GCM encryption for direct messages
   - Location: `backend/src/lib/encryption.js`

5. **Immutable Audit Logs**
   - Database triggers prevent tampering with audit_logs and events tables

6. **CORS Protection**
   - Configured to allow only frontend origin
   - Location: `backend/src/index.js` line 38

7. **JWT Verification**
   - All API requests verified via Clerk JWT
   - Location: `backend/src/middleware/auth.js`

### Environment Variables

**Backend** (`.env`):
```
DATABASE_URL=postgresql://...
CLERK_JWT_KEY=pem_key_here
CLERK_SECRET_KEY=sk_...
ENCRYPTION_KEY=64_char_hex_string
PORT=4000
FRONTEND_URL=http://localhost:3000
```

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

---

## Deployment

### Frontend (Vercel)

**Configuration** (`frontend/vercel.json`):
```json
{
    "rewrites": [
        { "source": "/(.*)", "destination": "/" }
    ]
}
```

**Environment Variables** (set in Vercel dashboard):
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_API_URL` (production backend URL)
- `NEXT_PUBLIC_SOCKET_URL` (production backend URL)
- `CLERK_SECRET_KEY`

### Backend (Railway)

**Configuration** (`backend/package.json`):
```json
{
    "scripts": {
        "start": "node src/index.js"
    }
}
```

**Environment Variables** (set in Railway dashboard):
- `DATABASE_URL` (Neon PostgreSQL connection string)
- `CLERK_SECRET_KEY`
- `CLERK_JWT_KEY`
- `ENCRYPTION_KEY`
- `FRONTEND_URL` (production frontend URL)
- `PORT` (automatically set by Railway)

### Database (Neon)

- Serverless PostgreSQL database
- Connection via `DATABASE_URL` environment variable
- Schema initialization: `npm run db:setup`
- Seeding: `npm run db:seed`

### Demo Account

Pre-configured demo organization "Northstar Logistics" with 5 demo accounts:
- Admin account
- Manager account
- 3 Employee accounts

Demo access page: `/demo-access`

---

## State Management (Frontend)

### TanStack Query (React Query)

Used for server state management:

```typescript
const { data, isLoading, error } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => api.get('/shifts').then(res => res.data)
});
```

**Benefits**:
- Automatic caching and background refetch
- Loading/error states built-in
- Optimistic updates support
- Deduplication of requests

### Local State

React `useState` for UI state (modals, form inputs, etc.)

### Real-time State Sync

Socket.io events update TanStack Query cache directly:

```typescript
socket.on('shift:created', (shift) => {
    queryClient.setQueryData(['shifts'], (old) => [...old, shift]);
});
```

---

## Development Workflow

### Prerequisites
- Node.js 20+
- PostgreSQL database (or Neon account)
- Clerk account for authentication

### Setup

1. **Clone repository**
   ```bash
   git clone <repo-url>
   cd shiftsync
   ```

2. **Backend setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Fill in environment variables
   npm run db:setup
   npm run dev
   ```

3. **Frontend setup**
   ```bash
   cd frontend
   npm install
   cp .env.local.example .env.local
   # Fill in environment variables
   npm run dev
   ```

### Running Tests

**Backend**:
```bash
cd backend
npm test
```

### Database Seeding

```bash
cd backend
npm run db:seed              # Basic seed
npm run db:seed:scenario     # Demo scenario with shifts and timesheets
```

---

## Troubleshooting

### Common Issues

1. **CORS errors**
   - Check `FRONTEND_URL` in backend `.env`
   - Ensure frontend URL matches exactly (no trailing slash)

2. **Socket connection fails**
   - Verify `NEXT_PUBLIC_SOCKET_URL` in frontend
   - Check that Clerk token is being passed correctly

3. **Database connection fails**
   - Verify `DATABASE_URL` format
   - Check Neon dashboard for connection status

4. **Clerk authentication fails**
   - Verify `CLERK_JWT_KEY` is correct (PEM format)
   - Check Clerk dashboard for API keys

---

## Future Enhancements

Potential areas for expansion:
- Mobile app (React Native)
- Advanced reporting (CSV/Excel export)
- Integration with payroll providers (Gusto, ADP)
- Time-off request system
- Geofencing for clock in/out
- Push notifications (mobile)
- Multi-language support
- Dark mode theme

---

*Documentation generated on: 2026-05-03*
