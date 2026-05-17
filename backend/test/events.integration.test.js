const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestServer } = require("./helpers/http");
const { withMockedModules } = require("./helpers/moduleMocks");

const srcRoot = path.resolve(__dirname, "../src");
const authModulePath = path.join(srcRoot, "middleware/auth.ts");
const dbModulePath = path.join(srcRoot, "db/client.ts");

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

const loadRoute = async ({ routeFile, basePath, member, queryImpl }) => {
  const router = await withMockedModules(
    {
      [authModulePath]: createAuthMocks(member),
      [dbModulePath]: {
        query: async (sql, params) => queryImpl(normalizeSql(sql), params),
        pool: { async connect() { return { query: async (s, p) => queryImpl(normalizeSql(s), p), release() {} }; } },
      },
    },
    async ({ requireFresh }) => requireFresh(path.join(srcRoot, "routes", routeFile))
  );

  return createTestServer({ basePath, router });
};

test("GET /api/events/since returns events after timestamp", async (t) => {
  const harness = await loadRoute({
    routeFile: "events.ts",
    basePath: "/api/events",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM events")) {
        return {
          rows: [
            { id: "evt-1", event_type: "shift.created", created_at: "2026-05-16T10:00:00Z" },
            { id: "evt-2", event_type: "attendance.clock_in", created_at: "2026-05-16T11:00:00Z" },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/since?since=2026-05-16T09:00:00Z");
  assert.equal(response.status, 200);
  assert.equal(response.body.events.length, 2);
  assert.equal(response.body.count, 2);
});

test("GET /api/events/since returns 400 without since parameter", async (t) => {
  const harness = await loadRoute({
    routeFile: "events.ts",
    basePath: "/api/events",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/since");
  assert.equal(response.status, 400);
});

test("GET /api/events/since returns 400 with invalid timestamp", async (t) => {
  const harness = await loadRoute({
    routeFile: "events.ts",
    basePath: "/api/events",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async () => { throw new Error("Should not reach DB"); },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/since?since=not-a-date");
  assert.equal(response.status, 400);
});

test("GET /api/events/since returns empty when no events", async (t) => {
  const harness = await loadRoute({
    routeFile: "events.ts",
    basePath: "/api/events",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM events")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/since?since=2026-05-16T09:00:00Z");
  assert.equal(response.status, 200);
  assert.equal(response.body.events.length, 0);
  assert.equal(response.body.count, 0);
});

test("GET /api/events/since sets hasMore when 500 results", async (t) => {
  const harness = await loadRoute({
    routeFile: "events.ts",
    basePath: "/api/events",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM events")) {
        return { rows: Array(500).fill({ id: "evt" }) };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/since?since=2026-05-16T09:00:00Z");
  assert.equal(response.status, 200);
  assert.equal(response.body.hasMore, true);
});

test("GET /api/events/types/:eventType returns events by type", async (t) => {
  const harness = await loadRoute({
    routeFile: "events.ts",
    basePath: "/api/events",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM events WHERE organisation_id = $1 AND event_type = $2")) {
        return {
          rows: [
            { id: "evt-1", event_type: "shift.created" },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/types/shift.created");
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 1);
});

test("GET /api/events/types/:eventType supports pagination", async (t) => {
  const harness = await loadRoute({
    routeFile: "events.ts",
    basePath: "/api/events",
    member: { id: "admin-1", organisation_id: "org-1", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM events")) {
        return { rows: [{ id: "evt-1" }, { id: "evt-2" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/types/shift.created?limit=2&before=2026-05-16T12:00:00Z");
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 2);
});
