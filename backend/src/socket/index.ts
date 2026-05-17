const { locationRoom, orgRoom, shiftRoom, userRoom } = require("../lib/socketRooms");

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
          "SELECT id FROM members WHERE clerk_user_id = $1 AND organisation_id = $2",
          [socket.clerkUserId, organisationId]
        );
        if (!result.rows.length || result.rows[0].id.toString() !== memberId.toString()) {
          socket.emit("error", { message: "Unauthorized" });
          return;
        }
        socket.join(orgRoom(organisationId));
        socket.join(userRoom(memberId));
        socket.orgId = organisationId;
        socket.memberId = memberId;
        socket.to(orgRoom(organisationId)).emit("member:online", { memberId });
      } catch (err) {
        socket.emit("error", { message: "Failed to join org" });
      }
    });

    socket.on("join:shift", async ({ shiftId }) => {
      try {
        if (!socket.orgId || !socket.memberId) {
          socket.emit("error", { message: "Join an organisation before joining shift rooms" });
          return;
        }

        const { query } = require("../db/client");
        const result = await query(
          "SELECT id FROM shifts WHERE id = $1 AND organisation_id = $2",
          [shiftId, socket.orgId]
        );
        if (!result.rows.length) {
          socket.emit("error", { message: "Shift room unauthorized" });
          return;
        }

        socket.join(shiftRoom(shiftId));
      } catch (err) {
        socket.emit("error", { message: "Failed to join shift room" });
      }
    });

    socket.on("join:location", async ({ location }) => {
      if (!socket.orgId || !location) {
        socket.emit("error", { message: "Join an organisation before joining location rooms" });
        return;
      }

      socket.join(locationRoom(socket.orgId, location));
    });

    socket.on("disconnect", () => {
      if (socket.orgId && socket.memberId) {
        socket.to(orgRoom(socket.orgId)).emit("member:offline", { memberId: socket.memberId });
      }
    });
  });
};

module.exports = { initSocket };

export {};
