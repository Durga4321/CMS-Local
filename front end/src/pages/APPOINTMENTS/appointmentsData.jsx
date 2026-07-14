const STORAGE_KEY = "clinicadmin_appointments";

export const DEFAULT_APPOINTMENTS = [
  {
    id: "A001",
    patient: "James Wilson",
    doctor: "Dr. Sarah Mitchell",
    date: "2026-04-21",
    time: "09:00",
    status: "Scheduled",
  },
  {
    id: "A002",
    patient: "Maria Gonzalez",
    doctor: "Dr. Emily Chen",
    date: "2026-04-21",
    time: "09:30",
    status: "Completed",
  },
  {
    id: "A003",
    patient: "Hiroshi Tanaka",
    doctor: "Dr. Ahmed Hassan",
    date: "2026-04-21",
    time: "10:15",
    status: "Scheduled",
  },
  {
    id: "A004",
    patient: "Ava Patel",
    doctor: "Dr. Rajesh Kumar",
    date: "2026-04-21",
    time: "11:00",
    status: "Scheduled",
  },
  {
    id: "A005",
    patient: "Noah Anderson",
    doctor: "Dr. Sarah Mitchell",
    date: "2026-04-22",
    time: "09:45",
    status: "Completed",
  },
  {
    id: "A006",
    patient: "Emma Rodriguez",
    doctor: "Dr. Emily Chen",
    date: "2026-04-22",
    time: "10:30",
    status: "Scheduled",
  },
  {
    id: "A007",
    patient: "Lucas Martin",
    doctor: "Dr. Ahmed Hassan",
    date: "2026-04-22",
    time: "11:30",
    status: "Scheduled",
  },
  {
    id: "A008",
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
