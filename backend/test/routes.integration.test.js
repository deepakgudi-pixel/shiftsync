const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestServer } = require("./helpers/http");
const { withMockedModules } = require("./helpers/moduleMocks");

const srcRoot = path.resolve(__dirname, "../src");
const authModulePath = path.join(srcRoot, "middleware/auth.js");
const dbModulePath = path.join(srcRoot, "db/client.js");
const auditModulePath = path.join(srcRoot, "lib/audit.js");
const eventEmitterModulePath = path.join(srcRoot, "lib/eventEmitter.js");
const payrollServicePath = path.join(srcRoot, "services/payrollService.js");
const shiftServicePath = path.join(srcRoot, "services/shiftService.js");
const attendanceServicePath = path.join(srcRoot, "services/attendanceService.js");

const clearModuleCache = (modulePath) => {
  try {
    const resolved = require.resolve(modulePath);
    delete require.cache[resolved];
  } catch {
    // Module not in cache, nothing to clear
  }
};

const normalizeSql = (sql) => sql.replace(/\s+/g, " ").trim();

const createAuthMocks = (member) => ({
  requireAuth(req, _res, next) {
    req.member = member;
    req.clerkUserId = "clerk_test_user";
    next();
  },
  requireRole: (...roles) => (req, res, next) => {
    if (!roles.includes(req.member?.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  },
});

const createClient = (queryImpl) => ({
  async query(sql, params) {
    return queryImpl(normalizeSql(sql), params);
  },
  release() {},
});

const loadRoute = async ({ routeFile, basePath, member, queryImpl, clientQueryImpl }) => {
  // Clear service modules that depend on db/client so they pick up the mock
  clearModuleCache(payrollServicePath);
  clearModuleCache(shiftServicePath);
  clearModuleCache(attendanceServicePath);

  const router = await withMockedModules(
    {
      [authModulePath]: createAuthMocks(member),
      [dbModulePath]: {
        query: async (sql, params) => queryImpl(normalizeSql(sql), params),
        pool: {
          async connect() {
            return createClient(clientQueryImpl || queryImpl);
          },
        },
      },
      [auditModulePath]: { logAudit: async () => {} },
      [eventEmitterModulePath]: { emitEvent: async () => {} },
    },
    async ({ requireFresh }) => requireFresh(path.join(srcRoot, "routes", routeFile))
  );

  return createTestServer({ basePath, router });
};

test("GET /api/payroll/pay-periods/:id/timesheet returns calculated payroll totals", async (t) => {
  const harness = await loadRoute({
    routeFile: "payroll.js",
    basePath: "/api/payroll",
    member: { id: "member-admin", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM pay_periods WHERE id=$1")) {
        return {
          rows: [
            {
              id: "period-1",
              start_date: "2026-04-01",
              end_date: "2026-04-07",
            },
          ],
        };
      }

      if (sql.includes("FROM overtime_rules")) {
        return {
          rows: [
            {
              daily_threshold_hours: 8,
              weekly_threshold_hours: 40,
              daily_multiplier: 1.5,
              weekly_multiplier: 1.5,
            },
          ],
        };
      }

      if (sql.includes("FROM members m") && sql.includes("LEFT JOIN LATERAL")) {
        return {
          rows: [
            {
              id: "employee-1",
              name: "Sam Loader",
              avatar_url: null,
              hourly_rate: "22.50",
              override_rate: "25.00",
              ot_multiplier: "2",
            },
          ],
        };
      }

      if (sql.includes("FROM shifts s") && sql.includes("JOIN clock_events ci")) {
        return {
          rows: [
            { assignee_id: "employee-1", shift_date: "2026-04-01", raw_hours: "4" },
            { assignee_id: "employee-1", shift_date: "2026-04-01", raw_hours: "6" },
            { assignee_id: "employee-1", shift_date: "2026-04-02", raw_hours: "8" },
            { assignee_id: "employee-1", shift_date: "2026-04-03", raw_hours: "9" },
            { assignee_id: "employee-1", shift_date: "2026-04-04", raw_hours: "7" },
            { assignee_id: "employee-1", shift_date: "2026-04-05", raw_hours: "7" },
          ],
        };
      }

      throw new Error(`Unexpected SQL in payroll test: ${sql}`);
    },
  });

  t.after(async () => {
    await harness.close();
  });

  const response = await harness.request("/pay-periods/period-1/timesheet");

  assert.equal(response.status, 200);
  assert.equal(response.body.employees.length, 1);
  assert.deepEqual(response.body.employees[0], {
    employeeId: "employee-1",
    name: "Sam Loader",
    avatarUrl: null,
    hourlyRate: 25,
    shifts: [
      { date: "2026-04-01", hours: 4 },
      { date: "2026-04-01", hours: 6 },
      { date: "2026-04-02", hours: 8 },
      { date: "2026-04-03", hours: 9 },
      { date: "2026-04-04", hours: 7 },
      { date: "2026-04-05", hours: 7 },
    ],
    totalHours: 41,
    baseHours: 38,
    overtimeHours: 3,
    baseEarnings: 950,
    overtimeEarnings: 150,
    totalEarnings: 1100,
  });
});

test("POST /api/overtime applies default rule values when fields are omitted", async (t) => {
  const harness = await loadRoute({
    routeFile: "overtime.js",
    basePath: "/api/overtime",
    member: { id: "member-admin", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => {
      throw new Error("Top-level query should not be used in this overtime create test");
    },
    clientQueryImpl: async (sql, params) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO overtime_rules")) {
        return {
          rows: [
            {
              id: "rule-1",
              organisation_id: params[0],
              name: params[1],
              daily_threshold_hours: params[2],
              weekly_threshold_hours: params[3],
              daily_multiplier: params[4],
              weekly_multiplier: params[5],
              is_active: params[6],
            },
          ],
        };
      }

      throw new Error(`Unexpected SQL in overtime create test: ${sql}`);
    },
  });

  t.after(async () => {
    await harness.close();
  });

  const response = await harness.request("/", {
    method: "POST",
    body: { name: "Warehouse Standard OT" },
  });

  assert.equal(response.status, 201);
  assert.deepEqual(response.body, {
    id: "rule-1",
    organisation_id: "org-1",
    name: "Warehouse Standard OT",
    daily_threshold_hours: 8,
    weekly_threshold_hours: 40,
    daily_multiplier: 1.5,
    weekly_multiplier: 1.5,
    is_active: true,
  });
});

test("PUT /api/overtime/:id updates an existing overtime rule", async (t) => {
  const harness = await loadRoute({
    routeFile: "overtime.js",
    basePath: "/api/overtime",
    member: { id: "member-admin", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => {
      throw new Error("Top-level query should not be used in this overtime update test");
    },
    clientQueryImpl: async (sql, params) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("SELECT * FROM overtime_rules WHERE id=$1")) {
        return {
          rows: [
            {
              id: "rule-1",
              organisation_id: "org-1",
              name: "Old Rule",
            },
          ],
        };
      }

      if (sql.includes("UPDATE overtime_rules SET")) {
        return {
          rows: [
            {
              id: params[6],
              name: params[0],
              daily_threshold_hours: params[1],
              weekly_threshold_hours: params[2],
              daily_multiplier: params[3],
              weekly_multiplier: params[4],
              is_active: params[5],
            },
          ],
        };
      }

      throw new Error(`Unexpected SQL in overtime update test: ${sql}`);
    },
  });

  t.after(async () => {
    await harness.close();
  });

  const response = await harness.request("/rule-1", {
    method: "PUT",
    body: {
      name: "Weekend Rule",
      daily_threshold_hours: 10,
      weekly_threshold_hours: 48,
      daily_multiplier: 1.75,
      weekly_multiplier: 2,
      is_active: false,
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    id: "rule-1",
    name: "Weekend Rule",
    daily_threshold_hours: 10,
    weekly_threshold_hours: 48,
    daily_multiplier: 1.75,
    weekly_multiplier: 2,
    is_active: false,
  });
});

test("POST /api/shifts returns 409 when the assignee already has an overlapping shift", async (t) => {
  const assigneeId = "11111111-1111-4111-8111-111111111111";
  const harness = await loadRoute({
    routeFile: "shifts.js",
    basePath: "/api/shifts",
    member: { id: "member-manager", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.startsWith("SELECT id FROM shifts WHERE assignee_id=$1")) {
        return { rows: [{ id: "existing-shift" }] };
      }

      throw new Error(`Unexpected SQL in shift create conflict test: ${sql}`);
    },
  });

  t.after(async () => {
    await harness.close();
  });

  const response = await harness.request("/", {
    method: "POST",
    body: {
      title: "Morning Stocking",
      startTime: "2026-05-01T09:00:00.000Z",
      endTime: "2026-05-01T17:00:00.000Z",
      assigneeId,
    },
  });

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, { error: "Schedule conflict detected" });
});

test("PUT /api/shifts/:id returns 409 when an updated shift overlaps another assignment", async (t) => {
  const shiftId = "22222222-2222-4222-8222-222222222222";
  const assigneeId = "11111111-1111-4111-8111-111111111111";
  const harness = await loadRoute({
    routeFile: "shifts.js",
    basePath: "/api/shifts",
    member: { id: "member-manager", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id")) {
        return {
          rows: [
            {
              id: shiftId,
              organisation_id: "org-1",
              assignee_id: assigneeId,
              start_time: "2026-05-01T09:00:00.000Z",
              end_time: "2026-05-01T17:00:00.000Z",
              assignee_role: "EMPLOYEE",
            },
          ],
        };
      }

      if (sql.includes("FROM clock_events WHERE shift_id=$1 AND member_id=$2 AND type='CLOCK_IN'")) {
        return { rows: [] };
      }

      if (sql.startsWith("SELECT id FROM shifts WHERE assignee_id=$1 AND status IN ('ASSIGNED','IN_PROGRESS') AND id != $4")) {
        return { rows: [{ id: "existing-shift" }] };
      }

      throw new Error(`Unexpected SQL in shift update conflict test: ${sql}`);
    },
  });

  t.after(async () => {
    await harness.close();
  });

  const response = await harness.request(`/${shiftId}`, {
    method: "PUT",
    body: {
      startTime: "2026-05-01T12:00:00.000Z",
      endTime: "2026-05-01T20:00:00.000Z",
    },
  });

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, { error: "Schedule conflict detected for this employee" });
});

test("POST /api/messages returns 403 when receiver is in a different organisation", async (t) => {
  const harness = await loadRoute({
    routeFile: "messages.js",
    basePath: "/api/messages",
    member: { id: "member-1", organisation_id: "org-a", role: "EMPLOYEE" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM members WHERE id=$1")) {
        return { rows: [{ id: "member-2", organisation_id: "org-b" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => {
    await harness.close();
  });

  const response = await harness.request("/", {
    method: "POST",
    body: { receiverId: "member-2", content: "Hello" },
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Cannot message members outside your organisation");
});

test("PATCH /api/shifts/:id/swap/:swapId returns 404 when swap belongs to different organisation", async (t) => {
  const shiftId = "11111111-1111-4111-8111-111111111111";
  const swapId = "22222222-2222-4222-8222-222222222222";
  const harness = await loadRoute({
    routeFile: "shifts.js",
    basePath: "/api/shifts",
    member: { id: "member-1", organisation_id: "org-a", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM swap_requests sr")) {
        return { rows: [] };
      }
      if (sql.includes("FROM clock_events WHERE shift_id=$1")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => {
    await harness.close();
  });

  const response = await harness.request(`/${shiftId}/swap/${swapId}`, {
    method: "PATCH",
    body: { status: "APPROVED" },
  });

  assert.equal(response.status, 404);
});

test("POST /api/payroll/employee-rates returns 404 when member is in a different organisation", async (t) => {
  const harness = await loadRoute({
    routeFile: "payroll.js",
    basePath: "/api/payroll",
    member: { id: "member-admin", organisation_id: "org-a", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM members WHERE id=$1 AND organisation_id=$2")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => {
    await harness.close();
  });

  const response = await harness.request("/employee-rates", {
    method: "POST",
    body: { member_id: "member-other", hourly_rate: 25, effective_from: "2026-01-01" },
  });

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "Member not found in your organisation");
});

test("POST /api/payroll/pay-periods/:id/process returns cached result on second call", async (t) => {
  const periodId = "period-1";
  let snapshotCount = 0;
  const harness = await loadRoute({
    routeFile: "payroll.js",
    basePath: "/api/payroll",
    member: { id: "member-admin", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM pay_periods WHERE id=$1")) {
        return { rows: [{ id: periodId, start_date: "2026-04-01", end_date: "2026-04-07", status: "DRAFT" }] };
      }
      if (sql.includes("SELECT COUNT(*) FROM payroll_snapshots")) {
        snapshotCount++;
        return { rows: [{ count: snapshotCount > 1 ? "2" : "0" }] };
      }
      if (sql.includes("FROM overtime_rules")) {
        return { rows: [] };
      }
      if (sql.includes("FROM members m") && sql.includes("role='EMPLOYEE'")) {
        return { rows: [] };
      }
      if (sql.includes("SELECT currency FROM organisations")) {
        return { rows: [{ currency: "USD" }] };
      }
      if (sql.includes("FROM payroll_snapshots ps") && sql.includes("JOIN members")) {
        return { rows: [] };
      }
      if (sql.includes("FROM payslips WHERE pay_period_id")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    clientQueryImpl: async (sql) => {
      if (sql.includes("FROM pay_periods WHERE id=$1")) {
        return { rows: [{ id: periodId, start_date: "2026-04-01", end_date: "2026-04-07", status: "DRAFT" }] };
      }
      if (sql.includes("SELECT COUNT(*) FROM payroll_snapshots")) {
        snapshotCount++;
        return { rows: [{ count: snapshotCount > 1 ? "2" : "0" }] };
      }
      if (sql.includes("FROM overtime_rules")) {
        return { rows: [] };
      }
      if (sql.includes("FROM members m") && sql.includes("role='EMPLOYEE'")) {
        return { rows: [] };
      }
      if (sql.includes("SELECT currency FROM organisations")) {
        return { rows: [{ currency: "USD" }] };
      }
      if (sql.includes("FROM payroll_snapshots ps") && sql.includes("JOIN members")) {
        return { rows: [] };
      }
      if (sql.includes("FROM payslips WHERE pay_period_id")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  });

  t.after(async () => {
    await harness.close();
  });

  const first = await harness.request(`/pay-periods/${periodId}/process`, { method: "POST" });
  assert.equal(first.status, 200);
  assert.equal(first.body.success, true);

  const second = await harness.request(`/pay-periods/${periodId}/process`, { method: "POST" });
  assert.equal(second.status, 200);
  assert.equal(second.body.cached, true);
});

test("PUT /api/shifts/:id returns 409 with locked fields after clock-in", async (t) => {
  const shiftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const harness = await loadRoute({
    routeFile: "shifts.js",
    basePath: "/api/shifts",
    member: { id: "member-admin", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id")) {
        return {
          rows: [{
            id: shiftId,
            organisation_id: "org-1",
            assignee_id: "emp-1",
            start_time: "2026-05-01T09:00:00.000Z",
            end_time: "2026-05-01T17:00:00.000Z",
            assignee_role: "EMPLOYEE",
          }],
        };
      }
      if (sql.includes("FROM clock_events WHERE shift_id=$1 AND member_id=$2 AND type='CLOCK_IN'")) {
        return { rows: [{ id: "clock-1" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => {
    await harness.close();
  });

  const response = await harness.request(`/${shiftId}`, {
    method: "PUT",
    body: { startTime: "2026-05-01T10:00:00.000Z", endTime: "2026-05-01T18:00:00.000Z" },
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.error, "SHIFT_LOCKED_AFTER_CLOCK_IN");
  assert.deepEqual(response.body.lockedFields, ["startTime", "endTime"]);
});

test("POST /api/dev/demo-ticket returns 400 for unknown demo account", async (t) => {
  const prevEnv = process.env.DEMO_ACCESS_ENABLED;
  process.env.DEMO_ACCESS_ENABLED = "true";

  const harness = await loadRoute({
    routeFile: "dev.js",
    basePath: "/api/dev",
    member: { id: "member-public", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async () => {
      throw new Error("Should not reach DB for invalid email");
    },
  });

  t.after(async () => {
    process.env.DEMO_ACCESS_ENABLED = prevEnv;
    await harness.close();
  });

  const response = await harness.request("/demo-ticket", {
    method: "POST",
    body: { email: "not-a-demo-user@example.com" },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Unknown demo account");
});

test("GET /api/payroll/employee-rates returns 403 for EMPLOYEE role", async (t) => {
  const harness = await loadRoute({
    routeFile: "payroll.js",
    basePath: "/api/payroll",
    member: { id: "member-emp", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async () => {
      throw new Error("Should not reach DB for unauthorized role");
    },
  });

  t.after(async () => {
    await harness.close();
  });

  const response = await harness.request("/employee-rates?memberId=some-id", {
    method: "GET",
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Insufficient permissions");
});

test("POST /api/payroll/employee-rates returns 403 for MANAGER role", async (t) => {
  const harness = await loadRoute({
    routeFile: "payroll.js",
    basePath: "/api/payroll",
    member: { id: "member-mgr", organisation_id: "org-1", role: "MANAGER" },
    queryImpl: async () => {
      throw new Error("Should not reach DB for unauthorized role");
    },
  });

  t.after(async () => {
    await harness.close();
  });

  const response = await harness.request("/employee-rates", {
    method: "POST",
    body: { member_id: "emp-1", hourly_rate: 25, effective_from: "2026-01-01" },
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Insufficient permissions");
});

