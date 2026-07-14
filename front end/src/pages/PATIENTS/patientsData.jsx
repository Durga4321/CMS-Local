const STORAGE_KEY = "clinicadmin_patients";

export const DEFAULT_PATIENTS = [
  {
    id: "P001",
    name: "James Wilson",
    initials: "JW",
    phone: "+1 415 555 1100",
    age: 42,
    gender: "Male",
    email: "jwilson@mail.com",
    address: "221B Baker St, SF",
    lastVisit: "2026-04-18",
    visits: [
      {
        doctor: "Dr. Sarah Mitchell",
        dateTime: "2026-04-21 · 09:00",
        status: "Scheduled",
      },
      {
        doctor: "Dr. Sarah Mitchell",
        dateTime: "2026-04-19 · 14:00",
        status: "Completed",
      },
    ],
    prescriptions: [
      {
        name: "Atorvastatin 20mg, Aspirin 75mg",
        note: "Prescribed by Dr. Sarah Mitchell · Continue for 3 months",
        date: "2026-04-18",
      },
      {
        name: "Metoprolol 50mg",
        note: "Prescribed by Dr. Sarah Mitchell · Twice daily",
        date: "2026-03-20",
      },
    ],
  },
  {
    id: "P002",
    name: "Maria Gonzalez",
    initials: "MG",
    phone: "+1 415 555 1144",
    age: 31,
    gender: "Female",
    email: "maria.g@mail.com",
    address: "99 Valencia St, SF",
    lastVisit: "2026-04-15",
    visits: [
      {
        doctor: "Dr. Emily Chen",
        dateTime: "2026-04-15 · 10:30",
        status: "Completed",
      },
    ],
  },
  {
    id: "P003",
    name: "Hiroshi Tanaka",
    initials: "HT",
    phone: "+1 415 555 1166",
    age: 58,
    gender: "Male",
    email: "hiroshi.t@mail.com",
    address: "18 Market St, SF",
    lastVisit: "2026-04-12",
    visits: [
      {
        doctor: "Dr. Rajesh Kumar",
        dateTime: "2026-04-12 · 16:45",
        status: "Completed",
      },
    ],
  },
  {
    id: "P004",
    name: "Ava Patel",
    initials: "AP",
    phone: "+1 415 555 1191",
    age: 24,
    gender: "Female",
    email: "ava.p@mail.com",
    address: "412 King St, SF",
    lastVisit: "2026-04-10",
    visits: [
      {
        doctor: "Dr. Emily Chen",
        dateTime: "2026-04-10 · 11:15",
        status: "Completed",
      },
    ],
  },
  {
    id: "P005",
    name: "Noah Anderson",
    initials: "NA",
    phone: "+1 415 555 1220",
    age: 46,
    gender: "Male",
    email: "noah.a@mail.com",
    address: "77 Pine St, SF",
    lastVisit: "2026-04-09",
    visits: [
      {
        doctor: "Dr. Sarah Mitchell",
        dateTime: "2026-04-09 · 13:20",
        status: "Completed",
      },
    ],
  },
  {
    id: "P006",
    name: "Emma Rodriguez",
    initials: "ER",
    phone: "+1 415 555 1262",
    age: 37,
    gender: "Female",
    email: "emma.r@mail.com",
    address: "14 Mission St, SF",
    lastVisit: "2026-04-07",
    visits: [
      {
        doctor: "Dr. Rajesh Kumar",
        dateTime: "2026-04-07 · 15:40",
        status: "Completed",
      },
    ],
  },
  {
    id: "P007",
    name: "Lucas Martin",
    initials: "LM",
    phone: "+1 415 555 1298",
    age: 50,
    gender: "Male",
    email: "lucas.m@mail.com",
    address: "210 Howard St, SF",
    lastVisit: "2026-04-05",
    visits: [
      {
        doctor: "Dr. Sarah Mitchell",
        dateTime: "2026-04-05 · 09:50",
        status: "Completed",
      },
    ],
  },
];

export function getInitials(name) {
  if (!name) return "NA";

  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

export function loadPatients() {
  if (typeof window === "undefined") return DEFAULT_PATIENTS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PATIENTS;

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch (error) {
    // Fall back to default patients if localStorage is unavailable/corrupt.
  }

  return DEFAULT_PATIENTS;
}

export function savePatients(patients) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

export function createPatientId(existingPatients) {
  const numbers = existingPatients
    .map((patient) => Number(String(patient.id || "").replace("P", "")))
    .filter((value) => Number.isFinite(value));

  const nextNumber = (Math.max(0, ...numbers) + 1).toString().padStart(3, "0");
  return `P${nextNumber}`;
}
