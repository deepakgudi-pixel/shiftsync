const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { createClerkClient } = require("@clerk/backend");
const { query } = require("./client");

const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
const DEV_HEADER = "x-dev-clerk-user-id";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "ShiftSync!234";
const DEMO_ORG_NAME = "Northstar Logistics";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const demoUsers = [
  {
    key: "admin",
    firstName: "Ava",
    lastName: "Reynolds",
    displayName: "Ava Reynolds",
    role: "ADMIN",
    emailLabel: "admin",
    hourlyRate: null,
    phone: "+1-555-0101",
    skills: ["Operations", "Scheduling", "Payroll"],
  },
  {
    key: "manager",
    firstName: "Marco",
    lastName: "Diaz",
    displayName: "Marco Diaz",
    role: "MANAGER",
    emailLabel: "manager",
    hourlyRate: null,
    phone: "+1-555-0102",
    skills: ["Dispatch", "Coverage Planning", "Team Ops"],
  },
  {
    key: "employeeA",
    firstName: "Leah",
    lastName: "Kim",
    displayName: "Leah Kim",
    role: "EMPLOYEE",
    emailLabel: "leah",
    hourlyRate: 24,
    phone: "+1-555-0103",
    skills: ["Receiving", "Inventory"],
  },
  {
    key: "employeeB",
    firstName: "Owen",
    lastName: "Patel",
    displayName: "Owen Patel",
    role: "EMPLOYEE",
    emailLabel: "owen",
    hourlyRate: 26,
    phone: "+1-555-0104",
    skills: ["Forklift", "Dispatch"],
  },
  {
    key: "employeeC",
    firstName: "Nina",
    lastName: "Lopez",
    displayName: "Nina Lopez",
    role: "EMPLOYEE",
    emailLabel: "nina",
    hourlyRate: 23,
    phone: "+1-555-0105",
    skills: ["Packing", "Fulfillment"],
  },
];

const request = async (pathname, options = {}) => {
  const { clerkUserId, headers, ...rest } = options;
  const finalHeaders = {
    "Content-Type": "application/json",
    ...(headers || {}),
  };

  if (clerkUserId) {
    finalHeaders[DEV_HEADER] = clerkUserId;
    finalHeaders.Host = `localhost:${process.env.PORT || 4000}`;
  }

  const response = await fetch(`${BASE_URL}${pathname}`, {
    ...rest,
    headers: finalHeaders,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} on ${pathname}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }

  return data;
};

const buildDemoEmail = (label) => `demo.${label}.northstar+clerk_test@example.com`;

const upsertClerkUser = async (config) => {
  const email = buildDemoEmail(config.emailLabel);
  const existing = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
  let user = existing.data[0];

  if (!user) {
    user = await clerk.users.createUser({
      firstName: config.firstName,
      lastName: config.lastName,
      emailAddress: [email],
      password: DEMO_PASSWORD,
      skipPasswordChecks: true,
      skipLegalChecks: true,
    });
  }

  const primaryEmailId = user.primaryEmailAddressId || user.emailAddresses?.[0]?.id;
  if (primaryEmailId) {
    await clerk.emailAddresses.updateEmailAddress(primaryEmailId, {
      verified: true,
      primary: true,
    });
  }

  return {
    ...config,
    email,
    clerkUserId: user.id,
  };
};

const seed = async () => {
   const output = {
     organisation: DEMO_ORG_NAME,
     password: DEMO_PASSWORD,
     accounts: [],
   };

   try {
     const users = {};
     for (const config of demoUsers) {
       users[config.key] = await upsertClerkUser(config);
     }

     const admin = users.admin;
     const adminMember = await request("/api/members/onboard", {
       method: "POST",
       body: JSON.stringify({
         clerkUserId: admin.clerkUserId,
         email: admin.email,
         name: admin.displayName,
         organisationName: DEMO_ORG_NAME,
       }),
     });

     const organisationId = adminMember.organisation_id;

     for (const user of Object.values(users)) {
       if (user.key === "admin") continue;

       await request("/api/members/onboard", {
         method: "POST",
         body: JSON.stringify({
           clerkUserId: user.clerkUserId,
           email: user.email,
           name: user.displayName,
           organisationId,
         }),
       });
     }

     for (const user of Object.values(users)) {
       const memberResult = await query(
         "SELECT id, role FROM members WHERE clerk_user_id = $1",
         [user.clerkUserId]
       );
       const member = memberResult.rows[0];

       const patchBody = {};
       if (user.role !== member.role) {
         patchBody.role = user.role;
       }
       if (user.hourlyRate !== null) {
         patchBody.hourly_rate = user.hourlyRate;
       }

       if (Object.keys(patchBody).length > 0) {
         await request(`/api/members/${member.id}`, {
           method: "PATCH",
           clerkUserId: admin.clerkUserId,
           body: JSON.stringify(patchBody),
         });
       }

       await query(
         `UPDATE members
          SET phone = $1, skills = $2, updated_at = NOW()
          WHERE id = $3`,
         [user.phone, user.skills, member.id]
       );

       output.accounts.push({
         role: user.role,
         name: user.displayName,
         email: user.email,
       });
     }

     output.accounts.sort((a, b) => {
       const order = { ADMIN: 0, MANAGER: 1, EMPLOYEE: 2 };
       return (order[a.role] ?? 99) - (order[b.role] ?? 99) || a.name.localeCompare(b.name);
     });

     return output;
   } catch (error) {
     console.error("Failed to seed demo accounts");
     console.error(error);
     throw error;
   }
 };

 if (require.main === module) {
   seed().then(output => {
     console.log(JSON.stringify(output, null, 2));
   }).catch(() => process.exit(1));
 }

 module.exports = { seed };
