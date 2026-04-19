require("dotenv").config();
const { pool } = require("./client");
const setup = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      CREATE TABLE IF NOT EXISTS organisations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, logo_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        clerk_user_id TEXT UNIQUE NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL,
        avatar_url TEXT, role TEXT NOT NULL DEFAULT 'EMPLOYEE' CHECK (role IN ('ADMIN','MANAGER','EMPLOYEE')),
        skills TEXT[] DEFAULT '{}', hourly_rate NUMERIC(10,2), phone TEXT,
        organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT NOT NULL, start_time TIMESTAMPTZ NOT NULL, end_time TIMESTAMPTZ NOT NULL,
        location TEXT, notes TEXT, color TEXT DEFAULT '#4f6eff',
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
        organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        assignee_id TEXT REFERENCES members(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS availability (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        start_time TEXT NOT NULL, end_time TEXT NOT NULL,
        UNIQUE(member_id, day_of_week)
      );
      CREATE TABLE IF NOT EXISTS swap_requests (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        requester_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        target_id TEXT REFERENCES members(id) ON DELETE SET NULL,
        reason TEXT, status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS clock_events (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('CLOCK_IN','CLOCK_OUT')),
        timestamp TIMESTAMPTZ DEFAULT NOW(), latitude NUMERIC(10,6), longitude NUMERIC(10,6)
      );
      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT NOT NULL, content TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
        organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        content TEXT NOT NULL,
        sender_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        receiver_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
        read BOOLEAN DEFAULT FALSE, data JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_shifts_org_start ON shifts(organisation_id, start_time);
      CREATE INDEX IF NOT EXISTS idx_shifts_assignee ON shifts(assignee_id);
      CREATE INDEX IF NOT EXISTS idx_clock_events_shift_type ON clock_events(shift_id, type);
      CREATE INDEX IF NOT EXISTS idx_members_org_role ON members(organisation_id, role);
      CREATE INDEX IF NOT EXISTS idx_members_clerk ON members(clerk_user_id);
      CREATE INDEX IF NOT EXISTS idx_announcements_org_date ON announcements(organisation_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_member ON notifications(member_id);
    `);
    await client.query("COMMIT");
    console.log("Database setup complete");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Setup failed:", err);
  } finally {
    client.release();
    pool.end();
  }
};
setup();
