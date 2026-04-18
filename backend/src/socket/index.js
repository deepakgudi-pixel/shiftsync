const initSocket = (io) => {
  io.on("connection", (socket) => {
    socket.on("join:org", ({ organisationId, memberId }) => {
      socket.join(`org:${organisationId}`);
      socket.join(`user:${memberId}`);
      socket.to(`org:${organisationId}`).emit("member:online", { memberId });
    });
    socket.on("leave:org", ({ organisationId, memberId }) => {
      socket.leave(`org:${organisationId}`);
      socket.to(`org:${organisationId}`).emit("member:offline", { memberId });
    });
    socket.on("message:typing", ({ receiverId, senderId, senderName }) => {
      socket.to(`user:${receiverId}`).emit("message:typing", { senderId, senderName });
    });
    socket.on("disconnect", () => {});
  });
};
module.exports = { initSocket };
