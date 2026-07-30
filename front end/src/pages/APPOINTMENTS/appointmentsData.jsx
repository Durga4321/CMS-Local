const STORAGE_KEY = "clinicadmin_appointments";

export const DEFAULT_APPOINTMENTS = [
  {
    id: "A001",
    tokenNumber: "TKN001",
    patient: "James Wilson",
    doctor: "Dr. Sarah Mitchell",
    date: "2026-04-21",
    time: "09:00",
    status: "Scheduled",
  },
  {
    id: "A002",
    tokenNumber: "TKN002",
    patient: "Maria Gonzalez",
    doctor: "Dr. Emily Chen",
    date: "2026-04-21",
    time: "09:30",
    status: "Completed",
  },
  {
    id: "A003",
    tokenNumber: "TKN003",
    patient: "Hiroshi Tanaka",
    doctor: "Dr. Ahmed Hassan",
    date: "2026-04-21",
    time: "10:15",
    status: "Scheduled",
  },
  {
    id: "A004",
    tokenNumber: "TKN004",
    patient: "Ava Patel",
    doctor: "Dr. Rajesh Kumar",
    date: "2026-04-21",
    time: "11:00",
    status: "Scheduled",
  },
  {
    id: "A005",
    tokenNumber: "TKN005",
    patient: "Noah Anderson",
    doctor: "Dr. Sarah Mitchell",
    date: "2026-04-22",
    time: "09:45",
    status: "Completed",
  },
  {
    id: "A006",
    tokenNumber: "TKN006",
    patient: "Emma Rodriguez",
    doctor: "Dr. Emily Chen",
    date: "2026-04-22",
    time: "10:30",
    status: "Scheduled",
  },
  {
    id: "A007",
    tokenNumber: "TKN007",
    patient: "Lucas Martin",
    doctor: "Dr. Ahmed Hassan",
    date: "2026-04-22",
    time: "11:30",
    status: "Scheduled",
  },
  {
    id: "A008",
    tokenNumber: "TKN008",
    patient: "Daniel Lee",
    doctor: "Dr. Rajesh Kumar",
    date: "2026-04-23",
    time: "08:45",
    status: "Cancelled",
  },
];

export const DOCTOR_OPTIONS = [
  "Dr. Sarah Mitchell",
  "Dr. Emily Chen",
  "Dr. Ahmed Hassan",
  "Dr. Rajesh Kumar",
];

export function loadAppointments() {
  if (typeof window === "undefined") return DEFAULT_APPOINTMENTS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPOINTMENTS;

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch (error) {
    // fall back to defaults when storage is unavailable/corrupt
  }

  return DEFAULT_APPOINTMENTS;
}

export function saveAppointments(appointments) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
}

export function createAppointmentId(existing) {
  const values = existing
    .map((item) => Number(String(item.id || "").replace("A", "")))
    .filter((value) => Number.isFinite(value));

  const next = (Math.max(0, ...values) + 1).toString().padStart(3, "0");
  return `A${next}`;
}

const getTokenSequence = (appointment = {}) => {
  const token = appointment.tokenNumber || appointment.token || appointment.TokenNumber || appointment.tokenNo || "";
  const match = String(token).trim().match(/^TKN\s*0*(\d+)$/i);
  return match ? Number(match[1]) : 0;
};

// Tokens are assigned once, when an appointment is created. Existing records are
// only read to determine the next number and are never rewritten.
export function createAppointmentToken(existing = []) {
  const highestToken = (Array.isArray(existing) ? existing : []).reduce(
    (highest, appointment) => Math.max(highest, getTokenSequence(appointment)),
    0
  );

  return `TKN${String(highestToken + 1).padStart(3, "0")}`;
}

const normalizeTime = (value) => String(value || "").trim().slice(0, 5);

const isActiveAppointment = (appointment = {}) =>
  !["cancelled", "canceled", "rejected"].includes(
    String(appointment.status || "").trim().toLowerCase()
  );

export function getAppointmentConflict(existing = [], candidate = {}) {
  const patient = String(candidate.patient || "").trim().toLowerCase();
  const doctor = String(candidate.doctor || "").trim().toLowerCase();
  const date = String(candidate.date || "").trim();
  const time = normalizeTime(candidate.time);

  return existing.find((appointment) => {
    if (!isActiveAppointment(appointment)) return false;
    if (String(appointment.date || "").trim() !== date) return false;
    if (normalizeTime(appointment.time) !== time) return false;

    const appointmentPatient = String(appointment.patient || "").trim().toLowerCase();
    const appointmentDoctor = String(appointment.doctor || "").trim().toLowerCase();
    return appointmentPatient === patient || appointmentDoctor === doctor;
  });
}
