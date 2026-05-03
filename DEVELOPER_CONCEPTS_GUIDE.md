# ShiftSync - Developer Concepts Guide

This guide outlines the key concepts, technologies, and patterns that developers should understand to effectively work on the ShiftSync codebase.

## Table of Contents
1. [Prerequisite Knowledge](#prerequisite-knowledge)
2. [Frontend Concepts](#frontend-concepts)
3. [Backend Concepts](#backend-concepts)
4. [Database Concepts](#database-concepts)
5. [Real-time Communication](#real-time-communication)
6. [Authentication & Security](#authentication--security)
7. [Architecture Patterns](#architecture-patterns)
8. [Development Workflow](#development-workflow)
9. [Learning Resources](#learning-resources)

---

## Prerequisite Knowledge

Before diving into the ShiftSync codebase, developers should be comfortable with:

### Essential
- **JavaScript/TypeScript**: Modern ES6+ syntax, async/await, modules
- **Node.js**: Event loop, npm, CommonJS vs ESM modules
- **HTTP/REST**: Status codes, methods, headers, request/response cycle
- **SQL Basics**: SELECT, INSERT, UPDATE, DELETE, JOINs, WHERE clauses
- **JSON**: Data format for API communication
- **Git**: Basic commands (clone, commit, push, pull, branch)

### Recommended
- **React Fundamentals**: Components, props, state, hooks
- **Promises**: .then(), .catch(), async/await
- **Environment Variables**: How .env files work
- **Command Line**: Basic navigation and commands

---

## Frontend Concepts

### Next.js 14 (App Router)

**What to learn**:
- App Router vs Pages Router
- File-based routing (folders = routes)
- Server Components vs Client Components
- Layouts and templates
- Loading and error states
- Data fetching in Server Components

**Key files in ShiftSync**:
- `frontend/src/app/layout.tsx` - Root layout
- `frontend/src/app/page.tsx` - Landing page
- `frontend/src/app/dashboard/page.tsx` - Dashboard

**Learning resource**: [Next.js Documentation](https://nextjs.org/docs)

**Why it matters**: The entire frontend is built with Next.js App Router. Understanding when to use 'use client' directive is crucial.

### React Hooks

**What to learn**:
- `useState` - Local state management
- `useEffect` - Side effects
- `useContext` - Context API
- Custom hooks - Reusable logic

**Key hooks in ShiftSync**:
- `frontend/src/hooks/useApi.ts` - Custom hook for API calls with auth
- `frontend/src/hooks/useSocket.ts` - Custom hook for Socket.io

**Example from codebase**:
```typescript
// frontend/src/hooks/useSocket.ts
const [socket, setSocket] = useState<Socket | null>(null);

useEffect(() => {
    const s = io(SOCKET_URL, { auth: { token } });
    setSocket(s);
    return () => s.disconnect();
}, []);
```

### TanStack Query (React Query) v5

**What to learn**:
- Queries - Fetching data
- Mutations - Modifying data
- Query keys and caching
- Invalidation and refetching
- Loading and error states

**Why it matters**: ShiftSync uses TanStack Query for ALL server state management. It replaces useEffect + useState for data fetching.

**Example from codebase**:
```typescript
const { data, isLoading, error } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => api.get('/shifts').then(res => res.data)
});
```

**Learning resource**: [TanStack Query Docs](https://tanstack.com/query/latest)

### TypeScript

**What to learn**:
- Type annotations
- Interfaces and types
- Generics (basic understanding)
- Props typing in React

**Why it matters**: The entire frontend is written in TypeScript. Understanding interfaces is crucial for API response typing.

**Example from codebase**:
```typescript
interface Shift {
    id: number;
    title: string;
    start_time: string;
    end_time: string;
    status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
    assigned_to?: number;
}
```

### Tailwind CSS

**What to learn**:
- Utility classes
- Responsive design (sm:, md:, lg: prefixes)
- Flexbox and Grid utilities
- Customization via tailwind.config.js

**Why it matters**: All styling in ShiftSync uses Tailwind utility classes. No CSS files.

**Example**:
```tsx
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
```

**Learning resource**: [Tailwind CSS Docs](https://tailwindcss.com/docs)

### Clerk Authentication (Frontend)

**What to learn**:
- `<ClerkProvider>` setup
- `useAuth()` hook
- `useUser()` hook
- Protecting routes with middleware

**Key file**: `frontend/src/app/layout.tsx`

```typescript
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }) {
    return (
        <ClerkProvider>
            {children}
        </ClerkProvider>
    );
}
```

**Learning resource**: [Clerk Next.js Docs](https://clerk.com/docs/references/nextjs/overview)

---

## Backend Concepts

### Express.js

**What to learn**:
- Route handlers (GET, POST, PUT, DELETE)
- Middleware concept
- Request/Response objects
- Error handling

**Key file**: `backend/src/index.js`

**Example from codebase**:
```javascript
app.get('/api/shifts', requireAuth, requireRole('EMPLOYEE'), async (req, res) => {
    const shifts = await db.query('SELECT * FROM shifts WHERE org_id = $1', [req.member.org_id]);
    res.json(shifts.rows);
});
```

**Learning resource**: [Express.js Guide](https://expressjs.com/en/guide/routing.html)

### PostgreSQL with node-postgres (pg)

**What to learn**:
- Connection pools
- Parameterized queries (prevent SQL injection)
- Async/await with database queries
- JSONB data type in PostgreSQL

**Key file**: `backend/src/db/client.js`

```javascript
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Parameterized query - prevents SQL injection
const result = await pool.query(
    'SELECT * FROM members WHERE org_id = $1 AND id = $2',
    [orgId, memberId]
);
```

**Why it matters**: All database access in ShiftSync uses the `pg` library with parameterized queries.

**Learning resource**: [node-postgres Docs](https://node-postgres.com/)

### JWT (JSON Web Tokens)

**What to learn**:
- Token structure (header, payload, signature)
- Verification process
- Clerk JWT template format (JWK)

**Key file**: `backend/src/middleware/auth.js`

```javascript
const token = req.headers.authorization?.replace('Bearer ', '');
const decoded = jwt.verify(token, process.env.CLERK_JWT_KEY);
```

**Learning resource**: [JWT.io Introduction](https://jwt.io/introduction)

### Middleware Pattern

**What to learn**:
- Express middleware chain
- `next()` function
- Request modification in middleware

**Example from codebase** (`backend/src/middleware/auth.js`):
```javascript
const requireAuth = async (req, res, next) => {
    // Verify token...
    req.member = member;  // Attach member to request
    next();  // Continue to next middleware/route handler
};
```

### Database Transactions

**What to learn**:
- BEGIN, COMMIT, ROLLBACK
- Why transactions matter (data consistency)

**Example from codebase** (`backend/src/routes/payroll.js`):
```javascript
await db.query('BEGIN');
try {
    // Multiple queries...
    await db.query('COMMIT');
} catch (error) {
    await db.query('ROLLBACK');
    throw error;
}
```

### Event-Driven Architecture

**What to learn**:
- Events as a pattern
- Event emitters
- Decoupling with events

**Key files**:
- `backend/src/lib/events.js` - Event type constants
- `backend/src/lib/eventEmitter.js` - Transactional event emission

**Why it matters**: ShiftSync uses events for both real-time updates (Socket.io) and audit logging.

---

## Database Concepts

### Relational Database Design

**What to learn**:
- Primary keys and foreign keys
- Table relationships (one-to-many, many-to-one)
- Referential integrity (CASCADE, RESTRICT)
- Normalization basics

**Example from ShiftSync**:
```sql
CREATE TABLE shifts (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organisations(id),  -- Foreign key
    assigned_to INTEGER REFERENCES members(id)   -- Foreign key
);
```

### PostgreSQL Specific Features

**JSONB**:
- Store flexible JSON data
- Query JSON fields
- Used in ShiftSync for: `settings`, `payload` in events/notifications

```sql
-- Query JSONB
SELECT * FROM organisations WHERE settings->>'timezone' = 'America/New_York';
```

**Triggers**:
- Automatically execute functions on INSERT/UPDATE/DELETE
- Used in ShiftSync for immutable audit logs

```sql
CREATE TRIGGER block_audit_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION block_audit_modification();
```

**Indexes**:
- Improve query performance
- ShiftSync creates indexes on frequently queried columns

```sql
CREATE INDEX idx_shifts_org_id ON shifts(org_id);
CREATE INDEX idx_clock_events_member_id ON clock_events(member_id);
```

### SQL Query Patterns

**Parameterized Queries** (prevent SQL injection):
```javascript
// GOOD - parameterized
await db.query('SELECT * FROM members WHERE id = $1', [memberId]);

// BAD - string interpolation (vulnerable to SQL injection)
await db.query(`SELECT * FROM members WHERE id = ${memberId}`);
```

**JOINs**:
```sql
SELECT s.*, m.name as assigned_name
FROM shifts s
LEFT JOIN members m ON s.assigned_to = m.id
WHERE s.org_id = $1;
```

---

## Real-time Communication

### Socket.io

**What to learn**:
- WebSocket vs HTTP polling
- Rooms and namespaces
- Emitting and listening to events
- Connection lifecycle (connect, disconnect, reconnect)

**Key concepts in ShiftSync**:

1. **Rooms**: Group connections for targeted broadcasts
   ```javascript
   socket.join(`org:${orgId}`);  // Join organization room
   io.to(`org:${orgId}`).emit('event', data);  // Broadcast to org
   ```

2. **Authentication**: Verify token on handshake
   ```javascript
   io.use((socket, next) => {
       const token = socket.handshake.auth.token;
       // Verify token...
       next();
   });
   ```

3. **Event-driven**: Events drive UI updates
   ```javascript
   socket.on('shift:created', (shift) => {
       // Update UI with new shift
   });
   ```

**Learning resource**: [Socket.io Docs](https://socket.io/docs/v4/)

### Reconnection Strategy

**What to learn**:
- Handling disconnections gracefully
- Event replay on reconnect
- Timestamp-based event fetching

**Key file**: `frontend/src/hooks/useSocket.ts`

ShiftSync stores the last event timestamp and fetches missed events on reconnect:
```typescript
const lastEventTime = localStorage.getItem('lastEventTime');
const missedEvents = await api.get(`/events/since?time=${lastEventTime}`);
```

---

## Authentication & Security

### Clerk Authentication

**What to learn**:
- How Clerk works (hosted auth)
- JWT verification
- User management
- Organizations/teams in Clerk

**Backend verification** (`backend/src/middleware/auth.js`):
```javascript
import { verifyJwt } from '@clerk/backend';

const { payload } = await verifyJwt(token, { key: process.env.CLERK_JWT_KEY });
```

**Learning resource**: [Clerk Backend Docs](https://clerk.com/docs/references/backend/overview)

### Role-Based Access Control (RBAC)

**What to learn**:
- Role definitions
- Permission matrices
- Middleware for authorization

**ShiftSync roles**: `ADMIN`, `MANAGER`, `EMPLOYEE`

```javascript
const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.member.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
};

// Usage
app.post('/api/payroll/process', requireAuth, requireRole('ADMIN'), handler);
```

### Security Best Practices

**What to learn**:
- Helmet.js - Security headers
- CORS - Cross-Origin Resource Sharing
- Rate limiting - Prevent abuse
- Input validation - Sanitize user input
- Encryption - AES-256-GCM for sensitive data

**Key file**: `backend/src/index.js`

```javascript
app.use(helmet());  // Security headers
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(rateLimit());  // Rate limiting
```

### Encryption (AES-256-GCM)

**What to learn**:
- Symmetric encryption
- Initialization vectors (IV)
- Authentication tags

**Key file**: `backend/src/lib/encryption.js`

Used in ShiftSync for encrypting direct messages between users.

---

## Architecture Patterns

### Repository Pattern (Light)

While ShiftSync doesn't strictly use the Repository pattern, the route handlers act as a service layer between HTTP and database.

### Event Sourcing (Light)

The `events` table acts as an event log:
- All significant actions emit events
- Events are immutable (no updates/deletes)
- Used for real-time reconnection and audit trail

### State Management Pattern

**Frontend state flow**:
```
User Action → API Call → Backend → Database
                ↓
         TanStack Query Cache
                ↓
         UI Update + Socket Event
                ↓
         Other clients receive event → Update their cache
```

### Error Handling

**Backend**: Centralized error handling
```javascript
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});
```

**Frontend**: React Query error states
```typescript
const { data, error, isError } = useQuery({...});

if (isError) return <div>Error: {error.message}</div>;
```

---

## Development Workflow

### Local Development Setup

1. **Install dependencies**
   ```bash
   cd backend && npm install
   cd frontend && npm install
   ```

2. **Environment variables**
   - Copy `.env.example` to `.env` (backend)
   - Copy `.env.local.example` to `.env.local` (frontend)
   - Fill in required values (Database URL, Clerk keys, etc.)

3. **Database setup**
   ```bash
   cd backend
   npm run db:setup  # Create tables
   npm run db:seed   # Optional: add sample data
   ```

4. **Run development servers**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev  # Runs on :4000
   
   # Terminal 2 - Frontend
   cd frontend && npm run dev  # Runs on :3000
   ```

### Code Style

- **Frontend**: TypeScript, functional components, hooks
- **Backend**: JavaScript (Node.js), Express routes, async/await
- **Database**: SQL in separate files or route handlers

### Git Workflow

```bash
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
# Create pull request
```

---

## Learning Resources

### Official Documentation
| Technology | URL |
|------------|-----|
| Next.js | https://nextjs.org/docs |
| React | https://react.dev/learn |
| TypeScript | https://www.typescriptlang.org/docs/ |
| Tailwind CSS | https://tailwindcss.com/docs |
| TanStack Query | https://tanstack.com/query/latest/docs |
| Express.js | https://expressjs.com/en/guide/ |
| PostgreSQL | https://www.postgresql.org/docs/ |
| Socket.io | https://socket.io/docs/ |
| Clerk | https://clerk.com/docs |
| Node.js | https://nodejs.org/en/docs/ |

### Recommended Tutorials

**For Beginners**:
1. "Full Stack Next.js Course" - freeCodeCamp on YouTube
2. "Node.js Crash Course" - Traversy Media on YouTube
3. "PostgreSQL Tutorial for Beginners" - Programming with Mosh

**For Intermediate**:
1. "React Query (TanStack Query) Full Course" - Web Dev Simplified
2. "JWT Authentication in Node.js" - Dave Gray on YouTube
3. "Socket.io Crash Course" - Traversy Media

**For Advanced**:
1. "System Design: Event-Driven Architecture"
2. "PostgreSQL Performance Tuning"
3. "Advanced TypeScript Patterns"

### Practice Projects

Before working on ShiftSync, try building:
1. A simple REST API with Express + PostgreSQL
2. A React app with TanStack Query for data fetching
3. A real-time chat app with Socket.io
4. An authentication system with JWT

---

## Key Files Quick Reference

### Must Read (Start Here)
1. `backend/src/index.js` - Understand server setup
2. `backend/src/middleware/auth.js` - Understand auth flow
3. `frontend/src/app/layout.tsx` - Understand app structure
4. `frontend/src/hooks/useApi.ts` - Understand API communication
5. `backend/src/db/setup.js` - Understand database schema

### When Working On...
- **Shifts**: `backend/src/routes/shifts.js`, `frontend/src/app/schedule/page.tsx`
- **Attendance**: `backend/src/routes/attendance.js`, `frontend/src/app/attendance/page.tsx`
- **Payroll**: `backend/src/routes/payroll.js`, `backend/src/lib/payrollCalculations.js`
- **Real-time**: `backend/src/socket/index.js`, `frontend/src/hooks/useSocket.ts`
- **Auth**: `backend/src/middleware/auth.js`, `frontend/middleware.ts`

---

## Common Gotchas

1. **CORS Issues**: Make sure `FRONTEND_URL` in backend `.env` matches exactly (no trailing slash)

2. **Clerk Token**: The backend expects `Authorization: Bearer <token>` header

3. **Database Transactions**: Always use transactions when modifying multiple related records

4. **Socket Rooms**: Remember to join rooms after authentication

5. **TanStack Query**: The query key must be unique and consistent for proper caching

6. **TypeScript Errors**: Run `npm run build` to catch type errors before committing

7. **Environment Variables**: Frontend vars must be prefixed with `NEXT_PUBLIC_`

---

## Summary Checklist

Before contributing to ShiftSync, ensure you understand:

- [ ] React components and hooks
- [ ] Next.js App Router basics
- [ ] TypeScript syntax and types
- [ ] Express.js routing and middleware
- [ ] PostgreSQL queries and JSONB
- [ ] TanStack Query for data fetching
- [ ] Socket.io for real-time features
- [ ] JWT authentication with Clerk
- [ ] Role-based access control
- [ ] Environment variables and configuration
- [ ] Git workflow (branches, commits, PRs)

---

*Guide generated on: 2026-05-03*
