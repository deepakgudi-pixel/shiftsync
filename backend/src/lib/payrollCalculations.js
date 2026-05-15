/**
 * @typedef {Object} OvertimeRule
 * @property {number} daily_threshold_hours
 * @property {number} weekly_threshold_hours
 * @property {number} daily_multiplier
 * @property {number} weekly_multiplier
 */

/**
 * @typedef {Object} OvertimeResult
 * @property {number} totalHours
 * @property {number} overtimeHours
 * @property {number} baseHours
 */

/**
 * @typedef {Object} PayrollTotals
 * @property {number} hourlyRate
 * @property {number} overtimeMultiplier
 * @property {number} totalHours
 * @property {number} baseHours
 * @property {number} overtimeHours
 * @property {number} baseEarnings
 * @property {number} overtimeEarnings
 * @property {number} totalEarnings
 */

/** @type {Readonly<OvertimeRule>} */
const DEFAULT_OVERTIME_RULE = Object.freeze({
  daily_threshold_hours: 8,
  weekly_threshold_hours: 40,
  daily_multiplier: 1.5,
  weekly_multiplier: 1.5,
});

/**
 * Round a value to cents (2 decimal places)
 * @param {number} value
 * @returns {number}
 */
const roundToCents = (value) => Math.round((value || 0) * 100) / 100;

/**
 * Normalize a value to a number, returning fallback if invalid
 * @param {number | string | null | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
const normalizeNumber = (value, fallback) => {
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Normalize an overtime rule object, filling missing fields with defaults
 * @param {Partial<OvertimeRule> | null} rule
 * @returns {OvertimeRule}
 */
const normalizeOvertimeRule = (rule = {}) => ({
  daily_threshold_hours: normalizeNumber(rule.daily_threshold_hours, DEFAULT_OVERTIME_RULE.daily_threshold_hours),
  weekly_threshold_hours: normalizeNumber(rule.weekly_threshold_hours, DEFAULT_OVERTIME_RULE.weekly_threshold_hours),
  daily_multiplier: normalizeNumber(rule.daily_multiplier, DEFAULT_OVERTIME_RULE.daily_multiplier),
  weekly_multiplier: normalizeNumber(rule.weekly_multiplier, DEFAULT_OVERTIME_RULE.weekly_multiplier),
});

/**
 * Calculate overtime hours from daily hours array
 * @param {(number | string)[]} dailyHours
 * @param {Partial<OvertimeRule> | null} rule
 * @returns {OvertimeResult}
 */
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

/**
 * Calculate full payroll totals including earnings
 * @param {Object} params
 * @param {(number | string)[]} params.dailyHours
 * @param {number | string} params.hourlyRate
 * @param {number | string} params.overtimeMultiplier
 * @param {Partial<OvertimeRule> | null} params.rule
 * @returns {PayrollTotals}
 */
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
