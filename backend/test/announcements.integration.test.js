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

test("GET /api/organisations/announcements returns announcements", async (t) => {
  const harness = await loadRoute({
    routeFile: "organisations.ts",
    basePath: "/api/organisations",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM announcements a")) {
        return {
          rows: [
            { id: "ann-1", title: "Holiday Schedule", priority: "HIGH" },
            { id: "ann-2", title: "Team Meeting", priority: "NORMAL" },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/announcements");
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 2);
  assert.equal(response.body[0].title, "Holiday Schedule");
});

test("POST /api/organisations/announcements creates announcement", async (t) => {
  const harness = await loadRoute({
    routeFile: "organisations.ts",
    basePath: "/api/organisations",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => { throw new Error("Should use client"); },
    clientQueryImpl: async (sql, params) => {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.includes("INSERT INTO announcements")) {
        return {
          rows: [{
            id: "ann-new",
            title: params[0],
            content: params[1],
            priority: params[2],
          }],
        };
      }
      if (sql.includes("SELECT id FROM members WHERE organisation_id")) {
        return { rows: [{ id: "emp-1" }, { id: "emp-2" }] };
      }
      if (sql.includes("INSERT INTO notifications")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/announcements", {
    method: "POST",
    body: { title: "New Policy", content: "Updated dress code", priority: "NORMAL" },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.title, "New Policy");
});

test("DELETE /api/organisations/announcements/:id deletes announcement", async (t) => {
  const harness = await loadRoute({
    routeFile: "organisations.ts",
    basePath: "/api/organisations",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => { throw new Error("Should use client"); },
    clientQueryImpl: async (sql) => {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.includes("SELECT * FROM announcements WHERE id=$1")) {
        return { rows: [{ id: "ann-1", title: "Old Announcement" }] };
      }
      if (sql.includes("DELETE FROM announcements")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/announcements/ann-1", { method: "DELETE" });
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test("GET /api/notifications returns user notifications", async (t) => {
  const harness = await loadRoute({
    routeFile: "notifications.ts",
    basePath: "/api/notifications",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM notifications WHERE member_id")) {
        return {
          rows: [
            { id: "notif-1", title: "Shift Assigned", read: false },
            { id: "notif-2", title: "Announcement", read: true },
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

test("PATCH /api/notifications/read-all marks all as read", async (t) => {
  const harness = await loadRoute({
    routeFile: "notifications.ts",
    basePath: "/api/notifications",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async (sql) => {
      if (sql.includes("UPDATE notifications SET read=TRUE")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/read-all", { method: "PATCH" });
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test("PATCH /api/notifications/:id/read marks single notification as read", async (t) => {
  const harness = await loadRoute({
    routeFile: "notifications.ts",
    basePath: "/api/notifications",
    member: { id: "emp-1", organisation_id: "org-1", role: "EMPLOYEE" },
    queryImpl: async (sql) => {
      if (sql.includes("UPDATE notifications SET read=TRUE WHERE id=$1")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/notif-1/read", { method: "PATCH" });
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test("GET /api/organisations/me returns organisation details", async (t) => {
  const harness = await loadRoute({
    routeFile: "organisations.ts",
    basePath: "/api/organisations",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM organisations o LEFT JOIN members m")) {
        return { rows: [{ id: "org-1", name: "Acme Corp", member_count: "12", currency: "USD" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/me");
  assert.equal(response.status, 200);
  assert.equal(response.body.name, "Acme Corp");
  assert.equal(response.body.currency, "USD");
});

test("PUT /api/organisations/currency updates org currency", async (t) => {
  const harness = await loadRoute({
    routeFile: "organisations.ts",
    basePath: "/api/organisations",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql, params) => {
      if (sql.includes("UPDATE organisations SET currency=$1")) {
        return { rows: [{ id: "org-1", currency: params[0] }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/currency", {
    method: "PUT",
    body: { currency: "EUR" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.currency, "EUR");
});

test("PUT /api/organisations/currency returns 400 without currency", async (t) => {
  const harness = await loadRoute({
    routeFile: "organisations.ts",
    basePath: "/api/organisations",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/currency", {
    method: "PUT",
    body: {},
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Currency required");
});
