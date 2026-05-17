const routes = [
  { path: "/api/members", router: require("./members") },
  { path: "/api/organisations", router: require("./organisations") },
  { path: "/api/shifts", router: require("./shifts") },
  { path: "/api/attendance", router: require("./attendance") },
  { path: "/api/messages", router: require("./messages") },
  { path: "/api/notifications", router: require("./notifications") },
  { path: "/api/analytics", router: require("./analytics") },
  { path: "/api/audit-logs", router: require("./audit") },
  { path: "/api/overtime", router: require("./overtime") },
  { path: "/api/payroll", router: require("./payroll") },
  { path: "/api/payslips", router: require("./payslips") },
  { path: "/api/events", router: require("./events") },
  { path: "/api/dev", router: require("./dev") },
];

module.exports = { routes };

export {};
