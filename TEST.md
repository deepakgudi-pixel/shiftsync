# Relay Test Framework

## Overview

Relay uses a comprehensive testing strategy covering both backend and frontend with **163 total tests** and **~85%+ route coverage**.

---

## Backend Tests: 93/93 Passing

| Test File | Tests | Coverage |
|---|---|---|
| `payroll-calculations.test.js` | 5 | Overtime math, rounding, defaults |
| `routes.integration.test.js` | 14 | Payroll, overtime, conflicts, RBAC, cache |
| `attendance.integration.test.js` | 9 | Clock-in/out, live view, timesheets |
| `crossOrg.integration.test.js` | 3 | Dedicated cross-org leakage guardrails |
| `shifts.integration.test.js` | 13 | CRUD, swaps, conflict detection, locking, version conflicts |
| `members.integration.test.js` | 6 | Profile, availability, role management |
| `announcements.integration.test.js` | 9 | Announcements, notifications, org settings |
| `events.integration.test.js` | 7 | Event replay, pagination, filtering |
| `encryption.test.js` | 12 | AES-256-GCM encrypt/decrypt, edge cases |
| `rateLimit.test.js` | 7 | Sliding window, headers, user isolation |
| `validation.test.js` | 8 | Input validation on all mutation routes |

### Running Backend Tests

```bash
cd backend && npm test
```

---

## Frontend Tests: 71/71 Passing

| Test File | Tests | Coverage |
|---|---|---|
| `utils.test.ts` | 15 | cn, fmtTime, fmtDateTime, getInitials, colors |
| `payroll/utils.test.ts` | 17 | formatMoney, getCurrencySymbol, CURRENCIES |
| `StatusBadge.test.tsx` | 4 | PAID/PROCESSED/DRAFT status rendering |
| `PayrollHeader.test.tsx` | 9 | Title, org name, total cost, currency button |
| `PayrollLoadingState.test.tsx` | 3 | Skeleton placeholders |
| `AdminStats.test.tsx` | 6 | Loading state, stat cards |
| `UpcomingShifts.test.tsx` | 11 | Empty state, swap button, role-based labels |
| `Sidebar.test.tsx` | 6 | Nav items, user display, admin features |

### Running Frontend Tests

```bash
cd frontend && npm test          # Run once
cd frontend && npm run test:watch # Watch mode
```

---

## Test Infrastructure

### Frontend
- **Vitest** — Fast, modern test runner with native ESM support
- **React Testing Library** — Component testing with user-centric queries
- **jsdom** — DOM simulation for browser APIs
- **@vitejs/plugin-react** — JSX/TSX transformation

### Backend
- **Node.js built-in `node:test`** — Zero-dependency test runner
- **Custom SQL-mocking harness** — `withMockedModules`, `createTestServer`, `createIoStub`
- **Module cache isolation** — Each test gets fresh module instances to prevent state bleed

---

## Before vs After

| Metric | Before | After |
|---|---|---|
| Backend tests | 18 | 93 |
| Dedicated cross-org tests | 0 | 3 |
| Frontend tests | 0 | 71 |
| **Total tests** | **18** | **163** |
| Route coverage | ~25% | ~85%+ |

---

## Test Architecture

### Backend Testing Strategy

Tests use **SQL-mocked integration testing** — each route is tested in isolation with mocked database queries. This approach:

1. **No real database needed** — Tests run instantly without PostgreSQL
2. **Full route coverage** — Tests Express middleware, validation, and response formatting
3. **Deterministic** — No flaky tests from database state or network issues
4. **SQL verification** — Tests assert the exact SQL queries being executed

```javascript
// Example: Testing shift creation with conflict detection
const harness = await loadRoute({
  routeFile: "shifts.js",
  basePath: "/api/shifts",
  member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
  queryImpl: async (sql) => {
    if (sql.includes("SELECT id FROM shifts WHERE assignee_id")) {
      return { rows: [{ id: "existing-shift" }] }; // Simulate conflict
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  },
});

const response = await harness.request("/", {
  method: "POST",
  body: { title: "Shift", startTime: "...", endTime: "...", assigneeId: "..." },
});

assert.equal(response.status, 409);
```

### Frontend Testing Strategy

Tests use **component-level unit testing** with React Testing Library:

1. **Mock external dependencies** — Clerk, API calls, routing
2. **Test rendered output** — Verify correct text, buttons, and conditional rendering
3. **Test user interactions** — Click handlers, form submissions
4. **Test role-based UI** — Different views for Admin/Manager/Employee

```tsx
// Example: Testing role-based UI
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: { fullName: 'Test User', ... } }),
  useAuth: () => ({ getToken: vi.fn() }),
}));

it('hides total cost for employee', () => {
  render(<PayrollHeader member={createMember('EMPLOYEE')} totalCost={1000} />);
  expect(screen.queryByText('Total Cost')).toBeNull();
});
```

---

## CI Integration

Both test suites run in GitHub Actions on every push and PR:

```yaml
# Backend
- run: cd backend && npm test

# Frontend
- run: cd frontend && npm test
```
