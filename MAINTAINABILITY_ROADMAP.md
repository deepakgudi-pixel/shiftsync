# ShiftSync Maintainability Roadmap

This roadmap keeps cleanup work visible and reviewable. The goal is a codebase that a new engineer can navigate quickly, change safely, and trust in production-like demo flows.

## Current Strengths

- Real product domain with clear Admin, Manager, and Employee roles.
- Backend tests cover payroll math and high-risk route behavior.
- Demo setup is now a single canonical command: `npm run demo:seed`.
- Lint, typecheck, tests, and audit run cleanly in the backend.
- Events, audit logs, payroll snapshots, and shift locking show production-minded design.

## Refactor Priorities

1. Split oversized backend routes into HTTP routers plus domain/service helpers.
   - Completed: `backend/src/routes/payroll.js` (438 → 169 lines) split into thin route handlers + `backend/src/services/payrollService.js`.
   - Completed: `backend/src/routes/shifts.js` (383 → 302 lines) split into thin route handlers + `backend/src/services/shiftService.js`.
   - Completed: `backend/src/routes/attendance.js` (322 → 144 lines) split into thin route handlers + `backend/src/services/attendanceService.js`.
   - Target shape: route validates request, service owns workflow, lib owns pure business rules.

2. Split oversized frontend pages into feature components and hooks.
   - Completed: `frontend/src/app/payroll/page.tsx` (851 → 168 lines) split into `usePayroll` hook, tab components, and modal components.
   - Completed: `frontend/src/app/dashboard/page.tsx` (535 → 135 lines) split into `useDashboard` hook, section components, and modal components.
   - Completed: `frontend/src/app/page.tsx` (438 → 99 lines) split into `WebGLHero`, `SmoothScroll`, and section components.
   - Target shape: page composes sections, hooks own API/state, small components render UI.

3. Tighten TypeScript usage on the frontend.
   - Completed: All `any` types removed from payroll feature area (`usePayroll`, tab components, modals).
   - Added shared types: `PayPeriodTimesheet`, `TimesheetEmployee`, `PayPeriodSummary`, `EmployeeRate`, `PayslipWithPeriod`, `ProcessPayPeriodResult`.
   - Remaining: `any` in other pages (analytics, attendance, audit, messages, schedule, team) — pre-existing, not part of refactoring scope.

4. Keep setup and demo paths boring.
   - Preserve `npm run demo:seed` as the canonical demo rebuild command.
   - Keep browser demo reset wired to the same backend seed flow.

5. Expand tests around risky workflows.
   - Completed: Payroll processing idempotency test (cached result on second call).
   - Completed: Shift lock behavior after clock-in test.
   - Completed: Demo access ticket validation test (rejects unknown accounts).
   - Completed: Manager permissions test (EMPLOYEE blocked from viewing rates, MANAGER blocked from creating rates).
   - All roadmap test items complete.

6. Plan the framework/tooling migration separately.
   - Next is patched to the latest 14.x line for this codebase.
   - A future Next 16 + ESLint 9 migration should be a dedicated slice because it changes lint config format and framework behavior.

## Done In This Pass

- Tightened TypeScript types across entire payroll feature area — zero `any` warnings. Added 6 new shared types to `types/index.ts`.
- Added 2 backend integration tests: payroll idempotency and shift lock behavior. Total tests: 15 (all passing).
- Split `frontend/src/app/dashboard/page.tsx` (535 → 135 lines) into `useDashboard` hook + 7 components.
- Split `frontend/src/app/page.tsx` (438 → 99 lines) into `WebGLHero`, `SmoothScroll`, and 7 section components.
- Split `frontend/src/app/payroll/page.tsx` (851 → 168 lines) into `usePayroll` hook + 8 components.
- Split `backend/src/routes/payroll.js` (438 → 169 lines) into thin handlers + `payrollService.js`.
- Split `backend/src/routes/shifts.js` (383 → 302 lines) into thin handlers + `shiftService.js`.
- Split `backend/src/routes/attendance.js` (322 → 144 lines) into thin handlers + `attendanceService.js`.
- Updated test helper to clear dependent service modules from cache.
