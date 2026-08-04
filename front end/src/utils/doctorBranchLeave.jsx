const DOCTOR_BRANCH_LEAVES_KEY = "doctorBranchLeaves";

const normalizeId = (value) => String(value || "").trim();

const normalizeDate = (value) => String(value || "").slice(0, 10);

export const getDoctorBranchLeaveKey = (doctorId, branchId, date) =>
  `${normalizeId(doctorId)}::${normalizeId(branchId)}::${normalizeDate(date)}`;

const readLeaveMap = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DOCTOR_BRANCH_LEAVES_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeLeaveMap = (map) => {
  localStorage.setItem(DOCTOR_BRANCH_LEAVES_KEY, JSON.stringify(map || {}));
};

export const isDoctorBranchLeaveDate = (doctorId, branchId, date) => {
  if (!doctorId || !branchId || !date) return false;
  return Boolean(readLeaveMap()[getDoctorBranchLeaveKey(doctorId, branchId, date)]);
};

export const saveDoctorBranchLeaveDates = (doctorId, branchId, dates = []) => {
  if (!doctorId || !branchId) return;
  const map = readLeaveMap();
  dates.forEach((date) => {
    const key = getDoctorBranchLeaveKey(doctorId, branchId, date);
    map[key] = {
      doctorId: normalizeId(doctorId),
      branchId: normalizeId(branchId),
      date: normalizeDate(date),
      savedAt: new Date().toISOString(),
    };
  });
  writeLeaveMap(map);
};

export const clearDoctorBranchLeaveDates = (doctorId, branchId, dates = []) => {
  if (!doctorId || !branchId) return;
  const map = readLeaveMap();
  dates.forEach((date) => {
    delete map[getDoctorBranchLeaveKey(doctorId, branchId, date)];
  });
  writeLeaveMap(map);
};
