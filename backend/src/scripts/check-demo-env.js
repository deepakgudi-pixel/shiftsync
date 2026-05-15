const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const envPath = path.resolve(__dirname, "../../.env");

const required = [
  {
    key: "DATABASE_URL",
    hint: "PostgreSQL connection string, usually from Neon.",
  },
  {
    key: "CLERK_SECRET_KEY",
    hint: "Clerk backend secret key used to create demo users.",
  },
  {
    key: "CLERK_JWT_KEY",
    hint: "Clerk JWT public key used by API auth middleware.",
  },
  {
    key: "DEMO_PASSWORD",
    hint: "Shared password assigned to all seeded demo accounts.",
  },
  {
    key: "ENCRYPTION_KEY",
    hint: "64-character hex key used for encrypted messaging.",
    validate: (value) => /^[a-f0-9]{64}$/i.test(value),
    invalid: "must be a 64-character hex string.",
  },
];

const missing = [];
const invalid = [];

for (const item of required) {
  const value = process.env[item.key];
  if (!value) {
    missing.push(item);
    continue;
  }

  if (item.validate && !item.validate(value)) {
    invalid.push(item);
  }
}

if (!fs.existsSync(envPath)) {
  console.error("Demo setup cannot find backend/.env.");
  console.error("Create it first: cp .env.example .env");
  process.exit(1);
}

if (missing.length || invalid.length) {
  console.error("Demo setup needs a little env attention before seeding.");

  for (const item of missing) {
    console.error(`- Missing ${item.key}: ${item.hint}`);
  }

  for (const item of invalid) {
    console.error(`- Invalid ${item.key}: ${item.invalid}`);
  }

  console.error("\nUpdate backend/.env, then run: npm run demo:seed");
  process.exit(1);
}

console.log("Demo environment looks ready.");
