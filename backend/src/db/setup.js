require("dotenv").config();
const { pool } = require("./client");
const setup = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fix existing FK constraints that use ON DELETE CASCADE — replace with SET NULL so
    // the append-only trigger on audit_logs and events doesn't block org deletion.
    // These are no-ops if the constraint name doesn't exist or already uses SET NULL.
    await client.query(`
      DO $$
      BEGIN
        -- audit_logs
        ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_organisation_id_fkey;
        ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_organisation_id_fkey
          FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL;

        -- events
        ALTER TABLE events DROP CONSTRAINT IF EXISTS events_organisation_id_fkey;
        ALTER TABLE events ADD CONSTRAINT events_organisation_id_fkey
          FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL;

        -- pay_periods
        ALTER TABLE pay_periods DROP CONSTRAINT IF EXISTS pay_periods_organisation_id_fkey;
        ALTER TABLE pay_periods ADD CONSTRAINT pay_periods_organisation_id_fkey
          FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL;

        -- overtime_rules
        ALTER TABLE overtime_rules DROP CONSTRAINT IF EXISTS overtime_rules_organisation_id_fkey;
        ALTER TABLE overtime_rules ADD CONSTRAINT overtime_rules_organisation_id_fkey
          FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL;

        -- payroll_snapshots org FK
        ALTER TABLE payroll_snapshots DROP CONSTRAINT IF EXISTS payroll_snapshots_organisation_id_fkey;
        ALTER TABLE payroll_snapshots ADD CONSTRAINT payroll_snapshots_organisation_id_fkey
          FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL;
      END;
      $$;
    `);

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
        organisation_id TEXT REFERENCES organisations(id) ON DELETE SET NULL,
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
        organisation_id TEXT REFERENCES organisations(id) ON DELETE SET NULL,
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
        organisation_id TEXT REFERENCES organisations(id) ON DELETE SET NULL,
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
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        seq BIGSERIAL,
        organisation_id TEXT REFERENCES organisations(id) ON DELETE SET NULL,
        member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        payload JSONB NOT NULL DEFAULT '{}',
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS payroll_snapshots (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        pay_period_id TEXT REFERENCES pay_periods(id) ON DELETE CASCADE,
        organisation_id TEXT REFERENCES organisations(id) ON DELETE SET NULL,
        member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
        hourly_rate NUMERIC(10,2) NOT NULL,
        effective_rate_id TEXT,
        overtime_multiplier NUMERIC(3,2) NOT NULL,
        rule_id TEXT,
        rule_daily_threshold_hours NUMERIC(4,2) NOT NULL,
        rule_weekly_threshold_hours NUMERIC(4,2) NOT NULL,
        rule_daily_multiplier NUMERIC(3,2) NOT NULL,
        rule_weekly_multiplier NUMERIC(3,2) NOT NULL,
        total_hours NUMERIC(8,2) NOT NULL,
        base_hours NUMERIC(8,2) NOT NULL,
        overtime_hours NUMERIC(8,2) NOT NULL,
        base_earnings NUMERIC(12,2) NOT NULL,
        overtime_earnings NUMERIC(12,2) NOT NULL,
        total_earnings NUMERIC(12,2) NOT NULL,
        generated_by TEXT REFERENCES members(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(pay_period_id, member_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_events_org_seq ON events(organisation_id, seq DESC);
      CREATE INDEX IF NOT EXISTS idx_events_org_type ON events(organisation_id, event_type);
      CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_events_member ON events(member_id);
      CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payroll_snapshots_period ON payroll_snapshots(pay_period_id);
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

    // Event immutability trigger — prevents UPDATE or DELETE on events
    await client.query(`
      CREATE OR REPLACE FUNCTION block_events_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'events table is append-only: UPDATE and DELETE are not permitted';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS block_events_update ON events;
      CREATE TRIGGER block_events_update
        BEFORE UPDATE ON events
        FOR EACH ROW EXECUTE FUNCTION block_events_modification();
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS block_events_delete ON events;
      CREATE TRIGGER block_events_delete
        BEFORE DELETE ON events
        FOR EACH ROW EXECUTE FUNCTION block_events_modification();
    `);

    // Audit log immutability trigger — prevents UPDATE or DELETE on audit_logs
    await client.query(`
      CREATE OR REPLACE FUNCTION block_audit_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs table is append-only: UPDATE and DELETE are not permitted';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS block_audit_update ON audit_logs;
      CREATE TRIGGER block_audit_update
        BEFORE UPDATE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION block_audit_modification();
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS block_audit_delete ON audit_logs;
      CREATE TRIGGER block_audit_delete
        BEFORE DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION block_audit_modification();
    `);

    // Safe org deletion — disables immutability triggers, deletes in constraint-safe order, re-enables triggers
    await client.query(`
      CREATE OR REPLACE FUNCTION delete_organisation(org_id TEXT)
      RETURNS void AS $$
      BEGIN
        ALTER TABLE audit_logs DISABLE TRIGGER block_audit_update;
        ALTER TABLE audit_logs DISABLE TRIGGER block_audit_delete;
        ALTER TABLE events DISABLE TRIGGER block_events_update;
        ALTER TABLE events DISABLE TRIGGER block_events_delete;

        DELETE FROM clock_events WHERE shift_id IN (SELECT id FROM shifts WHERE organisation_id = org_id);
        DELETE FROM swap_requests WHERE shift_id IN (SELECT id FROM shifts WHERE organisation_id = org_id);
        DELETE FROM shifts WHERE organisation_id = org_id;
        DELETE FROM payslips WHERE organisation_id = org_id;
        DELETE FROM payroll_snapshots WHERE organisation_id = org_id;
        DELETE FROM pay_periods WHERE organisation_id = org_id;
        DELETE FROM overtime_rules WHERE organisation_id = org_id;
        DELETE FROM messages WHERE sender_id IN (SELECT id FROM members WHERE organisation_id = org_id)
           OR receiver_id IN (SELECT id FROM members WHERE organisation_id = org_id);
        DELETE FROM notifications WHERE member_id IN (SELECT id FROM members WHERE organisation_id = org_id);
        DELETE FROM employee_rates WHERE member_id IN (SELECT id FROM members WHERE organisation_id = org_id);
        DELETE FROM availability WHERE member_id IN (SELECT id FROM members WHERE organisation_id = org_id);
        DELETE FROM announcements WHERE organisation_id = org_id;
        DELETE FROM members WHERE organisation_id = org_id;
        DELETE FROM organisations WHERE id = org_id;

        ALTER TABLE audit_logs ENABLE TRIGGER block_audit_update;
        ALTER TABLE audit_logs ENABLE TRIGGER block_audit_delete;
        ALTER TABLE events ENABLE TRIGGER block_events_update;
        ALTER TABLE events ENABLE TRIGGER block_events_delete;
      END;
      $$ LANGUAGE plpgsql;
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