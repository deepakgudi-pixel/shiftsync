const EVENT_TYPES = Object.freeze({
  // Shift events
  SHIFT_CREATED: "shift.created",
  SHIFT_UPDATED: "shift.updated",
  SHIFT_DELETED: "shift.deleted",
  SHIFT_ASSIGNED: "shift.assigned",
  SHIFT_STATUS_CHANGED: "shift.status_changed",
  SHIFT_CLOCK_IN: "shift.clock_in",
  SHIFT_CLOCK_OUT: "shift.clock_out",

  // Swap events
  SWAP_REQUESTED: "swap.requested",
  SWAP_APPROVED: "swap.approved",
  SWAP_REJECTED: "swap.rejected",

  // Payroll events
  PAY_PERIOD_CREATED: "pay_period.created",
  PAY_PERIOD_PROCESSED: "pay_period.processed",
  PAY_PERIOD_PAID: "pay_period.paid",
  PAYSLIP_GENERATED: "payslip.generated",

  // Member events
  MEMBER_JOINED: "member.joined",
  MEMBER_ROLE_CHANGED: "member.role_changed",
  MEMBER_UPDATED: "member.updated",

  // Overtime rule events
  OVERTIME_RULE_CREATED: "overtime_rule.created",
  OVERTIME_RULE_UPDATED: "overtime_rule.updated",
  OVERTIME_RULE_DELETED: "overtime_rule.deleted",

  // Attendance events (canonical, emitted alongside shift.* events)
  CLOCK_IN: "attendance.clock_in",
  CLOCK_OUT: "attendance.clock_out",

  // Announcement events
  ANNOUNCEMENT_CREATED: "announcement.created",
  ANNOUNCEMENT_DELETED: "announcement.deleted",
});

module.exports = { EVENT_TYPES };