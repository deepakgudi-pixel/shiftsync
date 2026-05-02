const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_OVERTIME_RULE,
  calculateOvertime,
  calculatePayrollTotals,
  normalizeOvertimeRule,
} = require("../src/lib/payrollCalculations");
const { shiftsOverlap } = require("../src/lib/shiftConflicts");

test("calculateOvertime uses daily overtime when it exceeds weekly overtime", () => {
  const result = calculateOvertime([10, 8, 9, 7, 7], DEFAULT_OVERTIME_RULE);

  assert.deepEqual(result, {
    totalHours: 41,
    overtimeHours: 3,
    baseHours: 38,
  });
});

test("calculateOvertime uses weekly overtime when it exceeds daily overtime and avoids double-counting", () => {
  const result = calculateOvertime([9, 9, 9, 9, 9], DEFAULT_OVERTIME_RULE);

  assert.deepEqual(result, {
    totalHours: 45,
    overtimeHours: 5,
    baseHours: 40,
  });
});

test("calculatePayrollTotals rounds earnings and falls back to the rule multiplier", () => {
  const result = calculatePayrollTotals({
    dailyHours: [8.125, 8.125, -2],
    hourlyRate: "19.995",
    rule: DEFAULT_OVERTIME_RULE,
  });

  assert.deepEqual(result, {
    hourlyRate: 19.995,
    overtimeMultiplier: 1.5,
    totalHours: 16.25,
    baseHours: 16,
    overtimeHours: 0.25,
    baseEarnings: 319.92,
    overtimeEarnings: 7.5,
    totalEarnings: 327.42,
  });
});

test("normalizeOvertimeRule fills missing thresholds and multipliers with defaults", () => {
  assert.deepEqual(normalizeOvertimeRule({ daily_threshold_hours: "10" }), {
    daily_threshold_hours: 10,
    weekly_threshold_hours: 40,
    daily_multiplier: 1.5,
    weekly_multiplier: 1.5,
  });
});

test("shiftsOverlap matches the route conflict rules, including edge-touching shifts", () => {
  const existing = {
    startTime: "2026-05-01T09:00:00.000Z",
    endTime: "2026-05-01T17:00:00.000Z",
  };

  assert.equal(
    shiftsOverlap(existing, {
      startTime: "2026-05-01T12:00:00.000Z",
      endTime: "2026-05-01T18:00:00.000Z",
    }),
    true
  );

  assert.equal(
    shiftsOverlap(existing, {
      startTime: "2026-05-01T17:00:00.000Z",
      endTime: "2026-05-01T20:00:00.000Z",
    }),
    false
  );

  assert.equal(
    shiftsOverlap(existing, {
      startTime: "2026-05-01T10:00:00.000Z",
      endTime: "2026-05-01T12:00:00.000Z",
    }),
    true
  );
});
