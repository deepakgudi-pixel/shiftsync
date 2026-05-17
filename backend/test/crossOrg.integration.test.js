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
const payrollServicePath = path.join(srcRoot, "services/payrollService.ts");
const shiftServicePath = path.join(srcRoot, "services/shiftService.ts");

const clearModuleCache = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
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

const loadRoute = async ({ routeFile, basePath, member, queryImpl }) => {
  clearModuleCache(payrollServicePath);
  clearModuleCache(shiftServicePath);

  const router = await withMockedModules(
    {
      [authModulePath]: createAuthMocks(member),
      [dbModulePath]: {
        query: async (sql, params) => queryImpl(normalizeSql(sql), params),
        pool: {
          async connect() {
            return {
              query: async (sql, params) => queryImpl(normalizeSql(sql), params),
              release() {},
            };
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

test("cross-org: messages cannot be sent to members outside the sender org", async (t) => {
  const harness = await loadRoute({
    routeFile: "messages.ts",
    basePath: "/api/messages",
    member: { id: "member-a", organisation_id: "org-a", role: "EMPLOYEE" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM members WHERE id=$1")) {
        return { rows: [{ id: "member-b", organisation_id: "org-b" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/", {
    method: "POST",
    body: { receiverId: "member-b", content: "Hello" },
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Cannot message members outside your organisation");
  assert.equal(harness.io.events.length, 0);
});

test("cross-org: employee rate overrides cannot target another org", async (t) => {
  const harness = await loadRoute({
    routeFile: "payroll.ts",
    basePath: "/api/payroll",
    member: { id: "admin-a", organisation_id: "org-a", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM members WHERE id=$1 AND organisation_id=$2")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request("/employee-rates", {
    method: "POST",
    body: { member_id: "member-b", hourly_rate: 25, effective_from: "2026-01-01" },
  });

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "Member not found in your organisation");
});

test("cross-org: swap approvals cannot access swaps from another org", async (t) => {
  const harness = await loadRoute({
    routeFile: "shifts.ts",
    basePath: "/api/shifts",
    member: { id: "admin-a", organisation_id: "org-a", role: "ADMIN" },
    queryImpl: async (sql) => {
      if (sql.includes("FROM swap_requests sr")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  t.after(async () => await harness.close());

  const response = await harness.request(
    "/11111111-1111-4111-8111-111111111111/swap/22222222-2222-4222-8222-222222222222",
    { method: "PATCH", body: { status: "APPROVED" } }
  );

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "Swap request not found");
  assert.equal(harness.io.events.length, 0);
});
