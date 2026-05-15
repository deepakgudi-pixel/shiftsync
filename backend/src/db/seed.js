const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { createClerkClient } = require("@clerk/backend");
const { pool } = require("./client");
const { emitEvent } = require("../lib/eventEmitter");
const { EVENT_TYPES } = require("../lib/events");

const DEMO_ORG_NAME = "Northstar Logistics";

let clerk = null;

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

const buildDemoEmail = (label) => `demo.${label}.northstar+clerk_test@example.com`;

const getDemoPassword = () => {
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    throw new Error("DEMO_PASSWORD environment variable is required for seeding demo data. Set it in backend/.env or pass it when running npm run db:seed.");
  }
  return password;
};

const getClerk = () => {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY environment variable is required for seeding demo users. Set it in backend/.env.");
  }

  if (!clerk) {
    clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  }

  return clerk;
};

const slugify = (value) => value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const upsertDemoOrganisation = async (client) => {
  const existing = await client.query("SELECT * FROM organisations WHERE name = $1 LIMIT 1", [DEMO_ORG_NAME]);
  if (existing.rows[0]) return existing.rows[0];

  const slug = slugify(DEMO_ORG_NAME);
  const result = await client.query(
    `INSERT INTO organisations (name, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
     RETURNING *`,
    [DEMO_ORG_NAME, slug]
  );

  return result.rows[0];
};

const upsertDemoMember = async (client, organisationId, user) => {
  const existing = await client.query(
    "SELECT * FROM members WHERE clerk_user_id = $1 OR email = $2 LIMIT 1",
    [user.clerkUserId, user.email]
  );

  if (existing.rows[0]) {
    const result = await client.query(
      `UPDATE members
       SET clerk_user_id = $1, email = $2, name = $3, role = $4, organisation_id = $5,
           hourly_rate = $6, phone = $7, skills = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        user.clerkUserId,
        user.email,
        user.displayName,
        user.role,
        organisationId,
        user.hourlyRate,
        user.phone,
        user.skills,
        existing.rows[0].id,
      ]
    );
    return result.rows[0];
  }

  const result = await client.query(
    `INSERT INTO members (clerk_user_id, email, name, role, organisation_id, hourly_rate, phone, skills)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [user.clerkUserId, user.email, user.displayName, user.role, organisationId, user.hourlyRate, user.phone, user.skills]
  );

  await emitEvent({
    client,
    organisationId,
    memberId: result.rows[0].id,
    eventType: EVENT_TYPES.MEMBER_JOINED,
    entityType: "member",
    entityId: result.rows[0].id,
    payload: result.rows[0],
  });

  return result.rows[0];
};

const upsertClerkUser = async (config, demoPassword) => {
  const email = buildDemoEmail(config.emailLabel);
  const client = getClerk();
  const existing = await client.users.getUserList({ emailAddress: [email], limit: 1 });
  let user = existing.data[0];

  if (!user) {
    user = await client.users.createUser({
      firstName: config.firstName,
      lastName: config.lastName,
      emailAddress: [email],
      password: demoPassword,
      skipPasswordChecks: true,
      skipLegalChecks: true,
    });
  }

  const primaryEmailId = user.primaryEmailAddressId || user.emailAddresses?.[0]?.id;
  if (primaryEmailId) {
    await client.emailAddresses.updateEmailAddress(primaryEmailId, {
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
   const demoPassword = getDemoPassword();
   const output = {
     organisation: DEMO_ORG_NAME,
     password: demoPassword,
     accounts: [],
   };

   try {
     const users = {};
     for (const config of demoUsers) {
       users[config.key] = await upsertClerkUser(config, demoPassword);
     }

     const dbClient = await pool.connect();
     try {
       await dbClient.query("BEGIN");
       const organisation = await upsertDemoOrganisation(dbClient);
       const organisationId = organisation.id;

       for (const user of Object.values(users)) {
         const member = await upsertDemoMember(dbClient, organisationId, user);
         output.accounts.push({
           role: member.role,
           name: member.name,
           email: member.email,
         });
       }

       await dbClient.query("COMMIT");
     } catch (error) {
       await dbClient.query("ROLLBACK");
       throw error;
     } finally {
       dbClient.release();
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
   }).catch((error) => {
     console.error(error.message);
     process.exit(1);
   }).finally(() => {
     pool.end();
   });
 }

 module.exports = { seed };
