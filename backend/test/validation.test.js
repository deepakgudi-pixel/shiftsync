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
const shiftServicePath = path.join(srcRoot, "services/shiftService.js");

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

test("POST /api/shifts returns 400 when title is missing", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.js",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/", {
    method: "POST",
    body: { startTime: "2026-05-16T09:00:00Z", endTime: "2026-05-16T17:00:00Z" },
  });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors);
});

test("POST /api/shifts returns 400 when startTime is invalid", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.js",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/", {
    method: "POST",
    body: { title: "Shift", startTime: "not-a-date", endTime: "2026-05-16T17:00:00Z" },
  });

  assert.equal(response.status, 400);
});

test("POST /api/shifts returns 400 when endTime is invalid", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.js",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/", {
    method: "POST",
    body: { title: "Shift", startTime: "2026-05-16T09:00:00Z", endTime: "invalid" },
  });

  assert.equal(response.status, 400);
});

test("POST /api/shifts returns 400 when assigneeId is not UUID", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.js",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/", {
    method: "POST",
    body: { title: "Shift", startTime: "2026-05-16T09:00:00Z", endTime: "2026-05-16T17:00:00Z", assigneeId: "not-uuid" },
  });

  assert.equal(response.status, 400);
});

test("PUT /api/shifts/:id returns 400 when status is invalid", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.js",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM shifts s LEFT JOIN members m")) {
        return { rows: [{ id: "shift-1", assignee_id: null, assignee_role: null }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/shift-1", {
    method: "PUT",
    body: { status: "INVALID_STATUS" },
  });

  assert.equal(response.status, 400);
});

test("PATCH /api/shifts/:id/swap/:swapId returns 400 when status is not APPROVED/REJECTED", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.js",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/shift-1/swap/swap-1", {
    method: "PATCH",
    body: { status: "PENDING" },
  });

  assert.equal(response.status, 400);
});

test("POST /api/shifts/:id/swap returns 400 when shiftId is not UUID", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.js",
    basePath: "/api/shifts",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/not-uuid/swap", {
    method: "POST",
    body: { reason: "Sick" },
  });

  assert.equal(response.status, 400);
});

test("PUT /api/shifts/:id returns 400 when id is not UUID", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.js",
    basePath: "/api/shifts",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/not-uuid", {
    method: "PUT",
    body: { title: "Updated" },
  });

  assert.equal(response.status, 400);
});
