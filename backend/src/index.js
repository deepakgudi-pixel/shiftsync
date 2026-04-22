require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { initSocket } = require("./socket");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true },
});

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use((req, _, next) => { req.io = io; next(); });
app.get("/health", (_, res) => res.json({ status: "ok", ts: new Date() }));
app.use("/api/members", require("./routes/members"));
app.use("/api/organisations", require("./routes/organisations"));
app.use("/api/shifts", require("./routes/shifts"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/audit-logs", require("./routes/audit"));
app.use("/api/overtime", require("./routes/overtime"));
app.use("/api/payroll", require("./routes/payroll"));
app.use("/api/payslips", require("./routes/payslips"));
initSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`ShiftSync API running on http://localhost:${PORT}`));
