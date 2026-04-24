const initSocket = (io) => {
  // Auth middleware - verify Clerk token on every socket connection
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const { verifyToken } = require("@clerk/backend");
      const payload = await verifyToken(token, {
        jwtKey: process.env.CLERK_JWT_KEY,
      });
      socket.clerkUserId = payload.sub;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    // Emit server time so clients can compute lastEventTimestamp gap on reconnect
    socket.emit("connected", { serverTime: new Date().toISOString() });

    socket.on("join:org", async ({ organisationId, memberId }) => {
      try {
        // Verify memberId belongs to the authenticated user
        const { query } = require("../db/client");
        const result = await query(
          `SELECT id FROM members WHERE clerk_user_id = $1 AND organisation_id = $2`,
          [socket.clerkUserId, organisationId]
        );
        if (!result.rows.length || result.rows[0].id.toString() !== memberId.toString()) {
          socket.emit("error", { message: "Unauthorized" });
          return;
        }
        socket.join(`org:${organisationId}`);
        socket.join(`user:${memberId}`);
        socket.orgId = organisationId;
        socket.memberId = memberId;
        socket.to(`org:${organisationId}`).emit("member:online", { memberId });
      } catch (err) {
        socket.emit("error", { message: "Failed to join org" });
      }
    });

    socket.on("disconnect", () => {
      if (socket.orgId && socket.memberId) {
        socket.to(`org:${socket.orgId}`).emit("member:offline", { memberId: socket.memberId });
      }
    });
  });
};

module.exports = { initSocket };