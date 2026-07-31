import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import {
  Bell, Calendar, Check, CheckCircle2, ChevronDown, ChevronRight, Circle, ClipboardList,
  CreditCard, Download, Eye, EyeOff, FileText, Heart, KeyRound, LogOut, Mail, MapPin, Pill,
  Menu, Phone, Search, Share2, Trash2, UserRound, X,
} from "lucide-react";
import PatientDashboard from "./PatientDashboard";
import { apiUrl, patientApiUrl, PATIENT_API } from "../../config/api";
import { validateStrongPassword } from "../../utils/validation";
import { formatIndianCurrency, formatTitleCase } from "../../utils/format";
import {
  DUPLICATE_APPOINTMENT_MESSAGE,
  hasDuplicateAppointmentForPatientDoctorDate,
} from "../../utils/appointmentDuplicateValidation";

const getNestedValue = (record, path) => {
  if (record == null) return undefined;
  const keys = Array.isArray(path) ? path : String(path).replace(/\?/g, "").split(".");
  return keys.reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), record);
};

const readFirst = (record, keys) =>
  keys.reduce((value, key) => value || getNestedValue(record, key), "") || "";

const getClinicWatermarkSvg = (clinicName = "Clinic") => {
  const name = String(clinicName || "").toLowerCase();
  const fallbackText = String(clinicName || "CLINIC")
    .replace(/[^a-z0-9\s]/gi, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const logo = name.includes("dental")
    ? { text: "", color: "#0f8f8d", path: '<path d="M145 79c35-15 68-8 92 5 25 14 55 14 80 0 24-13 57-20 92-5 64 28 91 95 70 171l-45 170c-13 49-37 137-88 137-36 0-38-43-49-90-5-23-13-40-21-40s-16 17-21 40c-11 47-13 90-49 90-51 0-75-88-88-137L73 250C52 174 79 107 145 79Z" fill="none" stroke="currentColor" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>' }
    : name.includes("pragathi")
      ? { text: "PRAGATHI", color: "#00a86b", path: '<path d="M357 79c-93 0-168 36-213 96-43 57-55 132-30 200 64 24 139 11 196-32 60-45 96-120 96-213 0-28-22-51-49-51Z" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><path d="M263 173c-64 27-113 75-146 143" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round"/>' }
      : name.includes("sai ram") || name.includes("primo") || name.includes("pirnav")
        ? { text: name.includes("sai ram") ? "SAI RAM" : name.includes("primo") ? "PRIMO" : "PIRNAV", color: "#d97706", path: '<circle cx="240" cy="238" r="72" fill="none" stroke="currentColor" stroke-width="24"/><path d="M240 58v62M240 356v62M60 238h62M358 238h62M113 111l44 44M323 321l44 44M367 111l-44 44M157 321l-44 44" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round"/>' }
        : { text: name.includes("vims") ? "VIMS" : name.includes("nri") ? "NC" : fallbackText || "CL", color: "#00a884", path: '<path d="M214 86h52c11 0 20 9 20 20v88h88c11 0 20 9 20 20v52c0 11-9 20-20 20h-88v88c0 11-9 20-20 20h-52c-11 0-20-9-20-20v-88h-88c-11 0-20-9-20-20v-52c0-11 9-20 20-20h88v-88c0-11 9-20 20-20Z" fill="none" stroke="currentColor" stroke-width="24" stroke-linejoin="round"/>' };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 560" color="${logo.color}"><rect x="72" y="44" width="336" height="336" rx="72" fill="#f0fdfa" stroke="#7dd3fc" stroke-width="12"/><g>${logo.path}</g>${logo.text ? `<text x="240" y="455" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="900" fill="#075eea">${logo.text}</text>` : ""}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const getTokenSequence = (appointment = {}) => {
  const token = readFirst(appointment, ["tokenNumber", "TokenNumber", "token", "tokenNo", "token_number"]);
  const match = String(token || "").trim().match(/^TKN\s*0*(\d+)$/i);
  return match ? Number(match[1]) : 0;
};

const createNextPatientToken = (appointments = []) => {
  const highestToken = (Array.isArray(appointments) ? appointments : []).reduce(
    (highest, appointment) => Math.max(highest, getTokenSequence(appointment)),
    0
  );
  return `TKN${String(highestToken + 1).padStart(3, "0")}`;
};

const PATIENT_NOTIFICATION_TYPES = [
  'Appointment Reminder',
  'Prescription Ready',
  'Bill Generated',
  'Follow-up Reminder',
];

const PATIENT_PASSWORD_REQUIREMENTS = [
  { label: "Minimum 8 characters", test: (value) => value.length >= 8 },
  { label: "At least 1 uppercase letter (A-Z)", test: (value) => /[A-Z]/.test(value) },
  { label: "At least 1 lowercase letter (a-z)", test: (value) => /[a-z]/.test(value) },
  { label: "At least 1 number (0-9)", test: (value) => /\d/.test(value) },
  { label: "At least 1 special character (@, #, $, %, etc.)", test: (value) => /[^A-Za-z0-9]/.test(value) },
];

const logoutPatient = async (navigate) => {
  const name = localStorage.getItem("patientName") || localStorage.getItem("patientEmail") || "Patient";
  const role = localStorage.getItem("patientRole") || "Patient";
  const ipAddress = localStorage.getItem("loginIpAddress") || "";
  const email = localStorage.getItem("patientEmail") || "";

  ["token", "userRole", "patientName", "patientId", "patientToken", "patientRole", "patientEmail"].forEach((key) =>
    localStorage.removeItem(key)
  );
  navigate("/login/patient", { replace: true });

  window.setTimeout(() => {
    import("../SUPERADMIN/superAdminApi").then(({ recordAuditLog }) =>
      recordAuditLog({
        userName: name,
        user: name,
        userEmail: email,
        email,
        action: `${name} logged out`,
        systemAction: "Logout",
        role,
        ipAddress,
        timestamp: new Date().toISOString(),
      })
    ).catch(() => {});
  }, 0);
};

/* ----------------- Patient module (inlined) ----------------- */
// patient styles should be moved to App.css; removed individual import

const readId = (record, keys) => {
  const value = keys.reduce((currentValue, key) => currentValue || getNestedValue(record, key), undefined);
  return value === undefined || value === null ? undefined : String(value);
};

const getBillRecordKey = (bill) => {
  if (!bill || typeof bill !== "object") return "";
  const billId = readFirst(bill, [
    'invoiceId', 'billId', 'id', '_id', 'referenceId',
    'invoice.id', 'invoice._id', 'invoice.referenceId',
    'bill.id', 'bill._id', 'bill.referenceId',
  ]);
  const billNumber = readFirst(bill, [
    'invoiceNumber', 'billNumber', 'referenceNumber', 'number',
    'invoice.invoiceNumber', 'invoice.billNumber', 'invoice.referenceNumber',
    'bill.invoiceNumber', 'bill.billNumber', 'bill.referenceNumber',
  ]);
  const appointmentId = readFirst(bill, [
    'appointmentId', 'appointment.id', 'appointment_id',
    'appointmentNumber', 'appointmentNo', 'appointment.number',
    'invoice.appointmentId', 'invoice.appointment.id',
    'bill.appointmentId', 'bill.appointment.id',
  ]);
  const patientId = readFirst(bill, [
    'patientId', 'patient.id', 'invoice.patientId', 'invoice.patient.id',
    'patientCode', 'patient.code', 'patient.patientCode',
  ]);
  const parts = [billId, billNumber, appointmentId, patientId]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (parts.length) return parts.join("|");
  const stableKeys = Object.keys(bill).sort();
  return JSON.stringify(stableKeys.reduce((acc, key) => {
    acc[key] = bill[key];
    return acc;
  }, {}));
};

const getBillDateValue = (bill) => {
  const date = new Date(
    readFirst(bill, ['invoiceDate', 'billDate', 'date', 'createdAt', 'updatedAt']) || ''
  );
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

const selectBestBillRecord = (existing, incoming) => {
  if (!existing) return incoming;
  const existingDate = getBillDateValue(existing);
  const incomingDate = getBillDateValue(incoming);
  if (incomingDate > existingDate) return incoming;
  if (incomingDate < existingDate) return existing;

  const existingStatus = String(readFirst(existing, ['status', 'paymentStatus', 'billStatus', 'state']) || '').toLowerCase();
  const incomingStatus = String(readFirst(incoming, ['status', 'paymentStatus', 'billStatus', 'state']) || '').toLowerCase();
  if (incomingStatus === 'paid' && existingStatus !== 'paid') return incoming;
  if (existingStatus === 'paid' && incomingStatus !== 'paid') return existing;

  return incoming;
};

const parseApiList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.result)) return value.result;
  if (Array.isArray(value?.bills)) return value.bills;
  if (Array.isArray(value?.invoices)) return value.invoices;
  return [];
};

const dedupeBillsByInvoice = (bills = []) => {
  const grouped = new Map();
  (Array.isArray(bills) ? bills : []).forEach((bill) => {
    const key = getBillRecordKey(bill);
    const current = grouped.get(key);
    grouped.set(key, selectBestBillRecord(current, bill));
  });
  return Array.from(grouped.values()).sort((left, right) => getBillDateValue(right) - getBillDateValue(left));
};

const getPatientIdentityValues = (patient = {}, visits = []) => {
  const values = [
    patient?.id,
    patient?.patientId,
    patient?.PatientId,
    patient?.patientCode,
    patient?.PatientCode,
    localStorage.getItem("patientId"),
  ];
  (Array.isArray(visits) ? visits : []).forEach((visit) => {
    values.push(
      readFirst(visit, ["patientId", "patient.id", "patient.patientId", "patientCode", "patient.patientCode"]),
      readFirst(visit, ["appointmentId", "id", "appointmentNumber"])
    );
  });
  return new Set(values.map((value) => normalizeComparable(value)).filter(Boolean));
};

const getPatientNameValues = (patient = {}, visits = []) => {
  const values = [
    patient?.name,
    patient?.fullName,
    patient?.firstName,
    localStorage.getItem("patientName"),
  ];
  (Array.isArray(visits) ? visits : []).forEach((visit) => {
    values.push(readFirst(visit, ["patientName", "patient.name", "patient.fullName", "name"]));
  });
  return new Set(values.map((value) => normalizeComparable(value)).filter(Boolean));
};

const billBelongsToPatient = (bill, patient = {}, visits = []) => {
  const patientIds = getPatientIdentityValues(patient, visits);
  const patientNames = getPatientNameValues(patient, visits);
  const billIds = [
    readFirst(bill, ["patientId", "PatientId", "patient.id", "patient.patientId", "patientCode", "patient.patientCode"]),
    readFirst(bill, ["appointmentId", "appointment.id", "appointmentNumber"]),
  ].map((value) => normalizeComparable(value)).filter(Boolean);
  if (billIds.some((value) => patientIds.has(value))) return true;

  const billName = normalizeComparable(readFirst(bill, ["patientName", "patient.name", "patient.fullName", "customerName", "name"]));
  return Boolean(billName && patientNames.has(billName));
};

const normalizeName = (value) => {
  if (!value && value !== 0) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    const result = readFirst(value, [
      "name",
      "doctorName",
      "fullName",
      "departmentName",
      "specialty",
      "speciality",
      "department",
      "specialization",
      "clinicName",
      "hospitalName",
      "title",
      "label",
    ]);
    if (result === undefined || result === null) return "";
    return typeof result === "string" ? result.trim() : String(result).trim();
  }
  return String(value).trim();
};

const normalizeComparable = (value) => String(value || "").trim().toLowerCase();

const formatSlotTime = (value) => {
  const time = String(value || "").trim();
  if (!time) return "";
  if (/^\d{1,2}:\d{2}$/.test(time)) return `${time}:00`;
  return time;
};

const formatAppointmentDateTime = (value) => {
  const date = String(value || "").trim();
  if (!date) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T00:00:00.000Z`;
  return date;
};

const normalizeAppointmentBookingDate = (value) => String(value || "").trim().slice(0, 10);

const normalizeAppointmentBookingTime = (value) => {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!match) return text.toLowerCase();

  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
};

const isActiveAppointmentBooking = (appointment = {}) =>
  !["cancelled", "canceled", "rejected"].includes(
    String(readFirst(appointment, ["status", "appointmentStatus", "state"]) || "").trim().toLowerCase()
  );

export const findPatientBookingConflict = (visits = [], date, time) => {
  const selectedDate = normalizeAppointmentBookingDate(date);
  const selectedTime = normalizeAppointmentBookingTime(time);

  const activeVisits = (Array.isArray(visits) ? visits : []).filter((visit) => isActiveAppointmentBooking(visit));
  if (!activeVisits.length) return undefined;

  const sameSlotConflict = activeVisits.find((visit) => {
    const visitDate = normalizeAppointmentBookingDate(
      readFirst(visit, ["date", "appointmentDate", "visitDate", "scheduledDate", "slotDate"])
    );
    const visitTime = normalizeAppointmentBookingTime(
      readFirst(visit, ["startTime", "time", "slot", "appointmentTime", "slotTime"])
    );
    return visitDate === selectedDate && visitTime === selectedTime;
  });

  if (sameSlotConflict) return sameSlotConflict;

  return activeVisits[0];
};

const readNumericId = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : value;
};

const getResponseId = (record, keys) => {
  if (!record || typeof record !== "object") return "";
  return readFirst(record, keys) || readFirst(record.data || {}, keys) || "";
};

const formatPatientDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }
  return String(value);
};

const getAppointmentNumber = (appointment) =>
  readFirst(appointment, ["appointmentNumber", "number", "referenceNumber", "id", "appointmentId"]);

const getAppointmentDoctor = (appointment) =>
  readFirst(appointment, ["doctor", "doctorName", "doctor.name", "providerName", "practitionerName"]) || "Doctor assigned";

const getAppointmentClinic = (appointment) =>
  readFirst(appointment, ["clinic", "clinicName", "hospitalName", "hospital", "branch"]) || "Clinic details unavailable";

const getAppointmentDate = (appointment) =>
  readFirst(appointment, ["date", "appointmentDate", "scheduledDate", "visitDate", "createdAt"]);

const getAppointmentTime = (appointment) =>
  formatSlotTime(readFirst(appointment, ["time", "startTime", "slot", "appointmentTime", "scheduleTime"]));

const getAppointmentReason = (appointment) =>
  readFirst(appointment, ["reasonForVisit", "reason", "summary", "notes", "complaint"]) || "Reason not provided";

const getAppointmentStatus = (appointment) =>
  readFirst(appointment, ["status", "appointmentStatus", "state"]) || "Scheduled";

const normalizeClinicOption = (clinic) => {
  const source = clinic && typeof clinic === "object" ? clinic : {};
  const name = normalizeName(clinic);
  return {
    ...source,
    id: readId(source, ["id", "clinicId", "hospitalId"]) || name,
    name,
    address: readFirst(source, ["address", "location", "clinicAddress", "hospitalAddress"]),
  };
};

const normalizeDepartmentOption = (department, clinicId = "") => {
  const source = department && typeof department === "object" ? department : {};
  const name =
    normalizeName(department) ||
    normalizeName(readFirst(source, ["name", "departmentName", "specialization", "specialty", "title"]));
  const normalizedClinicId = String(clinicId || readId(source, ["clinicId", "hospitalId", "clinic.id"]) || "");

  return {
    ...source,
    id: readId(source, ["id", "departmentId", "specialtyId"]) || name,
    name,
    clinicId: normalizedClinicId,
  };
};

const normalizeDoctorOption = (doctor, clinicId = "", departmentName = "") => {
  const source = doctor && typeof doctor === "object" ? doctor : {};
  const departmentLabel =
    normalizeName(readFirst(source, ["department", "departmentName", "specialty", "speciality", "specialization", "department.name"])) ||
    normalizeName(departmentName);

  return {
    ...source,
    id: readId(source, ["id", "doctorId", "userId"]),
    name: normalizeName(doctor),
    specialty: departmentLabel,
    departmentName: departmentLabel,
    departmentId: readId(source, ["departmentId", "specialtyId", "department.id"]),
    clinicId: String(clinicId || readId(source, ["clinicId", "hospitalId", "clinic.id"]) || ""),
  };
};

const normalizeSlotOption = (slot, doctorId = "", selectedDate = "") => {
  const source = slot && typeof slot === "object" ? slot : {};
  const normalizedDoctorId = String(doctorId || readId(source, ["doctorId", "doctor.id", "doctor.doctorId"]) || "");
  const date = readFirst(source, ["date", "appointmentDate", "visitDate"]) || selectedDate;
  const time = formatSlotTime(readFirst(source, ["time", "slot", "appointmentTime"]) || (typeof slot === "string" ? slot : ""));

  return {
    ...source,
    id: readId(source, ["id"]) || `${normalizedDoctorId}-${date}-${time}`,
    doctorId: normalizedDoctorId,
    date,
    time,
    clinicId: readId(source, ["clinicId", "hospitalId", "clinic.id"]),
    departmentId: readId(source, ["departmentId", "specialtyId", "department.id"]),
  };
};

function PatientShell({ notifications, children, patient }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const unreadCount = (notifications || []).filter((item) => item.unread).length;

  useEffect(() => {
    const closeMenu = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const logout = async () => {
    setMenuOpen(false);
    await logoutPatient(navigate);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    const destinations = [
      { terms: ["dashboard", "home"], path: "/patient/dashboard" },
      { terms: ["appointment", "booking", "visit"], path: "/patient/appointments" },
      { terms: ["medical", "history", "record"], path: "/patient/medical-history" },
      { terms: ["prescription", "medicine", "medication"], path: "/patient/prescriptions" },
      { terms: ["bill", "payment", "invoice"], path: "/patient/bills" },
      { terms: ["notification", "alert"], path: "/patient/notifications" },
      { terms: ["profile", "account"], path: "/patient/profile" },
    ];
    const match = destinations.find(({ terms }) => terms.some((term) => term.includes(query) || query.includes(term)));
    if (match) {
      navigate(match.path);
      setSearchOpen(false);
    }
  };

  const patientTitle = formatTitleCase(
    patient?.name || patient?.firstName || patient?.fullName || "Patient"
  );
  const patientSubtitle = formatTitleCase(
    patient?.clinicName ||
    patient?.hospitalName ||
    patient?.clinic?.name ||
    patient?.organization ||
    patient?.role ||
    "Patient"
  );

  const initials = (() => {
    const name = patientTitle;
    if (!name) return "P";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  })();

  return (
    <div className={`patient-portal ${searchOpen ? "pp-search-open" : ""}`}>
      <button
        type="button"
        className={`pp-sidebar-overlay ${sidebarOpen ? "is-visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close navigation menu"
        tabIndex={sidebarOpen ? 0 : -1}
      />
      <aside className={`pp-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="pp-brand">
          <div className="pp-brand-mark">
            <Heart size={20} />
          </div>
          <div>
            <strong>CMS</strong>
            <span>Patient Portal</span>
          </div>
        </div>
        <nav className="pp-nav" onClick={() => setSidebarOpen(false)}>
          <span className="pp-nav-label">MAIN MENU</span>
          <NavLink to="/patient/dashboard" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <ClipboardList size={16} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/patient/appointments" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <Calendar size={16} />
            <span>Appointments</span>
          </NavLink>
          <NavLink to="/patient/medical-history" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <FileText size={16} />
            <span>Medical History</span>
          </NavLink>
          <NavLink to="/patient/prescriptions" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <Pill size={16} />
            <span>Prescriptions</span>
          </NavLink>
          <NavLink to="/patient/bills" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <CreditCard size={16} />
            <span>Bills</span>
          </NavLink>
          <NavLink to="/patient/notifications" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <Bell size={16} />
            <span>Notifications</span>
            {unreadCount ? <em>{unreadCount}</em> : null}
          </NavLink>
        </nav>
        <div className="pp-patient-chip">
          <div className="pp-avatar">{initials}</div>
          <div>
            <strong>{patientTitle}</strong>
            <span>{patientSubtitle}</span>
            <div className="pp-patient-status">
              <span className="pp-status-dot pp-status-dot--online" />
              Online
            </div>
          </div>
        </div>
      </aside>
      <main className="pp-main">
        <header className="pp-topbar">
          <form className={`pp-search-box ${searchOpen ? "is-expanded" : ""}`} onSubmit={submitSearch}>
            <button
              type="button"
              className="pp-search-toggle"
              onClick={() => setSearchOpen(true)}
              aria-label="Search patient portal"
            >
              <Search size={18} className="pp-search-icon" />
            </button>
            <input
              type="search"
              ref={searchRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search appointments, bills, prescriptions..."
              aria-label="Search patient portal"
            />
            <button
              type="button"
              className="pp-search-close"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
            >
              <X size={18} />
            </button>
          </form>
          <div className="pp-top-actions">
            <button
              type="button"
              className="pp-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
            >
              <Menu size={21} />
            </button>
            <NavLink to="/patient/notifications" className="pp-icon-btn">
              <Bell size={17} />
              {unreadCount ? <span className="pp-dot" /> : null}
            </NavLink>
            <div className="pp-account-menu" ref={menuRef}>
              <button
                className="pp-account-toggle"
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="pp-avatar">{initials}</span>
                <span className="pp-account-name">{formatTitleCase(patient?.firstName || patient?.name || '')}</span>
                <ChevronDown size={15} />
              </button>
              {menuOpen ? (
                <div className="pp-account-dropdown" role="menu">
                  <div className="pp-account-summary">
                    <span className="pp-account-summary-avatar">{initials}</span>
                    <strong>{formatTitleCase(patient?.name || patient?.firstName || '')}</strong>
                    <span>{patient?.email || ''}</span>
                    <span className="pp-account-badge">Patient</span>
                  </div>
                  <button
                    type="button"
                    className="pp-account-item"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/patient/profile');
                    }}
                    role="menuitem"
                  >
                    <span className="pp-account-menu-icon">
                      <UserRound size={20} />
                    </span>
                    <span className="pp-account-menu-copy">
                      <b>My Profile</b>
                      <small>View and edit your profile</small>
                    </span>
                    <ChevronRight size={17} className="pp-account-menu-arrow" />
                  </button>
                  <button
                    type="button"
                    className="pp-account-item"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/patient/change-password');
                    }}
                    role="menuitem"
                  >
                    <span className="pp-account-menu-icon">
                      <KeyRound size={20} />
                    </span>
                    <span className="pp-account-menu-copy">
                      <b>Change Password</b>
                      <small>Update your password</small>
                    </span>
                    <ChevronRight size={17} className="pp-account-menu-arrow" />
                  </button>
                  <button
                    type="button"
                    className="pp-account-item pp-account-item--logout"
                    onClick={logout}
                    role="menuitem"
                  >
                    <span className="pp-account-menu-icon danger">
                      <LogOut size={20} />
                    </span>
                    <span className="pp-account-menu-copy">
                      <b>Logout</b>
                      <small>Sign out from your account</small>
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function PatientRoutes() {
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [bills, setBills] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const [
        profileRes,
        appointmentsRes,
        prescriptionsRes,
        billsRes,
        notificationsRes,
        dashboardRes,
      ] = await Promise.all([
        fetch(patientApiUrl(PATIENT_API.profile), { headers }).catch(() => null),
        fetch(patientApiUrl(PATIENT_API.appointments), { headers }).catch(() => null),
        fetch(patientApiUrl(PATIENT_API.prescriptions), { headers }).catch(() => null),
        fetch(patientApiUrl(PATIENT_API.bills), { headers }).catch(() => null),
        fetch(patientApiUrl(PATIENT_API.notifications), { headers }).catch(() => null),
        fetch(patientApiUrl(PATIENT_API.dashboard), { headers }).catch(() => null),
      ]);

      const profileData = profileRes?.ok ? await profileRes.json().catch(() => null) : null;
      if (profileData) setPatient(profileData);

      const appointmentsData = appointmentsRes?.ok ? await appointmentsRes.json().catch(() => []) : [];
      const appointmentsList = Array.isArray(appointmentsData) ? appointmentsData : (appointmentsData.items || appointmentsData.data || []);
      setVisits(appointmentsList);

      if (prescriptionsRes?.ok) {
        const rxData = await prescriptionsRes.json().catch(() => []);
        setPrescriptions(Array.isArray(rxData) ? rxData : (rxData.items || rxData.data || []));
      }

      if (billsRes?.ok) {
        const bData = await billsRes.json().catch(() => []);
        setBills(dedupeBillsByInvoice(parseApiList(bData)));
      }

      if (notificationsRes?.ok) {
        const nData = await notificationsRes.json().catch(() => []);
        setNotifications(Array.isArray(nData) ? nData : (nData.items || nData.data || []));
      }

      const dashboardJson = dashboardRes?.ok ? await dashboardRes.json().catch(() => null) : null;
      if (dashboardJson) setDashboardData(dashboardJson);
    } catch (err) {
      // ignore errors
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <PatientShell notifications={notifications} patient={patient}>
      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <PatientDashboard
              patient={patient}
              visits={visits}
              prescriptions={prescriptions}
              bills={bills}
              notifications={notifications}
              dashboardData={dashboardData}
            />
          }
        />
        <Route path="appointments" element={<PatientAppointmentsPage visits={visits} onRefresh={fetchData} />} />
        <Route path="appointments/book" element={<PatientBookingWizardPage patient={patient} visits={visits} onRefresh={fetchData} />} />
        <Route path="book" element={<Navigate to="appointments/book" replace />} />
        <Route path="medical-history" element={<PatientMedicalHistoryPage patient={patient} visits={visits} prescriptions={prescriptions} />} />
        <Route path="history" element={<Navigate to="medical-history" replace />} />
        <Route path="reports" element={<Navigate to="medical-history" replace />} />
        <Route path="prescriptions" element={<PatientPrescriptionsPage prescriptions={prescriptions} />} />
        <Route path="bills" element={<PatientBillsPage bills={bills} patient={patient} visits={visits} />} />
        <Route path="billing" element={<Navigate to="bills" replace />} />
        <Route path="notifications" element={<PatientNotificationsPage notifications={notifications} />} />
        <Route path="profile" element={<PatientProfilePage patient={patient} visits={visits} prescriptions={prescriptions} bills={bills} notifications={notifications} />} />
        <Route path="change-password" element={<PatientChangePasswordPage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </PatientShell>
  );
}

function PatientPageShell({ title, subtitle, action, children }) {
  return (
    <div className="patient-dashboard">
      <div className="pd-header">
        <div className="pd-header-copy">
          <h1 className="pd-greeting-title">{title}</h1>
          <p className="pd-greeting-subtitle">{subtitle}</p>
        </div>
        {action ? <div className="pd-header-actions">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

function PatientAppointmentsPage({ visits = [], onRefresh }) {
  const navigate = useNavigate();
  const rows = visits || [];
  const [selectedAppointment, setSelectedAppointment] = useState(rows[0] || null);

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleLoadingSlots, setRescheduleLoadingSlots] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  useEffect(() => {
    setSelectedAppointment(rows[0] || null);
  }, [rows]);

  const getApiHeaders = () => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const handleCancel = async () => {
    setCancelLoading(true);
    setCancelError("");
    try {
      const id = selectedAppointment.appointmentId || selectedAppointment.id;
      const cancelUrl = patientApiUrl(PATIENT_API.cancelAppointment, { id });
      const response = await fetch(cancelUrl, {
        method: "PATCH",
        headers: getApiHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unable to cancel appointment.");
        throw new Error(errorText || "Unable to cancel appointment.");
      }
      setCancelling(false);
      if (onRefresh) await onRefresh();
    } catch (err) {
      setCancelError(err.message || "Failed to cancel appointment.");
    } finally {
      setCancelLoading(false);
    }
  };

  useEffect(() => {
    const fetchRescheduleSlots = async () => {
      if (!selectedAppointment || !rescheduleDate) {
        setRescheduleSlots([]);
        return;
      }
      setRescheduleLoadingSlots(true);
      setRescheduleError("");
      try {
        const doctor = selectedAppointment.doctor || {};
        const doctorId = selectedAppointment.doctorId || doctor.doctorId || doctor.id || selectedAppointment.userId;
        if (!doctorId) {
          throw new Error("Doctor identifier not found on this appointment.");
        }
        const slotsUrl = patientApiUrl(PATIENT_API.doctorSlots, { doctorId });
        const response = await fetch(`${slotsUrl}?date=${encodeURIComponent(rescheduleDate)}`, {
          headers: getApiHeaders(),
        });
        if (!response.ok) {
          throw new Error("Unable to fetch available time slots.");
        }
        const data = await response.json();
        const slotList = Array.isArray(data) ? data : (data.items || data.data || data.slots || []);
        setRescheduleSlots(slotList.map((slot) => {
          if (typeof slot === 'string') return slot;
          return slot.start || slot.time || '';
        }).filter(Boolean));
      } catch (err) {
        setRescheduleError(err.message || "Failed to load slots.");
        setRescheduleSlots([]);
      } finally {
        setRescheduleLoadingSlots(false);
      }
    };

    if (rescheduling) {
      fetchRescheduleSlots();
    }
  }, [rescheduling, rescheduleDate, selectedAppointment]);

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError("Please select date and time.");
      return;
    }
    setRescheduleSaving(true);
    setRescheduleError("");
    try {
      const id = selectedAppointment.appointmentId || selectedAppointment.id;
      const rescheduleUrl = patientApiUrl(PATIENT_API.rescheduleAppointment, { id });
      const payload = {
        date: formatAppointmentDateTime(rescheduleDate),
        startTime: formatSlotTime(rescheduleTime),
      };
      const response = await fetch(rescheduleUrl, {
        method: "PUT",
        headers: getApiHeaders(),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unable to reschedule appointment.");
        throw new Error(errorText || "Unable to reschedule appointment.");
      }
      setRescheduling(false);
      setRescheduleDate("");
      setRescheduleTime("");
      if (onRefresh) await onRefresh();
    } catch (err) {
      setRescheduleError(err.message || "Failed to reschedule appointment.");
    } finally {
      setRescheduleSaving(false);
    }
  };

  return (
    <PatientPageShell
      title="Appointments"
      subtitle="Book, review, and reschedule care visits from your portal."
      action={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="button" className="pd-header-btn pd-header-btn--primary" onClick={() => navigate("/patient/dashboard")}>
            ← Back to dashboard
          </button>
          <button type="button" className="pd-header-btn" onClick={() => navigate("/patient/appointments/book")}>
            Book appointment
          </button>
        </div>
      }
    >
      <div className="pd-card">
        <div className="pd-section-header">
          <div>
            <h2>Appointment history</h2>
            <p>Linked to the patient portal backend data.</p>
          </div>
          {/* Book button moved to header actions */}
        </div>

        {rows.length ? (
          <div className="pd-notification-list">
            {rows.map((visit, index) => {
              const appointmentKey = visit.appointmentId || visit.id || index;
              const isSelected =
                selectedAppointment &&
                String(selectedAppointment.appointmentId || selectedAppointment.id || "") === String(visit.appointmentId || visit.id || "");

              return (
                <button
                  type="button"
                  className={`pd-notification-item ${isSelected ? "is-active" : ""}`}
                  key={appointmentKey}
                  onClick={() => {
                    setSelectedAppointment(visit);
                    setCancelling(false);
                    setRescheduling(false);
                  }}
                >
                  <span className="pd-notification-dot" />
                  <span className="pd-notification-body">
                    <strong>{getAppointmentNumber(visit) || "Appointment"}</strong>
                    <span>
                      {getAppointmentDoctor(visit)} at {getAppointmentClinic(visit)}
                    </span>
                    <em>
                      {formatPatientDate(getAppointmentDate(visit)) || "Date not available"}
                      {getAppointmentTime(visit) ? `, ${getAppointmentTime(visit)}` : ""} - {getAppointmentStatus(visit)}
                    </em>
                  </span>
                  <ChevronRight size={16} className="pd-notification-chevron" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="pd-selected-notification">
            <p>No appointments found yet.</p>
          </div>
        )}

        {selectedAppointment ? (
          <div className="pd-selected-notification">
            <div className="pd-selected-notification-head">
              <strong>{getAppointmentNumber(selectedAppointment) || "Appointment details"}</strong>
              <span>{getAppointmentStatus(selectedAppointment)}</span>
            </div>
            <div className="pd-appointment-detail-grid">
              <div>
                <span>Doctor</span>
                <strong>{getAppointmentDoctor(selectedAppointment)}</strong>
              </div>
              <div>
                <span>Branch / Clinic</span>
                <strong>{getAppointmentClinic(selectedAppointment)}</strong>
              </div>
              <div>
                <span>Date</span>
                <strong>{formatPatientDate(getAppointmentDate(selectedAppointment)) || "Not available"}</strong>
              </div>
              <div>
                <span>Time</span>
                <strong>{getAppointmentTime(selectedAppointment) || "Not available"}</strong>
              </div>
              <div className="pd-appointment-detail-wide">
                <span>Reason for visit</span>
                <strong>{getAppointmentReason(selectedAppointment)}</strong>
              </div>
            </div>

            {getAppointmentStatus(selectedAppointment) !== "Cancelled" &&
              getAppointmentStatus(selectedAppointment) !== "Completed" && (
                <div className="pd-appointment-actions">
                  <button
                    type="button"
                    className="pd-action-btn pd-action-btn--secondary"
                    onClick={() => {
                      setRescheduling(true);
                      setCancelling(false);
                      setRescheduleError("");
                      setRescheduleDate("");
                      setRescheduleTime("");
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    className="pd-action-btn pd-action-btn--danger"
                    onClick={() => {
                      setCancelling(true);
                      setRescheduling(false);
                      setCancelError("");
                    }}
                  >
                    Cancel Appointment
                  </button>
                </div>
              )}

            {cancelling && (
              <div className="pd-action-form">
                <h3>Cancel Appointment</h3>
                <p>Are you sure you want to cancel appointment {getAppointmentNumber(selectedAppointment)}?</p>
                {cancelError && <p className="pd-error-text">{cancelError}</p>}
                <div className="pd-form-actions">
                  <button
                    type="button"
                    className="pd-btn pd-btn--ghost"
                    onClick={() => setCancelling(false)}
                    disabled={cancelLoading}
                  >
                    No, keep it
                  </button>
                  <button
                    type="button"
                    className="pd-btn pd-btn--danger"
                    onClick={handleCancel}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? "Cancelling..." : "Yes, cancel"}
                  </button>
                </div>
              </div>
            )}

            {rescheduling && (
              <div className="pd-action-form">
                <h3>Reschedule Appointment</h3>
                <div className="pd-form-group">
                  <label htmlFor="reschedule-date">Select new date</label>
                  <input
                    id="reschedule-date"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={rescheduleDate}
                    onChange={(e) => {
                      setRescheduleDate(e.target.value);
                      setRescheduleTime("");
                    }}
                  />
                </div>
                {rescheduleDate && (
                  <div className="pd-form-group">
                    <label>Available slots</label>
                    {rescheduleLoadingSlots ? (
                      <p>Loading slots...</p>
                    ) : rescheduleSlots.length ? (
                      <div className="pd-slot-grid">
                        {rescheduleSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            className={`pd-slot-chip ${rescheduleTime === slot ? 'selected' : ''}`}
                            onClick={() => setRescheduleTime(slot)}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="pd-error-text">No slots available for this date.</p>
                    )}
                  </div>
                )}
                {rescheduleError && <p className="pd-error-text">{rescheduleError}</p>}
                <div className="pd-form-actions">
                  <button
                    type="button"
                    className="pd-btn pd-btn--ghost"
                    onClick={() => setRescheduling(false)}
                    disabled={rescheduleSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="pd-btn pd-btn--primary"
                    onClick={handleReschedule}
                    disabled={rescheduleSaving || !rescheduleDate || !rescheduleTime}
                  >
                    {rescheduleSaving ? "Saving..." : "Confirm Reschedule"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </PatientPageShell>
  );
}

function PatientBookingWizardPage({ patient = null, visits = [], onRefresh }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [reasonForVisit, setReasonForVisit] = useState("");
  const [bookingState, setBookingState] = useState("idle");
  const [bookingError, setBookingError] = useState("");
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const bookingRequestRef = useRef(false);

  const parseApiList = (data) => {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.clinics)) return data.clinics;
    if (Array.isArray(data.doctors)) return data.doctors;
    if (Array.isArray(data.departments)) return data.departments;
    if (Array.isArray(data.slots)) return data.slots;
    if (Array.isArray(data.appointments)) return data.appointments;
    if (Array.isArray(data.prescriptions)) return data.prescriptions;
    if (Array.isArray(data.bills)) return data.bills;
    if (Array.isArray(data.notifications)) return data.notifications;
    return [];
  };

  const getApiHeaders = () => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    const fetchBranches = async () => {
      setLoading(true);
      try {
        const headers = getApiHeaders();
        const branchesUrl = patientApiUrl(PATIENT_API.branches);
        const branchesRes = await fetch(branchesUrl, { headers }).catch(() => null);
        const branchesData = branchesRes?.ok ? await branchesRes.json().catch(() => null) : null;
        const branchList = parseApiList(branchesData);
        setBranches(branchList.map((b) => ({
          ...b,
          id: b.branchId || b.id,
          name: b.branchName || b.name || 'Branch',
          address: b.address || '',
          phone: b.phone || '',
        })));
      } catch (err) {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchBranches();
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      if (!selectedBranch) {
        setDepartments([]);
        return;
      }

      const headers = getApiHeaders();
      const branchId = selectedBranch.id || selectedBranch.branchId;
      if (!branchId) {
        setDepartments([]);
        return;
      }

      try {
        setDepartments([]);
        const departmentsUrl = patientApiUrl(PATIENT_API.branchDepartments, { branchId });
        const response = await fetch(departmentsUrl, { headers }).catch(() => null);
        const data = response?.ok ? await response.json().catch(() => null) : null;
        const departmentsList = parseApiList(data);
        // API returns array of strings like ["Neurology"]
        setDepartments(departmentsList.map((dept) => {
          if (typeof dept === 'string') return { id: dept, name: dept };
          return normalizeDepartmentOption(dept, branchId);
        }));
      } catch (err) {
        setDepartments([]);
      }
    };

    fetchDepartments();
  }, [selectedBranch]);

  useEffect(() => {
    const fetchDoctors = async () => {
      if (!selectedBranch || !selectedDepartment) {
        setDoctors([]);
        return;
      }

      const branchId = selectedBranch.id || selectedBranch.branchId;
      const departmentName = selectedDepartment.name || selectedDepartment.departmentName || selectedDepartment.id;
      if (!branchId || !departmentName) {
        setDoctors([]);
        return;
      }

      try {
        setDoctors([]);
        const headers = getApiHeaders();
        const params = new URLSearchParams({
          branchId: String(branchId),
          department: String(departmentName),
        });
        const doctorsUrl = `${patientApiUrl(PATIENT_API.doctors)}?${params.toString()}`;
        const response = await fetch(doctorsUrl, { headers }).catch(() => null);
        const data = response?.ok ? await response.json().catch(() => null) : null;
        const doctorList = parseApiList(data);
        setDoctors(doctorList.map((doctor) => ({
          ...doctor,
          id: doctor.doctorId || doctor.id,
          name: doctor.doctorName || doctor.name || 'Doctor',
          specialty: doctor.department || departmentName,
          qualification: doctor.qualification || '',
          experience: doctor.experience || 0,
          consultationFee: doctor.consultationFee || 0,
          availableToday: doctor.availableToday || false,
        })));
      } catch (err) {
        setDoctors([]);
      }
    };

    fetchDoctors();
  }, [selectedBranch, selectedDepartment]);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedDoctor || !selectedDate) {
        setSlots([]);
        return;
      }

      const headers = getApiHeaders();
      const doctorId = selectedDoctor.id || selectedDoctor.doctorId;
      if (!doctorId) {
        setSlots([]);
        return;
      }

      try {
        const slotsUrl = patientApiUrl(PATIENT_API.doctorSlots, { doctorId });
        const response = await fetch(`${slotsUrl}?date=${encodeURIComponent(selectedDate)}`, { headers }).catch(() => null);
        const data = response?.ok ? await response.json().catch(() => null) : null;
        const slotList = parseApiList(data);
        // API returns {start, end, status} objects
        setSlots(slotList.map((slot) => ({
          ...slot,
          id: `${doctorId}-${selectedDate}-${slot.start || slot.time}`,
          doctorId: String(doctorId),
          date: selectedDate,
          time: slot.start || slot.time || '',
          end: slot.end || '',
          status: slot.status || 'Available',
        })));
      } catch (err) {
        setSlots([]);
      }
    };

    fetchSlots();
  }, [selectedDoctor, selectedDate]);

  const branchOptions = useMemo(() => {
    if (branches.length) return branches;

    const ids = new Map();
    visits.forEach((visit) => {
      const id = readId(visit, ['branchId', 'clinicId', 'clinic.id', 'hospitalId', 'clinic.clinicId']);
      const name = normalizeName(readFirst(visit, ['branchName', 'clinicName', 'clinic.name', 'hospitalName', 'clinic']));
      const address = readFirst(visit, ['branchAddress', 'clinicAddress', 'clinic.address', 'hospitalAddress']);
      if (id && name && !ids.has(id)) ids.set(id, { id, name, address });
    });
    return Array.from(ids.values());
  }, [branches, visits]);

  const departmentOptions = useMemo(() => {
    if (departments.length) {
      return departments.map((department) => {
        if (typeof department === 'string') return { id: department, name: department };
        return normalizeDepartmentOption(department, selectedBranch?.id);
      });
    }

    const ids = new Map();
    visits.forEach((visit) => {
      const id = readId(visit, ['departmentId', 'department.id', 'specialtyId']);
      const name = normalizeName(readFirst(visit, ['departmentName', 'department.name', 'specialty', 'speciality']));
      const branchId = readId(visit, ['branchId', 'clinicId', 'clinic.id', 'hospitalId', 'clinic.clinicId']);
      if (id && name && !ids.has(id)) ids.set(id, { id, name, branchId });
    });
    return Array.from(ids.values());
  }, [departments, selectedBranch, visits]);

  const doctorOptions = useMemo(() => {
    if (doctors.length) {
      return doctors.map((doctor) => ({
        ...doctor,
        id: doctor.doctorId || doctor.id,
        name: doctor.doctorName || doctor.name || 'Doctor',
        specialty: doctor.department || selectedDepartment?.name || '',
      }));
    }

    const ids = new Map();
    visits.forEach((visit) => {
      const doctor = visit.doctor || (visit.doctorName ? visit : {});
      const id = readId(doctor, ['id', 'doctorId', 'userId']);
      const name = normalizeName(readFirst(doctor, ['name', 'doctorName', 'fullName']));
      const specialty = normalizeName(readFirst(doctor, ['specialty', 'speciality', 'departmentName']));
      const departmentId = readId(visit, ['departmentId', 'department.id', 'specialtyId']);
      const branchId = readId(visit, ['branchId', 'clinicId', 'clinic.id', 'hospitalId', 'clinic.clinicId']);
      if (id && name && !ids.has(id)) ids.set(id, { id, name, specialty, departmentId, branchId });
    });
    return Array.from(ids.values());
  }, [doctors, selectedBranch, selectedDepartment, visits]);

  const slotOptions = useMemo(() => {
    if (slots.length) {
      return slots;
    }

    return visits
      .map((visit) => {
        const doctorId = readId(visit, ['doctorId', 'doctor.id', 'doctor.doctorId']);
        const date = readFirst(visit, ['date', 'appointmentDate', 'visitDate']);
        const time = readFirst(visit, ['time', 'slot', 'appointmentTime']);
        const branchId = readId(visit, ['branchId', 'clinicId', 'clinic.id', 'hospitalId', 'clinic.clinicId']);
        const departmentId = readId(visit, ['departmentId', 'department.id', 'specialtyId']);
        return doctorId && date && time ? { id: `${doctorId}-${date}-${time}`, doctorId, date, time, branchId, departmentId } : null;
      })
      .filter(Boolean);
  }, [slots, selectedDoctor, selectedDate, visits]);

  const filteredDepartments = useMemo(
    () => {
      if (!selectedBranch) return departmentOptions;
      const selectedBranchId = String(selectedBranch.id || selectedBranch.branchId || "");

      return departmentOptions.filter((department) => {
        if (department.branchId && String(department.branchId) === selectedBranchId) return true;
        if (department.clinicId && String(department.clinicId) === selectedBranchId) return true;
        return true;
      });
    },
    [departmentOptions, selectedBranch]
  );

  const filteredDoctors = useMemo(
    () => {
      if (!selectedDepartment) return doctorOptions;
      const selectedDepartmentId = String(selectedDepartment.id || "");
      const selectedDepartmentName = normalizeComparable(selectedDepartment.name || selectedDepartment.departmentName || selectedDepartment.id);
      const selectedBranchId = String(selectedBranch?.id || selectedBranch?.branchId || "");

      return doctorOptions.filter((doctor) => {
        const doctorDepartmentName = normalizeComparable(doctor.departmentName || doctor.department || doctor.specialty);
        const doctorDepartmentId = String(doctor.departmentId || "");

        if (
          doctorDepartmentId &&
          selectedDepartmentId &&
          doctorDepartmentId !== selectedDepartmentId &&
          normalizeComparable(doctorDepartmentId) !== selectedDepartmentName
        )
          return false;
        if (doctorDepartmentName && selectedDepartmentName && doctorDepartmentName !== selectedDepartmentName) return false;
        if (selectedBranchId && doctor.branchId && String(doctor.branchId) !== selectedBranchId) return false;
        if (selectedBranchId && doctor.clinicId && String(doctor.clinicId) !== selectedBranchId) return false;
        return true;
      });
    },
    [doctorOptions, selectedDepartment, selectedBranch]
  );

  const filteredSlots = useMemo(
    () => {
      if (!selectedDoctor) return [];
      const selectedDoctorId = String(selectedDoctor.id || selectedDoctor.doctorId || selectedDoctor.userId || "");

      return slotOptions.filter((slot) => {
        if (slot.doctorId && String(slot.doctorId) !== selectedDoctorId) return false;
        if (selectedDate && slot.date && slot.date !== selectedDate) return false;
        return true;
      });
    },
    [slotOptions, selectedDoctor, selectedDate]
  );

  const availableTimes = useMemo(
    () =>
      selectedDate
        ? Array.from(new Set(filteredSlots.map((slot) => formatSlotTime(slot.time || slot.slot)).filter(Boolean)))
        : [],
    [filteredSlots, selectedDate]
  );

  const stepItems = ['Branch', 'Department', 'Doctor', 'Date & time', 'Confirm'];
  const canConfirm =
    selectedBranch &&
    selectedDoctor &&
    selectedDate &&
    selectedTime &&
    reasonForVisit.trim();
  const canContinue =
    (step === 1 && selectedBranch) ||
    (step === 2 && selectedDepartment) ||
    (step === 3 && selectedDoctor) ||
    (step === 4 && selectedDate && selectedTime);

  const handleNextStep = () => {
    if (!canContinue) return;
    setStep((current) => Math.min(5, current + 1));
  };

  const handleBackStep = () => setStep((current) => Math.max(1, current - 1));

  const consultationFee = Number(
    selectedDoctor?.consultationFee ??
      selectedDoctor?.ConsultationFee ??
      selectedDoctor?.fees ??
      selectedDoctor?.fee ??
      0
  ) || 0;

  const handlePrintBill = (print = true) => {
    const bill = paymentDetails?.bill;
    if (!bill) return;

    const escapeHtml = (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    const amountToWords = (value) => {
      const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
      const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
      const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
      const convertHundred = (num) => {
        let result = "";
        if (num >= 100) {
          result += `${ones[Math.floor(num / 100)]} Hundred`;
          num %= 100;
          if (num) result += " ";
        }
        if (num >= 20) {
          result += tens[Math.floor(num / 10)];
          if (num % 10) result += ` ${ones[num % 10]}`;
        } else if (num >= 10) {
          result += teens[num - 10];
        } else if (num > 0) {
          result += ones[num];
        }
        return result;
      };
      let integer = Math.floor(Math.abs(value));
      if (!integer) return "INR ZERO ONLY";
      const segments = [
        { value: 10000000, label: "Crore" },
        { value: 100000, label: "Lakh" },
        { value: 1000, label: "Thousand" },
        { value: 100, label: "Hundred" },
      ];
      let words = "";
      for (const segment of segments) {
        const part = Math.floor(integer / segment.value);
        if (part) {
          words += `${convertHundred(part)} ${segment.label} `;
          integer %= segment.value;
        }
      }
      if (integer) {
        words += `${convertHundred(integer)} `;
      }
      return `INR ${words.trim().toUpperCase()} ONLY`;
    };
    const invoiceNumber = readFirst(bill, ["invoiceNumber", "billNumber", "referenceNumber", "id"]) || `BILL-${paymentDetails.appointmentId}`;
    const patientName = readFirst(bill, ["patientName", "patient.name"]) || patient?.name || "Patient";
    const doctorName = readFirst(bill, ["doctorName", "doctor.name"]) || selectedDoctor?.name || "Doctor";
    const amount = Number(readFirst(bill, ["totalAmount", "grandTotal", "amount", "paidAmount"]) || paymentDetails.amount || 0);
    const clinicName = readFirst(bill, ["clinicName", "branchName", "clinic.name", "branch.name"]) || selectedBranch?.name || "CMS Health Care";
    const watermarkUrl = getClinicWatermarkSvg(clinicName);
    const patientPhone = readFirst(patient || {}, ["phone", "phoneNumber", "mobile"]) || "-";
    const patientCode = readFirst(patient || {}, ["patientCode", "code", "id"]) || "-";
    const appointmentToken = readFirst(bill, ["tokenNumber", "appointment.tokenNumber"]) || createNextPatientToken(visits);
    const billDate = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) return;

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <title>Consultation Bill ${escapeHtml(invoiceNumber)}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#eef1f5;color:#1f2937;font-family:Arial,sans-serif;font-size:11px}
    .invoice{width:780px;max-width:100%;margin:14px auto;background:#fff;border:1px solid #cbd5db;padding:16px;position:relative;overflow:hidden}
    .invoice>*:not(.watermark){position:relative;z-index:1}
    .watermark{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;z-index:0}
    .watermark img{width:410px;height:410px;object-fit:contain;opacity:.18;filter:saturate(1.35) contrast(1.08)}
    .header{display:grid;grid-template-columns:1.6fr 1fr;gap:16px;align-items:start;border-bottom:1px solid #cbd5db;padding-bottom:16px}
    .clinic-title{display:flex;align-items:center;gap:12px;margin-bottom:6px}
    .clinic-title img{width:54px;height:54px;object-fit:contain;border-radius:12px}
    .header-left h1{margin:0 0 6px;font-size:20px;letter-spacing:1px;color:#0f4d3a}
    .header-left p{margin:4px 0;font-size:12px;color:#334155}
    .header-left .clinic-address{margin-top:8px;font-size:12px;color:#0f4d3a;font-weight:700}
    .header-right{border:1px solid #cbd5db;padding:14px;background:#f8fafb}
    .header-right div{display:flex;justify-content:space-between;padding:6px 0;font-size:12px}
    .header-right div:not(:last-child){border-bottom:1px solid #e2e8f0}
    .header-right b{color:#334155}
    .header-right span{font-weight:700;color:#102331}
    .header-right .status span{color:#047857}
    .title{margin:18px 0 12px;text-align:center;font-size:16px;letter-spacing:1px;font-weight:700;color:#0f4d3a}
    .info-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
    .info-box{border:1px solid #cbd5db;border-radius:10px;background:#f8fafb;padding:14px}
    .info-item{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:12px}
    .info-item:last-child{border-bottom:0}
    .info-label{color:#334155}
    .info-value{font-weight:700}
    .service{width:100%;border-collapse:collapse;border:1px solid #cbd5db}
    .service th,.service td{border:1px solid #cbd5db;padding:10px;text-align:left;font-size:12px}
    .service th{background:#f8fafb;font-size:11px}
    .service .num{text-align:right}
    .summary-section{display:grid;grid-template-columns:1.1fr .9fr;gap:14px;margin-top:18px}
    .amount-words{border:1px solid #cbd5db;border-radius:10px;background:#f8fafb;padding:14px;font-size:12px;line-height:1.6}
    .amount-words b{font-weight:700}
    .total-box{border:1px solid #cbd5db;border-radius:10px;padding:14px;background:#fff}
    .total-row{display:flex;justify-content:space-between;padding:8px 0;font-size:12px;border-bottom:1px solid #e2e8f0}
    .total-row:last-child{border-bottom:0;font-weight:700;color:#0f4d3a}
    .total-row.total span:first-child{color:#0f4d3a}
    .bottom{display:grid;grid-template-columns:1.5fr .85fr 1fr;gap:16px;margin-top:18px;align-items:start}
    .notes{border:1px solid #cbd5db;border-radius:10px;background:#f8fafb;padding:14px;font-size:11px;line-height:1.6}
    .token-group{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .token-box{border:1px solid #cbd5db;border-radius:50%;padding:18px;text-align:center;background:#fff}
    .token-box span{display:block;color:#334155;font-size:11px;margin-bottom:8px}
    .token-box strong{display:block;font-size:24px;color:#0f4d3a}
    .signature{border:1px solid #cbd5db;border-radius:10px;padding:14px;text-align:center;background:#fff}
    .signature .line{height:1px;background:#334155;margin:0 auto 10px;width:70px}
    .signature span{display:block;font-size:12px;font-weight:700}
    .signature em{display:block;font-size:11px;color:#334155;margin-top:4px}
    .footer{margin-top:16px;text-align:center;font-size:11px;color:#334155}
    .footer strong{display:block;margin-top:6px;color:#0f4d3a}
    @media print{body{background:#fff}.invoice{margin:0;border-color:#333}}@page{size:A4;margin:10mm}
  </style>
</head>
<body>
<main class="invoice">
  <div class="watermark"><img src="${escapeHtml(watermarkUrl)}" alt="" /></div>
  <div class="header">
    <div class="header-left">
      <div class="clinic-title">
        <img src="${escapeHtml(watermarkUrl)}" alt="Clinic logo" />
        <h1>${escapeHtml(clinicName).toUpperCase()}</h1>
      </div>
      <p>Consultation and Patient Care Centre</p>
      <p class="clinic-address">Hyderabad, Telangana, India - 500063</p>
      <p>${escapeHtml(patientPhone)}</p>
    </div>
    <div class="header-right">
      <div><b>Bill No</b><span>${escapeHtml(invoiceNumber)}</span></div>
      <div><b>Bill Date</b><span>${escapeHtml(billDate)}</span></div>
      <div><b>Appointment</b><span>${escapeHtml(paymentDetails.appointmentId)}</span></div>
      <div><b>Payment Mode</b><span>${escapeHtml(paymentDetails.paymentMode)}</span></div>
      <div class="status"><b>Status</b><span>PAID</span></div>
    </div>
  </div>
  <div class="title">CONSULTATION FEE INVOICE (UPI)</div>
  <div class="info-row">
    <div class="info-box">
      <div class="info-item"><span class="info-label">Patient Name</span><span class="info-value">${escapeHtml(patientName)}</span></div>
      <div class="info-item"><span class="info-label">Patient ID</span><span class="info-value">${escapeHtml(patientCode)}</span></div>
      <div class="info-item"><span class="info-label">Mobile No.</span><span class="info-value">${escapeHtml(patientPhone)}</span></div>
    </div>
    <div class="info-box">
      <div class="info-item"><span class="info-label">Doctor</span><span class="info-value">Dr. ${escapeHtml(doctorName)}</span></div>
      <div class="info-item"><span class="info-label">Appointment</span><span class="info-value">${escapeHtml(paymentDetails.appointmentId)}</span></div>
      <div class="info-item"><span class="info-label">Token No.</span><span class="info-value">${escapeHtml(appointmentToken)}</span></div>
    </div>
  </div>
  <table class="service">
    <thead>
      <tr>
        <th>S.No.</th>
        <th>Service / Item</th>
        <th class="num">Qty</th>
        <th class="num">Rate (₹)</th>
        <th class="num">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>Consultation Charges (Dr. ${escapeHtml(doctorName)})</td>
        <td class="num">1</td>
        <td class="num">${escapeHtml(amount.toFixed(2))}</td>
        <td class="num">${escapeHtml(amount.toFixed(2))}</td>
      </tr>
    </tbody>
  </table>
  <div class="summary-section">
    <div class="amount-words"><b>Amount In Words</b><br/>${escapeHtml(amountToWords(amount))}</div>
    <div class="total-box">
      <div class="total-row"><span>Gross Amount</span><span class="num">&#8377; ${escapeHtml(amount.toFixed(2))}</span></div>
      <div class="total-row"><span>Discount</span><span class="num">&#8377; 0.00</span></div>
      <div class="total-row"><span>Net Amount</span><span class="num">&#8377; ${escapeHtml(amount.toFixed(2))}</span></div>
      <div class="total-row"><span>Round Off</span><span class="num">&#8377; 0.00</span></div>
      <div class="total-row total"><span>Total Amount Payable</span><span class="num">&#8377; ${escapeHtml(amount.toFixed(2))}</span></div>
    </div>
  </div>
  <div class="bottom">
    <div class="notes">
      <p>• Consultation charges only. Additional tests or medicines, if any, are billed separately.</p>
      <p>• Please retain this bill for your records.</p>
      <p>• This is a computer-generated invoice.</p>
    </div>
    <div class="token-group">
      <div class="token-box"><span>OP. No.</span><strong>${escapeHtml(paymentDetails.appointmentId)}</strong></div>
      <div class="token-box"><span>Token No.</span><strong>${escapeHtml(appointmentToken)}</strong></div>
    </div>
    <div class="signature">
      <div class="line"></div>
      <span>Authorised Signature</span>
      <em>(Dr. ${escapeHtml(doctorName)})</em>
    </div>
  </div>
  <div class="footer">
    For any queries or support, contact: ${escapeHtml(patientPhone)}
    <strong>*** COMPUTERISED INVOICE ***</strong>
    Thank you for your visit. Stay healthy!
  </div>
</main>
${print ? '<script>window.onload=()=>window.print()</script>' : ''}
</body>
</html>`);
    printWindow.document.close();
  };

  const handleConfirmBooking = async () => {
    if (bookingRequestRef.current) return;

    const conflict = findPatientBookingConflict(visits, selectedDate, selectedTime);
    if (conflict) {
      const message = "You already have an active appointment. Please complete or cancel the current appointment before booking another one.";
      setBookingError(message);
      setBookingState("error");
      return;
    }

    bookingRequestRef.current = true;
    setBookingState('payment');
    setBookingError('');
    try {
      const branchId = selectedBranch?.branchId || selectedBranch?.id;
      const doctorId = selectedDoctor?.doctorId || selectedDoctor?.id;
      const patientId = localStorage.getItem("patientId") || "";
      const patientName =
        readFirst(patient || {}, ["name", "patientName", "fullName", "displayName"]) ||
        localStorage.getItem("patientName") ||
        "";
      const patientPhone = readFirst(patient || {}, [
        "phone",
        "Phone",
        "phoneNumber",
        "PhoneNumber",
        "mobile",
        "Mobile",
        "mobileNumber",
        "MobileNumber",
      ]);
      const duplicateAppointments = [...visits];
      const headers = getApiHeaders();
      const allAppointmentsResponse = await fetch(apiUrl("Appointment"), { headers }).catch(() => null);
      if (allAppointmentsResponse?.ok) {
        const allAppointmentsData = await allAppointmentsResponse.json().catch(() => []);
        duplicateAppointments.push(...parseApiList(allAppointmentsData));
      }

      if (
        hasDuplicateAppointmentForPatientDoctorDate(duplicateAppointments, {
          patientId,
          patientName,
          phone: patientPhone,
          doctorId,
          doctorName: selectedDoctor?.doctorName || selectedDoctor?.name,
          date: selectedDate,
        })
      ) {
        throw new Error(DUPLICATE_APPOINTMENT_MESSAGE);
      }

      const payload = {
        branchId: readNumericId(branchId),
        doctorId: readNumericId(doctorId),
        tokenNumber: createNextPatientToken(duplicateAppointments),
        date: formatAppointmentDateTime(selectedDate),
        startTime: formatSlotTime(selectedTime),
        reasonForVisit: reasonForVisit.trim(),
        patientName,
        phone: patientPhone,
        patientPhone,
      };
      const appointmentUrl = patientApiUrl(PATIENT_API.appointments);
      const response = await fetch(appointmentUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to book appointment.');
        throw new Error(errorText || 'Unable to book appointment.');
      }
      const appointmentData = await response.json().catch(() => ({}));
      const appointmentId =
        getResponseId(appointmentData, ["appointmentId", "AppointmentId", "id", "Id"]) ||
        getResponseId(appointmentData?.appointment, ["appointmentId", "AppointmentId", "id", "Id"]);
      if (!appointmentId) {
        throw new Error("Appointment created, but appointment ID was not returned for payment.");
      }

      const paymentPayload = {
        appointmentId: readNumericId(appointmentId),
        patientId: readNumericId(patientId),
        doctorId: readNumericId(doctorId),
        branchId: readNumericId(branchId),
        date: formatAppointmentDateTime(selectedDate),
        startTime: formatSlotTime(selectedTime),
        amount: consultationFee,
        paymentMode,
      };
      const paymentResponse = await fetch(apiUrl("payment/create"), {
        method: "POST",
        headers,
        body: JSON.stringify(paymentPayload),
      });
      const paymentData = await paymentResponse.json().catch(() => ({}));
      if (!paymentResponse.ok) {
        throw new Error(paymentData.message || paymentData.title || "Unable to create consultation payment.");
      }

      const paymentId = getResponseId(paymentData, ["paymentId", "PaymentId", "id", "Id"]);
      const transactionId =
        getResponseId(paymentData, ["transactionId", "TransactionId"]) ||
        `PAT-${Date.now()}`;

      const successResponse = await fetch(apiUrl("payment/success"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          paymentId: readNumericId(paymentId),
          transactionId,
        }),
      });
      const successData = await successResponse.json().catch(() => ({}));
      if (!successResponse.ok) {
        throw new Error(successData.message || successData.title || "Payment could not be confirmed.");
      }

      const billPayload = {
        appointmentId: readNumericId(appointmentId),
        consultationCharge: consultationFee,
        totalAmount: consultationFee,
        grandTotal: consultationFee,
        payableAmount: consultationFee,
        paymentAmount: consultationFee,
        paidAmount: consultationFee,
        paymentMode,
        paymentStatus: "Paid",
      };
      // Patients do not have permission to create bills through the staff-only
      // Billing endpoint. Payment confirmation creates the bill server-side;
      // retrieve it through the existing patient bills endpoint when available.
      const patientBillsResponse = await fetch(patientApiUrl(PATIENT_API.bills), { headers }).catch(() => null);
      const patientBillsData = patientBillsResponse?.ok ? await patientBillsResponse.json().catch(() => []) : [];
      const patientBills = parseApiList(patientBillsData);
      const billData = patientBills.find((bill) => String(readFirst(bill, ["appointmentId", "appointment.id", "appointmentNumber"]) || "") === String(appointmentId)) || successData?.bill || successData?.invoice || paymentData?.bill || paymentData?.invoice || {};
      const generatedBill = {
        ...(Array.isArray(billData) ? billData[0] : billData),
        ...billPayload,
        patientName,
        doctorName: selectedDoctor?.doctorName || selectedDoctor?.name,
      };

      setPaymentDetails({
        appointmentId,
        paymentId,
        transactionId,
        amount: consultationFee,
        paymentMode,
        bill: generatedBill,
      });
      setBookingState('success');
      setStep(5);
      if (onRefresh) await onRefresh();
    } catch (error) {
      setBookingState('error');
      setBookingError(error.message || 'Could not complete booking.');
    } finally {
      bookingRequestRef.current = false;
    }
  };

  return (
    <PatientPageShell
      title="Book appointment"
      subtitle="Follow the steps to reserve your slot."
      action={
        <button type="button" className="pd-header-btn pd-header-btn--primary" onClick={() => navigate('/patient/dashboard')}>
          <Calendar size={16} />
          Back to dashboard
        </button>
      }
    >
      <div className="booking-page">
        <div className="booking-stepper">
          {stepItems.map((label, index) => {
            const stepNumber = index + 1;
            return (
              <button
                key={label}
                type="button"
                className={`booking-step ${stepNumber === step ? 'active' : ''} ${stepNumber < step ? 'completed' : ''}`}
                onClick={() => setStep(stepNumber)}
              >
                <span>{stepNumber}</span>
                {label}
              </button>
            );
          })}
        </div>

        <div className="booking-content">
          {step === 1 && (
            <section className="booking-panel">
              <div className="booking-panel-header">
                <h2>Branch</h2>
                <p>Choose the branch location for your appointment.</p>
              </div>
              <div className="booking-grid">
                {branchOptions.length ? (
                  branchOptions.map((branch) => (
                    <button
                      key={branch.id || branch.name}
                      type="button"
                      className={`booking-card ${selectedBranch?.id === branch.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedBranch(branch);
                        setSelectedDepartment(null);
                        setSelectedDoctor(null);
                        setSelectedDate('');
                        setSelectedTime('');
                      }}
                    >
                      <strong>{branch.name}</strong>
                      <span>{branch.address || 'Location details unavailable'}</span>
                    </button>
                  ))
                ) : (
                  <p className="booking-empty">No branches found yet.</p>
                )}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="booking-panel">
              <div className="booking-panel-header">
                <h2>Department</h2>
                <p>Select the care specialty you need.</p>
              </div>
              <div className="booking-grid">
                {filteredDepartments.length ? (
                  filteredDepartments.map((department) => (
                    <button
                      key={department.id || department.name}
                      type="button"
                      className={`booking-card ${selectedDepartment?.id === department.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedDepartment(department);
                        setSelectedDoctor(null);
                        setSelectedDate('');
                        setSelectedTime('');
                      }}
                    >
                      <strong>{department.name}</strong>
                    </button>
                  ))
                ) : (
                  <p className="booking-empty">No departments available.</p>
                )}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="booking-panel">
              <div className="booking-panel-header">
                <h2>Doctor</h2>
                <p>Pick the doctor that best matches your selected specialty.</p>
              </div>
              <div className="booking-grid">
                {filteredDoctors.length ? (
                  filteredDoctors.map((doctor) => (
                    <button
                      key={doctor.id || doctor.name}
                      type="button"
                      className={`booking-card ${selectedDoctor?.id === doctor.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedDoctor(doctor);
                        setSelectedDate('');
                        setSelectedTime('');
                      }}
                    >
                      <strong>{doctor.name}</strong>
                      <span>{doctor.specialty || 'General consultation'}</span>
                    </button>
                  ))
                ) : (
                  <p className="booking-empty">No doctors available for this department.</p>
                )}
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="booking-panel booking-schedule-panel">
              <div className="booking-panel-header">
                <h2>Date & time</h2>
                <p>Choose a date and time slot for your appointment.</p>
              </div>
              <div className="booking-field-group">
                <label htmlFor="appointment-date">Appointment date</label>
                <input
                  id="appointment-date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSelectedTime('');
                  }}
                />
              </div>
              <div className="booking-slot-list">
                {availableTimes.length ? (
                  availableTimes.map((time) => (
                    <button
                      key={time}
                      type="button"
                      className={`booking-slot ${selectedTime === time ? 'selected' : ''}`}
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </button>
                  ))
                ) : (
                  <p className="booking-empty">Select a date to display available time slots.</p>
                )}
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="booking-panel booking-summary-panel">
              <div className="booking-panel-header">
                <h2>Confirm</h2>
                <p>Review your  branch, department, doctor, and schedule.</p>
              </div>
              <div className="booking-summary">
                
                <div className="booking-summary-row">
                  <span>Branch</span>
                  <strong>{selectedBranch?.name || 'Not selected'}</strong>
                </div>
                <div className="booking-summary-row">
                  <span>Department</span>
                  <strong>{selectedDepartment?.name || 'Not selected'}</strong>
                </div>
                <div className="booking-summary-row">
                  <span>Doctor</span>
                  <strong>{selectedDoctor?.name || 'Not selected'}</strong>
                </div>
                <div className="booking-summary-row">
                  <span>Date</span>
                  <strong>{selectedDate || 'Not selected'}</strong>
                </div>
                <div className="booking-summary-row">
                  <span>Time</span>
                  <strong>{selectedTime || 'Not selected'}</strong>
                </div>
                <div className="booking-summary-row">
                  <span>Consultation Fee</span>
                  <strong>{formatIndianCurrency(consultationFee)}</strong>
                </div>
              </div>
              <div className="booking-field-group">
                <label htmlFor="reason-for-visit">Reason for visit</label>
                <textarea
                  id="reason-for-visit"
                  rows={4}
                  value={reasonForVisit}
                  onChange={(event) => setReasonForVisit(event.target.value)}
                  placeholder="Fever, follow-up consultation, knee pain..."
                />
              </div>
              <div className="booking-payment-panel">
                <div>
                  <strong>Payment</strong>
                  <span>Pay only the doctor consultation fee to confirm this appointment.</span>
                </div>
                <label>
                  <span>Payment Mode</span>
                  <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                  </select>
                </label>
              </div>
              {bookingError ? <p className="booking-error">{bookingError}</p> : null}
              {bookingState === 'success' && (
                <div className="booking-success">
                  <p>Payment completed and consultation bill generated{paymentDetails?.transactionId ? ` - ${paymentDetails.transactionId}` : ""}.</p>
                  <div className="booking-success-actions">
                    <button type="button" className="booking-button booking-button--ghost" onClick={() => handlePrintBill(false)}>View Bill</button>
                    <button type="button" className="booking-button booking-button--secondary" onClick={handlePrintBill}>Print Bill</button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="booking-footer">
          <button type="button" className="booking-button booking-button--ghost" onClick={() => navigate('/patient/dashboard')}>
            Cancel
          </button>
          {step < 5 ? (
            <button
              type="button"
              className="booking-button booking-button--primary"
              onClick={handleNextStep}
              disabled={!canContinue}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="booking-button booking-button--primary"
              onClick={handleConfirmBooking}
              disabled={bookingState === 'payment' || bookingState === 'success' || !canConfirm}
            >
              {bookingState === 'payment' ? 'Processing payment...' : bookingState === 'success' ? 'Payment Complete' : 'Pay Now'}
            </button>
          )}
          {step > 1 ? (
            <button type="button" className="booking-button booking-button--secondary" onClick={handleBackStep}>
              Back
            </button>
          ) : null}
        </div>
      </div>
    </PatientPageShell>
  );
}

function PatientMedicalHistoryPage({ patient, visits = [], prescriptions = [] }) {
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const patientId = String(
    patient?.id ||
    patient?.patientId ||
    localStorage.getItem("patientId") ||
    ""
  ).trim();

  useEffect(() => {
    if (!patientId) {
      setHistory(null);
      setHistoryError("Patient ID is required to load medical history.");
      return undefined;
    }

    let isCurrent = true;
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const fetchHistory = async () => {
      setLoadingHistory(true);
      setHistoryError("");
      try {
        const historyUrl = apiUrl(`MedicalHistory/${encodeURIComponent(patientId)}`);
        const response = await fetch(historyUrl, { headers });
        if (!response.ok) {
          throw new Error('Unable to load medical history.');
        }
        const data = await response.json().catch(() => null);
        if (isCurrent) setHistory(data);
      } catch (error) {
        if (isCurrent) setHistoryError(error.message || 'Unable to load medical history.');
      } finally {
        if (isCurrent) setLoadingHistory(false);
      }
    };

    fetchHistory();

    const refreshTimer = window.setInterval(fetchHistory, 30000);
    return () => {
      isCurrent = false;
      window.clearInterval(refreshTimer);
    };
  }, [patientId]);

  const normalizeList = (value) => {
    if (!value && value !== 0) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return String(value)
      .split(/,|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const normalizeRecords = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (Array.isArray(value?.data)) return value.data.filter(Boolean);
    if (Array.isArray(value?.items)) return value.items.filter(Boolean);
    return [];
  };

  const newestFirst = (records, dateReader) =>
    [...records].sort((left, right) => {
      const leftTime = new Date(dateReader(left) || left?.updatedAt || left?.createdAt || 0).getTime();
      const rightTime = new Date(dateReader(right) || right?.updatedAt || right?.createdAt || 0).getTime();
      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    });

  const currentPatientId = normalizeComparable(patientId);
  const belongsToCurrentPatient = (record) => {
    const recordPatientId = readFirst(record, ["patientId", "patient.id", "patient.patientId"]);
    return !recordPatientId || normalizeComparable(recordPatientId) === currentPatientId;
  };

  const historyRecord = Array.isArray(history) ? history.find(belongsToCurrentPatient) || history[0] || null : history;

  const chronicConditions = normalizeList(
    historyRecord?.chronicConditions ||
    historyRecord?.chronicDiseases ||
    patient?.chronicDiseases ||
    patient?.chronicConditions
  );
  const allergies = normalizeList(historyRecord?.allergies || historyRecord?.allergyList || historyRecord?.allergy || patient?.allergies);
  const currentMedications = normalizeList(
    historyRecord?.currentMedications || historyRecord?.medications || historyRecord?.drugs || patient?.currentMedications
  );

  const medicalConditions = normalizeList(historyRecord?.medicalConditions || historyRecord?.conditions || historyRecord?.surgeries);

  const rawVisitRecords = normalizeRecords(historyRecord?.visits).length
    ? normalizeRecords(historyRecord?.visits)
    : normalizeRecords(historyRecord?.appointments).length
      ? normalizeRecords(historyRecord?.appointments)
      : normalizeRecords(visits).filter(belongsToCurrentPatient);

  const reportRecords = [
    ...normalizeRecords(historyRecord?.reports),
    ...normalizeRecords(historyRecord?.labReports),
    ...normalizeRecords(historyRecord?.scanReports),
    ...normalizeRecords(historyRecord?.attachments),
    ...rawVisitRecords
        .map((visit) => readFirst(visit, ['report', 'reportName', 'reportTitle', 'reportUrl', 'documentUrl']) ? visit : null)
        .filter(Boolean),
  ];

  const prescriptionRecords = normalizeRecords(historyRecord?.prescriptions).length
    ? normalizeRecords(historyRecord?.prescriptions)
    : normalizeRecords(prescriptions).filter(belongsToCurrentPatient);

  const readVisitDate = (visit) =>
    readFirst(visit, ['date', 'visitDate', 'appointmentDate', 'createdAt', 'appointment?.date']) || 'Unknown date';

  const readVisitDoctor = (visit) =>
    readFirst(visit, ['doctor.name', 'doctorName', 'practitioner', 'provider']) || 'Doctor details unavailable';

  const readVisitDepartment = (visit) =>
    readFirst(visit, ['specialty', 'departmentName', 'department', 'specialization', 'doctor.specialization']) || '-';

  const readVisitDiagnosis = (visit) =>
    readFirst(visit, ['diagnosis', 'condition', 'summary']) || '-';

  const readVisitChiefComplaint = (visit) =>
    readFirst(visit, ['chiefComplaint', 'chiefComplaints', 'reasonForVisit', 'reason', 'complaint']) || '-';

  const readVisitNotes = (visit) =>
    readFirst(visit, ['consultationNotes', 'notes', 'doctorNotes', 'description']) || '-';

  const readReportTitle = (report) =>
    readFirst(report, ['title', 'reportTitle', 'reportName', 'name', 'testName']) || 'Report';

  const readReportDate = (report) =>
    readFirst(report, ['date', 'reportDate', 'createdAt', 'appointmentDate']) || 'Unknown date';

  const readReportType = (report) =>
    readFirst(report, ['type', 'category', 'reportType', 'documentType']) || 'Other Attachment';

  const readPrescriptionDoctor = (prescription) =>
    readFirst(prescription, ['doctor.name', 'doctorName', 'prescribedBy', 'providerName']) || 'Doctor details unavailable';

  const readPrescriptionDate = (prescription) =>
    readFirst(prescription, ['date', 'visitDate', 'prescriptionDate', 'prescribedOn', 'createdAt']) || 'Unknown date';

  const normalizeMedicines = (prescription) => {
    const medicines = prescription?.medicines || prescription?.medicineList || prescription?.items || prescription?.drugs;
    if (Array.isArray(medicines)) return medicines.filter(Boolean);
    const medicine = readFirst(prescription, ['medicine', 'medicineName', 'drugName', 'medication']);
    return medicine ? [{ medicine, dosage: readFirst(prescription, ['dosage', 'dose']), instructions: readFirst(prescription, ['instructions', 'notes']) }] : [];
  };

  const visitRecords = newestFirst(rawVisitRecords, readVisitDate);
  const sortedReports = newestFirst(reportRecords, readReportDate);
  const sortedPrescriptions = newestFirst(prescriptionRecords, readPrescriptionDate);
  const hasAnyHistory =
    medicalConditions.length ||
    allergies.length ||
    chronicConditions.length ||
    currentMedications.length ||
    visitRecords.length ||
    sortedReports.length ||
    sortedPrescriptions.length;

  return (
    <PatientPageShell
      title="Medical History"
      subtitle="Read-only medical records maintained by your care team."
    >
      {historyError ? <div className="mh-error">{historyError}</div> : null}
      {!historyError && loadingHistory ? <div className="mh-loading">Loading medical history...</div> : null}
      {!historyError && !loadingHistory && !hasAnyHistory ? (
        <div className="mh-empty">
          <p>No medical history has been recorded for this patient yet.</p>
        </div>
      ) : null}

      <div className="mh-grid">
        <div className="mh-card">
          <h3>Medical Conditions</h3>
          <div className="mh-condition-list">
            {[
              ["Medical Conditions", medicalConditions],
              ["Allergies", allergies],
              ["Chronic Diseases", chronicConditions],
              ["Current Medications", currentMedications],
            ].map(([label, values]) => (
              <div className="mh-condition-row" key={label}>
                <span>{label}</span>
                {values.length ? (
                  <div className="mh-chip-list">
                    {values.map((item, index) => (
                      <span key={`${label}-${item}-${index}`} className="mh-chip">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <strong>Not recorded</strong>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mh-card">
          <h3>Reports</h3>
          {sortedReports.length ? (
            <div className="mh-mini-list">
              {sortedReports.map((report, index) => (
                <div className="mh-mini-item" key={report.id || report.reportId || index}>
                  <strong>{readReportTitle(report)}</strong>
                  <span>{readReportDate(report)} - {readReportType(report)}</span>
                  {readFirst(report, ['reportUrl', 'documentUrl', 'fileUrl', 'url']) ? (
                    <a href={readFirst(report, ['reportUrl', 'documentUrl', 'fileUrl', 'url'])} target="_blank" rel="noreferrer">
                      View attachment
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p>No reports or attachments recorded.</p>
          )}
        </div>
        <div className="mh-card">
          <h3>Prescriptions</h3>
          {sortedPrescriptions.length ? (
            <div className="mh-mini-list">
              {sortedPrescriptions.map((prescription, index) => (
                <div className="mh-mini-item" key={prescription.id || prescription.prescriptionId || index}>
                  <strong>{readPrescriptionDoctor(prescription)}</strong>
                  <span>{readPrescriptionDate(prescription)}</span>
                  {normalizeMedicines(prescription).length ? (
                    <div className="mh-medicine-list">
                      {normalizeMedicines(prescription).map((medicine, medicineIndex) => (
                        <p key={`${index}-${medicineIndex}`}>
                          <b>{readFirst(medicine, ['medicine', 'medicineName', 'name', 'drugName']) || String(medicine)}</b>
                          <span>{readFirst(medicine, ['dosage', 'dose']) || 'Dosage not recorded'}</span>
                          <em>{readFirst(medicine, ['instructions', 'notes', 'frequency']) || 'No instructions'}</em>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <span>No medicines recorded.</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p>No prescriptions recorded.</p>
          )}
        </div>
      </div>

      <div className="mh-panel">
        <div className="mh-panel-header">
          <div>
            <h2>Previous Visits</h2>
            <p>Latest consultations and notes from your patient history.</p>
          </div>
        </div>
        {visitRecords.length ? (
          <div className="mh-visit-list">
            {visitRecords.map((visit, index) => (
              <div className="mh-visit-item" key={visit.id || visit.appointmentId || index}>
                <div className="mh-visit-meta">
                  <span>{readVisitDate(visit)}</span>
                  <strong>{readVisitDoctor(visit)}</strong>
                </div>
                <div className="mh-visit-detail-grid">
                  <div>
                    <span>Department</span>
                    <strong>{readVisitDepartment(visit)}</strong>
                  </div>
                  <div>
                    <span>Diagnosis</span>
                    <strong>{readVisitDiagnosis(visit)}</strong>
                  </div>
                  <div>
                    <span>Chief Complaint</span>
                    <strong>{readVisitChiefComplaint(visit)}</strong>
                  </div>
                  <div>
                    <span>Consultation Notes</span>
                    <strong>{readVisitNotes(visit)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mh-empty">
            <p>No previous visits found.</p>
          </div>
        )}
      </div>
    </PatientPageShell>
  );
}

function PatientPrescriptionsPage({ prescriptions = [] }) {
  const prescriptionRecords = Array.isArray(prescriptions) ? prescriptions : [];
  const [selectedPrescription, setSelectedPrescription] = useState(prescriptionRecords[0] || null);

  useEffect(() => {
    setSelectedPrescription(prescriptionRecords[0] || null);
  }, [prescriptionRecords]);

  const formatDate = (record) =>
    formatPatientDate(
      readFirst(record, [
        'visitDate',
        'prescriptionDate',
        'date',
        'prescribedOn',
        'createdAt',
        'appointmentDate',
        'followUpDate',
        'visitOn',
      ])
    ) || 'Unknown date';

  const getTitle = (record) =>
    readFirst(record, ['title', 'summary', 'diagnosis', 'condition', 'description', 'problem', 'chiefComplaint']) ||
    'Prescription';

  const normalizePrescriptionUrl = (value) => {
    if (!value && value !== 0) return '';
    const rawUrl = String(value).trim();
    if (!rawUrl) return '';
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    if (/^\/?api\//i.test(rawUrl)) return apiUrl(rawUrl.replace(/^\/?api\/?/i, ''));
    if (/^\//.test(rawUrl)) return `${window.location.origin}${rawUrl}`;
    if (/\.pdf(\?|$)/i.test(rawUrl) || /\/[^\s]+\.[a-z0-9]{2,5}(\?|$)/i.test(rawUrl)) {
      return `${window.location.origin}/${rawUrl.replace(/^\/?/, '')}`;
    }
    return '';
  };

  const resolvePrescriptionUrl = (value, seen = new Set()) => {
    if (value == null) return '';
    if (typeof value === 'string') return normalizePrescriptionUrl(value);
    if (typeof value !== 'object') return '';
    if (seen.has(value)) return '';
    seen.add(value);

    const direct = readFirst(value, [
      'prescriptionUrl',
      'pdfUrl',
      'documentUrl',
      'downloadUrl',
      'fileUrl',
      'url',
      'link',
      'path',
    ]);
    if (direct) {
      const normalized = normalizePrescriptionUrl(direct);
      if (normalized) return normalized;
    }

    const nestedPaths = [
      'prescription',
      'document',
      'file',
      'pdf',
      'download',
      'attachment',
      'attachments',
    ];

    for (const path of nestedPaths) {
      const nestedValue = getNestedValue(value, path);
      const result = resolvePrescriptionUrl(nestedValue, seen);
      if (result) return result;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const result = resolvePrescriptionUrl(item, seen);
        if (result) return result;
      }
    }

    for (const key of Object.keys(value)) {
      const result = resolvePrescriptionUrl(value[key], seen);
      if (result) return result;
    }

    return '';
  };

  const getDownloadUrl = (record) => resolvePrescriptionUrl(record) || '';

  const getApiHeaders = () => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const getFileNameFromUrl = (url) => {
    if (!url) return 'prescription.pdf';
    const fileName = url.split('/').pop().split('?')[0];
    return fileName || 'prescription.pdf';
  };

  const escapeHtml = (unsafe) => {
    if (unsafe == null) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const formatShareText = (prescription) => {
    const lines = [];
    lines.push(`Prescription`);
    const doctor = readFirst(prescription, ['doctorName', 'doctor.name', 'prescribedBy']);
    if (doctor) lines.push(`Doctor: ${doctor}`);
    const diag = readFirst(prescription, ['diagnosis', 'condition', 'title']);
    if (diag) lines.push(`Diagnosis: ${diag}`);
    const meds = getMedicineList(prescription);
    if (meds && meds.length) {
      lines.push('Medicines:');
      meds.forEach((m) => lines.push(`- ${m.name} | ${m.dosage} | ${m.instructions}`));
    }
    return lines.join('\n');
  };

  const downloadPrescription = async (url, prescription = null) => {
    // Primary: download existing URL
    if (url) {
      try {
        const response = await fetch(url, { headers: getApiHeaders(), mode: 'cors' });
        if (!response.ok) throw new Error('Unable to download prescription.');
        const blob = await response.blob();
        const filename = getFileNameFromUrl(url);
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
        return;
      } catch (error) {
        // fallback to opening in new tab
        try { window.open(url, '_blank', 'noopener,noreferrer'); return; } catch (e) {}
      }
    }

    // Fallback: generate printable HTML and open print dialog so user can save as PDF
    if (prescription) {
      try {
        const html = `
          <html>
            <head>
              <title>Prescription</title>
              <style>body{font-family: Arial, sans-serif; padding:20px;}</style>
            </head>
            <body>
              <h2>Prescription</h2>
              <p><strong>Diagnosis:</strong> ${escapeHtml(readFirst(prescription, ['diagnosis', 'condition', 'title']) || '')}</p>
              <p><strong>Doctor:</strong> ${escapeHtml(readFirst(prescription, ['doctorName','doctor.name','prescribedBy']) || '')}</p>
              <h3>Medicines</h3>
              <ul>
                ${getMedicineList(prescription)
                  .map(m => `<li><strong>${escapeHtml(m.name)}</strong> - ${escapeHtml(m.dosage)} - ${escapeHtml(m.instructions)}</li>`)
                  .join('')}
              </ul>
            </body>
          </html>`;

        const win = window.open('', '_blank');
        if (!win) return;
        win.document.open();
        win.document.write(html);
        win.document.close();
        // Ask user to print/save as PDF
        win.focus();
        setTimeout(() => { try { win.print(); } catch (e) {} }, 500);
        return;
      } catch (e) {
        // ignore and fall through
      }
    }
  };

  const sharePrescription = async (url, title = 'Prescription', prescription = null) => {
    if (!url && !prescription) return;
    try {
      const response = await fetch(url, { headers: getApiHeaders(), mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const filename = getFileNameFromUrl(url);
        const file = new File([blob], filename, { type: blob.type || 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title, files: [file], text: title });
          return;
        }
      }
    } catch (err) {
      // if fetch/share fails, fallback to URL share
    }

    if (navigator.share) {
      try {
        if (url) {
          await navigator.share({ title, url });
          return;
        }
        // share textual prescription if no URL
        if (prescription) {
          await navigator.share({ title, text: formatShareText(prescription) });
          return;
        }
        return;
      } catch (err) {
        // ignore
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        if (url) {
          await navigator.clipboard.writeText(url);
          window.alert('Prescription link copied to clipboard.');
          return;
        }
        if (prescription) {
          await navigator.clipboard.writeText(formatShareText(prescription));
          window.alert('Prescription text copied to clipboard.');
          return;
        }
      } catch (err) {
        // fallback below
      }
    }

    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const viewPrescription = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const splitMedicineEntries = (value) => {
    if (!value && value !== 0) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'object') {
      if (Array.isArray(value.medicines)) return value.medicines.filter(Boolean);
      if (Array.isArray(value.medications)) return value.medications.filter(Boolean);
      if (Array.isArray(value.items)) return value.items.filter(Boolean);
      if (Array.isArray(value.drugs)) return value.drugs.filter(Boolean);
      if (typeof value.text === 'string') return splitMedicineEntries(value.text);
      return [];
    }

    const text = String(value).trim();
    if (!text) return [];

    const entries = text.split(/\n|\r|;|\|/).map((item) => item.trim()).filter(Boolean);
    if (entries.length > 1) return entries;

    return [text];
  };

  const normalizePrescriptionNote = (note, medicineName = '') => {
    const value = String(note || '').trim();
    if (!value) return '';

    const normalized = value.replace(/\s+/g, ' ').trim();
    const lower = normalized.toLowerCase();
    if (/\b(after\s+food|before\s+food|with\s+water|at\s+bedtime|morning\s+only|evening\s+only|night\s+only|after\s+meals|before\s+meals|complete\s+full\s+course|continue\s+full\s+course|take\s+as\s+directed|as\s+directed|continue\s+medication)\b/i.test(lower)) {
      return '';
    }

    const nameLower = String(medicineName || '').trim().toLowerCase();
    if (nameLower && (lower === nameLower || lower === `${nameLower} ${nameLower}`)) {
      return '';
    }

    return normalized;
  };

  const extractMedicineFieldsFromString = (text) => {
    const source = String(text || '').trim();
    if (!source) return null;

    const quantityMatch = source.match(/\b\d+\s*(?:tabs?|tablets?|capsules?|caps|ml|mg|g|pills?|strip|pack|dose(?:s)?|qty|x)\b/i);
    const frequencyMatch = source.match(/\b(?:\d[- ]\d[- ]\d(?:[- ]\d)?|every\s+\d+\s*(?:hours?|hrs?)|once\s+daily|twice\s+daily|thrice\s+daily|od|bd|tds|hs|morning|evening|night|bedtime|after\s+food|before\s+food)\b/i);
    const durationMatch = source.match(/\b(?:\d+\s*(?:days?|weeks?|months?)|course(?:\s+days)?|treatment\s+duration|course\s+of\s+\d+)\b/i);
    const dosageMatch = source.match(/\b\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|units?|tablet|tab|capsule|cap|sachet|dose)\b/i);

    const quantity = quantityMatch ? quantityMatch[0] : '';
    const frequency = frequencyMatch ? frequencyMatch[0] : '';
    const duration = durationMatch ? durationMatch[0] : '';
    const dosage = dosageMatch ? dosageMatch[0] : '';

    let name = source;
    [quantity, frequency, duration, dosage].forEach((token) => {
      if (token) name = name.replace(token, '');
    });
    name = name.replace(/[:,;\-\|]+/g, ' ').replace(/\b(after|before|with|and|for|daily|once|twice|thrice|take|tab|tablet|capsule|cap|dose)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!name) {
      name = source;
    }

    const rawNotes = source
      .split(/[,;\n\r]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => {
        const lower = item.toLowerCase();
        return ![quantity, frequency, duration, dosage].some((token) => token && lower.includes(token.toLowerCase()));
      })
      .filter((item) => {
        const lower = item.toLowerCase();
        return !/\b(after\s+food|before\s+food|with\s+water|at\s+bedtime|morning\s+only|evening\s+only|night\s+only|after\s+meals|before\s+meals)\b/i.test(lower);
      });

    const notes = rawNotes.length > 1 ? rawNotes.slice(1).join(', ') : rawNotes.slice(0, 1).join(', ');

    return {
      name,
      dosage,
      quantity,
      frequency,
      duration,
      notes,
      instructions: notes || '',
    };
  };

  const normalizeMedicineList = (value) => {
    const entries = splitMedicineEntries(value);
    return entries.map((item) => item && typeof item === 'string' ? item.trim() : item).filter(Boolean);
  };

  const parseMedicineEntry = (medicine, index, record) => {
    if (typeof medicine === 'string') {
      const parsed = extractMedicineFieldsFromString(medicine);
      const displayName = parsed?.name || String(medicine);
      return {
        ...parsed,
        name: displayName,
        notes: normalizePrescriptionNote(parsed?.notes, displayName),
      };
    }

    if (medicine && typeof medicine === 'object') {
      const primaryName =
        readFirst(medicine, ['name', 'medicineName', 'drugName', 'title', 'itemName', 'label']) ||
        readFirst(medicine, ['medicine', 'medication']) ||
        '';
      const parsedFromName = extractMedicineFieldsFromString(primaryName);
      const displayName = primaryName || parsedFromName?.name || `Medicine ${index + 1}`;
      const rawNotes =
        readFirst(medicine, ['notes', 'note', 'remark', 'remarks', 'comments', 'instructionNotes', 'specialInstructions', 'additionalNotes', 'advice', 'adviceNotes']) ||
        parsedFromName?.notes ||
        '';
      const notes = normalizePrescriptionNote(rawNotes, displayName);
      const rawInstructions =
        readFirst(medicine, ['instructions', 'instruction', 'notes', 'frequency', 'timing', 'duration']) ||
        parsedFromName?.instructions ||
        readFirst(record, ['instructions', 'instruction', 'notes']) ||
        '';

      return {
        ...parsedFromName,
        ...medicine,
        name: displayName,
        dosage:
          readFirst(medicine, ['dosage', 'dose', 'strength', 'quantity', 'qty']) ||
          parsedFromName?.dosage ||
          readFirst(record, ['dosage', 'dose']) ||
          'Dosage not recorded',
        quantity:
          readFirst(medicine, ['quantity', 'qty', 'count', 'pack', 'units', 'quantityValue', 'pillCount', 'pill_count', 'doseCount', 'doseQty']) ||
          parsedFromName?.quantity ||
          '',
        frequency:
          readFirst(medicine, ['frequency', 'freq', 'timing', 'when', 'doseFrequency', 'frequencyText', 'timings', 'howOften', 'doseTiming', 'schedule']) ||
          parsedFromName?.frequency ||
          '',
        duration:
          readFirst(medicine, ['duration', 'days', 'course', 'period', 'durationDays', 'courseDays', 'treatmentDuration', 'courseDuration']) ||
          parsedFromName?.duration ||
          '',
        notes,
        instructions: normalizePrescriptionNote(rawInstructions, displayName) || rawInstructions,
      };
    }

    return {
      name: String(medicine || `Medicine ${index + 1}`),
      dosage: readFirst(record, ['dosage', 'dose']) || 'Dosage not recorded',
      instructions: readFirst(record, ['instructions', 'instruction', 'notes']) || 'Instructions not recorded',
    };
  };

  const getDoctorDetails = (record) => {
    const name =
      readFirst(record, [
        'doctorName',
        'doctor.name',
        'provider.name',
        'practitionerName',
        'prescribedBy',
        'provider.displayName',
      ]) || 'Doctor details unavailable';
    const specialty = readFirst(record, ['doctorSpecialty', 'doctor.specialty', 'specialty', 'department', 'departmentName']);
    const phone = readFirst(record, ['doctorPhone', 'doctor.phone', 'doctor.mobile', 'contact', 'contactNumber']);
    return [name, specialty, phone].filter(Boolean).join(' | ');
  };

  const getDiagnosis = (record) =>
    readFirst(record, ['diagnosis', 'condition', 'summary', 'title', 'description', 'provisionalDiagnosis', 'dx']) ||
    'Diagnosis not recorded';

  const getMedicineList = (record) => {
    const rawMedicines =
      Array.isArray(record.medicines) && record.medicines.length
        ? record.medicines
        : Array.isArray(record.medications) && record.medications.length
        ? record.medications
        : Array.isArray(record.medicineList) && record.medicineList.length
        ? record.medicineList
        : Array.isArray(record.prescribedMedicines) && record.prescribedMedicines.length
        ? record.prescribedMedicines
        : normalizeMedicineList(record.medicineNames || record.medicines || record.medications || record.medicineList || record.prescribedMedicines || record.items || record.drugs);

    return rawMedicines.map((medicine, index) => parseMedicineEntry(medicine, index, record));
  };
  // extend medicine objects with quantity, frequency, duration, notes when available
  const enrichMedicine = (medicine = {}) => {
    const rawFreq = readFirst(medicine, ['frequency', 'freq', 'timing', 'when', 'doseFrequency', 'frequencyText', 'timings', 'howOften', 'doseTiming', 'schedule']);
    const frequency = Array.isArray(rawFreq) ? rawFreq.join('-') : rawFreq || '';
    const rawDuration = readFirst(medicine, ['duration', 'days', 'course', 'period', 'durationDays', 'courseDays', 'treatmentDuration', 'courseDuration']);
    const duration = rawDuration || '';
    const qty =
      readFirst(medicine, ['quantity', 'qty', 'count', 'pack', 'units', 'quantityValue', 'pillCount', 'pill_count', 'doseCount', 'doseQty']) ||
      (medicine.dosage && /\d+/.test(String(medicine.dosage)) ? String((String(medicine.dosage).match(/\d+/) || [''])[0]) : '');
    return {
      ...medicine,
      quantity: qty,
      frequency,
      duration,
      notes:
        readFirst(medicine, [
          'notes',
          'note',
          'remark',
          'remarks',
          'comments',
          'instructionNotes',
          'specialInstructions',
          'additionalNotes',
          'advice',
          'adviceNotes',
        ]) || medicine.instructions || '',
    };
  };



  return (
    <PatientPageShell
      title="Prescriptions"
      subtitle="Doctor details, diagnosis, medicine list, dosage, and instructions."
    >
      <div className="pd-card">
        <div className="pd-section-header">
          <div>
            <h2>Prescription Records</h2>
            <p>Current and historical prescriptions.</p>
          </div>
        </div>

        {/* debug panel removed */}

        {!prescriptionRecords.length ? (
          <div className="pd-prescription-empty-note">
            <p>No prescriptions found. The prescription format is ready below.</p>
          </div>
        ) : null}

        {prescriptionRecords.length ? (
          <div className="pd-prescription-list">
            {prescriptionRecords.map((prescription, index) => {
              const date = formatDate(prescription);
              const title = getTitle(prescription);
              const doctorDetails = getDoctorDetails(prescription);
              const diagnosis = getDiagnosis(prescription);
              const medicines = getMedicineList(prescription);
              const downloadUrl = getDownloadUrl(prescription);
              // runtime debug removed

              return (
                <div className="pd-prescription-card" key={prescription.prescriptionId || prescription.id || prescription.appointmentId || index}>
                  <div className="pd-prescription-copy">
                    <span className="pd-prescription-date">{date}</span>
                    <h3>{diagnosis || title}</h3>
                    <div className="pd-prescription-detail-grid">
                      <div>
                        <span>Doctor Details</span>
                        <strong>{doctorDetails}</strong>
                      </div>
                      <div>
                        <span>Diagnosis</span>
                        <strong>{diagnosis || title}</strong>
                      </div>
                    </div>
                    <div className="pd-medicine-table">
                      <div className="pd-medicine-table-head">
                        <span>Medicine</span>
                        <span>Dosage</span>
                        <span>Quantity</span>
                        <span>Frequency</span>
                        <span>Duration</span>
                        <span>Notes</span>
                      </div>
                      {medicines.length ? medicines.map((rawMed, medicineIndex) => {
                        const medicine = enrichMedicine(rawMed);
                        return (
                          <div className="pd-medicine-row" key={`${medicine.name}-${medicineIndex}`}>
                            <strong>{medicine.name}</strong>
                            <span>{medicine.dosage}</span>
                            <span>{medicine.quantity || '-'}</span>
                            <span>{medicine.frequency || '-'}</span>
                            <span>{medicine.duration || '-'}</span>
                            <span>{medicine.notes || '-'}</span>
                          </div>
                        );
                      }) : (
                        <div className="pd-medicine-empty">No medicines recorded.</div>
                      )}
                    </div>
                  </div>
                  <div className="pd-prescription-actions">
                    <button
                      type="button"
                      className="pd-prescription-btn pd-prescription-btn--ghost"
                      onClick={() => downloadPrescription(downloadUrl, prescription)}
                      disabled={!(downloadUrl || prescription)}
                    >
                      <Download size={15} />
                      Download PDF
                    </button>
                    <button
                      type="button"
                      className="pd-prescription-btn pd-prescription-btn--primary"
                      onClick={() => sharePrescription(downloadUrl, title, prescription)}
                      disabled={!(downloadUrl || prescription)}
                    >
                      <Share2 size={15} />
                      Share
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pd-selected-notification">
            <p>No prescriptions found.</p>
          </div>
        )}
      </div>
    </PatientPageShell>
  );
}

function PatientBillsPage({ bills = [], patient = null, visits = [] }) {
  const [apiBills, setApiBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const billRecords = useMemo(() => {
    let recentServiceBills = [];
    try {
      const stored = JSON.parse(localStorage.getItem("receptionRecentServiceBills") || "[]");
      recentServiceBills = Array.isArray(stored) ? stored : [];
    } catch {
      recentServiceBills = [];
    }

    return dedupeBillsByInvoice([...bills, ...apiBills, ...recentServiceBills])
      .filter((bill) => billBelongsToPatient(bill, patient || {}, visits));
  }, [apiBills, bills, patient, visits]);

  useEffect(() => {
    let isCurrent = true;
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const loadSubmittedBills = async () => {
      setLoadingBills(true);
      try {
        const patientIds = Array.from(getPatientIdentityValues(patient || {}, visits));
        const primaryPatientId = patientIds[0] || localStorage.getItem("patientId") || "";
        const billingPaths = [
          PATIENT_API.bills,
          "Billing",
          primaryPatientId ? `Billing/patient/${encodeURIComponent(primaryPatientId)}` : "",
          primaryPatientId ? `Billing/by-patient/${encodeURIComponent(primaryPatientId)}` : "",
          primaryPatientId ? `Billing?patientId=${encodeURIComponent(primaryPatientId)}` : "",
          primaryPatientId ? `Billing?PatientId=${encodeURIComponent(primaryPatientId)}` : "",
        ].filter(Boolean);
        const responses = await Promise.allSettled(
          billingPaths.map((path) => fetch(path === PATIENT_API.bills ? patientApiUrl(path) : apiUrl(path), { headers }))
        );
        const lists = await Promise.all(responses.map(async (result) => {
          if (result.status !== "fulfilled" || !result.value?.ok) return [];
          const data = await result.value.json().catch(() => []);
          return parseApiList(data);
        }));
        if (isCurrent) setApiBills(dedupeBillsByInvoice(lists.flat()));
      } finally {
        if (isCurrent) setLoadingBills(false);
      }
    };

    loadSubmittedBills();
    const refresh = () => {
      if (document.visibilityState === "visible") loadSubmittedBills();
    };
    window.addEventListener("focus", loadSubmittedBills);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      isCurrent = false;
      window.removeEventListener("focus", loadSubmittedBills);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [patient, visits]);
  const formatAmount = (value) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));

  const formatDate = (record) =>
    readFirst(record, ['invoiceDate', 'billDate', 'date', 'createdAt', 'createdOn', 'updatedAt']) || 'Unknown date';

  const invoiceNumber = (record) =>
    readFirst(record, ['invoiceNo', 'invoiceNumber', 'billNo', 'billNumber', 'referenceNumber', 'transactionId', 'id']) || 'Invoice';

  const billTypeLabel = (record) => {
    const rawType = String(readFirst(record, ['invoiceType', 'billingType', 'type', 'serviceType', 'category']) || '').toLowerCase();
    if (rawType.includes('pharmacy') || rawType.includes('medicine')) return 'Pharmacy';
    if (rawType.includes('diagnostic') || rawType.includes('diagnosis') || rawType.includes('lab') || rawType.includes('test')) return 'Diagnostic';
    if (getConsultationFee(record) > 0 || rawType.includes('consult')) return 'OP Bill';
    const hasLab = Number(readFirst(record, ['labCharge', 'labCharges', 'laboratoryCharges']) || 0) > 0;
    const hasMedicine = Number(readFirst(record, ['medicineCharge', 'medicineCharges', 'medicationCharges']) || 0) > 0;
    if (hasLab && !hasMedicine) return 'Diagnostic';
    if (hasMedicine && !hasLab) return 'Pharmacy';
    return 'OP Bill';
  };

  const getPatientName = (record) => {
    const rawName = readFirst(record, [
      'patientName',
      'patient.name',
      'patient.fullName',
      'patient.firstName',
      'patient.lastName',
      'patientName',
      'customerName',
      'name',
    ]);
    if (typeof rawName === 'string' && rawName.trim()) return rawName.trim();
    if (typeof rawName === 'object' && rawName !== null) {
      return (
        readFirst(rawName, ['fullName', 'name', 'firstName', 'lastName']) || ''
      ).trim();
    }
    return invoiceNumber(record);
  };

  const getAppointmentNumber = (record) =>
    readFirst(record, ['appointmentNumber', 'appointmentNo', 'appointmentId', 'appointment.id', 'appointment_id']) || '-';

  const getConsultationFee = (record) =>
    Number(
      readFirst(record, [
        'consultationCharges',
        'consultationCharge',
        'consultationFee',
        'consultationAmount',
        'consultation',
      ]) || 0
    );

  const doctorLabel = (record) => {
    const doctorName = readFirst(record, ['doctorName', 'doctor.name', 'provider.name', 'physician']);
    const department = readFirst(record, ['specialty', 'department', 'departmentName']);
    const details = [doctorName, department].filter(Boolean).join(' with ');
    return details || 'Billing details unavailable';
  };

  const paymentMode = (record) =>
    readFirst(record, ['paymentMode', 'paymentType', 'mode', 'method']) || 'Not specified';

  const normalizePaymentMode = (value) => String(value).toLowerCase().replace(/\s+/g, '');

  const displayPaymentMode = (record) => {
    const mode = paymentMode(record);
    const normalizedMode = normalizePaymentMode(mode);
    return normalizedMode === 'online' || normalizedMode === 'netbanking' ? 'Netbanking' : mode;
  };

  const paymentStatus = (record) =>
    String(readFirst(record, ['status', 'paymentStatus', 'billStatus']) || 'Pending').toLowerCase();

  const totalAmount = (record) => Number(readFirst(record, ['total', 'totalAmount', 'amount', 'invoiceAmount', 'grandTotal', 'payableAmount', 'paymentAmount', 'paidAmount', 'netAmount', 'dueAmount', 'totals.total']) || 0);
  const dueAmount = (record) => Number(readFirst(record, ['dueAmount', 'balance', 'outstandingAmount']) || 0);

  const getLineItems = (record) => {
    if (Array.isArray(record.lineItems) && record.lineItems.length) return record.lineItems;
    if (Array.isArray(record.rows) && record.rows.length) {
      return record.rows.map((row) => ({
        label: readFirst(row, ['item', 'name', 'test', 'medicine', 'diagnosis']) || 'Service item',
        amount: (Number(readFirst(row, ['unitPrice', 'price', 'rate', 'amount']) || 0) || 0) * (Number(readFirst(row, ['quantity', 'qty']) || 1) || 1),
      }));
    }
    const serviceItems = record.serviceItems || record.billItems || record.items || record.billingItems;
    if (Array.isArray(serviceItems) && serviceItems.length) {
      return serviceItems.map((row) => ({
        label: readFirst(row, ['item', 'name', 'test', 'medicine', 'diagnosis']) || 'Service item',
        amount: readFirst(row, ['amount', 'total', 'netAmount']) || ((Number(readFirst(row, ['unitPrice', 'price', 'rate']) || 0) || 0) * (Number(readFirst(row, ['quantity', 'qty']) || 1) || 1)),
      }));
    }
    if (record.charges && typeof record.charges === 'object') {
      return Object.entries(record.charges).map(([label, amount]) => ({ label, amount }));
    }
    return [
      { label: 'Consultation charges', amount: readFirst(record, ['consultationCharges', 'consultationCharge']) },
      { label: 'Lab charges', amount: readFirst(record, ['labCharge', 'labCharges', 'laboratoryCharges']) },
      { label: 'Medicine charges', amount: readFirst(record, ['medicineCharge', 'medicineCharges', 'medicationCharges']) },
      { label: 'Other charges', amount: readFirst(record, ['otherCharges', 'miscCharges', 'serviceCharges']) },
    ].filter((item) => item.amount != null && item.amount !== '');
  };

  const paymentUrl = (record) =>
    readFirst(record, ['paymentUrl', 'payUrl', 'checkoutUrl', 'paymentLink', 'paymentGatewayUrl']) || '';

  const getApiHeaders = () => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const resolveInvoiceUrl = (value) => {
    if (!value && value !== 0) return '';
    if (typeof value === 'string') {
      return value.trim();
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const result = resolveInvoiceUrl(item);
        if (result) return result;
      }
      return '';
    }
    if (typeof value === 'object') {
      const url = readFirst(value, [
        'invoiceUrl',
        'downloadUrl',
        'documentUrl',
        'pdfUrl',
        'fileUrl',
        'url',
        'link',
        'path',
        'invoice.fileUrl',
        'invoice.downloadUrl',
        'invoice.documentUrl',
        'invoice.pdfUrl',
        'document.fileUrl',
        'document.downloadUrl',
        'document.pdfUrl',
        'file.url',
        'invoice.link',
        'document.link',
      ]);
      if (url) return resolveInvoiceUrl(url);

      return (
        resolveInvoiceUrl(value.invoice) ||
        resolveInvoiceUrl(value.document) ||
        resolveInvoiceUrl(value.file) ||
        resolveInvoiceUrl(value.pdf) ||
        resolveInvoiceUrl(value.download)
      );
    }
    return '';
  };

  const invoiceUrl = (record) => resolveInvoiceUrl(record) || '';

  const getInvoiceId = (record) =>
    readFirst(record, ['invoiceId', 'billId', 'billingId', 'id', '_id', 'referenceId']);

  const getBillDetailUrl = (billId) =>
    patientApiUrl(`patient-portal/bills/${encodeURIComponent(billId)}`);

  const getInvoiceSourceUrl = async (record) => {
    const directUrl = invoiceUrl(record);
    if (directUrl) return directUrl;

    const invoiceId = getInvoiceId(record);
    if (!invoiceId) return '';

    const billDetailUrl = getBillDetailUrl(invoiceId);
    const response = await fetch(billDetailUrl, { headers: getApiHeaders() }).catch(() => null);
    if (!response?.ok) return '';

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('pdf') || contentType.includes('octet-stream') || contentType.includes('binary')) {
      return billDetailUrl;
    }

    const data = await response.json().catch(() => null);
    if (!data) return '';

    return resolveInvoiceUrl(data) || resolveInvoiceUrl(data.invoice) || resolveInvoiceUrl(data.document) || '';
  };

  const getPrintableInvoiceHtml = (record, { autoPrint = true } = {}) => {
    const invoiceNumberValue = invoiceNumber(record);
    const patientName = readFirst(record, ['patientName', 'patient.name', 'name', 'customerName']) || 'Patient';
    const doctorName = readFirst(record, ['doctorName', 'doctor.name', 'provider.name', 'physician']) || 'Doctor';
    const appointmentNumber = readFirst(record, ['appointmentNumber', 'appointmentNo', 'appointmentId', 'appointment.id']) || '-';
    const billDate = formatDate(record);
    const total = formatAmount(totalAmount(record));
    const due = formatAmount(dueAmount(record));
    const paymentModeValue = displayPaymentMode(record);
    const statusValue = paymentStatus(record) === 'paid' ? 'Paid' : 'Pending';
    const lineItems = getLineItems(record);
    const clinicName = readFirst(record, ['clinicName', 'hospitalName', 'branchName', 'clinic.name', 'hospital.name', 'branch.name']) || 'Clinic';
    const watermarkUrl = getClinicWatermarkSvg(clinicName);

    const lineRows = lineItems.length
      ? lineItems.map((item) => `
          <tr>
            <td>${item.label}</td>
            <td style="text-align:right;">${formatAmount(item.amount)}</td>
          </tr>
        `).join('')
      : `
          <tr>
            <td>Description</td>
            <td style="text-align:right;">${total}</td>
          </tr>
        `;

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Invoice ${invoiceNumberValue}</title>
          <style>
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f5f7fb; color: #0f172a; }
            .invoice { max-width: 780px; margin: 0 auto; padding: 32px; background: #ffffff; position: relative; overflow: hidden; }
            .invoice > *:not(.watermark) { position: relative; z-index: 1; }
            .watermark { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; z-index: 0; }
            .watermark img { width: 410px; height: 410px; object-fit: contain; opacity: .18; filter: saturate(1.35) contrast(1.08); }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
            .clinic-title { display: flex; align-items: center; gap: 12px; }
            .clinic-title img { width: 54px; height: 54px; object-fit: contain; border-radius: 12px; }
            .header h1 { margin: 0; font-size: 24px; }
            .meta { text-align: right; }
            .meta span { display: block; margin-bottom: 4px; color: #475569; font-size: 13px; }
            .section { margin-bottom: 24px; }
            .section h2 { margin: 0 0 12px; font-size: 14px; color: #0f172a; letter-spacing: .8px; text-transform: uppercase; }
            .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
            .info-card { padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; }
            .info-card strong { display: block; font-size: 15px; margin-top: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { padding: 14px 12px; border-bottom: 1px solid #e2e8f0; }
            th { text-align: left; background: #111827; color: white; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
            td:last-child { text-align: right; }
            .summary { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 18px; background: #111827; color: #ffffff; border-radius: 12px; }
            .summary div { font-size: 16px; }
            .footer { margin-top: 32px; font-size: 12px; color: #475569; }
            @media print {
              body { background: #ffffff; }
              .invoice { box-shadow: none; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="invoice">
            <div class="watermark"><img src="${watermarkUrl}" alt="" /></div>
            <div class="header">
              <div>
                <div class="clinic-title">
                  <img src="${watermarkUrl}" alt="Clinic logo" />
                  <h1>${clinicName}</h1>
                </div>
                <p style="margin:4px 0 0;color:#475569;">${invoiceNumberValue}</p>
              </div>
              <div class="meta">
                <span>Date: ${billDate}</span>
                <span>Status: ${statusValue}</span>
                <span>Payment: ${paymentModeValue}</span>
              </div>
            </div>
            <div class="info-grid">
              <div class="info-card">
                <strong>Patient</strong>
                <span>${patientName}</span>
                <span>Appointment: ${appointmentNumber}</span>
              </div>
              <div class="info-card">
                <strong>Doctor</strong>
                <span>${doctorName}</span>
              </div>
            </div>
            <div class="section">
              <h2>Line Items</h2>
              <table>
                <thead>
                  <tr><th>Description</th><th>Amount</th></tr>
                </thead>
                <tbody>${lineRows}</tbody>
              </table>
            </div>
            <div class="summary">
              <div>Total Amount</div>
              <div>${total}</div>
            </div>
            <div class="footer">
              <p>Thank you for choosing our clinic. Please retain this invoice for your records.</p>
            </div>
          </div>
          <script>
            ${autoPrint ? "window.onload = function() { window.print(); };" : ""}
          </script>
        </body>
      </html>`;
  };

  const viewInvoice = async (record, directUrl = '') => {
    const url = directUrl || (await getInvoiceSourceUrl(record));
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setDownloadError('Please allow popups to view the invoice.');
      return;
    }
    printWindow.document.write(getPrintableInvoiceHtml(record, { autoPrint: false }));
    printWindow.document.close();
  };

  const downloadInvoice = async (record, directUrl = '', filename = '') => {
    const url = directUrl || (await getInvoiceSourceUrl(record));
    if (!url) {
      setDownloadStatus('Invoice is being prepared for PDF download.');
      setDownloadError('');
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setDownloadStatus('');
        setDownloadError('Please allow popups to download the invoice PDF.');
        return;
      }
      printWindow.document.write(getPrintableInvoiceHtml(record, { autoPrint: true }));
      printWindow.document.close();
      return;
    }

    setDownloadStatus('');
    setDownloadError('');

    try {
      const response = await fetch(url, { headers: getApiHeaders() });
      if (!response.ok) throw new Error('Unable to download invoice.');
      const blob = await response.blob();
      const downloadName = filename || url.split('/').pop().split('?')[0] || 'invoice.pdf';
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setDownloadStatus('Invoice downloaded successfully.');
    } catch (error) {
      setDownloadError('Unable to download invoice. Please try again.');
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const payLabel = (record) => {
    const mode = displayPaymentMode(record);
    return paymentUrl(record) ? `Pay by ${mode}` : 'Payment unavailable';
  };

  const payInvoice = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const latestBill = billRecords[0] || {};
  const latestLineItems = getLineItems(latestBill);
  const latestTotal = totalAmount(latestBill);
  const latestStatus = paymentStatus(latestBill);
  const latestPatientName = getPatientName(latestBill) || 'Patient';
  const latestPaymentMode = billRecords.length ? displayPaymentMode(latestBill) : 'UPI';
  const selectedAppointment = billRecords.length ? getAppointmentNumber(latestBill) : 'No billable appointments found';
  const latestBillNumber = invoiceNumber(latestBill);
  const latestAppointmentNumber = getAppointmentNumber(latestBill);
  const latestConsultationFee = getConsultationFee(latestBill);
  const latestLabCharges = readFirst(latestBill, ['labCharges', 'laboratoryCharges']) || 0;
  const latestMedicineCharges = readFirst(latestBill, ['medicineCharges', 'medicationCharges']) || 0;
  const latestGst = readFirst(latestBill, ['gst', 'tax', 'gstAmount', 'taxAmount']) || 0;
  const latestOtherCharges = Number(
    readFirst(latestBill, ['otherCharges', 'miscCharges', 'serviceCharges', 'additionalCharges']) || 0
  );
  const latestSummaryLineItems = [
    { label: 'Consultation Fee', amount: latestConsultationFee },
    { label: 'Lab Charges', amount: latestLabCharges },
    { label: 'Medicine Charges', amount: latestMedicineCharges },
    { label: 'GST / Tax', amount: latestGst },
    { label: 'Other Charges', amount: latestOtherCharges },
  ].filter((item) => item.amount != null && Number(item.amount) !== 0);
  const paymentOptions = ['UPI', 'Card', 'Netbanking'];
  const statusOptions = ['Paid', 'Pending', 'Refunded'];
  const totalBillsAmount = billRecords.reduce((sum, bill) => sum + totalAmount(bill), 0);
  const totalDueAmount = billRecords.reduce((sum, bill) => sum + (dueAmount(bill) || 0), 0);
  const totalPaidAmount = billRecords.reduce((sum, bill) => sum + ((paymentStatus(bill) === 'paid') ? totalAmount(bill) : 0), 0);

  return (
    <PatientPageShell
      title="Billing"
      subtitle="Review charges, invoices, and pending payments."
    >
      {/* Billing summary cards */}
      <div className="pb-summary-grid">
        <div className="pb-summary-card">
          <span className="pb-summary-title">Patient</span>
          <strong>{latestPatientName || 'N/A'}</strong>
          <p>Active patient on file</p>
        </div>
        <div className="pb-summary-card">
          <span className="pb-summary-title">Latest Bill</span>
          <strong>{latestBillNumber || 'N/A'}</strong>
          <p>Appointment: {latestAppointmentNumber || 'N/A'}</p>
        </div>
        <div className="pb-summary-card">
          <span className="pb-summary-title">Billing Status</span>
          <strong>{latestStatus === 'paid' ? 'Paid' : 'Pending'}</strong>
          <p>{billRecords.length} invoice{billRecords.length === 1 ? '' : 's'}</p>
        </div>
        <div className="pb-summary-card pb-info-item--total">
          <span className="pb-summary-title">Total Outstanding</span>
          <strong>{formatAmount(totalDueAmount)}</strong>
          <p>Due amount across all invoices</p>
        </div>
      </div>

      <div className="pb-billing-layout">
        <section className="pb-generate-card">
          <div className="pb-billing-header">
            <div>
              <h2>Hospital Bill Summary</h2>
              <p>All charges and invoice details are shown in a single summary.</p>
            </div>
            <span className="pb-billing-icon">
              <FileText size={30} />
            </span>
          </div>

          <div className="pb-bill-details-grid">
            <div className="pb-bill-detail">
              <span>Patient</span>
              <strong>{latestPatientName || 'N/A'}</strong>
            </div>
            <div className="pb-bill-detail">
              <span>Bill Number</span>
              <strong>{latestBillNumber || 'N/A'}</strong>
            </div>
            <div className="pb-bill-detail">
              <span>Appointment Number</span>
              <strong>{selectedAppointment || 'N/A'}</strong>
            </div>
            <div className="pb-bill-detail">
              <span>Status</span>
              <strong>{latestStatus === 'paid' ? 'Paid' : 'Pending'}</strong>
            </div>
          </div>

          <div className="pb-charge-summary">
            <span>Latest Invoice Total</span>
            <strong>{formatAmount(latestTotal)}</strong>
          </div>

          <div className="pb-payment-actions">
            <button
              type="button"
              className="pb-action-btn pb-action-btn--ghost"
              onClick={() => viewInvoice(latestBill, invoiceUrl(latestBill))}
              disabled={!billRecords.length}
            >
              View Invoice
            </button>
            <button
              type="button"
              className="pb-action-btn pb-action-btn--primary"
              onClick={() => downloadInvoice(latestBill, '', `${invoiceNumber(latestBill)}.pdf`)}
              disabled={!billRecords.length}
            >
              Download Invoice
            </button>
            {downloadStatus ? (
              <div className="pb-download-message pb-download-message--success">{downloadStatus}</div>
            ) : null}
            {downloadError ? (
              <div className="pb-download-message pb-download-message--error">{downloadError}</div>
            ) : null}
          </div>
        </section>

        <aside className="pb-latest-card">
          <h2>Latest Invoice</h2>
          <div className="pb-latest-invoice">
            <div>
              <strong>{latestPatientName}</strong>
              <span>Invoice generated</span>
              <span>Status: {latestStatus === 'paid' ? 'Paid' : 'Pending'}</span>
            </div>
            <div className="pb-latest-lines">
              {(latestLineItems.length ? latestLineItems : [{ label: 'Total', amount: latestTotal }]).map((item, index) => (
                <div className="pb-latest-line" key={`${item.label}-${index}`}>
                  <span>{item.label}</span>
                  <strong>{formatAmount(item.amount)}</strong>
                </div>
              ))}
              <div className="pb-latest-line pb-latest-line--total">
                <span>Total</span>
                <strong>{formatAmount(latestTotal)}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {billRecords.length ? (
        <div className="pb-bills-overview">
          <div className="pb-invoice-list">
            <h3>Recent Bills</h3>
            {loadingBills ? <p className="pb-download-message">Refreshing latest submitted bills...</p> : null}
            <div className="pb-table-wrap">
              <table className="pb-recent-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice #</th>
                    <th>Doctor / Clinic</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {billRecords.map((bill, index) => {
                    const status = paymentStatus(bill);
                    const total = totalAmount(bill);
                    const invoiceLink = invoiceUrl(bill);
                    return (
                      <tr key={bill.id || bill.invoiceNumber || index}>
                        <td>{formatDate(bill)}</td>
                        <td>{invoiceNumber(bill)}</td>
                        <td>{doctorLabel(bill)}</td>
                        <td>{billTypeLabel(bill)}</td>
                        <td>{formatAmount(total)}</td>
                        <td><span className={`pb-status-badge pb-status-badge--${status === 'paid' ? 'paid' : 'pending'}`}>{status === 'paid' ? 'Paid' : 'Pending'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="pb-action-btn pb-action-btn--ghost"
                              onClick={() => viewInvoice(bill, invoiceLink)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="pb-action-btn pb-action-btn--ghost"
                              onClick={() => downloadInvoice(bill, invoiceLink, `${invoiceNumber(bill)}.pdf`)}
                            >
                              Download
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="pb-total-card">
            <span>Payment Summary</span>
            <strong>{formatAmount(totalBillsAmount)}</strong>
            <p>{billRecords.length} invoice{billRecords.length === 1 ? '' : 's'} included</p>
            <div style={{ marginTop: 12 }}>
              <div className="pb-info-item">
                <span>Paid</span>
                <strong>{formatAmount(totalPaidAmount)}</strong>
              </div>
              <div style={{ height: 8 }} />
              <div className="pb-info-item">
                <span>Outstanding</span>
                <strong>{formatAmount(totalDueAmount)}</strong>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>Need Help?</h4>
              <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 13 }}>Contact billing support at <a href="mailto:billing@hospital.example">billing@hospital.example</a> or call +91-99999-99999</p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="pd-selected-notification">
          <p>No bills available.</p>
        </div>
      )}
    </PatientPageShell>
  );
}

function PatientNotificationsPage({ notifications = [] }) {
  const notificationTypes = PATIENT_NOTIFICATION_TYPES;

  const defaultNotifications = useMemo(() => notificationTypes.map((type, index) => ({
    id: `default-${index}`,
    title: type,
    message: `${type} notification will be shown here when available.`,
    date: 'No date',
    type,
    read: true,
    url: '',
  })), [notificationTypes]);

  const normalizeNotification = useCallback((notification, index) => {
    const title = readFirst(notification, ['title', 'subject', 'name']) || notificationTypes[index % notificationTypes.length];
    const message = readFirst(notification, ['message', 'body', 'description', 'content']) || 'Notification details will appear here.';
    const date = readFirst(notification, ['date', 'createdAt', 'scheduledAt', 'time']) || 'No date';
    const rawType = readFirst(notification, ['type', 'category', 'notificationType']);
    const searchable = `${rawType} ${title} ${message}`.toLowerCase();
    const type =
      notificationTypes.find((item) => searchable.includes(item.toLowerCase().replace('-', ''))) ||
      (searchable.includes('appointment') ? 'Appointment Reminder' : '') ||
      (searchable.includes('prescription') ? 'Prescription Ready' : '') ||
      (searchable.includes('bill') || searchable.includes('invoice') ? 'Bill Generated' : '') ||
      (searchable.includes('follow') ? 'Follow-up Reminder' : '') ||
      notificationTypes[index % notificationTypes.length];

    return {
      ...notification,
      id: notification.id || notification.notificationId || `notification-${index}`,
      title,
      message,
      date,
      type,
      read: Boolean(notification.read || notification.isRead),
      url: readFirst(notification, ['url', 'link', 'actionUrl', 'documentUrl']),
    };
  }, [notificationTypes]);

  const [notificationRows, setNotificationRows] = useState(() =>
    (notifications.length ? notifications : defaultNotifications).map(normalizeNotification)
  );
  const [selectedNotification, setSelectedNotification] = useState(null);

  useEffect(() => {
    setNotificationRows((notifications.length ? notifications : defaultNotifications).map(normalizeNotification));
    setSelectedNotification(null);
  }, [defaultNotifications, normalizeNotification, notifications]);

  const viewNotification = (notification) => {
    setSelectedNotification(notification);
    if (notification.url) {
      window.open(notification.url, '_blank', 'noopener,noreferrer');
    }
  };

  const markNotificationAsRead = (notificationId) => {
    setNotificationRows((rows) =>
      rows.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      )
    );
  };

  const deleteNotification = (notificationId) => {
    setNotificationRows((rows) => rows.filter((notification) => notification.id !== notificationId));
    setSelectedNotification((notification) => (notification?.id === notificationId ? null : notification));
  };

  return (
    <PatientPageShell
      title="Notifications"
      subtitle="Appointment reminders, prescription updates, bills, and follow-up reminders."
    >
      <div className="pd-card">
        <div className="pd-section-header">
          <div>
            <h2>Notification Types</h2>
            <p>Appointment Reminder, Prescription Ready, Bill Generated, and Follow-up Reminder.</p>
          </div>
        </div>
        <div className="pd-notification-type-row">
          {notificationTypes.map((type) => (
            <span className="pd-notification-type-chip" key={type}>{type}</span>
          ))}
        </div>

        {notificationRows.length ? (
          <div className="pd-notification-list">
            {notificationRows.map((notification) => (
              <div className={`pd-notification-item ${notification.read ? "is-read" : "is-unread"}`} key={notification.id}>
                <span className="pd-notification-dot" />
                <div className="pd-notification-body">
                  <em>{notification.type}</em>
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <em>{notification.date}</em>
                </div>
                <div className="pd-notification-actions">
                  <button type="button" onClick={() => viewNotification(notification)}>
                    <FileText size={14} />
                    View
                  </button>
                  <button type="button" onClick={() => markNotificationAsRead(notification.id)} disabled={notification.read}>
                    <Check size={14} />
                    Mark as Read
                  </button>
                  <button type="button" className="is-danger" onClick={() => deleteNotification(notification.id)}>
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="pd-selected-notification">
            <p>No notifications available.</p>
          </div>
        )}
        {selectedNotification ? (
          <div className="pd-selected-notification">
            <div className="pd-selected-notification-head">
              <strong>{selectedNotification.title}</strong>
              <span>{selectedNotification.type}</span>
            </div>
            <p>{selectedNotification.message}</p>
          </div>
        ) : null}
      </div>
    </PatientPageShell>
  );
}

function PatientAccountLayout({ active = "profile", children }) {
  const navigate = useNavigate();

  return (
    <div className="pp-account-page-layout">
      <aside className="pp-account-card">
        <button
          type="button"
          className={`pp-account-card-action ${active === "profile" ? "is-active" : ""}`}
          onClick={() => navigate("/patient/profile")}
        >
          <UserRound size={22} />
          My Profile
        </button>
        <button
          type="button"
          className={`pp-account-card-action ${active === "password" ? "is-active" : ""}`}
          onClick={() => navigate("/patient/change-password")}
        >
          <KeyRound size={22} />
          Change Password
        </button>
        <button
          type="button"
          className="pp-account-card-action pp-account-card-action--logout"
          onClick={() => logoutPatient(navigate)}
        >
          <LogOut size={22} />
          Logout
        </button>
      </aside>
      <section className="pp-account-panel">{children}</section>
    </div>
  );
}

function PatientChangePasswordPage() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [visiblePasswords, setVisiblePasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [saving, setSaving] = useState(false);

  const passwordRequirements = useMemo(
    () =>
      PATIENT_PASSWORD_REQUIREMENTS.map((requirement) => ({
        ...requirement,
        met: requirement.test(form.newPassword),
      })),
    [form.newPassword]
  );

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMessage("");
    setMessageType("");
  };

  const togglePasswordVisibility = (field) => {
    setVisiblePasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    setMessageType("");

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setMessage("Please fill all password fields.");
      setMessageType("error");
      return;
    }

    const currentPasswordError = validateStrongPassword(form.currentPassword, "Current Password");
    if (currentPasswordError) {
      setMessage(currentPasswordError);
      setMessageType("error");
      return;
    }

    const newPasswordError = validateStrongPassword(form.newPassword, "New Password");
    if (newPasswordError) {
      setMessage(newPasswordError);
      setMessageType("error");
      return;
    }

    if (form.currentPassword === form.newPassword) {
      setMessage("New password must be different from current password.");
      setMessageType("error");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setMessage("New password and confirm password must match.");
      setMessageType("error");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("patientToken") || localStorage.getItem("token") || "";
      const response = await fetch(apiUrl("Auth/change-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          oldPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Request failed with status ${response.status}`);
      setMessage(data.message || "Password changed successfully.");
      setMessageType("success");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setVisiblePasswords({ currentPassword: false, newPassword: false, confirmPassword: false });
    } catch (error) {
      setMessage(error.message || "Unable to change password right now.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const renderPasswordField = (field, label, autoComplete) => (
    <label className="pp-password-label">
      <span>{label}</span>
      <div className="pp-password-field">
        <input
          type={visiblePasswords[field] ? "text" : "password"}
          value={form[field]}
          minLength={8}
          required
          autoComplete={autoComplete}
          onChange={(event) => updateField(field, event.target.value)}
        />
        <button
          type="button"
          className="pp-password-toggle"
          onClick={() => togglePasswordVisibility(field)}
          aria-label={visiblePasswords[field] ? `Hide ${label}` : `Show ${label}`}
          title={visiblePasswords[field] ? "Hide password" : "Show password"}
        >
          {visiblePasswords[field] ? <Eye size={24} /> : <EyeOff size={24} />}
        </button>
      </div>
    </label>
  );

  return (
    <div className="patient-dashboard">
      <PatientAccountLayout active="password">
        <form className="pp-password-form" onSubmit={changePassword} noValidate>
          <h2>Change Password</h2>
          {renderPasswordField("currentPassword", "Current Password", "current-password")}
          {renderPasswordField("newPassword", "New Password", "new-password")}
          <ul className="pp-password-requirements" aria-label="Password requirements">
            {passwordRequirements.map((requirement) => (
              <li key={requirement.label} className={requirement.met ? "met" : ""}>
                {requirement.met ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                {requirement.label}
              </li>
            ))}
          </ul>
          {renderPasswordField("confirmPassword", "Confirm Password", "new-password")}
          {message ? <p className={`pp-password-message pp-password-message--${messageType}`}>{message}</p> : null}
          <button type="submit" className="pp-password-submit" disabled={saving}>
            {saving ? "Updating..." : "Update Password"}
          </button>
        </form>
      </PatientAccountLayout>
    </div>
  );
}

function PatientProfilePage({ patient, visits = [], prescriptions = [], bills = [], notifications = [] }) {
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    address: "",
    bloodGroup: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
  });

  const currentPatient = patient || {};
  const profileName = currentPatient.name || currentPatient.firstName || "Patient";
  const profileEmail = currentPatient.email || "Email not available";
  const profilePhone = currentPatient.mobile || currentPatient.phone || currentPatient.phoneNumber || "Mobile not available";
  const profileGender = currentPatient.gender || "Gender not available";
  const profileDob = currentPatient.dob || currentPatient.dateOfBirth || currentPatient.birthDate || "DOB not available";
  const profileAddress = currentPatient.address || "Address not available";
  const profileEmergencyName = currentPatient.emergencyContactName || currentPatient.emergencyName || currentPatient.emergencyContact?.name || "-";
  const profileEmergencyRelationship =
    currentPatient.emergencyContactRelationship ||
    currentPatient.emergencyRelationship ||
    currentPatient.emergencyContact?.relationship ||
    "-";
  const profileEmergencyPhone =
    currentPatient.emergencyContactPhone ||
    currentPatient.emergencyPhone ||
    currentPatient.emergencyContact?.phone ||
    "-";
  const formatMedicalList = (value, fallback = "Not recorded") => {
    if (Array.isArray(value)) return value.filter(Boolean).join(", ") || fallback;
    return value || fallback;
  };
  const profileAllergies = formatMedicalList(currentPatient.allergies || currentPatient.allergyList || currentPatient.allergy);
  const profileChronicDiseases = formatMedicalList(
    currentPatient.chronicDiseases || currentPatient.chronicConditions || currentPatient.medicalConditions
  );
  const profileCurrentMedications = formatMedicalList(
    currentPatient.currentMedications || currentPatient.medications || currentPatient.currentMedication
  );
  const profileInitials = String(profileName)
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!editMode) {
      setForm({
        name: currentPatient.name || currentPatient.firstName || "",
        email: currentPatient.email || "",
        mobile: currentPatient.mobile || currentPatient.phone || currentPatient.phoneNumber || "",
        address: currentPatient.address || "",
        bloodGroup: currentPatient.bloodGroup || currentPatient.bloodgroup || "",
        emergencyContactName:
          currentPatient.emergencyContactName || currentPatient.emergencyName || currentPatient.emergencyContact?.name || "",
        emergencyContactRelationship:
          currentPatient.emergencyContactRelationship || currentPatient.emergencyRelationship || currentPatient.emergencyContact?.relationship || "",
        emergencyContactPhone:
          currentPatient.emergencyContactPhone || currentPatient.emergencyPhone || currentPatient.emergencyContact?.phone || "",
      });
    }
  }, [currentPatient, editMode]);

  const getApiHeaders = () => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMessage("");
    setMessageType("");
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage("");
    setMessageType("");
    try {
      const profileUrl = patientApiUrl(PATIENT_API.profile);
      const payload = {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        address: form.address.trim(),
        bloodGroup: form.bloodGroup,
        emergencyContactName: form.emergencyContactName.trim(),
        emergencyContactRelationship: form.emergencyContactRelationship.trim(),
        emergencyContactPhone: form.emergencyContactPhone.trim(),
      };
      const response = await fetch(profileUrl, {
        method: "PATCH",
        headers: getApiHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Unable to update profile.");
      }
      setMessage(data.message || "Profile updated successfully.");
      setMessageType("success");
      setEditMode(false);
    } catch (error) {
      setMessage(error.message || "Unable to update profile.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    await saveProfile();
  };

  const renderField = (label, value, field, type = "text", disabled = false) => (
    <label className="pd-profile-input-label">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        disabled={!editMode || disabled}
        onChange={(e) => handleFieldChange(field, e.target.value)}
      />
    </label>
  );

  const renderBloodGroupField = () => (
    <label className="pd-profile-input-label">
      <span>Blood Group</span>
      <select value={form.bloodGroup} disabled={!editMode} onChange={(event) => handleFieldChange("bloodGroup", event.target.value)}>
        <option value="">Not recorded</option>
        {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((group) => <option key={group} value={group}>{group}</option>)}
      </select>
    </label>
  );

  const formattedProfileDob = profileDob && profileDob !== "DOB not available"
    ? String(profileDob).split("T")[0]
    : profileDob;

  const permittedFields = {
    name: form.name,
    mobile: form.mobile,
    address: form.address,
    emergencyContactName: form.emergencyContactName,
    emergencyContactRelationship: form.emergencyContactRelationship,
    emergencyContactPhone: form.emergencyContactPhone,
  };

  return (
    <div className="patient-dashboard">
      <PatientAccountLayout active="profile">
        <div className="pd-profile-page-grid">
          <div className="pd-card">
            <div className="pd-section-header">
              <div>
                <h2>Patient Profile</h2>
                <p>Personal details and contact information.</p>
              </div>
              <div className="pd-profile-actions">
                {editMode ? (
                  <>
                    <button type="button" className="pd-btn pd-btn--ghost" onClick={() => setEditMode(false)} disabled={saving}>
                      Cancel
                    </button>
                    <button type="button" className="pd-btn pd-btn--primary" onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </>
                ) : (
                  <button type="button" className="pd-btn pd-btn--primary" onClick={() => setEditMode(true)}>
                    Edit
                  </button>
                )}
              </div>
            </div>
            {message ? <p className={`pd-message pd-message--${messageType}`}>{message}</p> : null}
            <div className="pd-profile-card">
              <div className="pd-profile-avatar">{profileInitials}</div>
              <div className="pd-profile-copy">
                <h3>{profileName}</h3>
                <p>{profileEmail}</p>
                <div className="pd-profile-meta">
                  <span><Phone size={14} />{profilePhone}</span>
                  <span><UserRound size={14} />{profileGender}</span>
                  <span><Mail size={14} />{profileEmail}</span>
                  <span><MapPin size={14} />{profileAddress}</span>
                </div>
              </div>
            </div>
            <form className="pd-profile-section-grid" onSubmit={handleSave}>
              <section className="pd-profile-section">
                <h3>Personal Details</h3>
                <div className="pd-profile-strip pd-profile-strip--expanded">
                  {renderField("Name", form.name, "name")}
                  <div><span>Gender</span><strong>{profileGender}</strong></div>
                  <div><span>DOB</span><strong>{formattedProfileDob}</strong></div>
                  {renderBloodGroupField()}
                </div>
              </section>

              <section className="pd-profile-section">
                <h3>Contact</h3>
                <div className="pd-profile-strip pd-profile-strip--expanded">
                  {renderField("Mobile", form.mobile, "mobile", "text")}
                  <div><span>Email</span><strong>{profileEmail}</strong></div>
                  {renderField("Address", form.address, "address")}
                </div>
              </section>

              <section className="pd-profile-section">
                <h3>Emergency Contact</h3>
                <div className="pd-profile-strip pd-profile-strip--expanded">
                  {renderField("Name", form.emergencyContactName, "emergencyContactName")}
                  {renderField("Relationship", form.emergencyContactRelationship, "emergencyContactRelationship")}
                  {renderField("Phone", form.emergencyContactPhone, "emergencyContactPhone")}
                </div>
              </section>

              <section className="pd-profile-section">
                <h3>Medical Information</h3>
                <div className="pd-profile-strip pd-profile-strip--expanded">
                  <div><span>Allergies</span><strong>{profileAllergies}</strong></div>
                  <div><span>Chronic Diseases</span><strong>{profileChronicDiseases}</strong></div>
                  <div><span>Current Medications</span><strong>{profileCurrentMedications}</strong></div>
                </div>
              </section>
            </form>
          </div>
        </div>
      </PatientAccountLayout>
    </div>
  );
}

export default PatientRoutes;
