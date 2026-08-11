// Legacy compatibility helper.
// Recurring schedules and one-day overrides are now stored in the backend.
// Local draft slots are intentionally disabled to prevent stale frontend slots
// from conflicting with leave/branch-shift rules returned by the API.

export const DOCTOR_BRANCH_SCHEDULE_DRAFTS_KEY = "doctorBranchScheduleDrafts";

export const readDoctorScheduleDrafts = () => ({});
export const getDoctorScheduleDraft = () => null;
export const buildDoctorScheduleDraftSlots = () => [];
