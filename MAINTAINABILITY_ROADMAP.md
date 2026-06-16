# Relay Maintainability Roadmap

This roadmap keeps cleanup work visible and reviewable. The goal is a codebase that a new engineer can navigate quickly, change safely, and trust in production-like demo flows.

## Current Strengths

- Real product domain with clear Admin, Manager, and Employee roles.
- Backend tests cover payroll math and high-risk route behavior.
- Demo setup is now a single canonical command: `npm run demo:seed`.
- Lint, typecheck, tests, and audit run cleanly in the backend.
- Backend source is now TypeScript and compiles to `dist/` for production startup.
- Events, audit logs, payroll snapshots, and shift locking show production-minded design.
- Cross-org leakage has a dedicated backend test suite.
- Shift updates now use optimistic version checks from the frontend.
- Payroll processing writes durable background-job records and publishes pg-boss work for async fan-out.

## Refactor Priorities

1. Split oversized backend routes into HTTP routers plus domain/service helpers.
   - Completed: `backend/src/routes/payroll.ts` (438 → 169 lines) split into thin route handlers + `backend/src/services/payrollService.ts`.
   - Completed: `backend/src/routes/shifts.ts` (383 → 302 lines) split into thin route handlers + `backend/src/services/shiftService.ts`.
   - Completed: `backend/src/routes/attendance.ts` (322 → 144 lines) split into thin route handlers + `backend/src/services/attendanceService.ts`.
   - Target shape: route validates request, service owns workflow, lib owns pure business rules.

2. Split oversized frontend pages into feature components and hooks.
   - Completed: `frontend/src/app/payroll/page.tsx` (851 → 168 lines) split into `usePayroll` hook, tab components, and modal components.
   - Completed: `frontend/src/app/dashboard/page.tsx` (535 → 135 lines) split into `useDashboard` hook, section components, and modal components.
   - Completed: `frontend/src/app/page.tsx` (438 → 99 lines) split into `WebGLHero`, `SmoothScroll`, and section components.
   - Target shape: page composes sections, hooks own API/state, small components render UI.

3. Tighten TypeScript usage on the frontend.
   - Completed: All `any` types removed from payroll feature area (`usePayroll`, tab components, modals).
   - Added shared types: `PayPeriodTimesheet`, `TimesheetEmployee`, `PayPeriodSummary`, `EmployeeRate`, `PayslipWithPeriod`, `ProcessPayPeriodResult`.
   - Completed: current page/feature code lint clean with no frontend `any` usage in app/features, including the refreshed schedule board.
   - Remaining: backend strictness cleanup still has a small number of interop and helper `any` escape hatches.

4. Keep setup and demo paths boring.
   - Preserve `npm run demo:seed` as the canonical demo rebuild command.
   - Keep browser demo reset wired to the same backend seed flow.

5. Expand tests around risky workflows.
   - Completed: Payroll processing idempotency test (cached result on second call).
   - Completed: Shift lock behavior after clock-in test.
   - Completed: Demo access ticket validation test (rejects unknown accounts).
   - Completed: Manager permissions test (EMPLOYEE blocked from viewing rates, MANAGER blocked from creating rates).
   - Completed: Dedicated cross-org leakage tests for messages, swap approvals, and employee rates.
   - Completed: Stale shift update test for `If-Match` version conflicts.
   - Completed: Production demo-access disablement test.
   - All roadmap test items complete.

6. Plan the framework/tooling migration separately.
   - Next is patched to the latest 14.x line for this codebase.
   - A future Next 16 + ESLint 9 migration should be a dedicated slice because it changes lint config format and framework behavior.

7. Larger architecture slices to keep isolated.
   - Backend TypeScript strictness: source now compiles as TypeScript; keep tightening domain DTOs and service return types incrementally.
   - Worker depth: pg-boss now handles payroll fan-out; add retry dashboards, dead-letter views, and more queues as async workloads grow.
   - Playwright E2E: lightweight browser verification now exists via `frontend/scripts/verify-ux.mjs`; broader authenticated end-to-end suites can be added separately.

## Done In This Pass

- Tightened TypeScript types across entire payroll feature area — zero `any` warnings. Added 6 new shared types to `types/index.ts`.
- Added cross-org leakage, stale shift version, attendance side-effect, rate-limit role-skip, and production demo-access regression tests. Backend tests: 93 (all passing).
- Added `rules_snapshot` JSONB to payroll snapshots while preserving existing columns for compatibility.
- Added optimistic shift concurrency via `If-Match` and `shifts.version`.
- Migrated backend source from JS/JSDoc to TypeScript with `ts-node` dev/test flow and compiled `dist/` production startup.
- Added pg-boss worker runtime for payroll fan-out and durable `background_jobs` status tracking.
- Added non-production + feature-flag gating for attendance debug endpoints and production-hard demo route disabling.
- Added `frontend/scripts/verify-ux.mjs` plus `npm run verify:ux` for repeatable Playwright browser verification.
- Polished the schedule board with search, assignee filtering, internal column scrolling, and denser roster cards for large shift volumes.
- Reworked the demo scenario into a richer Northstar Logistics seed with 70+ completed shifts, live operations, payroll snapshots, open coverage, and pending swaps.
- Split `frontend/src/app/dashboard/page.tsx` (535 → 135 lines) into `useDashboard` hook + 7 components.
- Split `frontend/src/app/page.tsx` (438 → 99 lines) into `WebGLHero`, `SmoothScroll`, and 7 section components.
- Split `frontend/src/app/payroll/page.tsx` (851 → 168 lines) into `usePayroll` hook + 8 components.
- Split `backend/src/routes/payroll.ts` (438 → 169 lines) into thin handlers + `payrollService.ts`.
- Split `backend/src/routes/shifts.ts` (383 → 302 lines) into thin handlers + `shiftService.ts`.
- Split `backend/src/routes/attendance.ts` (322 → 144 lines) into thin handlers + `attendanceService.ts`.
- Updated test helper to clear dependent service modules from cache.
