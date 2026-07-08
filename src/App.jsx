import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { Bell, Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, CreditCard, Download, Edit3, FileText, Heart, Key, Link as LinkIcon, LogOut, Mail, MapPin, Pill, Phone, Search, Stethoscope, Trash2, UserRound, Wallet, X } from "lucide-react";
import { apiUrl } from "./config/api";
import { formatIndianCurrency } from "./utils/format";
// ensure app styles include patient styles

const normalizeRole = (role = "") =>
  String(role || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const isCurrentUserSuperAdmin = () =>
  normalizeRole(localStorage.getItem("adminRole") || localStorage.getItem("userRole")) === "superadmin";

const SuperAdminRoute = ({ children }) =>
  isCurrentUserSuperAdmin() ? children : <Navigate to="/dashboard" replace />;

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
    setMenuOpen(false);
    navigate("/patients/register", { replace: true });
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
          <NavLink to="/patient/profile" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <UserRound size={16} />
            <span>My Profile</span>
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
                      navigate('/patient/profile');
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

  useEffect(() => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    const headers = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

    const fetchData = async () => {
      try {
        const [pRes, aRes, rxRes, bRes, nRes] = await Promise.all([
          fetch(apiUrl('patient-portal/profile'), { headers }),
          fetch(apiUrl('patient-portal/appointments'), { headers }),
          fetch(apiUrl('patient-portal/prescriptions'), { headers }),
          fetch(apiUrl('patient-portal/bills'), { headers }),
          fetch(apiUrl('patient-portal/notifications'), { headers }),
        ]);

        const pData = await pRes.json().catch(() => ({}));
        const aData = await aRes.json().catch(() => ([]));
        const rxData = await rxRes.json().catch(() => ([]));
        const bData = await bRes.json().catch(() => ([]));
        const nData = await nRes.json().catch(() => ([]));

        if (pRes.ok) setPatient(pData);
        if (aRes.ok) setVisits(Array.isArray(aData) ? aData : aData.items || []);
        if (rxRes.ok) setPrescriptions(Array.isArray(rxData) ? rxData : rxData.items || []);
        if (bRes.ok) setBills(Array.isArray(bData) ? bData : bData.items || []);
        if (nRes.ok) setNotifications(Array.isArray(nData) ? nData : nData.items || []);
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
        <Route path="medical-history" element={<PatientMedicalHistoryPage patient={patient} visits={visits} />} />
        <Route path="history" element={<Navigate to="medical-history" replace />} />
        <Route path="reports" element={<Navigate to="medical-history" replace />} />
        <Route path="prescriptions" element={<PatientPrescriptionsPage prescriptions={prescriptions} />} />
        <Route path="bills" element={<PatientBillsPage bills={bills} />} />
        <Route path="billing" element={<Navigate to="bills" replace />} />
        <Route path="notifications" element={<PatientNotificationsPage notifications={notifications} />} />
        <Route path="profile" element={<PatientProfilePage patient={patient} visits={visits} prescriptions={prescriptions} bills={bills} notifications={notifications} />} />
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
          <p className="pd-eyebrow">Patient portal</p>
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

  const getValue = (record, path) => {
    if (record == null) return undefined;
    if (typeof path === 'string') path = path.split('.');
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
    if (typeof value === 'object') return readFirst(value, ['name', 'clinicName', 'hospitalName', 'title', 'label']);
    return String(value);
  };

  const apiHeaders = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(localStorage.getItem('patientToken') || localStorage.getItem('token')
      ? { Authorization: `Bearer ${localStorage.getItem('patientToken') || localStorage.getItem('token')}` }
      : {}),
  };

  useEffect(() => {
    const tryFetchList = async (paths) => {
      for (const path of paths) {
        try {
          const res = await fetch(apiUrl(path), { headers: apiHeaders });
          if (!res.ok) continue;
          const data = await res.json().catch(() => []);
          if (Array.isArray(data)) return data;
          if (Array.isArray(data.items)) return data.items;
          if (Array.isArray(data.data)) return data.data;
          if (data.data && Array.isArray(data.data.items)) return data.data.items;
          if (Array.isArray(data.clinics)) return data.clinics;
          if (Array.isArray(data.result)) return data.result;
          if (Array.isArray(data.results)) return data.results;
        } catch (err) {
          continue;
        }
      }
      return [];
    };

    const fetchBookingData = async () => {
      try {
        const [clinicList, departmentList, doctorList, slotList] = await Promise.all([
          tryFetchList(['Clinics', 'clinics']),
          tryFetchList(['patient-portal/departments', 'departments']),
          tryFetchList(['patient-portal/doctors', 'doctors']),
          tryFetchList(['patient-portal/slots', 'slots']),
        ]);

        setClinics(clinicList);
        setDepartments(departmentList);
        setDoctors(doctorList);
        setSlots(slotList);
      } catch (err) {
        // ignore backend fetch failures and fall back to visit-derived options
      }
    };

    fetchBookingData();
  }, []);

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
      const response = await fetch(apiUrl('patient-portal/appointments'), {
        method: 'POST',
        headers: apiHeaders,
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

function PatientMedicalHistoryPage({ patient, visits = [] }) {
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    const headers = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

    const fetchHistory = async () => {
      setLoadingHistory(true);
      setHistoryError("");
      try {
        const response = await fetch(apiUrl('patient-portal/medical-history'), { headers });
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

  const chronicConditions = normalizeList(history?.chronicConditions || history?.chronicDiseases || history?.conditions);
  const allergies = normalizeList(history?.allergies || history?.allergyList || history?.allergy);
  const currentMedications = normalizeList(history?.currentMedications || history?.medications || history?.drugs);

  const visitRecords = Array.isArray(history?.visits)
    ? history.visits
    : Array.isArray(history?.appointments)
    ? history.appointments
    : visits;

  const readVisitDate = (visit) =>
    readFirst(visit, ['date', 'visitDate', 'appointmentDate', 'createdAt', 'appointment?.date']) || 'Unknown date';

  const readVisitDoctor = (visit) =>
    readFirst(visit, ['doctor.name', 'doctorName', 'practitioner', 'provider']) || 'Doctor details unavailable';

  const readVisitSpecialty = (visit) =>
    readFirst(visit, ['specialty', 'departmentName', 'department', 'condition']) || '';

  const readVisitSummary = (visit) =>
    readFirst(visit, ['summary', 'reason', 'notes', 'diagnosis']) || '';

  return (
    <PatientPageShell
      title="Medical history"
      subtitle="Your record of visits, conditions, and treatments pulled from the patient API."
    >
      <div className="mh-grid">
        <div className="mh-card">
          <h3>Chronic conditions</h3>
          {loadingHistory ? (
            <p>Loading...</p>
          ) : chronicConditions.length ? (
            <div className="mh-chip-list">
              {chronicConditions.map((item, index) => (
                <span key={index} className="mh-chip">
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p>No chronic conditions recorded.</p>
          )}
        </div>
        <div className="mh-card">
          <h3>Allergies</h3>
          {loadingHistory ? (
            <p>Loading...</p>
          ) : allergies.length ? (
            <div className="mh-chip-list">
              {allergies.map((item, index) => (
                <span key={index} className="mh-chip">
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p>No allergies recorded.</p>
          )}
        </div>
        <div className="mh-card">
          <h3>Current medications</h3>
          {loadingHistory ? (
            <p>Loading...</p>
          ) : currentMedications.length ? (
            <div className="mh-chip-list">
              {currentMedications.map((item, index) => (
                <span key={index} className="mh-chip">
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p>No medications recorded.</p>
          )}
        </div>
      </div>

      <div className="mh-panel">
        <div className="mh-panel-header">
          <div>
            <h2>Previous visits</h2>
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
            <p>No medical history found.</p>
          </div>
        )}
      </div>
    </PatientPageShell>
  );
}

function PatientPrescriptionsPage({ prescriptions = [] }) {
  const prescriptionRecords = Array.isArray(prescriptions) ? prescriptions : [];

  const formatDate = (record) =>
    readFirst(record, ['visitDate', 'date', 'prescribedOn', 'createdAt', 'appointmentDate']) || 'Unknown date';

  const getTitle = (record) =>
    readFirst(record, ['title', 'summary', 'diagnosis', 'condition', 'description']) || 'Prescription';

  const getDoctor = (record) => {
    const doctorName = readFirst(record, ['doctorName', 'doctor.name', 'provider.name', 'prescribedBy']);
    return doctorName ? `Prescribed by ${doctorName}` : 'Doctor unavailable';
  };

  const getMedicationCount = (record) => {
    const count =
      Array.isArray(record.medicines) && record.medicines.length
        ? record.medicines.length
        : Array.isArray(record.medicineNames) && record.medicineNames.length
        ? record.medicineNames.length
        : record.medicationCount || record.medicineCount || record.medicinesCount || 0;
    return count ? `${count} medicine${count === 1 ? '' : 's'}` : '';
  };

  const getDownloadUrl = (record) =>
    readFirst(record, ['documentUrl', 'downloadUrl', 'prescriptionUrl', 'url']) || '';

  const viewPrescription = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <PatientPageShell
      title="Prescriptions"
      subtitle="View, download or share your prescriptions."
    >
      <div className="pd-card">
        <div className="pd-section-header">
          <div>
            <h2>Prescription records</h2>
            <p>Current and historical prescriptions.</p>
          </div>
        </div>

        {prescriptionRecords.length ? (
          <div className="pd-prescription-list">
            {prescriptionRecords.map((prescription, index) => {
              const date = formatDate(prescription);
              const title = getTitle(prescription);
              const doctor = getDoctor(prescription);
              const count = getMedicationCount(prescription);
              const downloadUrl = getDownloadUrl(prescription);

              return (
                <div className="pd-prescription-card" key={prescription.id || prescription.appointmentId || index}>
                  <div className="pd-prescription-copy">
                    <span className="pd-prescription-date">{date}</span>
                    <h3>{title}</h3>
                    <p className="pd-prescription-subtitle">
                      {doctor}
                      {count ? ` • ${count}` : ''}
                    </p>
                  </div>
                  <div className="pd-prescription-actions">
                    <button
                      type="button"
                      className="pd-prescription-btn pd-prescription-btn--ghost"
                      onClick={() => viewPrescription(downloadUrl)}
                      disabled={!downloadUrl}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="pd-prescription-btn pd-prescription-btn--primary"
                      onClick={() => viewPrescription(downloadUrl)}
                      disabled={!downloadUrl}
                    >
                      Download
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

  const paymentStatus = (record) =>
    String(readFirst(record, ['status', 'paymentStatus', 'billStatus']) || 'Pending').toLowerCase();

  const totalAmount = (record) => Number(readFirst(record, ['total', 'amount', 'invoiceAmount', 'grandTotal', 'dueAmount', 'netAmount']) || 0);
  const paidAmount = (record) => Number(readFirst(record, ['paidAmount', 'paid', 'settledAmount']) || 0);
  const dueAmount = (record) => Number(readFirst(record, ['dueAmount', 'balance', 'outstandingAmount']) || 0);

  const uniquePaymentModes = Array.from(
    new Set(billRecords.map((bill) => paymentMode(bill)).filter(Boolean))
  );

  const pendingTotal = billRecords.reduce((sum, bill) => sum + Math.max(dueAmount(bill), 0), 0);
  const settledTotal = billRecords.reduce((sum, bill) => sum + (paidAmount(bill) || 0), 0);
  const invoiceCount = billRecords.length;

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
    const mode = paymentMode(record);
    return paymentUrl(record) ? `Pay by ${mode}` : 'Payment unavailable';
  };

  const payInvoice = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <PatientPageShell
      title="Bills"
      subtitle="Track billing, lab charges, medicine fees, invoices and payments."
    >
      <div className="pb-summary-grid">
        <div className="pb-summary-card">
          <span className="pb-summary-title">Pending amount</span>
          <strong>{formatAmount(pendingTotal)}</strong>
          <p>Needs payment</p>
        </div>
        <div className="pb-summary-card">
          <span className="pb-summary-title">Paid amount</span>
          <strong>{formatAmount(settledTotal)}</strong>
          <p>Settled invoices</p>
        </div>
        <div className="pb-summary-card">
          <span className="pb-summary-title">Invoices</span>
          <strong>{invoiceCount}</strong>
          <p>Available to view</p>
        </div>
        <div className="pb-summary-card">
          <span className="pb-summary-title">Payment modes</span>
          <strong>{uniquePaymentModes.length}</strong>
          <p>{uniquePaymentModes.join(', ') || 'None'}</p>
        </div>
      </div>

      {billRecords.length ? (
        <div className="pb-invoice-list">
          {billRecords.map((bill, index) => {
            const status = paymentStatus(bill);
            const total = totalAmount(bill);
            const paid = paidAmount(bill);
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
                    <span className="pb-payment-badge">{paymentMode(bill)}</span>
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
      ) : (
        <div className="pd-selected-notification">
          <p>No bills available.</p>
        </div>
      )}
    </PatientPageShell>
  );
}

function PatientNotificationsPage({ notifications = [] }) {
  return (
    <PatientPageShell
      title="Notifications"
      subtitle="Recent updates from the clinic and billing desk."
    >
      <div className="pd-card">
        <div className="pd-section-header">
          <div>
            <h2>Recent notifications</h2>
            <p>Synced from the patient portal API.</p>
          </div>
        </div>
        {notifications.length ? (
          <div className="pd-notification-list">
            {notifications.map((notification, index) => (
              <div className={`pd-notification-item ${notification.read ? "is-read" : "is-unread"}`} key={notification.id || index}>
                <span className="pd-notification-dot" />
                <div className="pd-notification-body">
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <em>{notification.date}</em>
                </div>
                <Bell size={16} className="pd-notification-chevron" />
              </div>
            ))}
          </div>
        ) : (
          <div className="pd-selected-notification">
            <p>No notifications available.</p>
          </div>
        )}
      </div>
    </PatientPageShell>
  );
}

function PatientProfilePage({ patient, visits = [], prescriptions = [], bills = [], notifications = [] }) {
  const currentPatient = patient || {};
  const profileName = currentPatient.name || currentPatient.firstName || "Patient";
  const profileEmail = currentPatient.email || "Email not available";
  const profilePhone = currentPatient.phone || "Phone not available";
  const profileGender = currentPatient.gender || "Gender not available";
  const profileAge = currentPatient.age || currentPatient.dob || "Age not available";
  const profileBloodGroup = currentPatient.bloodGroup || currentPatient.bloodgroup || "-";
  const profileId = currentPatient.id || currentPatient.patientCode || "-";
  const profileAddress = currentPatient.address || "Address not available";
  const profileEmergencyName = currentPatient.emergencyContactName || "-";
  const profileEmergencyPhone = currentPatient.emergencyContactPhone || "-";
  const profileLastVisit = visits[0]?.date || currentPatient.lastVisit || "-";
  const profileInitials = String(profileName)
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <PatientPageShell
      title="My profile"
      subtitle="Profile details and summary cards backed by the live patient session."
    >
      <div className="pd-bottom-grid">
        <div className="pd-card">
          <div className="pd-section-header">
            <div>
              <h2>Profile</h2>
              <p>Identity, contact, and emergency details from the live patient session.</p>
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
          <div className="pd-profile-strip pd-profile-strip--expanded" style={{ marginTop: 16 }}>
            <div><span>Patient ID</span><strong>{profileId}</strong></div>
            <div><span>Age / DOB</span><strong>{profileAge}</strong></div>
            <div><span>Gender</span><strong>{profileGender}</strong></div>
            <div><span>Blood group</span><strong>{profileBloodGroup}</strong></div>
            <div><span>Phone</span><strong>{profilePhone}</strong></div>
            <div><span>Email</span><strong>{profileEmail}</strong></div>
            <div><span>Emergency contact</span><strong>{profileEmergencyName}</strong></div>
            <div><span>Emergency phone</span><strong>{profileEmergencyPhone}</strong></div>
            <div><span>Address</span><strong>{profileAddress}</strong></div>
            <div><span>Last visit</span><strong>{profileLastVisit}</strong></div>
          </div>
        </div>

        <div className="pd-card">
          <div className="pd-section-header">
            <div>
              <h2>Summary</h2>
              <p>Quick counts from the portal backend.</p>
            </div>
          </div>
          <div className="pd-stats-container" style={{ gridTemplateColumns: "1fr" }}>
            <div className="pd-stat-card">
              <div className="pd-stat-icon pd-stat-icon--teal"><Calendar size={18} /></div>
              <div className="pd-stat-copy"><p className="pd-stat-label">Visits</p><h2 className="pd-stat-value">{visits.length}</h2><span className="pd-stat-description">Completed consultations</span></div>
            </div>
            <div className="pd-stat-card">
              <div className="pd-stat-icon pd-stat-icon--amber"><Pill size={18} /></div>
              <div className="pd-stat-copy"><p className="pd-stat-label">Prescriptions</p><h2 className="pd-stat-value">{prescriptions.length}</h2><span className="pd-stat-description">Ready to review</span></div>
            </div>
            <div className="pd-stat-card">
              <div className="pd-stat-icon pd-stat-icon--green"><Wallet size={18} /></div>
              <div className="pd-stat-copy"><p className="pd-stat-label">Bills</p><h2 className="pd-stat-value">{bills.length}</h2><span className="pd-stat-description">Billing records</span></div>
            </div>
            <div className="pd-stat-card">
              <div className="pd-stat-icon pd-stat-icon--blue"><Bell size={18} /></div>
              <div className="pd-stat-copy"><p className="pd-stat-label">Notifications</p><h2 className="pd-stat-value">{notifications.length}</h2><span className="pd-stat-description">Recent updates</span></div>
            </div>
          </div>
        </div>
      </div>
    </PatientPageShell>
  );
}
