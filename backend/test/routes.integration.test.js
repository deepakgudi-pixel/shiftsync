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

      if (sql.includes("FROM clock_events WHERE shift_id=$1 AND type='CLOCK_IN'")) {
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
