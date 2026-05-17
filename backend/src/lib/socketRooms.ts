const normalizeRoomPart = (value) => String(value || "").trim();

const orgRoom = (organisationId) => `org:${normalizeRoomPart(organisationId)}`;
const userRoom = (memberId) => `user:${normalizeRoomPart(memberId)}`;
const shiftRoom = (shiftId) => `shift:${normalizeRoomPart(shiftId)}`;
const locationRoom = (organisationId, location) => (
  `location:${normalizeRoomPart(organisationId)}:${normalizeRoomPart(location).toLowerCase()}`
);

module.exports = {
  orgRoom,
  userRoom,
  shiftRoom,
  locationRoom,
};

export {};
