require("dotenv").config();
const { pool } = require("./client");
const setup = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Add missing columns (safe to run even if column exists)
    await client.query("ALTER TABLE organisations ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD'");
    await client.query("ALTER TABLE members ADD COLUMN IF NOT EXISTS phone TEXT");

    await client.query(`
      CREATE TABLE IF NOT EXISTS organisations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, logo_url TEXT,
        currency TEXT DEFAULT 'USD',
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        clerk_user_id TEXT UNIQUE NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL,
        avatar_url TEXT, role TEXT NOT NULL DEFAULT 'EMPLOYEE' CHECK (role IN ('ADMIN','MANAGER','EMPLOYEE')),
        skills TEXT[] DEFAULT '{}', hourly_rate NUMERIC(10,2), phone TEXT,
        organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT NOT NULL, start_time TIMESTAMPTZ NOT NULL, end_time TIMESTAMPTZ NOT NULL,
        location TEXT, notes TEXT, color TEXT DEFAULT '#4f6eff',
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
        organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        assignee_id TEXT REFERENCES members(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS availability (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        start_time TEXT NOT NULL, end_time TEXT NOT NULL,
        UNIQUE(member_id, day_of_week)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS swap_requests (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        requester_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        target_id TEXT REFERENCES members(id) ON DELETE SET NULL,
        reason TEXT, status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS clock_events (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('CLOCK_IN','CLOCK_OUT')),
        timestamp TIMESTAMPTZ DEFAULT NOW(), latitude NUMERIC(10,6), longitude NUMERIC(10,6)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT NOT NULL, content TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
        organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        content TEXT NOT NULL,
        sender_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        receiver_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
        read BOOLEAN DEFAULT FALSE, data JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
        clerk_user_id TEXT,
        action TEXT NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE','CLOCK_IN','CLOCK_OUT','APPROVE','REJECT','REQUEST')),
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        old_values JSONB,
        new_values JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS pay_periods (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        period_type TEXT NOT NULL CHECK (period_type IN ('WEEKLY','BIWEEKLY','SEMI_MONTHLY','MONTHLY')),
        start_date DATE NOT NULL, end_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PROCESSED','PAID')),
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS overtime_rules (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT 'Default Overtime Rule',
        daily_threshold_hours NUMERIC(4,2) DEFAULT 8,
        weekly_threshold_hours NUMERIC(4,2) DEFAULT 40,
        daily_multiplier NUMERIC(3,2) DEFAULT 1.5,
        weekly_multiplier NUMERIC(3,2) DEFAULT 1.5,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_rates (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        hourly_rate NUMERIC(10,2) NOT NULL,
        overtime_multiplier NUMERIC(3,2) DEFAULT 1.5,
        effective_from DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS payslips (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        pay_period_id TEXT NOT NULL REFERENCES pay_periods(id) ON DELETE CASCADE,
        organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        base_hours NUMERIC(8,2) NOT NULL,
        overtime_hours NUMERIC(8,2) DEFAULT 0,
        overtime_rate NUMERIC(3,2),
        base_earnings NUMERIC(12,2) NOT NULL,
        overtime_earnings NUMERIC(12,2) DEFAULT 0,
        total_earnings NUMERIC(12,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT DEFAULT 'GENERATED' CHECK (status IN ('GENERATED','VIEWED','DOWNLOADED')),
        generated_by TEXT REFERENCES members(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shifts_org_start ON shifts(organisation_id, start_time);
      CREATE INDEX IF NOT EXISTS idx_shifts_assignee ON shifts(assignee_id);
      CREATE INDEX IF NOT EXISTS idx_clock_events_shift_type ON clock_events(shift_id, type);
      CREATE INDEX IF NOT EXISTS idx_members_org_role ON members(organisation_id, role);
      CREATE INDEX IF NOT EXISTS idx_members_clerk ON members(clerk_user_id);
      CREATE INDEX IF NOT EXISTS idx_announcements_org_date ON announcements(organisation_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_member ON notifications(member_id);
      CREATE INDEX IF NOT EXISTS idx_audit_org_date ON audit_logs(organisation_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_member ON audit_logs(member_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_pay_periods_org ON pay_periods(organisation_id);
      CREATE INDEX IF NOT EXISTS idx_overtime_rules_org ON overtime_rules(organisation_id);
      CREATE INDEX IF NOT EXISTS idx_employee_rates_member ON employee_rates(member_id);
      CREATE INDEX IF NOT EXISTS idx_payslips_member_period ON payslips(member_id, pay_period_id);
      CREATE INDEX IF NOT EXISTS idx_employee_rates_effective ON employee_rates(member_id, effective_from DESC);
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