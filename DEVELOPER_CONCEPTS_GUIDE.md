# ShiftSync — Developer Concepts Guide

This guide covers the concepts and patterns needed to work on the ShiftSync codebase.

## Prerequisites

- JavaScript/TypeScript (ES6+, async/await, modules)
- Node.js (event loop, npm, CommonJS)
- HTTP/REST (status codes, methods, headers)
- SQL (SELECT, INSERT, UPDATE, JOIN, WHERE)
- React fundamentals (components, hooks)
- Git basics

## Frontend

### Next.js 14 (App Router)

- File-based routing: folders = routes
- `'use client'` directive for client components
- Layouts wrap child pages; each route can have its own `layout.tsx`
- `error.tsx` for error boundaries, `loading.tsx` for loading states

Key files:
- `src/app/layout.tsx` — root layout with ClerkProvider
- `src/app/dashboard/page.tsx` — main dashboard
- `src/app/schedule/page.tsx` — shift kanban board

### TypeScript

- Shared interfaces in `src/types/index.ts` (Member, Shift, PayPeriod, etc.)
- Use interfaces over `any` for API responses
- `catch (err: unknown)` with type guards instead of `catch (err: any)`

### TanStack Query

Used for all server state. Replaces useEffect + useState for data fetching.

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['shifts'],
  queryFn: () => api.get('/api/shifts').then(res => res.data)
})
```

### Custom Hooks

- `useApi()` — Axios instance with Clerk token injection
- `useSocket()` — Socket.io connection with reconnect recovery

### Shared Components

- `AppLayout` — wraps all app pages with sidebar and mobile header
- `Sidebar` — navigation with role-based visibility

## Backend

### Express.js

Route handlers in `src/routes/`. Each file exports an Express router mounted in `src/index.js`.

```javascript
router.get('/', requireAuth, async (req, res) => {
  const result = await query('SELECT * FROM shifts WHERE organisation_id = $1', [req.member.organisation_id])
  res.json(result.rows)
})
```

### PostgreSQL (node-postgres)

- Connection pool in `src/db/client.js`
- Always use parameterized queries (`$1`, `$2`) — never string interpolation
- Transactions: `BEGIN` → queries → `COMMIT` or `ROLLBACK`
- `FOR UPDATE` row locks for race condition prevention (clock-in)

### Auth Middleware

- `requireAuth` — verifies Clerk JWT, attaches `req.member` and `req.clerkUserId`
- `requireRole('ADMIN', 'MANAGER')` — checks `req.member.role`
- Dev bypass via `x-dev-clerk-user-id` header (localhost only, `NODE_ENV=development`)

### Event System

- `events` table — canonical event log (append-only via DB trigger)
- `emitEvent()` — writes event, optionally inside a transaction
- Event types in `src/lib/events.js`
- Socket.io broadcasts events to `org:${id}` and `user:${id}` rooms

### Audit Logging

- `logAudit()` — writes to `audit_logs` with before/after state diffs
- Silent failure (non-blocking) — audit never breaks the main operation
- Append-only via DB trigger

### Payroll Calculations

- `src/lib/payrollCalculations.js` — pure functions for OT math
- Daily vs weekly overtime: picks the larger OT amount
- `roundToCents()` for financial rounding
- JSDoc types for type checking without full TypeScript migration

## Database

### Multi-tenant Design

Every core table has `organisation_id`. All queries filter by the authenticated member's org.

### Immutable Tables

`events` and `audit_logs` have DB triggers that block UPDATE and DELETE:

```sql
CREATE TRIGGER block_events_delete
BEFORE DELETE ON events
FOR EACH ROW EXECUTE FUNCTION block_events_modification()
```

### Key Relationships

- organisations → members (one-to-many)
- organisations → shifts (one-to-many)
- shifts → clock_events (one-to-many)
- shifts → swap_requests (one-to-many)
- pay_periods → payslips (one-to-many)
- pay_periods → payroll_snapshots (one-to-many)

## Real-time

### Socket.io Rooms

- `org:${id}` — org-wide broadcasts (shift updates, announcements)
- `user:${id}` — private notifications (messages, shift assignments)

### Reconnect Recovery

1. Client stores `lastEventTimestamp` in localStorage on every event
2. On reconnect: rejoin rooms, fetch `/api/events/since?since=timestamp`
3. Replay events, then refresh from authoritative API

## Security

- **Auth**: Clerk JWT verified on every API request and socket handshake
- **RBAC**: middleware enforces role checks per route
- **Org scoping**: every query filters by `organisation_id`
- **Headers**: Helmet.js (CSP, HSTS, frame-ancestors, XSS filter)
- **CORS**: restricted to frontend origin
- **Rate limiting**: global (1000 req/15min) + per-user on sensitive routes
- **Validation**: express-validator on POST/PUT/PATCH
- **SQL**: parameterized queries only
- **Encryption**: AES-256-GCM for message content
- **Audit**: all write operations logged, append-only tables

## Development Workflow

```bash
# Install
cd backend && npm install
cd ../frontend && npm install

# Setup
cd backend && npm run db:setup && npm run db:seed && npm run db:seed:scenario

# Run
cd backend && npm run dev    # port 4000
cd ../frontend && npm run dev  # port 3000

# Test
cd backend && npm test

# Lint
cd backend && npm run lint
cd ../frontend && npm run lint

# Typecheck
cd backend && npm run typecheck
cd ../frontend && npm run build  # includes typecheck
```

## Key Files to Read

1. `backend/src/index.js` — server setup, middleware chain
2. `backend/src/middleware/auth.js` — Clerk JWT verification
3. `backend/src/lib/payrollCalculations.js` — payroll math
4. `backend/src/routes/payroll.js` — pay period processing
5. `frontend/src/hooks/useApi.ts` — API client with auth
6. `frontend/src/hooks/useSocket.ts` — socket with reconnect
7. `frontend/src/components/layout/AppLayout.tsx` — shared layout
8. `frontend/src/types/index.ts` — shared TypeScript interfaces

## Common Gotchas

- `FRONTEND_URL` in backend `.env` must match exactly (no trailing slash)
- Frontend env vars must be prefixed with `NEXT_PUBLIC_`
- Socket rooms must be rejoined after reconnect
- Payroll processing is idempotent — re-processing returns cached results
- Shifts lock after first clock-in — time and assignee changes are rejected
- `events` and `audit_logs` are append-only — cannot be updated or deleted
