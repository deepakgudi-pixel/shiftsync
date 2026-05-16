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

test("GET /api/members returns team members", async (t) => {
  const harness = await loadRoute({
    routeFile: "members.js",
    basePath: "/api/members",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM members m")) {
        return {
          rows: [
            { id: "admin-1", name: "Admin User", role: "ADMIN", hourly_rate: 50 },
            { id: "emp-1", name: "John Doe", role: "EMPLOYEE", hourly_rate: 20 },
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
});

test("GET /api/members/me returns member profile with availability", async (t) => {
  const harness = await loadRoute({
    routeFile: "members.js",
    basePath: "/api/members",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM members m JOIN organisations o")) {
        return { rows: [{ id: "emp-1", name: "John", role: "EMPLOYEE", org_name: "Acme" }] };
      }
      if (sql.includes("FROM availability WHERE member_id")) {
        return { rows: [{ day_of_week: 1, start_time: "09:00", end_time: "17:00" }] };
      }
      if (sql.includes("FROM notifications WHERE member_id")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/me");
  assert.equal(response.status, 200);
  assert.equal(response.body.name, "John");
  assert.equal(response.body.availability.length, 1);
});

test("PUT /api/members/me updates profile", async (t) => {
  const harness = await loadRoute({
    routeFile: "members.js",
    basePath: "/api/members",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async () => { throw new Error("Should use client"); },
    clientQueryImpl: async (sql, params) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("SELECT * FROM members WHERE id")) {
        return { rows: [{ id: "emp-1", name: "Old Name" }] };
      }
      if (sql.includes("UPDATE members SET")) {
        return { rows: [{ id: "emp-1", name: params[0], phone: params[1] }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/me", {
    method: "PUT",
    body: { name: "New Name", phone: "555-1234" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.name, "New Name");
});

test("PUT /api/members/me/availability updates availability schedule", async (t) => {
  const harness = await loadRoute({
    routeFile: "members.js",
    basePath: "/api/members",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async () => { throw new Error("Should use client"); },
    clientQueryImpl: async (sql) => {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.includes("DELETE FROM availability WHERE member_id")) return { rows: [] };
      if (sql.includes("INSERT INTO availability")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/me/availability", {
    method: "PUT",
    body: {
      availability: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
      ],
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test("PATCH /api/members/:id updates member role (admin only)", async (t) => {
  const harness = await loadRoute({
    routeFile: "members.js",
    basePath: "/api/members",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => { throw new Error("Should use client"); },
    clientQueryImpl: async (sql, params) => {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.includes("SELECT * FROM members WHERE id=$1 AND organisation_id=$2")) {
        return { rows: [{ id: "emp-1", role: "EMPLOYEE" }] };
      }
      if (sql.includes("UPDATE members SET")) {
        return { rows: [{ id: "emp-1", role: params[0], hourly_rate: params[1] }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/emp-1", {
    method: "PATCH",
    body: { role: "MANAGER", hourly_rate: 30 },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.role, "MANAGER");
});

test("PATCH /api/members/:id returns 403 when manager tries to change role", async (t) => {
  const harness = await loadRoute({
    routeFile: "members.js",
    basePath: "/api/members",
    member: { id: "mgr-1", organisation_id: "org-1", role: "MANAGER" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
    clientQueryImpl: async () => { throw new Error("Should not reach DB"); },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/emp-1", {
    method: "PATCH",
    body: { role: "ADMIN" },
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Managers cannot change member roles");
});
