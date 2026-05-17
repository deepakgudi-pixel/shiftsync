const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestServer } = require("./helpers/http");
const { withMockedModules } = require("./helpers/moduleMocks");

const srcRoot = path.resolve(__dirname, "../src");
const authModulePath = path.join(srcRoot, "middleware/auth.ts");
const dbModulePath = path.join(srcRoot, "db/client.ts");
const auditModulePath = path.join(srcRoot, "lib/audit.ts");
const eventEmitterModulePath = path.join(srcRoot, "lib/eventEmitter.ts");
const shiftServicePath = path.join(srcRoot, "services/shiftService.ts");

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
  clearModuleCache(shiftServicePath);

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

test("GET /api/shifts returns shifts for organisation", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.ts",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM shifts s LEFT JOIN members m")) {
        return {
          rows: [
            { id: "shift-1", title: "Morning Shift", status: "ASSIGNED", assignee_name: "John" },
            { id: "shift-2", title: "Evening Shift", status: "OPEN", assignee_name: null },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/");
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 2);
  assert.equal(response.body[0].title, "Morning Shift");
});

test("POST /api/shifts creates a new shift successfully", async (t) => {
  const assigneeId = "11111111-1111-4111-8111-111111111111";
  const harness = await loadRoute({
    routeFile: "shifts.ts",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql, params) => {
      if (sql.startsWith("SELECT id FROM shifts WHERE assignee_id=$1")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO shifts")) {
        return {
          rows: [{
            id: "new-shift",
            title: params[0],
            start_time: params[1],
            end_time: params[2],
            location: params[3],
            notes: params[4],
            color: params[5],
            status: params[6],
            organisation_id: params[7],
            assignee_id: params[8],
          }],
        };
      }
      if (sql.includes("FROM shifts s LEFT JOIN members m") && sql.includes("WHERE s.id = $1")) {
        return {
          rows: [{
            id: "new-shift",
            title: "Morning Shift",
            status: "ASSIGNED",
            assignee_name: "John",
          }],
        };
      }
      if (sql.includes("FROM members WHERE id=$1")) {
        return { rows: [{ role: "EMPLOYEE" }] };
      }
      if (sql.includes("INSERT INTO notifications")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/", {
    method: "POST",
    body: {
      title: "Morning Shift",
      startTime: "2026-05-16T09:00:00Z",
      endTime: "2026-05-16T17:00:00Z",
      assigneeId,
      location: "Warehouse A",
      notes: "Stock inventory",
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.title, "Morning Shift");
  assert.equal(response.body.status, "ASSIGNED");
});

test("POST /api/shifts creates open shift without assignee", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.ts",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql, params) => {
      if (sql.includes("INSERT INTO shifts")) {
        return {
          rows: [{
            id: "open-shift",
            title: params[0],
            status: params[6],
            assignee_id: params[8] || null,
          }],
        };
      }
      if (sql.includes("FROM shifts s LEFT JOIN members m") && sql.includes("WHERE s.id = $1")) {
        return { rows: [{ id: "open-shift", title: "Open Shift", status: "OPEN", assignee_name: null }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/", {
    method: "POST",
    body: {
      title: "Open Shift",
      startTime: "2026-05-16T09:00:00Z",
      endTime: "2026-05-16T17:00:00Z",
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.status, "OPEN");
  assert.ok(response.body.assignee_id === null || response.body.assignee_id === undefined);
});

test("PUT /api/shifts/:id updates shift successfully", async (t) => {
  const shiftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const harness = await loadRoute({
    routeFile: "shifts.ts",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql, params) => {
      if (sql.includes("FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id") && sql.includes("WHERE s.id=$1 AND s.organisation_id=$2")) {
        return {
          rows: [{
            id: shiftId,
            organisation_id: "org-1",
            assignee_id: "11111111-1111-4111-8111-111111111111",
            start_time: "2026-05-01T09:00:00Z",
            end_time: "2026-05-01T17:00:00Z",
            assignee_role: "EMPLOYEE",
          }],
        };
      }
      if (sql.includes("FROM clock_events WHERE shift_id=$1 AND member_id=$2 AND type='CLOCK_IN'")) {
        return { rows: [] };
      }
      if (sql.startsWith("SELECT id FROM shifts WHERE assignee_id=$1 AND status IN ('ASSIGNED','IN_PROGRESS')")) {
        return { rows: [] };
      }
      if (sql.includes("UPDATE shifts SET")) {
        return {
          rows: [{
            id: shiftId,
            title: "Updated Shift",
            status: "ASSIGNED",
            assignee_name: "John",
          }],
        };
      }
      if (sql.includes("FROM shifts s LEFT JOIN members m") && sql.includes("WHERE s.id = $1")) {
        return { rows: [{ id: shiftId, title: "Updated Shift", status: "ASSIGNED", assignee_name: "John" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request(`/${shiftId}`, {
    method: "PUT",
    body: { title: "Updated Shift" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.title, "Updated Shift");
});

test("PUT /api/shifts/:id returns 409 when If-Match version is stale", async (t) => {
  const shiftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const harness = await loadRoute({
    routeFile: "shifts.ts",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id") && sql.includes("WHERE s.id=$1 AND s.organisation_id=$2")) {
        return {
          rows: [{
            id: shiftId,
            organisation_id: "org-1",
            assignee_id: null,
            start_time: "2026-05-01T09:00:00Z",
            end_time: "2026-05-01T17:00:00Z",
            assignee_role: null,
            version: 3,
          }],
        };
      }
      if (sql.includes("FROM clock_events WHERE shift_id=$1 AND member_id=$2 AND type='CLOCK_IN'")) {
        return { rows: [] };
      }
      if (sql.includes("UPDATE shifts SET")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request(`/${shiftId}`, {
    method: "PUT",
    headers: { "if-match": "2" },
    body: { title: "Stale Update" },
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.error, "SHIFT_VERSION_CONFLICT");
});

test("DELETE /api/shifts/:id deletes shift successfully", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.ts",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id") && sql.includes("WHERE s.id=$1")) {
        return { rows: [{ id: "shift-1", assignee_id: "emp-1", title: "Shift", assignee_role: "EMPLOYEE" }] };
      }
      if (sql.includes("DELETE FROM shifts")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO notifications")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/shift-1", { method: "DELETE" });
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test("GET /api/shifts/swaps/pending returns pending swap requests", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.ts",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM swap_requests sr") && sql.includes("WHERE s.organisation_id = $1")) {
        return {
          rows: [
            { id: "swap-1", shift_title: "Morning Shift", requester_name: "John", status: "PENDING" },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/swaps/pending");
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].shift_title, "Morning Shift");
});

test("POST /api/shifts/:id/swap creates swap request", async (t) => {
  const shiftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const harness = await loadRoute({
    routeFile: "shifts.ts",
    basePath: "/api/shifts",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async (sql, params) => {
      if (sql.includes("FROM shifts s LEFT JOIN members m") && sql.includes("WHERE s.id=$1 AND s.organisation_id=$2")) {
        return { rows: [{ id: shiftId, assignee_id: "emp-1", title: "Morning Shift" }] };
      }
      if (sql.includes("INSERT INTO swap_requests")) {
        return { rows: [{ id: "swap-1", shift_id: params[0], requester_id: params[1], status: "PENDING" }] };
      }
      if (sql.includes("FROM swap_requests sr") && sql.includes("WHERE sr.id = $1")) {
        return { rows: [{ id: "swap-1", shift_title: "Morning Shift", requester_name: "John" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request(`/${shiftId}/swap`, {
    method: "POST",
    body: { reason: "Personal emergency", targetId: "11111111-1111-4111-8111-111111111111" },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.shift_id, shiftId);
});

test("PATCH /api/shifts/:id/swap/:swapId approves swap and reassigns", async (t) => {
  const shiftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const swapId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const harness = await loadRoute({
    routeFile: "shifts.ts",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql, params) => {
      if (sql.includes("FROM swap_requests sr") && sql.includes("WHERE sr.id=$1 AND s.organisation_id=$2")) {
        return { rows: [{ id: swapId, shift_id: shiftId, requester_id: "emp-1", target_id: "11111111-1111-4111-8111-111111111111", status: "PENDING" }] };
      }
      if (sql.includes("UPDATE swap_requests SET status=$1")) {
        return { rows: [{ id: swapId, status: "APPROVED" }] };
      }
      if (sql.includes("UPDATE shifts SET assignee_id=$1")) {
        return { rows: [{ id: shiftId, assignee_id: "emp-2", assignee_name: "Jane" }] };
      }
      if (sql.includes("FROM shifts s LEFT JOIN members m") && sql.includes("WHERE s.id=$1")) {
        return { rows: [{ id: shiftId, assignee_id: "emp-2", assignee_name: "Jane" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request(`/${shiftId}/swap/${swapId}`, {
    method: "PATCH",
    body: { status: "APPROVED" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "APPROVED");
});

test("PATCH /api/shifts/:id/swap/:swapId rejects swap", async (t) => {
  const shiftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const swapId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const harness = await loadRoute({
    routeFile: "shifts.ts",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM swap_requests sr") && sql.includes("WHERE sr.id=$1 AND s.organisation_id=$2")) {
        return { rows: [{ id: swapId, shift_id: shiftId, status: "PENDING" }] };
      }
      if (sql.includes("UPDATE swap_requests SET status=$1")) {
        return { rows: [{ id: swapId, status: "REJECTED" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request(`/${shiftId}/swap/${swapId}`, {
    method: "PATCH",
    body: { status: "REJECTED" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "REJECTED");
});

test("GET /api/shifts/:id returns shift with clock events and swap requests", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.ts",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM shifts s LEFT JOIN members m") && sql.includes("WHERE s.id=$1 AND s.organisation_id=$2")) {
        return { rows: [{ id: "shift-1", title: "Morning Shift", assignee_name: "John" }] };
      }
      if (sql.includes("FROM clock_events ce") && sql.includes("WHERE ce.shift_id=$1")) {
        return { rows: [{ id: "clock-1", type: "CLOCK_IN", member_name: "John" }] };
      }
      if (sql.includes("FROM swap_requests sr") && sql.includes("WHERE sr.shift_id=$1")) {
        return { rows: [{ id: "swap-1", requester_name: "John" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/shift-1");
  assert.equal(response.status, 200);
  assert.equal(response.body.title, "Morning Shift");
  assert.equal(response.body.clockEvents.length, 1);
  assert.equal(response.body.swapRequests.length, 1);
});

test("GET /api/shifts/:id returns 404 for unknown shift", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.ts",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM shifts s LEFT JOIN members m")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/unknown-shift");
  assert.equal(response.status, 404);
});
