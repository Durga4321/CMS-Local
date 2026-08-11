// Legacy compatibility helper.
// Doctor leave is now persisted by the backend ScheduleOverride APIs.
// Booking screens must use backend day-slot responses instead of localStorage leave flags.

export const getDoctorBranchLeaveKey = (doctorId, branchId, date) =>
  `${String(doctorId || "").trim()}::${String(branchId || "").trim()}::${String(date || "").slice(0, 10)}`;

export const isDoctorBranchLeaveDate = () => false;
export const saveDoctorBranchLeaveDates = () => {};
export const clearDoctorBranchLeaveDates = () => {};
