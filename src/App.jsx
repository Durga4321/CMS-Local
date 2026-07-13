import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import DoctorApp from "./doctors/DoctorApp";
import ReceptionistApp from "./Recepitionist/ReceptionistApp";
// Patient module inlined below (migrated from src/patients/PatientApp.jsx)
import UserProfilePage from "./profile/UserProfilePage";
import SuperAdminDashboard from "./pages/SUPERADMIN/Dashboard/Dashboard";
import SuperAdminClinics from "./pages/SUPERADMIN/Clinics/Clinics";
import SuperAdminClinicForm from "./pages/SUPERADMIN/Clinics/ClinicForm";
import SuperAdminAdmins from "./pages/SUPERADMIN/Admins/Admins";
import SuperAdminUsers from "./pages/SUPERADMIN/Users/Users";
import SuperAdminRolesPermissions from "./pages/SUPERADMIN/RolesPermissions/RolesPermissions";
import SuperAdminSettings from "./pages/SUPERADMIN/Settings/Settings";
import SuperAdminReports from "./pages/SUPERADMIN/Reports/Reports";
import SuperAdminAuditLogs from "./pages/SUPERADMIN/AuditLogs/AuditLogs";
import SuperAdminNotifications from "./pages/SUPERADMIN/Notifications/Notifications";

// Pages
import AdminLogin from "./Login/Adminlogin";
import ForgotPassword from "./Login/Forgotpassword";
import VerifyOTP from "./Login/Verifyopt";
import ResetPassword from "./Login/Resertpassword";
import Dashboard from "./Dashboard/Dashboard";
import Receptionists from "./pages/RECEPTIONISTS/Receptionists";
import Doctors from "./pages/DOCTORS/Doctors";
import AddDoctor from "./pages/DOCTORS/AddDoctor";
import DoctorSchedule from "./pages/DOCTORS/DoctorSchedule";
import Patients from "./pages/PATIENTS/Patients";
import PatientDetails from "./pages/PATIENTS/PatientDetails";
import PatientDashboard from "./pages/PATIENTS/PatientDashboard";
import PatientRegister from "./pages/PATIENTS/PatientRegister";
// Optional
import Appointments from "./pages/APPOINTMENTS/Appointments";
import NewAppointment from "./pages/APPOINTMENTS/NewAppointment";
import Doctorschedulepage from "./pages/Schedule/docschedule";
import Reports from "./pages/REPORTS/Reports";
import DailyReport from "./pages/REPORTS/DailyReport";
import RevenueReport from "./pages/REPORTS/RevenueReport";
import DoctorWiseReport from "./pages/REPORTS/DoctorWiseReport";
import "./pages/SUPERADMIN/SuperAdmin.css";
import { ToastProvider } from "./components/ToastProvider";
import { Bell, Calendar, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, ClipboardList, CreditCard, Download, Edit3, Eye, EyeOff, FileText, Heart, Key, Link as LinkIcon, LogOut, Mail, MapPin, Pill, Phone, Printer, Search, Share2, Stethoscope, Trash2, UserRound, Wallet, X } from "lucide-react";
import { apiUrl, patientApiUrl, PATIENT_API } from "./config/api";
import { formatIndianCurrency } from "./utils/format";
import { validateStrongPassword } from "./utils/validation";
// ensure app styles include patient styles

const normalizeRole = (role = "") =>
  String(role || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const getNestedValue = (record, path) => {
  if (record == null) return undefined;
  const keys = String(path).replace(/\?/g, "").split(".");
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

const isCurrentUserSuperAdmin = () =>
  normalizeRole(localStorage.getItem("adminRole") || localStorage.getItem("userRole")) === "superadmin";

const SuperAdminRoute = ({ children }) =>
  isCurrentUserSuperAdmin() ? children : <Navigate to="/dashboard" replace />;

const logoutPatient = async (navigate) => {
  const name = localStorage.getItem("patientName") || localStorage.getItem("patientEmail") || "Patient";
  const role = localStorage.getItem("patientRole") || "Patient";
  const ipAddress = localStorage.getItem("loginIpAddress") || "";
  try {
    await import("./pages/SUPERADMIN/superAdminApi").then(({ recordAuditLog }) =>
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
  } catch {}

  ["token", "userRole", "patientName", "patientId", "patientToken", "patientRole", "patientEmail"].forEach((key) =>
    localStorage.removeItem(key)
  );
  navigate("/patients/register", { replace: true });
};

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>

        {/* DEFAULT */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* LOGIN */}
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/VerifyOTP" element={<VerifyOTP />} />
        <Route path="/ResetPassword" element={<ResetPassword />} />
        <Route path="/patients/register" element={<PatientRegister />} />

        {/* MAIN LAYOUT */}
        <Route element={<AppLayout />}>

          {/* Dashboard */}
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<UserProfilePage roleType="admin" />} />

          {/* MODULES */}
          <Route path="doctors" element={<Doctors />} />
          <Route path="doctors/add" element={<AddDoctor />} />
          <Route path="doctors/register" element={<Navigate to="/doctors/add" replace />} />
          <Route path="doctors/schedule" element={<DoctorSchedule />} />
          <Route path="DoctorSchedule/schedule" element={<Doctorschedulepage />} />
          <Route path="receptionists" element={<Receptionists />} />

          <Route path="patients" element={<Patients />} />
          <Route path="patients/dashboard" element={<PatientDashboard />} />
          <Route path="patients/:id" element={<PatientDetails />} /> {/* ✅ IMPORTANT */}

          <Route path="appointments" element={<Appointments />} />
          <Route path="appointments/new" element={<NewAppointment />} />

          <Route path="reports" element={<Reports />} />
          <Route path="reports/daily" element={<DailyReport />} />
          <Route path="RevenueReport/daily" element={<RevenueReport />} />
          <Route path="DoctorWiseReport/daily" element={<DoctorWiseReport />} />

          <Route path="superadmin" element={<Navigate to="/superadmin/dashboard" replace />} />
          <Route path="superadmin/dashboard" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
          <Route path="superadmin/clinics" element={<SuperAdminRoute><SuperAdminClinics /></SuperAdminRoute>} />
          <Route path="superadmin/clinics/add" element={<SuperAdminRoute><SuperAdminClinicForm mode="add" /></SuperAdminRoute>} />
          <Route path="superadmin/clinics/edit/:id" element={<SuperAdminRoute><SuperAdminClinicForm mode="edit" /></SuperAdminRoute>} />
          <Route path="superadmin/admins" element={<SuperAdminRoute><SuperAdminAdmins /></SuperAdminRoute>} />
          <Route path="superadmin/users" element={<SuperAdminRoute><SuperAdminUsers /></SuperAdminRoute>} />
          <Route path="superadmin/roles" element={<SuperAdminRoute><SuperAdminRolesPermissions /></SuperAdminRoute>} />
          <Route path="superadmin/settings" element={<SuperAdminRoute><SuperAdminSettings /></SuperAdminRoute>} />
          <Route path="superadmin/reports" element={<SuperAdminRoute><SuperAdminReports /></SuperAdminRoute>} />
          <Route path="superadmin/audit-logs" element={<SuperAdminRoute><SuperAdminAuditLogs /></SuperAdminRoute>} />
          <Route path="superadmin/notifications" element={<SuperAdminRoute><SuperAdminNotifications /></SuperAdminRoute>} />







        </Route>

        {/* ── SEPARATE DOCTOR DASHBOARD ── */}
        <Route path="/doctor/*" element={<DoctorApp />} />
        <Route path="/reception/*" element={<ReceptionistApp />} />
        <Route path="/patient/*" element={<PatientRoutes />} />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;

/* ----------------- Patient module (inlined) ----------------- */
// patient styles should be moved to App.css; removed individual import

function PatientShell({ notifications, children, patient }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
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

  const logout = async () => {
    setMenuOpen(false);
    await logoutPatient(navigate);
  };

  const patientTitle = patient?.name || patient?.firstName || patient?.fullName || "Patient";
  const patientSubtitle =
    patient?.clinicName ||
    patient?.hospitalName ||
    patient?.clinic?.name ||
    patient?.organization ||
    patient?.role ||
    "Patient";

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
    <div className="patient-portal">
      <aside className="pp-sidebar">
        <div className="pp-brand">
          <div className="pp-brand-mark">
            <Heart size={20} />
          </div>
          <div>
            <strong>CMS</strong>
            <span>Patient Portal</span>
          </div>
        </div>
        <nav className="pp-nav">
          <span className="pp-nav-label">MAIN MENU</span>
          <NavLink to="/patient/dashboard" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <ClipboardList size={16} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/patient/appointments/book" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
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
          <div className="pp-search-box">
            <Search size={18} className="pp-search-icon" />
            <input
              type="search"
              placeholder="Search dashboard, clinics, admins, reports..."
              aria-label="Search patient portal"
            />
          </div>
          <div className="pp-top-actions">
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
                <span className="pp-account-name">{patient?.firstName || patient?.name || ''}</span>
                <ChevronDown size={15} />
              </button>
              {menuOpen ? (
                <div className="pp-account-dropdown" role="menu">
                  <div className="pp-account-summary">
                    <strong>{patient?.name || patient?.firstName || ''}</strong>
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

  useEffect(() => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const fetchData = async () => {
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
    };

    fetchData();
  }, []);

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
        <Route path="appointments" element={<Navigate to="appointments/book" replace />} />
        <Route path="appointments/book" element={<PatientBookingWizardPage visits={visits} />} />
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

function PatientAppointmentsPage({ visits = [] }) {
  const navigate = useNavigate();
  const rows = visits || [];

  return (
    <PatientPageShell
      title="Appointments"
      subtitle="Book, review, and reschedule care visits from your portal."
      action={
        <button type="button" className="pd-header-btn pd-header-btn--primary" onClick={() => navigate("/patient/dashboard")}>
          <Calendar size={16} />
          Back to dashboard
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
            {rows.map((visit, index) => (
              <div className="pd-notification-item" key={visit.id || visit.appointmentId || index}>
                <span className="pd-notification-dot" />
                <div className="pd-notification-body">
                  <strong>{visit.date || visit.appointmentDate || visit.createdAt || "Appointment"}</strong>
                  <span>{visit.doctor?.name || visit.doctorName || visit.specialist || "Doctor assigned"}</span>
                  <em>{visit.time || visit.slot || visit.status || "Scheduled"}</em>
                </div>
                <ChevronRight size={16} className="pd-notification-chevron" />
              </div>
            ))}
          </div>
        ) : (
          <div className="pd-selected-notification">
            <p>No appointments found yet.</p>
          </div>
        )}
      </div>
    </PatientPageShell>
  );
}

function PatientBookingWizardPage({ visits = [] }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [clinics, setClinics] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [bookingState, setBookingState] = useState("idle");
  const [bookingError, setBookingError] = useState("");
  const [loading, setLoading] = useState(true);

  const getValue = (record, path) => {
    if (record == null) return undefined;
    if (typeof path === 'string') path = path.replace(/\?\./g, '.').split('.');
    return path.reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), record);
  };

  const readFirst = (record, keys) =>
    keys.reduce((value, key) => value || getValue(record, key), "") || "";

  const readId = (record, keys) => {
    const value = keys.reduce((value, key) => value || getValue(record, key), undefined);
    return value === undefined || value === null ? undefined : String(value);
  };

  const normalizeName = (value) => {
    if (!value && value !== 0) return "";
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') {
      const result = readFirst(value, [
        'name',
        'departmentName',
        'specialty',
        'speciality',
        'department',
        'specialization',
        'clinicName',
        'hospitalName',
        'title',
        'label',
      ]);
      if (result === undefined || result === null) return "";
      return typeof result === 'string' ? result.trim() : String(result).trim();
    }
    return String(value).trim();
  };

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
    const fetchBookingData = async () => {
      setLoading(true);
      try {
        const headers = getApiHeaders();

        const clinicsUrl = patientApiUrl(PATIENT_API.clinics);
        const clinicsRes = await fetch(clinicsUrl, { headers }).catch(() => null);
        const clinicsData = clinicsRes?.ok ? await clinicsRes.json().catch(() => null) : null;
        const clinicList = parseApiList(clinicsData);

        const doctorsUrl = patientApiUrl(PATIENT_API.doctors);
        const doctorsRes = await fetch(doctorsUrl, { headers }).catch(() => null);
        const doctorsData = doctorsRes?.ok ? await doctorsRes.json().catch(() => null) : null;
        const doctorList = parseApiList(doctorsData);

        setClinics(clinicList);
        setDoctors(doctorList);

        const deptMap = new Map();
        doctorList.forEach((doctor) => {
          const deptName = normalizeName(readFirst(doctor, ['departmentName', 'specialty', 'speciality', 'department', 'specialization', 'department.name']));
          const deptId = readId(doctor, ['departmentId', 'specialtyId', 'department.id']);
          if (deptName && !deptMap.has(deptId || deptName)) {
            deptMap.set(deptId || deptName, { id: deptId || deptName, name: deptName });
          }
        });
        setDepartments(Array.from(deptMap.values()));
      } catch (err) {
        // Silently fail and fall back to visit-derived options
      } finally {
        setLoading(false);
      }
    };

    fetchBookingData();
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      if (!selectedClinic) {
        return;
      }

      const headers = getApiHeaders();
      const clinicId = selectedClinic.id || selectedClinic.clinicId || selectedClinic.hospitalId;
      if (!clinicId) {
        return;
      }

      try {
        const departmentsUrl = patientApiUrl(PATIENT_API.clinicDepartments, { clinicId });
        const response = await fetch(departmentsUrl, { headers }).catch(() => null);
        const data = response?.ok ? await response.json().catch(() => null) : null;
        const departmentsList = parseApiList(data);
        if (departmentsList.length) {
          setDepartments(departmentsList.map((department) => ({
            ...department,
            id: readId(department, ['id', 'departmentId', 'specialtyId']),
            name: normalizeName(readFirst(department, ['name', 'departmentName', 'specialization', 'specialty', 'title'])),
            clinicId,
          })));
          return;
        }
      } catch (err) {
        // ignore clinic departments fetch failure
      }
    };

    fetchDepartments();
  }, [selectedClinic]);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedDoctor || !selectedDate) {
        setSlots([]);
        return;
      }

      const headers = getApiHeaders();
      const doctorId = selectedDoctor.id || selectedDoctor.doctorId || selectedDoctor.userId;
      if (!doctorId) {
        setSlots([]);
        return;
      }

      try {
        const slotsUrl = patientApiUrl(PATIENT_API.doctorSlots, { doctorId });
        const response = await fetch(`${slotsUrl}?date=${encodeURIComponent(selectedDate)}`, { headers }).catch(() => null);
        const data = response?.ok ? await response.json().catch(() => null) : null;
        const slotList = parseApiList(data);
        setSlots(slotList);
      } catch (err) {
        setSlots([]);
      }
    };

    fetchSlots();
  }, [selectedDoctor, selectedDate]);

  const clinicOptions = useMemo(() => {
    if (clinics.length) return clinics.map((clinic) => ({
      ...clinic,
      id: readId(clinic, ['id', 'clinicId', 'hospitalId']),
      name: normalizeName(clinic),
      address: readFirst(clinic, ['address', 'location', 'clinicAddress', 'hospitalAddress']),
    }));

    const ids = new Map();
    visits.forEach((visit) => {
      const id = readId(visit, ['clinicId', 'clinic.id', 'hospitalId', 'clinic.clinicId']);
      const name = normalizeName(readFirst(visit, ['clinicName', 'clinic.name', 'hospitalName', 'clinic']));
      const address = readFirst(visit, ['clinicAddress', 'clinic.address', 'hospitalAddress']);
      if (id && name && !ids.has(id)) ids.set(id, { id, name, address });
    });
    return Array.from(ids.values());
  }, [clinics, visits]);

  const departmentOptions = useMemo(() => {
    if (departments.length) return departments.map((department) => ({
      ...department,
      id: readId(department, ['id', 'departmentId', 'specialtyId']),
      name: normalizeName(department),
      clinicId: readId(department, ['clinicId', 'hospitalId', 'clinic?.id']),
    }));

    const ids = new Map();
    visits.forEach((visit) => {
      const id = readId(visit, ['departmentId', 'department.id', 'specialtyId']);
      const name = normalizeName(readFirst(visit, ['departmentName', 'department.name', 'specialty', 'speciality']));
      const clinicId = readId(visit, ['clinicId', 'clinic.id', 'hospitalId', 'clinic.clinicId']);
      if (id && name && !ids.has(id)) ids.set(id, { id, name, clinicId });
    });
    return Array.from(ids.values());
  }, [departments, visits]);

  const doctorOptions = useMemo(() => {
    if (doctors.length) return doctors.map((doctor) => ({
      ...doctor,
      id: readId(doctor, ['id', 'doctorId', 'userId']),
      name: normalizeName(doctor),
      specialty: readFirst(doctor, ['specialty', 'speciality', 'departmentName']),
      departmentId: readId(doctor, ['departmentId', 'specialtyId', 'department?.id']),
      clinicId: readId(doctor, ['clinicId', 'hospitalId', 'clinic?.id']),
    }));

    const ids = new Map();
    visits.forEach((visit) => {
      const doctor = visit.doctor || (visit.doctorName ? visit : {});
      const id = readId(doctor, ['id', 'doctorId', 'userId']);
      const name = normalizeName(readFirst(doctor, ['name', 'doctorName', 'fullName']));
      const specialty = normalizeName(readFirst(doctor, ['specialty', 'speciality', 'departmentName']));
      const departmentId = readId(visit, ['departmentId', 'department.id', 'specialtyId']);
      const clinicId = readId(visit, ['clinicId', 'clinic.id', 'hospitalId', 'clinic.clinicId']);
      if (id && name && !ids.has(id)) ids.set(id, { id, name, specialty, departmentId, clinicId });
    });
    return Array.from(ids.values());
  }, [doctors, visits]);

  const slotOptions = useMemo(() => {
    if (slots.length) return slots.map((slot) => ({
      ...slot,
      id: readId(slot, ['id']) || `${readId(slot, ['doctorId', 'doctor.id', 'doctor.doctorId'])}-${readFirst(slot, ['date', 'appointmentDate', 'visitDate'])}-${readFirst(slot, ['time', 'slot', 'appointmentTime'])}`,
      doctorId: readId(slot, ['doctorId', 'doctor.id', 'doctor.doctorId']),
      date: readFirst(slot, ['date', 'appointmentDate', 'visitDate']),
      time: readFirst(slot, ['time', 'slot', 'appointmentTime']),
      clinicId: readId(slot, ['clinicId', 'hospitalId', 'clinic?.id']),
      departmentId: readId(slot, ['departmentId', 'specialtyId', 'department?.id']),
    }));

    return visits
      .map((visit) => {
        const doctorId = readId(visit, ['doctorId', 'doctor.id', 'doctor.doctorId']);
        const date = readFirst(visit, ['date', 'appointmentDate', 'visitDate']);
        const time = readFirst(visit, ['time', 'slot', 'appointmentTime']);
        const clinicId = readId(visit, ['clinicId', 'clinic.id', 'hospitalId', 'clinic.clinicId']);
        const departmentId = readId(visit, ['departmentId', 'department.id', 'specialtyId']);
        return doctorId && date && time ? { id: `${doctorId}-${date}-${time}`, doctorId, date, time, clinicId, departmentId } : null;
      })
      .filter(Boolean);
  }, [slots, visits]);

  const filteredDepartments = useMemo(
    () =>
      selectedClinic
        ? departmentOptions.filter((department) => {
            if (department.clinicId && department.clinicId === selectedClinic.id) return true;
            if (Array.isArray(department.clinicIds) && department.clinicIds.includes(selectedClinic.id)) return true;
            if (selectedClinic.departmentIds?.includes(department.id)) return true;
            return !department.clinicId && !department.clinicIds && !selectedClinic.departmentIds;
          })
        : departmentOptions,
    [departmentOptions, selectedClinic]
  );

  const filteredDoctors = useMemo(
    () =>
      selectedDepartment
        ? doctorOptions.filter((doctor) => {
            if (doctor.departmentId && doctor.departmentId !== selectedDepartment.id) return false;
            if (doctor.departmentName && doctor.departmentName !== selectedDepartment.name) return false;
            if (doctor.specialty && doctor.specialty !== selectedDepartment.name) return false;
            if (selectedClinic && doctor.clinicId && doctor.clinicId !== selectedClinic.id) return false;
            if (
              selectedClinic &&
              Array.isArray(doctor.clinicIds) &&
              doctor.clinicIds.length > 0 &&
              !doctor.clinicIds.includes(selectedClinic.id)
            )
              return false;
            return true;
          })
        : doctorOptions,
    [doctorOptions, selectedDepartment, selectedClinic]
  );

  const filteredSlots = useMemo(
    () =>
      selectedDoctor
        ? slotOptions.filter((slot) => {
            if (slot.doctorId !== selectedDoctor.id) return false;
            if (selectedDate && slot.date !== selectedDate) return false;
            return true;
          })
        : [],
    [slotOptions, selectedDoctor, selectedDate]
  );

  const availableTimes = useMemo(
    () =>
      selectedDate
        ? Array.from(new Set(filteredSlots.map((slot) => slot.time || slot.slot).filter(Boolean)))
        : [],
    [filteredSlots, selectedDate]
  );

  const stepItems = ['Clinic', 'Department', 'Doctor', 'Date & time', 'Confirm'];
  const canContinue =
    (step === 1 && selectedClinic) ||
    (step === 2 && selectedDepartment) ||
    (step === 3 && selectedDoctor) ||
    (step === 4 && selectedDate && selectedTime);

  const handleNextStep = () => {
    if (!canContinue) return;
    setStep((current) => Math.min(5, current + 1));
  };

  const handleBackStep = () => setStep((current) => Math.max(1, current - 1));

  const handleConfirmBooking = async () => {
    setBookingState('saving');
    setBookingError('');
    try {
      const payload = {
        clinicId: selectedClinic?.id,
        clinicName: selectedClinic?.name,
        departmentId: selectedDepartment?.id,
        departmentName: selectedDepartment?.name,
        doctorId: selectedDoctor?.id,
        doctorName: selectedDoctor?.name,
        appointmentDate: selectedDate,
        appointmentTime: selectedTime,
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
      setBookingState('success');
      setStep(5);
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
                <h2>Clinic</h2>
                <p>Choose the clinic location for your appointment.</p>
              </div>
              <div className="booking-grid">
                {clinicOptions.length ? (
                  clinicOptions.map((clinic) => (
                    <button
                      key={clinic.id || clinic.name}
                      type="button"
                      className={`booking-card ${selectedClinic?.id === clinic.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedClinic(clinic);
                        setSelectedDepartment(null);
                        setSelectedDoctor(null);
                        setSelectedDate('');
                        setSelectedTime('');
                      }}
                    >
                      <strong>{clinic.name}</strong>
                      <span>{clinic.address || 'Location details unavailable'}</span>
                    </button>
                  ))
                ) : (
                  <p className="booking-empty">No clinics found yet.</p>
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
                <p>Review your clinic, department, doctor, and schedule.</p>
              </div>
              <div className="booking-summary">
                <div className="booking-summary-row">
                  <span>Clinic</span>
                  <strong>{selectedClinic?.name || 'Not selected'}</strong>
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
              </div>
              {bookingError ? <p className="booking-error">{bookingError}</p> : null}
              {bookingState === 'success' && <p className="booking-success">Your appointment request has been sent successfully.</p>}
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
              disabled={bookingState === 'saving' || !canContinue}
            >
              {bookingState === 'saving' ? 'Booking...' : 'Confirm appointment'}
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

  useEffect(() => {
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
        const historyUrl = patientApiUrl(PATIENT_API.medicalHistory);
        const response = await fetch(historyUrl, { headers });
        if (!response.ok) {
          throw new Error('Unable to load medical history.');
        }
        const data = await response.json();
        setHistory(data);
      } catch (error) {
        setHistoryError(error.message || 'Unable to load medical history.');
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, []);

  const normalizeList = (value) => {
    if (!value && value !== 0) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return String(value)
      .split(/,|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const chronicConditions = normalizeList(
    history?.chronicConditions ||
      history?.chronicDiseases ||
      history?.medicalConditions ||
      history?.conditions ||
      patient?.chronicDiseases ||
      patient?.medicalConditions
  );
  const allergies = normalizeList(history?.allergies || history?.allergyList || history?.allergy || patient?.allergies);
  const currentMedications = normalizeList(
    history?.currentMedications || history?.medications || history?.drugs || patient?.currentMedications
  );

  const visitRecords = Array.isArray(history?.visits)
    ? history.visits
    : Array.isArray(history?.appointments)
    ? history.appointments
    : visits;

  const reportRecords = Array.isArray(history?.reports)
    ? history.reports
    : Array.isArray(history?.labReports)
    ? history.labReports
    : visitRecords
        .map((visit) => readFirst(visit, ['report', 'reportName', 'reportTitle', 'reportUrl', 'documentUrl']) ? visit : null)
        .filter(Boolean);

  const prescriptionRecords = Array.isArray(history?.prescriptions) && history.prescriptions.length
    ? history.prescriptions
    : Array.isArray(prescriptions)
    ? prescriptions
    : [];

  const readVisitDate = (visit) =>
    readFirst(visit, ['date', 'visitDate', 'appointmentDate', 'createdAt', 'appointment?.date']) || 'Unknown date';

  const readVisitDoctor = (visit) =>
    readFirst(visit, ['doctor.name', 'doctorName', 'practitioner', 'provider']) || 'Doctor details unavailable';

  const readVisitSpecialty = (visit) =>
    readFirst(visit, ['specialty', 'departmentName', 'department', 'condition']) || '';

  const readVisitSummary = (visit) =>
    readFirst(visit, ['summary', 'reason', 'notes', 'diagnosis']) || '';

  const readReportTitle = (report) =>
    readFirst(report, ['title', 'reportTitle', 'reportName', 'name', 'testName']) || 'Report';

  const readReportDate = (report) =>
    readFirst(report, ['date', 'reportDate', 'createdAt', 'appointmentDate']) || 'Unknown date';

  const readReportStatus = (report) =>
    readFirst(report, ['status', 'resultStatus', 'type', 'category']) || 'Available';

  const readPrescriptionDiagnosis = (prescription) =>
    readFirst(prescription, ['diagnosis', 'condition', 'summary', 'title']) || 'Diagnosis not recorded';

  return (
    <PatientPageShell
      title="Medical History"
      subtitle="Previous visits, medical conditions, reports, and prescriptions."
    >
      <div className="mh-grid">
        <div className="mh-card">
          <h3>Medical Conditions</h3>
          {loadingHistory ? (
            <p>Loading...</p>
          ) : chronicConditions.length || allergies.length || currentMedications.length ? (
            <div className="mh-chip-list">
              {[...chronicConditions, ...allergies, ...currentMedications].map((item, index) => (
                <span key={index} className="mh-chip">
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p>No medical conditions recorded.</p>
          )}
        </div>
        <div className="mh-card">
          <h3>Reports</h3>
          {loadingHistory ? (
            <p>Loading...</p>
          ) : reportRecords.length ? (
            <div className="mh-mini-list">
              {reportRecords.slice(0, 3).map((report, index) => (
                <div className="mh-mini-item" key={report.id || report.reportId || index}>
                  <strong>{readReportTitle(report)}</strong>
                  <span>{readReportDate(report)} - {readReportStatus(report)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p>No reports recorded.</p>
          )}
        </div>
        <div className="mh-card">
          <h3>Prescriptions</h3>
          {loadingHistory ? (
            <p>Loading...</p>
          ) : prescriptionRecords.length ? (
            <div className="mh-mini-list">
              {prescriptionRecords.slice(0, 3).map((prescription, index) => (
                <div className="mh-mini-item" key={prescription.id || prescription.prescriptionId || index}>
                  <strong>{readPrescriptionDiagnosis(prescription)}</strong>
                  <span>{readFirst(prescription, ['date', 'visitDate', 'prescribedOn', 'createdAt']) || 'Unknown date'}</span>
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
        {historyError ? (
          <div className="mh-error">{historyError}</div>
        ) : loadingHistory ? (
          <div className="mh-loading">Loading medical history...</div>
        ) : visitRecords.length ? (
          <div className="mh-visit-list">
            {visitRecords.map((visit, index) => (
              <div className="mh-visit-item" key={visit.id || visit.appointmentId || index}>
                <div className="mh-visit-meta">
                  <span>{readVisitDate(visit)}</span>
                  <strong>{readVisitDoctor(visit)}</strong>
                </div>
                <div className="mh-visit-details">
                  {readVisitSpecialty(visit) ? <span className="mh-visit-specialty">{readVisitSpecialty(visit)}</span> : null}
                  {readVisitSummary(visit) ? <p>{readVisitSummary(visit)}</p> : null}
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
  const visiblePrescriptionRecords = prescriptionRecords.length
    ? prescriptionRecords
    : [{ id: 'empty-prescription', title: 'Prescription', medicines: [] }];

  const formatDate = (record) =>
    readFirst(record, ['visitDate', 'date', 'prescribedOn', 'createdAt', 'appointmentDate']) || 'Unknown date';

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

  const printPrescription = (record) => {
    const medicines = getMedicineList(record);
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>Prescription</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a;">
          <h1>Prescription</h1>
          <p><strong>Date:</strong> ${formatDate(record)}</p>
          <p><strong>Doctor Details:</strong> ${getDoctorDetails(record)}</p>
          <p><strong>Diagnosis:</strong> ${getDiagnosis(record)}</p>
          <h2>Medicine List</h2>
          <ul>
            ${medicines.map((medicine) => `<li><strong>${medicine.name}</strong><br/>Dosage: ${medicine.dosage}<br/>Instructions: ${medicine.instructions}</li>`).join('')}
          </ul>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const sharePrescription = async (record) => {
    const url = getDownloadUrl(record);
    const text = `Prescription - ${getDiagnosis(record)} (${formatDate(record)})`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Prescription', text, url: url || window.location.href });
      } catch {}
      return;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url || text);
    }
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

        {visiblePrescriptionRecords.length ? (
          <div className="pd-prescription-list">
            {visiblePrescriptionRecords.map((prescription, index) => {
              const date = formatDate(prescription);
              const title = getTitle(prescription);
              const downloadUrl = getDownloadUrl(prescription);
              const doctorDetails = getDoctorDetails(prescription);
              const diagnosis = getDiagnosis(prescription);
              const medicines = getMedicineList(prescription);

              return (
                <div className="pd-prescription-card" key={prescription.id || prescription.appointmentId || index}>
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
                      onClick={() => printPrescription(prescription)}
                    >
                      <Printer size={15} />
                      Print
                    </button>
                    <button
                      type="button"
                      className="pd-prescription-btn pd-prescription-btn--secondary"
                      onClick={() => sharePrescription(prescription)}
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
