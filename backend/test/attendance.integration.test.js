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
const attendanceServicePath = path.join(srcRoot, "services/attendanceService.js");

const clearModuleCache = (modulePath) => {
  try {
    const resolved = require.resolve(modulePath);
    delete require.cache[resolved];
  } catch {}
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

test("POST /api/attendance/clock-in returns 201 and creates clock event", async (t) => {
  const harness = await loadRoute({
    routeFile: "attendance.js",
    basePath: "/api/attendance",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE", name: "Test Emp" },
    queryImpl: async () => {
      throw new Error("Top-level query should not be used");
    },
    clientQueryImpl: async (sql, params) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };

      if (sql.includes("FROM shifts WHERE id=$1 AND assignee_id=$2")) {
        return { rows: [{ id: "shift-1", assignee_id: "emp-1", status: "ASSIGNED" }] };
      }

      if (sql.includes("FROM clock_events WHERE shift_id=$1 AND member_id=$2 AND type='CLOCK_IN'")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO clock_events")) {
        return {
          rows: [{
            id: "clock-1",
            member_id: params[0],
            shift_id: params[1],
            type: params[2],
            timestamp: new Date().toISOString(),
            latitude: params[3],
            longitude: params[4],
          }],
        };
      }

      if (sql.includes("UPDATE shifts SET status=$1")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/clock-in", {
    method: "POST",
    body: { shiftId: "shift-1", latitude: 40.7128, longitude: -74.006 },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.type, "CLOCK_IN");
  assert.equal(response.body.shift_id, "shift-1");
});

test("POST /api/attendance/clock-in returns 404 when shift not assigned", async (t) => {
  const harness = await loadRoute({
    routeFile: "attendance.js",
    basePath: "/api/attendance",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
    clientQueryImpl: async (sql, params) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };

      if (sql.includes("FROM shifts WHERE id=$1 AND assignee_id=$2")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/clock-in", {
    method: "POST",
    body: { shiftId: "shift-999" },
  });

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "Shift not found or not assigned to you");
});

test("POST /api/attendance/clock-in returns 409 when already clocked in", async (t) => {
  const harness = await loadRoute({
    routeFile: "attendance.js",
    basePath: "/api/attendance",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
    clientQueryImpl: async (sql) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("FROM shifts WHERE id=$1 AND assignee_id=$2")) {
        return { rows: [{ id: "shift-1", assignee_id: "emp-1", status: "ASSIGNED" }] };
      }
      if (sql.includes("FROM clock_events WHERE shift_id=$1 AND member_id=$2 AND type='CLOCK_IN'")) {
        return { rows: [{ id: "existing-clock" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/clock-in", {
    method: "POST",
    body: { shiftId: "shift-1" },
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.error, "Already clocked in");
});

test("POST /api/attendance/clock-out returns 200 with hours worked", async (t) => {
  const clockInTime = new Date(Date.now() - 8 * 3600000);
  const harness = await loadRoute({
    routeFile: "attendance.js",
    basePath: "/api/attendance",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
    clientQueryImpl: async (sql, params) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("FROM clock_events WHERE shift_id=$1 AND member_id=$2 AND type='CLOCK_IN'")) {
        return { rows: [{ id: "clock-in-1", timestamp: clockInTime.toISOString() }] };
      }
      if (sql.includes("INSERT INTO clock_events")) {
        return {
          rows: [{
            id: "clock-out-1",
            type: "CLOCK_OUT",
            timestamp: new Date().toISOString(),
          }],
        };
      }
      if (sql.includes("UPDATE shifts SET status=$1")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO notifications")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/clock-out", {
    method: "POST",
    body: { shiftId: "shift-1" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.type, "CLOCK_OUT");
  assert.ok(response.body.hoursWorked > 0);
});

test("POST /api/attendance/clock-out returns 409 when not clocked in", async (t) => {
  const harness = await loadRoute({
    routeFile: "attendance.js",
    basePath: "/api/attendance",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
    clientQueryImpl: async (sql) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("FROM clock_events WHERE shift_id=$1 AND member_id=$2 AND type='CLOCK_IN'")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/clock-out", {
    method: "POST",
    body: { shiftId: "shift-1" },
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.error, "Not clocked in");
});

test("GET /api/attendance/live returns currently clocked-in shifts", async (t) => {
  const harness = await loadRoute({
    routeFile: "attendance.js",
    basePath: "/api/attendance",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM shifts s JOIN members m")) {
        return {
          rows: [
            { id: "shift-1", member_name: "John Doe", status: "IN_PROGRESS", clocked_in_at: new Date().toISOString() },
            { id: "shift-2", member_name: "Jane Smith", status: "IN_PROGRESS", clocked_in_at: new Date().toISOString() },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/live");
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 2);
});

test("GET /api/attendance/timesheet/me returns personal timesheet", async (t) => {
  const harness = await loadRoute({
    routeFile: "attendance.js",
    basePath: "/api/attendance",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM shifts s") && sql.includes("assignee_id = $1")) {
        return {
          rows: [
            { id: "shift-1", title: "Morning Shift", hours_worked: "8.5" },
            { id: "shift-2", title: "Evening Shift", hours_worked: "6.0" },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/timesheet/me");
  assert.equal(response.status, 200);
  assert.equal(response.body.timesheet.length, 2);
  assert.equal(response.body.totalHours, 14.5);
});

test("GET /api/attendance/timesheet returns team timesheet for admin", async (t) => {
  const harness = await loadRoute({
    routeFile: "attendance.js",
    basePath: "/api/attendance",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM members m") && sql.includes("LEFT JOIN shifts")) {
        return {
          rows: [
            { member_id: "emp-1", name: "John", hourly_rate: 20, shift_id: "s1", clock_in: new Date().toISOString(), hours_worked: "8" },
            { member_id: "emp-1", name: "John", hourly_rate: 20, shift_id: "s2", clock_in: new Date().toISOString(), hours_worked: "7" },
            { member_id: "emp-2", name: "Jane", hourly_rate: 25, shift_id: "s3", clock_in: new Date().toISOString(), hours_worked: "6" },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/timesheet");
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 2);
  assert.equal(response.body[0].name, "John");
  assert.equal(response.body[0].totalHours, 15);
  assert.equal(response.body[1].name, "Jane");
  assert.equal(response.body[1].totalHours, 6);
});

test("GET /api/attendance/live returns 403 for employee", async (t) => {
  const harness = await loadRoute({
    routeFile: "attendance.js",
    basePath: "/api/attendance",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/live");
  assert.equal(response.status, 403);
});
