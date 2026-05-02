const SHIFT_CONFLICT_WINDOW_SQL = `
  ((start_time <= $2 AND end_time > $2)
    OR (start_time < $3 AND end_time >= $3)
    OR (start_time >= $2 AND end_time <= $3))
`;

const toTimestamp = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime();
};

const shiftsOverlap = (left, right) => {
  const leftStart = toTimestamp(left.startTime || left.start_time);
  const leftEnd = toTimestamp(left.endTime || left.end_time);
  const rightStart = toTimestamp(right.startTime || right.start_time);
  const rightEnd = toTimestamp(right.endTime || right.end_time);

  return leftStart < rightEnd && leftEnd > rightStart;
};

module.exports = {
  SHIFT_CONFLICT_WINDOW_SQL,
  shiftsOverlap,
};
