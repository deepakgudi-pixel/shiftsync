const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { createClerkClient } = require("@clerk/backend");
const { query } = require("../db/client");

const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
const TEST_PASSWORD = "ShiftSync!234";
const DEV_HEADER = "x-dev-clerk-user-id";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const request = async (pathname, options = {}) => {
  const { clerkUserId, headers, ...rest } = options;
  const finalHeaders = {
    "Content-Type": "application/json",
    ...(headers || {}),
  };

  if (clerkUserId) {
    finalHeaders[DEV_HEADER] = clerkUserId;
  }

  const response = await fetch(`${BASE_URL}${pathname}`, {
    ...rest,
    headers: finalHeaders,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/pdf")
    ? Buffer.from(await response.arrayBuffer())
    : contentType.includes("application/json")
      ? await response.json()
      : await response.text();

  if (!response.ok) {
    const message = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`${response.status} ${response.statusText} on ${pathname}: ${message}`);
  }

  return { response, data };
};

const createClerkUser = async (label) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `qa.${label}.${stamp}+clerk_test@example.com`;
  const user = await clerk.users.createUser({
    firstName: label[0].toUpperCase() + label.slice(1),
    lastName: "QA",
    emailAddress: [email],
    password: TEST_PASSWORD,
    skipPasswordChecks: true,
    skipLegalChecks: true,
  });

  const primaryEmailId = user.primaryEmailAddressId || user.emailAddresses?.[0]?.id;
  if (primaryEmailId) {
    await clerk.emailAddresses.updateEmailAddress(primaryEmailId, { verified: true, primary: true });
  }

  return { label, email, clerkUserId: user.id };
};

const backdateClockIn = async (shiftId, memberId, hoursAgo = 2) => {
  await query(
    `UPDATE clock_events
     SET timestamp = NOW() - ($1::text || ' hours')::interval
     WHERE shift_id = $2 AND member_id = $3 AND type = 'CLOCK_IN'`,
    [hoursAgo, shiftId, memberId]
  );
};

const getMemberByClerkId = async (clerkUserId) => {
  const result = await query(
    "SELECT id, organisation_id, role, name, email, hourly_rate FROM members WHERE clerk_user_id = $1",
    [clerkUserId]
  );
  return result.rows[0] || null;
};

const main = async () => {
  const summary = [];
  const users = {};
  const ctx = {};

  const step = async (label, fn) => {
    try {
      const result = await fn();
      summary.push({ label, status: "PASS", detail: result || "" });
    } catch (error) {
      summary.push({ label, status: "FAIL", detail: error.message });
      throw error;
    }
  };

  try {
    await step("Create Clerk QA users", async () => {
      users.admin = await createClerkUser("admin");
      users.manager = await createClerkUser("manager");
      users.employeeA = await createClerkUser("employeea");
      users.employeeB = await createClerkUser("employeeb");
      return [users.admin.email, users.manager.email, users.employeeA.email, users.employeeB.email].join(", ");
    });

    await step("Admin creates organisation", async () => {
      const orgName = `ShiftSync QA ${Date.now()}`;
      const { data } = await request("/api/members/onboard", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: users.admin.clerkUserId,
          email: users.admin.email,
          name: "Admin QA",
          organisationName: orgName,
        }),
      });
      ctx.orgId = data.organisation_id;
      ctx.orgName = orgName;
      return `${orgName} (${ctx.orgId})`;
    });

    await step("Manager and employees join organisation", async () => {
      for (const user of [users.manager, users.employeeA, users.employeeB]) {
        await request("/api/members/onboard", {
          method: "POST",
          body: JSON.stringify({
            clerkUserId: user.clerkUserId,
            email: user.email,
            name: `${user.label.toUpperCase()} QA`,
            organisationId: ctx.orgId,
          }),
        });
      }
      return "3 members joined";
    });

    await step("Admin promotes manager and sets hourly rates", async () => {
      const managerMember = await getMemberByClerkId(users.manager.clerkUserId);
      const employeeAMember = await getMemberByClerkId(users.employeeA.clerkUserId);
      const employeeBMember = await getMemberByClerkId(users.employeeB.clerkUserId);

      ctx.managerMember = managerMember;
      ctx.employeeAMember = employeeAMember;
      ctx.employeeBMember = employeeBMember;

      await request(`/api/members/${managerMember.id}`, {
        method: "PATCH",
        clerkUserId: users.admin.clerkUserId,
        body: JSON.stringify({ role: "MANAGER" }),
      });

      for (const member of [employeeAMember, employeeBMember]) {
        await request(`/api/members/${member.id}`, {
          method: "PATCH",
          clerkUserId: users.admin.clerkUserId,
          body: JSON.stringify({ hourly_rate: 25 }),
        });
      }

      return "Manager promoted and employee rates set";
    });

    await step("Manager creates and assigns shift", async () => {
      const start = new Date(Date.now() - 60 * 60 * 1000);
      const end = new Date(Date.now() + 60 * 60 * 1000);
      const { data } = await request("/api/shifts", {
        method: "POST",
        clerkUserId: users.manager.clerkUserId,
        body: JSON.stringify({
          title: "Warehouse Morning",
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          location: "Dock A",
          notes: "QA manager flow",
          color: "#4f6eff",
          assigneeId: ctx.employeeAMember.id,
        }),
      });
      ctx.shift = data;
      return data.id;
    });

    await step("Employee requests swap", async () => {
      const { data } = await request(`/api/shifts/${ctx.shift.id}/swap`, {
        method: "POST",
        clerkUserId: users.employeeA.clerkUserId,
        body: JSON.stringify({
          reason: "Need coverage for a doctor appointment",
          targetId: ctx.employeeBMember.id,
        }),
      });
      ctx.swap = data;
      return data.id;
    });

    await step("Manager approves swap", async () => {
      await request(`/api/shifts/${ctx.shift.id}/swap/${ctx.swap.id}`, {
        method: "PATCH",
        clerkUserId: users.manager.clerkUserId,
        body: JSON.stringify({ status: "APPROVED" }),
      });

      const shift = await query("SELECT assignee_id, status FROM shifts WHERE id = $1", [ctx.shift.id]);
      if (shift.rows[0]?.assignee_id !== ctx.employeeBMember.id || shift.rows[0]?.status !== "ASSIGNED") {
        throw new Error("Approved swap did not reassign the shift correctly");
      }
      return "Shift reassigned to employee B";
    });

    await step("Replacement employee clocks in and out", async () => {
      await request("/api/attendance/clock-in", {
        method: "POST",
        clerkUserId: users.employeeB.clerkUserId,
        body: JSON.stringify({ shiftId: ctx.shift.id }),
      });

      await backdateClockIn(ctx.shift.id, ctx.employeeBMember.id, 2);

      await request("/api/attendance/clock-out", {
        method: "POST",
        clerkUserId: users.employeeB.clerkUserId,
        body: JSON.stringify({ shiftId: ctx.shift.id }),
      });

      const shift = await query("SELECT status FROM shifts WHERE id = $1", [ctx.shift.id]);
      if (shift.rows[0]?.status !== "COMPLETED") {
        throw new Error("Shift did not complete after clock-out");
      }
      return "Attendance completed";
    });

    await step("Admin creates pay period", async () => {
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      const end = new Date(today);
      end.setDate(today.getDate() + 1);

      const { data } = await request("/api/payroll/pay-periods", {
        method: "POST",
        clerkUserId: users.admin.clerkUserId,
        body: JSON.stringify({
          period_type: "WEEKLY",
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
        }),
      });
      ctx.payPeriod = data;
      return data.id;
    });

    await step("Admin processes payroll", async () => {
      const { data } = await request(`/api/payroll/pay-periods/${ctx.payPeriod.id}/process`, {
        method: "POST",
        clerkUserId: users.admin.clerkUserId,
      });
      if (!data.success || data.payslipsGenerated < 1) {
        throw new Error("Payroll processed without generating a payslip");
      }
      return `${data.payslipsGenerated} payslip(s) generated`;
    });

    await step("Employee downloads payslip PDF", async () => {
      const result = await query(
        `SELECT id FROM payslips
         WHERE pay_period_id = $1 AND member_id = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [ctx.payPeriod.id, ctx.employeeBMember.id]
      );
      if (!result.rows.length) {
        throw new Error("No payslip found for employee B");
      }
      ctx.payslipId = result.rows[0].id;

      const { response, data } = await request(`/api/payslips/${ctx.payslipId}/pdf`, {
        method: "GET",
        clerkUserId: users.employeeB.clerkUserId,
        headers: { Accept: "application/pdf" },
      });

      if (response.headers.get("content-type") !== "application/pdf") {
        throw new Error(`Unexpected content type: ${response.headers.get("content-type")}`);
      }
      if (!Buffer.isBuffer(data) || data.length < 500) {
        throw new Error("Payslip PDF response was unexpectedly small");
      }
      return `${ctx.payslipId} (${data.length} bytes)`;
    });
  } finally {
    console.log("\nManager flow QA summary");
    console.log("=======================");
    for (const item of summary) {
      console.log(`${item.status.padEnd(4)} ${item.label}${item.detail ? ` - ${item.detail}` : ""}`);
    }
  }
};

main().catch(() => {
  process.exitCode = 1;
});
