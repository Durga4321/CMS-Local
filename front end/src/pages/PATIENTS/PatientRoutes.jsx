import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import {
  Bell, Calendar, Check, CheckCircle2, ChevronDown, ChevronRight, Circle, ClipboardList,
  CreditCard, Download, Eye, EyeOff, FileText, Heart, Key, LogOut, Mail, MapPin, Pill,
  Menu, Phone, Search, Share2, Trash2, UserRound, X,
} from "lucide-react";
import PatientDashboard from "./PatientDashboard";
import { apiUrl, patientApiUrl, PATIENT_API } from "../../config/api";
import { validateStrongPassword } from "../../utils/validation";
import { formatIndianCurrency, formatTitleCase } from "../../utils/format";

const getNestedValue = (record, path) => {
  if (record == null) return undefined;
  const keys = Array.isArray(path) ? path : String(path).replace(/\?/g, "").split(".");
  return keys.reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), record);
};

const readFirst = (record, keys) =>
  keys.reduce((value, key) => value || getNestedValue(record, key), "") || "";

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
  try {
    await import("../SUPERADMIN/superAdminApi").then(({ recordAuditLog }) =>
      recordAuditLog({
        userName: name,
        user: name,
        userEmail: localStorage.getItem("patientEmail") || "",
        email: localStorage.getItem("patientEmail") || "",
        action: `${name} logged out`,
        systemAction: "Logout",
        role,
        ipAddress,
        timestamp: new Date().toISOString(),
      })
    );
  } catch { }

  ["token", "userRole", "patientName", "patientId", "patientToken", "patientRole", "patientEmail"].forEach((key) =>
    localStorage.removeItem(key)
  );
  navigate("/login/patient", { replace: true });
};

/* ----------------- Patient module (inlined) ----------------- */
// patient styles should be moved to App.css; removed individual import

const readId = (record, keys) => {
  const value = keys.reduce((currentValue, key) => currentValue || getNestedValue(record, key), undefined);
  return value === undefined || value === null ? undefined : String(value);
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
                    <UserRound size={16} />
                    My Profile
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
                    <Key size={16} />
                    Change Password
                  </button>
                  <button
                    type="button"
                    className="pp-account-item pp-account-item--logout"
                    onClick={logout}
                    role="menuitem"
                  >
                    <LogOut size={16} />
                    Logout
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
      const profileUrl = patientApiUrl(PATIENT_API.profile);
      const profileRes = await fetch(profileUrl, { headers }).catch(() => null);
      const profileData = profileRes?.ok ? await profileRes.json().catch(() => null) : null;
      if (profileData) setPatient(profileData);

      const appointmentsUrl = patientApiUrl(PATIENT_API.appointments);
      const appointmentsRes = await fetch(appointmentsUrl, { headers }).catch(() => null);
      const appointmentsData = appointmentsRes?.ok ? await appointmentsRes.json().catch(() => []) : [];
      const appointmentsList = Array.isArray(appointmentsData) ? appointmentsData : (appointmentsData.items || appointmentsData.data || []);
      setVisits(appointmentsList);

      const prescriptionsUrl = patientApiUrl(PATIENT_API.prescriptions);
      const prescriptionsRes = await fetch(prescriptionsUrl, { headers }).catch(() => null);
      if (prescriptionsRes?.ok) {
        const rxData = await prescriptionsRes.json().catch(() => []);
        setPrescriptions(Array.isArray(rxData) ? rxData : (rxData.items || rxData.data || []));
      }

      const billsUrl = patientApiUrl(PATIENT_API.bills);
      const billsRes = await fetch(billsUrl, { headers }).catch(() => null);
      if (billsRes?.ok) {
        const bData = await billsRes.json().catch(() => []);
        setBills(Array.isArray(bData) ? bData : (bData.items || bData.data || []));
      }

      const notificationsUrl = patientApiUrl(PATIENT_API.notifications);
      const notificationsRes = await fetch(notificationsUrl, { headers }).catch(() => null);
      if (notificationsRes?.ok) {
        const nData = await notificationsRes.json().catch(() => []);
        setNotifications(Array.isArray(nData) ? nData : (nData.items || nData.data || []));
      }

      const dashboardUrl = patientApiUrl(PATIENT_API.dashboard);
      const dashboardRes = await fetch(dashboardUrl, { headers }).catch(() => null);
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
            />
          }
        />
        <Route path="appointments" element={<PatientAppointmentsPage visits={visits} onRefresh={fetchData} />} />
        <Route path="appointments/book" element={<PatientBookingWizardPage visits={visits} onRefresh={fetchData} />} />
        <Route path="book" element={<Navigate to="appointments/book" replace />} />
        <Route path="medical-history" element={<PatientMedicalHistoryPage patient={patient} visits={visits} prescriptions={prescriptions} />} />
        <Route path="history" element={<Navigate to="medical-history" replace />} />
        <Route path="reports" element={<Navigate to="medical-history" replace />} />
        <Route path="prescriptions" element={<PatientPrescriptionsPage prescriptions={prescriptions} />} />
        <Route path="bills" element={<PatientBillsPage bills={bills} />} />
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
        <button type="button" className="pd-header-btn pd-header-btn--primary" onClick={() => navigate("/patient/dashboard")}>
        
          ← Back to dashboard
        </button>
      }
    >
      <div className="pd-card">
        <div className="pd-section-header">
          <div>
            <h2>Appointment history</h2>
            <p>Linked to the patient portal backend data.</p>
          </div>
          <button type="button" className="pd-link-button" onClick={() => navigate("/patient/appointments/book")}>
            Book appointment
          </button>
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

function PatientBookingWizardPage({ visits = [], onRefresh }) {
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

  const handleConfirmBooking = async () => {
    setBookingState('payment');
    setBookingError('');
    try {
      const branchId = selectedBranch?.branchId || selectedBranch?.id;
      const doctorId = selectedDoctor?.doctorId || selectedDoctor?.id;
      const patientId = localStorage.getItem("patientId") || "";
      const payload = {
        branchId: readNumericId(branchId),
        doctorId: readNumericId(doctorId),
        date: formatAppointmentDateTime(selectedDate),
        startTime: formatSlotTime(selectedTime),
        reasonForVisit: reasonForVisit.trim(),
      };
      const headers = getApiHeaders();
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

      setPaymentDetails({
        appointmentId,
        paymentId,
        transactionId,
        amount: consultationFee,
        paymentMode,
      });
      setBookingState('success');
      setStep(5);
      if (onRefresh) await onRefresh();
    } catch (error) {
      setBookingState('error');
      setBookingError(error.message || 'Could not complete booking.');
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
                    <option value="Insurance">Insurance</option>
                  </select>
                </label>
              </div>
              {bookingError ? <p className="booking-error">{bookingError}</p> : null}
              {bookingState === 'success' && (
                <p className="booking-success">
                  Payment completed. Appointment confirmed
                  {paymentDetails?.transactionId ? ` - ${paymentDetails.transactionId}` : ""}.
                </p>
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
              disabled={bookingState === 'payment' || !canConfirm}
            >
              {bookingState === 'payment' ? 'Processing payment...' : 'Pay Now'}
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
    formatPatientDate(readFirst(record, ['visitDate', 'date', 'prescribedOn', 'createdAt', 'appointmentDate', 'followUpDate'])) || 'Unknown date';

  const getTitle = (record) =>
    readFirst(record, ['title', 'summary', 'diagnosis', 'condition', 'description']) || 'Prescription';

  const getDownloadUrl = (record) =>
    readFirst(record, ['pdfUrl', 'documentUrl', 'downloadUrl', 'prescriptionUrl', 'url']) || '';

  const viewPrescription = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const normalizeMedicineList = (value) => {
    if (!value && value !== 0) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return String(value)
      .split(/,|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const getDoctorDetails = (record) => {
    const name = readFirst(record, ['doctorName', 'doctor.name', 'provider.name', 'prescribedBy']) || 'Doctor details unavailable';
    const specialty = readFirst(record, ['doctorSpecialty', 'doctor.specialty', 'specialty', 'department', 'departmentName']);
    const phone = readFirst(record, ['doctorPhone', 'doctor.phone', 'doctor.mobile']);
    return [name, specialty, phone].filter(Boolean).join(' | ');
  };

  const getDiagnosis = (record) =>
    readFirst(record, ['diagnosis', 'condition', 'summary', 'title', 'description']) || 'Diagnosis not recorded';

  const getMedicineList = (record) => {
    const rawMedicines =
      Array.isArray(record.medicines) && record.medicines.length
        ? record.medicines
        : Array.isArray(record.medications) && record.medications.length
          ? record.medications
          : Array.isArray(record.medicineList) && record.medicineList.length
            ? record.medicineList
            : normalizeMedicineList(record.medicineNames || record.medicines || record.medications || record.medicineList);

    return rawMedicines.map((medicine, index) => {
      if (medicine && typeof medicine === 'object') {
        return {
          name: readFirst(medicine, ['name', 'medicineName', 'drugName', 'title']) || `Medicine ${index + 1}`,
          dosage: readFirst(medicine, ['dosage', 'dose', 'strength']) || readFirst(record, ['dosage', 'dose']) || 'Dosage not recorded',
          instructions:
            readFirst(medicine, ['instructions', 'instruction', 'notes', 'frequency', 'timing']) ||
            readFirst(record, ['instructions', 'instruction', 'notes']) ||
            'Instructions not recorded',
        };
      }

      return {
        name: String(medicine || `Medicine ${index + 1}`),
        dosage: readFirst(record, ['dosage', 'dose']) || 'Dosage not recorded',
        instructions: readFirst(record, ['instructions', 'instruction', 'notes']) || 'Instructions not recorded',
      };
    });
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
                        <span>Medicine List</span>
                        <span>Dosage</span>
                        <span>Instructions</span>
                      </div>
                      {medicines.length ? medicines.map((medicine, medicineIndex) => (
                        <div className="pd-medicine-row" key={`${medicine.name}-${medicineIndex}`}>
                          <strong>{medicine.name}</strong>
                          <span>{medicine.dosage}</span>
                          <span>{medicine.instructions}</span>
                        </div>
                      )) : (
                        <div className="pd-medicine-empty">No medicines recorded.</div>
                      )}
                    </div>
                  </div>
                  <div className="pd-prescription-actions">
                    <button
                      type="button"
                      className="pd-prescription-btn pd-prescription-btn--ghost"
                      onClick={() => viewPrescription(downloadUrl)}
                      disabled={!downloadUrl}
                    >
                      <Download size={15} />
                      Download PDF
                    </button>
                    <button
                      type="button"
                      className="pd-prescription-btn pd-prescription-btn--primary"
                      onClick={() => viewPrescription(downloadUrl)}
                      disabled={!downloadUrl}
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

function PatientBillsPage({ bills = [] }) {
  const billRecords = Array.isArray(bills) ? bills : [];
  const formatAmount = (value) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));

  const formatDate = (record) =>
    readFirst(record, ['invoiceDate', 'billDate', 'date', 'createdAt']) || 'Unknown date';

  const invoiceNumber = (record) =>
    readFirst(record, ['invoiceNumber', 'billNumber', 'referenceNumber', 'id']) || 'Invoice';

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

  const totalAmount = (record) => Number(readFirst(record, ['total', 'amount', 'invoiceAmount', 'grandTotal', 'dueAmount', 'netAmount']) || 0);
  const dueAmount = (record) => Number(readFirst(record, ['dueAmount', 'balance', 'outstandingAmount']) || 0);

  const getLineItems = (record) => {
    if (Array.isArray(record.lineItems) && record.lineItems.length) return record.lineItems;
    if (record.charges && typeof record.charges === 'object') {
      return Object.entries(record.charges).map(([label, amount]) => ({ label, amount }));
    }
    return [
      { label: 'Consultation charges', amount: readFirst(record, ['consultationCharges', 'consultationCharge']) },
      { label: 'Lab charges', amount: readFirst(record, ['labCharges', 'laboratoryCharges']) },
      { label: 'Medicine charges', amount: readFirst(record, ['medicineCharges', 'medicationCharges']) },
      { label: 'Other charges', amount: readFirst(record, ['otherCharges', 'miscCharges', 'serviceCharges']) },
    ].filter((item) => item.amount != null && item.amount !== '');
  };

  const invoiceUrl = (record) =>
    readFirst(record, ['invoiceUrl', 'downloadUrl', 'documentUrl', 'pdfUrl']) || '';

  const paymentUrl = (record) =>
    readFirst(record, ['paymentUrl', 'payUrl', 'checkoutUrl', 'paymentLink', 'paymentGatewayUrl']) || '';

  const viewInvoice = (url) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
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
  const latestPatientName =
    readFirst(latestBill, ['patientName', 'patient.name', 'name', 'customerName']) || 'Patient';
  const latestPaymentMode = billRecords.length ? displayPaymentMode(latestBill) : 'UPI';
  const selectedAppointment = billRecords.length ? invoiceNumber(latestBill) : 'No billable appointments found';
  const latestBillNumber = invoiceNumber(latestBill);
  const latestAppointmentNumber =
    readFirst(latestBill, ['appointmentNumber', 'appointmentNo', 'appointmentId', 'appointment.id']) || '-';
  const latestConsultationFee = readFirst(latestBill, ['consultationCharges', 'consultationCharge']) || 0;
  const latestLabCharges = readFirst(latestBill, ['labCharges', 'laboratoryCharges']) || 0;
  const latestMedicineCharges = readFirst(latestBill, ['medicineCharges', 'medicationCharges']) || 0;
  const latestGst = readFirst(latestBill, ['gst', 'tax', 'gstAmount', 'taxAmount']) || 0;
  const paymentOptions = ['UPI', 'Card', 'Netbanking'];
  const statusOptions = ['Paid', 'Pending', 'Refunded'];
  const totalBillsAmount = billRecords.reduce((sum, bill) => sum + totalAmount(bill), 0);

  return (
    <PatientPageShell
      title="Billing"
      subtitle="Review charges, invoices, and pending payments."
    >
      <div className="pb-billing-layout">
        <section className="pb-generate-card">
          <div className="pb-billing-header">
            <div>
              <h2>Generate Bill</h2>
              <p>Review patient and charge details before creating the invoice.</p>
            </div>
            <span className="pb-billing-icon">
              <FileText size={30} />
            </span>
          </div>

          <div className="pb-patient-preview">
            <strong>{latestPatientName}</strong>
            <span>{selectedAppointment}</span>
          </div>

          <div className="pb-info-section">
            <h3>Bill Information</h3>
            <div className="pb-info-grid">
              <div className="pb-info-item">
                <span>Bill Number</span>
                <strong>{latestBillNumber}</strong>
              </div>
              <div className="pb-info-item">
                <span>Appointment Number</span>
                <strong>{latestAppointmentNumber}</strong>
              </div>
              <div className="pb-info-item">
                <span>Consultation Fee</span>
                <strong>{formatAmount(latestConsultationFee)}</strong>
              </div>
              <div className="pb-info-item">
                <span>Lab Charges</span>
                <strong>{formatAmount(latestLabCharges)}</strong>
              </div>
              <div className="pb-info-item">
                <span>Medicine Charges</span>
                <strong>{formatAmount(latestMedicineCharges)}</strong>
              </div>
              <div className="pb-info-item">
                <span>GST</span>
                <strong>{formatAmount(latestGst)}</strong>
              </div>
              <div className="pb-info-item pb-info-item--total">
                <span>Total</span>
                <strong>{formatAmount(latestTotal)}</strong>
              </div>
            </div>
          </div>

          <div className="pb-info-section">
            <h3>Payment</h3>
            <div className="pb-option-row">
              {paymentOptions.map((option) => (
                <span className={`pb-option-chip ${normalizePaymentMode(latestPaymentMode) === normalizePaymentMode(option) ? 'is-active' : ''}`} key={option}>
                  {option}
                </span>
              ))}
            </div>
          </div>

          <div className="pb-info-section">
            <h3>Status</h3>
            <div className="pb-option-row">
              {statusOptions.map((option) => (
                <span className={`pb-status-option ${latestStatus === option.toLowerCase() ? 'is-active' : ''}`} key={option}>
                  {option}
                </span>
              ))}
            </div>
          </div>

          <div className="pb-payment-actions">
            <button type="button" className="pb-action-btn pb-action-btn--primary" onClick={() => payInvoice(paymentUrl(latestBill))} disabled={!paymentUrl(latestBill)}>
              Pay Now
            </button>
            <button type="button" className="pb-action-btn pb-action-btn--ghost" onClick={() => viewInvoice(invoiceUrl(latestBill))} disabled={!invoiceUrl(latestBill)}>
              Download Invoice
            </button>
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
            {billRecords.map((bill, index) => {
              const status = paymentStatus(bill);
              const total = totalAmount(bill);
              const due = dueAmount(bill);
              const lineItems = getLineItems(bill);
              const invoiceLink = invoiceUrl(bill);

              return (
                <div className="pb-invoice-card" key={bill.id || bill.invoiceNumber || index}>
                  <div className="pb-invoice-header">
                    <div>
                      <span className="pb-invoice-date">{formatDate(bill)}</span>
                      <h3>{invoiceNumber(bill)}</h3>
                      <p className="pb-invoice-subtitle">{doctorLabel(bill)}</p>
                    </div>
                    <div className="pb-invoice-status-group">
                      <span className={`pb-status-badge pb-status-badge--${status === 'paid' ? 'paid' : 'pending'}`}>
                        {status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                      <span className="pb-payment-badge">{displayPaymentMode(bill)}</span>
                    </div>
                  </div>

                  <div className="pb-charge-grid">
                    {lineItems.length ? lineItems.map((item, itemIndex) => (
                      <div className="pb-charge-row" key={`${String(item.label)}-${itemIndex}`}>
                        <span>{item.label}</span>
                        <strong>{formatAmount(item.amount)}</strong>
                      </div>
                    )) : (
                      <div className="pb-charge-row">
                        <span>Amount</span>
                        <strong>{formatAmount(total)}</strong>
                      </div>
                    )}
                  </div>

                  <div className="pb-charge-summary">
                    <span>Total invoice</span>
                    <strong>{formatAmount(total)}</strong>
                  </div>

                  <div className="pb-bill-actions">
                    <button type="button" className="pb-action-btn pb-action-btn--ghost" onClick={() => viewInvoice(invoiceLink)} disabled={!invoiceLink}>
                      View invoice
                    </button>
                    <button type="button" className="pb-action-btn pb-action-btn--primary" onClick={() => viewInvoice(invoiceLink)} disabled={!invoiceLink}>
                      Download
                    </button>
                    {due > 0 ? (
                      <button
                        type="button"
                        className="pb-action-btn pb-action-btn--secondary"
                        onClick={() => payInvoice(paymentUrl(bill))}
                        disabled={!paymentUrl(bill)}
                      >
                        {payLabel(bill)}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <aside className="pb-total-card">
            <span>Total Bill</span>
            <strong>{formatAmount(totalBillsAmount)}</strong>
            <p>{billRecords.length} invoice{billRecords.length === 1 ? '' : 's'} included</p>
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
          <Key size={22} />
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
  const currentPatient = patient || {};
  const profileName = currentPatient.name || currentPatient.firstName || "Patient";
  const profileEmail = currentPatient.email || "Email not available";
  const profilePhone = currentPatient.mobile || currentPatient.phone || currentPatient.phoneNumber || "Mobile not available";
  const profileGender = currentPatient.gender || "Gender not available";
  const profileDob = currentPatient.dob || currentPatient.dateOfBirth || currentPatient.birthDate || "DOB not available";
  const profileBloodGroup = currentPatient.bloodGroup || currentPatient.bloodgroup || "-";
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
            </div>
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
            <div className="pd-profile-section-grid">
              <section className="pd-profile-section">
                <h3>Personal Details</h3>
                <div className="pd-profile-strip pd-profile-strip--expanded">
                  <div><span>Name</span><strong>{profileName}</strong></div>
                  <div><span>Gender</span><strong>{profileGender}</strong></div>
                  <div><span>DOB</span><strong>{profileDob}</strong></div>
                  <div><span>Blood Group</span><strong>{profileBloodGroup}</strong></div>
                </div>
              </section>

              <section className="pd-profile-section">
                <h3>Contact</h3>
                <div className="pd-profile-strip pd-profile-strip--expanded">
                  <div><span>Mobile</span><strong>{profilePhone}</strong></div>
                  <div><span>Email</span><strong>{profileEmail}</strong></div>
                  <div><span>Address</span><strong>{profileAddress}</strong></div>
                </div>
              </section>

              <section className="pd-profile-section">
                <h3>Emergency Contact</h3>
                <div className="pd-profile-strip pd-profile-strip--expanded">
                  <div><span>Name</span><strong>{profileEmergencyName}</strong></div>
                  <div><span>Relationship</span><strong>{profileEmergencyRelationship}</strong></div>
                  <div><span>Phone</span><strong>{profileEmergencyPhone}</strong></div>
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
            </div>
          </div>
        </div>
      </PatientAccountLayout>
    </div>
  );
}

export default PatientRoutes;
