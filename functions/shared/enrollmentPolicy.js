// Legacy records without status/active fields are active. Completion is not cancellation.
const inactiveStatuses = ['cancelled', 'canceled', 'inactive', 'removed', 'unenrolled'];
function isActiveEnrollment(record) {
  return !!record && record.active !== false && !inactiveStatuses.includes(record.status);
}
module.exports = { isActiveEnrollment };
