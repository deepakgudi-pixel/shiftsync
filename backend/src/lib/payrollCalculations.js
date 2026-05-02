const DEFAULT_OVERTIME_RULE = Object.freeze({
  daily_threshold_hours: 8,
  weekly_threshold_hours: 40,
  daily_multiplier: 1.5,
  weekly_multiplier: 1.5,
});

const roundToCents = (value) => Math.round((value || 0) * 100) / 100;

const normalizeNumber = (value, fallback) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeOvertimeRule = (rule = {}) => ({
  daily_threshold_hours: normalizeNumber(rule.daily_threshold_hours, DEFAULT_OVERTIME_RULE.daily_threshold_hours),
  weekly_threshold_hours: normalizeNumber(rule.weekly_threshold_hours, DEFAULT_OVERTIME_RULE.weekly_threshold_hours),
  daily_multiplier: normalizeNumber(rule.daily_multiplier, DEFAULT_OVERTIME_RULE.daily_multiplier),
  weekly_multiplier: normalizeNumber(rule.weekly_multiplier, DEFAULT_OVERTIME_RULE.weekly_multiplier),
});

const calculateOvertime = (dailyHours, rule = DEFAULT_OVERTIME_RULE) => {
  const normalizedRule = normalizeOvertimeRule(rule);
  const sanitizedHours = (dailyHours || []).map((hours) => Math.max(0, normalizeNumber(hours, 0)));

  let dailyOT = 0;
  for (const hours of sanitizedHours) {
    if (hours > normalizedRule.daily_threshold_hours) {
      dailyOT += hours - normalizedRule.daily_threshold_hours;
    }
  }

  const totalHours = sanitizedHours.reduce((sum, hours) => sum + hours, 0);
  const weeklyOT = Math.max(0, totalHours - normalizedRule.weekly_threshold_hours);
  const overtimeHours = Math.max(dailyOT, weeklyOT);

  return {
    totalHours,
    overtimeHours,
    baseHours: Math.max(0, totalHours - overtimeHours),
  };
};

const calculatePayrollTotals = ({
  dailyHours,
  hourlyRate,
  overtimeMultiplier,
  rule = DEFAULT_OVERTIME_RULE,
}) => {
  const normalizedRule = normalizeOvertimeRule(rule);
  const rate = normalizeNumber(hourlyRate, 0);
  const otMultiplier = normalizeNumber(overtimeMultiplier, normalizedRule.daily_multiplier);
  const { totalHours, overtimeHours, baseHours } = calculateOvertime(dailyHours, normalizedRule);

  const baseEarnings = baseHours * rate;
  const overtimeEarnings = overtimeHours * rate * otMultiplier;

  return {
    hourlyRate: rate,
    overtimeMultiplier: otMultiplier,
    totalHours: roundToCents(totalHours),
    baseHours: roundToCents(baseHours),
    overtimeHours: roundToCents(overtimeHours),
    baseEarnings: roundToCents(baseEarnings),
    overtimeEarnings: roundToCents(overtimeEarnings),
    totalEarnings: roundToCents(baseEarnings + overtimeEarnings),
  };
};

module.exports = {
  DEFAULT_OVERTIME_RULE,
  calculateOvertime,
  calculatePayrollTotals,
  normalizeOvertimeRule,
  roundToCents,
};
