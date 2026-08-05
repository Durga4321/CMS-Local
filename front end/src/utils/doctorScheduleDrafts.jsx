export const DOCTOR_BRANCH_SCHEDULE_DRAFTS_KEY = "doctorBranchScheduleDrafts";

const padNumber = (value) => String(value).padStart(2, "0");

const normalizeScheduleTime = (value, fallback = "") => {
  const text = String(value || "").trim();
  if (!text) return fallback;
  const meridiemMatch = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (meridiemMatch) {
    let hours = Number(meridiemMatch[1]);
    const minutes = meridiemMatch[2];
    const meridiem = meridiemMatch[3].toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return `${padNumber(hours)}:${minutes}`;
  }
  const timeMatch = text.match(/^(\d{1,2}):(\d{2})/);
  return timeMatch ? `${padNumber(Number(timeMatch[1]))}:${timeMatch[2]}` : fallback;
};

const timeToMinutes = (value) => {
  const normalized = normalizeScheduleTime(value);
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const minutesToTime = (minutes) => {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  return `${padNumber(Math.floor(safeMinutes / 60) % 24)}:${padNumber(safeMinutes % 60)}`;
};

export const readDoctorScheduleDrafts = () => {
  try {
    const raw = localStorage.getItem(DOCTOR_BRANCH_SCHEDULE_DRAFTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const getDoctorScheduleDraft = (doctorId, branchId) => {
  if (!doctorId || !branchId) return null;
  const drafts = readDoctorScheduleDrafts();
  return drafts[`${doctorId}::${branchId}`] || null;
};

export const buildDoctorScheduleDraftSlots = (doctorId, branchId, date) => {
  const draft = getDoctorScheduleDraft(doctorId, branchId);
  if (!draft || draft.isLeave) return [];
  const selectedDate = String(date || "").slice(0, 10);
  if (!selectedDate || !(draft.dates || []).some((item) => String(item).slice(0, 10) === selectedDate)) return [];

  const start = timeToMinutes(draft.workStart);
  const end = timeToMinutes(draft.workEnd);
  const duration = Number(draft.slotDuration) || 30;
  if (start === null || end === null || end <= start || duration <= 0) return [];

  const breakStart = timeToMinutes(draft.breakStart);
  const breakEnd = timeToMinutes(draft.breakEnd);
  const slots = [];
  for (let cursor = start; cursor + duration <= end; cursor += duration) {
    const slotEnd = cursor + duration;
    const overlapsBreak =
      breakStart !== null && breakEnd !== null && breakEnd > breakStart && cursor < breakEnd && slotEnd > breakStart;
    if (overlapsBreak) continue;

    const startTime = minutesToTime(cursor);
    const endTime = minutesToTime(slotEnd);
    slots.push({
      id: `draft-${doctorId}-${branchId}-${selectedDate}-${startTime}`,
      doctorId: String(doctorId),
      branchId: String(branchId),
      date: selectedDate,
      start: startTime,
      end: endTime,
      startTime,
      endTime,
      time: startTime,
      slot: `${startTime} - ${endTime}`,
      slotLabel: `${startTime} - ${endTime}`,
      status: "Available",
      source: "Local Schedule",
    });
  }
  return slots;
};
