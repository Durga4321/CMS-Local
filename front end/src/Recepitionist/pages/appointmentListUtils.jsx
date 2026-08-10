const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const readValue = (source, key) => {
  if (!source || typeof source !== "object") return "";
  const parts = String(key).split(".");
  let current = source;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return "";
    }
    current = current[part];
  }

  return current ?? "";
};

export const getAppointmentValue = (item, keys, fallback = "") => {
  for (const key of keys) {
    const value = readValue(item, key);
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
};

export const getBookingType = (item) => {
  const value = getAppointmentValue(item, ["bookingType", "BookingType", "type", "Type"], "");
  const normalized = normalizeText(value);

  if (normalized.includes("online")) return "Online";
  if (normalized.includes("offline") || normalized.includes("walk")) return "Offline";
  return value || "Unknown";
};

const normalizePatientKey = (appointment = {}) => {
  const patientId = getAppointmentValue(appointment, [
    "patientId",
    "PatientId",
    "pid",
    "PID",
    "patient.id",
    "patient.patientId",
    "Patient.Id",
    "Patient.PatientId",
  ]);
  if (patientId) return `patient-id:${normalizeText(patientId)}`;

  const patientCode = getAppointmentValue(appointment, [
    "patientCode",
    "PatientCode",
    "patient.code",
    "patient.patientCode",
    "Patient.Code",
    "Patient.PatientCode",
  ]);
  if (patientCode) return `patient-code:${normalizeText(patientCode)}`;

  const patientPhone = String(
    getAppointmentValue(appointment, [
      "phone",
      "Phone",
      "phoneNumber",
      "PhoneNumber",
      "mobile",
      "Mobile",
      "mobileNumber",
      "MobileNumber",
      "patient.phone",
      "patient.Phone",
      "patient.phoneNumber",
      "patient.PatientPhone",
    ], "")
  ).replace(/\D/g, "");

  const patientName = normalizeText(
    getAppointmentValue(appointment, [
      "patientName",
      "PatientName",
      "name",
      "Name",
      "patient.name",
      "patient.fullName",
      "Patient.Name",
      "Patient.FullName",
    ], "")
  );

  if (patientName && patientPhone) return `patient-name-phone:${patientName}:${patientPhone}`;
  if (patientName) return `patient-name:${patientName}`;
  return "";
};

const normalizeDoctorKey = (appointment = {}) =>
  normalizeText(
    getAppointmentValue(appointment, [
      "doctorId",
      "DoctorId",
      "doctor.id",
      "doctor.doctorId",
      "Doctor.Id",
      "Doctor.DoctorId",
      "doctorName",
      "DoctorName",
      "doctor.name",
      "doctor.doctorName",
      "Doctor.Name",
      "Doctor.DoctorName",
      "doctor",
    ], "")
  );

const getAppointmentDateKeyFromItem = (item) =>
  normalizeDateKey(getAppointmentValue(item, dateKeys, ""));

export const getAppointmentDateKey = (item) =>
  getAppointmentDateKeyFromItem(item);

export const dedupeSameDayAppointments = (appointments = []) => {
  const seen = new Set();

  return (appointments || []).filter((appointment) => {
    const appointmentId = getAppointmentValue(appointment, ["appointmentId", "AppointmentId", "id", "Id"], "");
    if (appointmentId) {
      const key = `appointment:${normalizeText(appointmentId)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }

    const patientKey = normalizePatientKey(appointment);
    const dateKey = getAppointmentDateKey(appointment);
    const doctorKey = normalizeDoctorKey(appointment) || "unknown-doctor";
    const bookingType = normalizeText(getBookingType(appointment) || "");

    if (!patientKey || !dateKey) return true;

    const key = `same-day:${patientKey}:${dateKey}:${bookingType}:${doctorKey}`;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
};

const tokenKeys = ["tokenNumber", "token", "TokenNumber", "tokenNo", "token_number"];
const dateKeys = ["date", "appointmentDate", "AppointmentDate", "scheduledDate", "slotDate", "SlotDate", "bookingDate", "BookingDate"];
const timeKeys = ["time", "slot", "Slot", "startTime", "StartTime", "slotTime", "SlotTime", "timeSlot", "TimeSlot", "appointmentTime", "AppointmentTime"];

const normalizeDateKey = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text.toLowerCase();
  return parsed.toISOString().slice(0, 10);
};

const parseTimeToMinutes = (value) => {
  const text = String(value || "").trim();
  if (!text) return Number.MAX_SAFE_INTEGER;

  const rangeStart = text.split(/\s*[-–]\s*/)[0].trim();
  const match = rangeStart.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return Number.MAX_SAFE_INTEGER;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = (match[3] || "").toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const getAppointmentTimeMinutes = (item) =>
  parseTimeToMinutes(getAppointmentValue(item, timeKeys, ""));

export const getOrderedToken = (sequence) => `TKN${String(sequence).padStart(3, "0")}`;

export const applyTimeOrderedTokens = (appointments = []) => {
  const sorted = appointments
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((left, right) => {
      const dateCompare = getAppointmentDateKeyFromItem(left.item).localeCompare(getAppointmentDateKeyFromItem(right.item));
      if (dateCompare) return dateCompare;

      const timeCompare = getAppointmentTimeMinutes(left.item) - getAppointmentTimeMinutes(right.item);
      if (timeCompare) return timeCompare;

      return left.originalIndex - right.originalIndex;
    });

  const sequenceByOriginalIndex = new Map();
  let currentDate = null;
  let sequence = 0;

  sorted.forEach(({ item, originalIndex }) => {
    const dateKey = getAppointmentDateKey(item) || "__unknown_date__";
    if (dateKey !== currentDate) {
      currentDate = dateKey;
      sequence = 1;
    } else {
      sequence += 1;
    }

    sequenceByOriginalIndex.set(originalIndex, sequence);
  });

  return appointments.map((item, index) => {
    const orderedTokenSequence = sequenceByOriginalIndex.get(index) || index + 1;
    const orderedToken = getOrderedToken(orderedTokenSequence);
    return {
      ...item,
      displayTokenNumber: orderedToken,
      orderedTokenNumber: orderedToken,
      orderedTokenSequence,
      orderedTokenSortDate: getAppointmentDateKey(item),
      orderedTokenSortTime: getAppointmentTimeMinutes(item),
      originalTokenNumber: getAppointmentValue(item, tokenKeys, ""),
    };
  });
};

export const filterAppointments = (appointments = [], filters = {}) => {
  const search = normalizeText(filters.search || "");
  const doctor = normalizeText(filters.doctor || "");
  const status = normalizeText(filters.status || "");
  const date = normalizeText(filters.date || "");

  return appointments.filter((item) => {
    if (doctor && normalizeText(getAppointmentValue(item, ["doctorName", "doctor.name", "DoctorName", "doctor", "doctorDetails.name"], "")) !== doctor) {
      return false;
    }

    if (status && normalizeText(getAppointmentValue(item, ["status", "appointmentStatus", "AppointmentStatus", "Status"], "")) !== status) {
      return false;
    }

    if (date) {
      const appointmentDate = normalizeText(getAppointmentDateKey(item));
      if (appointmentDate !== date) {
        return false;
      }
    }

    if (!search) return true;

    const searchable = [
      getAppointmentValue(item, ["displayTokenNumber", "orderedTokenNumber", ...tokenKeys], ""),
      getAppointmentValue(item, ["patientCode", "patient.code", "PatientCode"], ""),
      getAppointmentValue(item, ["patientName", "patient.name", "PatientName"], ""),
      getAppointmentValue(item, ["doctorName", "doctor.name", "DoctorName"], ""),
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(search);
  });
};
