import React, { Suspense, lazy } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import "./pages/SUPERADMIN/SuperAdmin.css";
import "./styles/compact-spacing.css";
import { ToastProvider } from "./components/ToastProvider";
import PermissionRoute from "./components/PermissionRoute";

// Pages
const DoctorApp = lazy(() => import("./doctors/DoctorApp"));
const ReceptionistApp = lazy(() => import("./Recepitionist/ReceptionistApp"));
const NurseApp = lazy(() => import("./Nurse/NurseApp"));
const LabApp = lazy(() => import("./Lab/LabApp"));
const PatientRoutes = lazy(() => import("./pages/PATIENTS/PatientRoutes"));
const UserProfilePage = lazy(() => import("./profile/UserProfilePage"));
const LandingPage = lazy(() => import("./Landing/LandingPage"));
const SuperAdminDashboard = lazy(() => import("./pages/SUPERADMIN/Dashboard/Dashboard"));
const SuperAdminClinics = lazy(() => import("./pages/SUPERADMIN/Clinics/Clinics"));
const SuperAdminClinicForm = lazy(() => import("./pages/SUPERADMIN/Clinics/ClinicForm"));
const SuperAdminAdmins = lazy(() => import("./pages/SUPERADMIN/Admins/Admins"));
const SuperAdminSettings = lazy(() => import("./pages/SUPERADMIN/Settings/Settings"));
const SuperAdminReports = lazy(() => import("./pages/SUPERADMIN/Reports/Reports"));
const SuperAdminAuditLogs = lazy(() => import("./pages/SUPERADMIN/AuditLogs/AuditLogs"));
const SuperAdminNotifications = lazy(() => import("./pages/SUPERADMIN/Notifications/Notifications"));
const SuperAdminRolesPermissions = lazy(() => import("./pages/SUPERADMIN/RolesPermissions/RolesPermissions"));
const AdminLogin = lazy(() => import("./Login/Adminlogin"));
const ForgotPassword = lazy(() => import("./Login/Forgotpassword"));
const VerifyOTP = lazy(() => import("./Login/Verifyopt"));
const ResetPassword = lazy(() => import("./Login/Resertpassword"));
const Dashboard = lazy(() => import("./Dashboard/Dashboard"));
const Branches = lazy(() => import("./pages/BRANCHES/Branches"));
const Receptionists = lazy(() => import("./pages/RECEPTIONISTS/Receptionists"));
const Nurses = lazy(() => import("./pages/NURSES/Nurses"));
const LabTechnicians = lazy(() => import("./pages/LABTECHNICIANS/LabTechnicians"));
const LabFiles = lazy(() => import("./pages/LABFILES/LabFiles"));
const Doctors = lazy(() => import("./pages/DOCTORS/Doctors"));
const AddDoctor = lazy(() => import("./pages/DOCTORS/AddDoctor"));
const DoctorSchedule = lazy(() => import("./pages/DOCTORS/DoctorSchedule"));
const AdminRolesPermissions = lazy(() => import("./pages/ADMIN/RolesPermissions/AdminRolesPermissions"));
const AdminUserManagement = lazy(() => import("./pages/ADMIN/UserManagement/AdminUserManagement"));
const AdminSettings = lazy(() => import("./pages/ADMIN/Settings/AdminSettings"));
const Patients = lazy(() => import("./pages/PATIENTS/Patients"));
const PatientDetails = lazy(() => import("./pages/PATIENTS/PatientDetails"));
const PatientDashboard = lazy(() => import("./pages/PATIENTS/PatientDashboard"));
const PatientRegister = lazy(() => import("./pages/PATIENTS/PatientRegister"));
const PatientLogin = lazy(() => import("./pages/PATIENTS/PatientLogin"));
// Optional
const Appointments = lazy(() => import("./pages/APPOINTMENTS/Appointments"));
const NewAppointment = lazy(() => import("./pages/APPOINTMENTS/NewAppointment"));
const Doctorschedulepage = lazy(() => import("./pages/Schedule/docschedule"));
const Reports = lazy(() => import("./pages/REPORTS/Reports"));
const DailyReport = lazy(() => import("./pages/REPORTS/DailyReport"));
const RevenueReport = lazy(() => import("./pages/REPORTS/RevenueReport"));
const DoctorWiseReport = lazy(() => import("./pages/REPORTS/DoctorWiseReport"));
// ensure app styles include patient styles

const normalizeRole = (role = "") =>
  String(role || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const getSessionValue = (key) =>
  sessionStorage.getItem(key) || localStorage.getItem(key) || "";

const isCurrentUserSuperAdmin = () =>
  normalizeRole(getSessionValue("adminRole") || getSessionValue("userRole")) === "superadmin";

const SuperAdminRoute = ({ children }) =>
  isCurrentUserSuperAdmin() ? children : <Navigate to="/dashboard" replace />;

const PatientRoute = ({ children }) => {
  const patientToken = getSessionValue("patientToken");
  const patientRole = normalizeRole(getSessionValue("patientRole") || getSessionValue("userRole"));

  return patientToken || patientRole === "patient"
    ? children
    : <Navigate to="/login/patient" replace />;
};

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="app-route-loading">Loading...</div>}>
          <Routes>

        {/* DEFAULT */}
        <Route path="/" element={<LandingPage />} />

        {/* LOGIN */}
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/VerifyOTP" element={<VerifyOTP />} />
        <Route path="/ResetPassword" element={<ResetPassword />} />

        {/* PATIENT AUTH - Separate Register & Login pages */}
        <Route path="/register/patient" element={<PatientRegister />} />
        <Route path="/login/patient" element={<PatientLogin />} />
        {/* Redirect aliases so old links still work */}
        <Route path="/patients/register" element={<Navigate to="/register/patient" replace />} />
        <Route path="/patient/register" element={<Navigate to="/register/patient" replace />} />
        <Route path="/patient/login" element={<Navigate to="/login/patient" replace />} />

        {/* MAIN LAYOUT */}
        <Route element={<AppLayout />}>

          {/* Dashboard */}
          <Route path="dashboard" element={<PermissionRoute roleType="admin" module="Dashboard"><Dashboard /></PermissionRoute>} />
          <Route path="profile" element={<UserProfilePage roleType="admin" />} />

          {/* MODULES */}
          <Route path="branches" element={<PermissionRoute roleType="admin" module="Branches"><Branches /></PermissionRoute>} />
          <Route path="doctors" element={<PermissionRoute roleType="admin" module="Doctors"><Doctors /></PermissionRoute>} />
          <Route path="doctors/add" element={<PermissionRoute roleType="admin" module="Doctors"><AddDoctor /></PermissionRoute>} />
          <Route path="doctors/register" element={<Navigate to="/doctors/add" replace />} />
          <Route path="doctors/schedule" element={<PermissionRoute roleType="admin" module="Doctors"><DoctorSchedule /></PermissionRoute>} />
          <Route path="DoctorSchedule/schedule" element={<PermissionRoute roleType="admin" module="Schedule Settings"><Doctorschedulepage /></PermissionRoute>} />
          <Route path="receptionists" element={<PermissionRoute roleType="admin" module="Receptionists"><Receptionists /></PermissionRoute>} />
          <Route path="nurses" element={<PermissionRoute roleType="admin" module="Nurses"><Nurses /></PermissionRoute>} />
          <Route path="lab-technicians" element={<PermissionRoute roleType="admin" module="Lab Technicians"><LabTechnicians /></PermissionRoute>} />
          <Route path="lab-files" element={<PermissionRoute roleType="admin" module="Lab Files"><LabFiles /></PermissionRoute>} />
          <Route path="roles" element={<PermissionRoute roleType="admin" module="Roles & Permissions"><AdminRolesPermissions /></PermissionRoute>} />
          <Route path="roles-permissions" element={<Navigate to="/roles" replace />} />
          <Route path="users" element={<PermissionRoute roleType="admin" module="User Management"><AdminUserManagement /></PermissionRoute>} />
          <Route path="settings" element={<PermissionRoute roleType="admin" module="Settings"><AdminSettings /></PermissionRoute>} />

          <Route path="patients" element={<PermissionRoute roleType="admin" module="Patients"><Patients /></PermissionRoute>} />
          <Route path="patients/dashboard" element={<PermissionRoute roleType="admin" module="Patients"><PatientDashboard /></PermissionRoute>} />
            <Route path="patients/:id" element={<PermissionRoute roleType="admin" module="Patients"><PatientDetails /></PermissionRoute>} /> {/* ✅ IMPORTANT */}

          <Route path="appointments" element={<PermissionRoute roleType="admin" module="Appointments"><Appointments /></PermissionRoute>} />
          <Route path="appointments/new" element={<PermissionRoute roleType="admin" module="Appointments"><NewAppointment /></PermissionRoute>} />

          <Route path="reports" element={<PermissionRoute roleType="admin" module="Reports"><Reports /></PermissionRoute>} />
          <Route path="reports/daily" element={<PermissionRoute roleType="admin" module="Reports"><DailyReport /></PermissionRoute>} />
          <Route path="RevenueReport/daily" element={<PermissionRoute roleType="admin" module="Reports"><RevenueReport /></PermissionRoute>} />
          <Route path="DoctorWiseReport/daily" element={<PermissionRoute roleType="admin" module="Reports"><DoctorWiseReport /></PermissionRoute>} />

          <Route path="superadmin" element={<Navigate to="/superadmin/dashboard" replace />} />
          <Route path="superadmin/dashboard" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
          <Route path="superadmin/clinics" element={<SuperAdminRoute><SuperAdminClinics /></SuperAdminRoute>} />
          <Route path="superadmin/clinics/add" element={<SuperAdminRoute><SuperAdminClinicForm mode="add" /></SuperAdminRoute>} />
          <Route path="superadmin/clinics/edit/:id" element={<SuperAdminRoute><SuperAdminClinicForm mode="edit" /></SuperAdminRoute>} />
          <Route path="superadmin/admins" element={<SuperAdminRoute><SuperAdminAdmins /></SuperAdminRoute>} />
          <Route path="superadmin/users" element={<Navigate to="/superadmin/dashboard" replace />} />
          <Route path="superadmin/settings" element={<SuperAdminRoute><SuperAdminSettings /></SuperAdminRoute>} />
          <Route path="superadmin/roles" element={<SuperAdminRoute><SuperAdminRolesPermissions /></SuperAdminRoute>} />
          <Route path="superadmin/roles-permissions" element={<Navigate to="/superadmin/roles" replace />} />
          <Route path="superadmin/reports" element={<SuperAdminRoute><SuperAdminReports /></SuperAdminRoute>} />
          <Route path="superadmin/audit-logs" element={<SuperAdminRoute><SuperAdminAuditLogs /></SuperAdminRoute>} />
          <Route path="superadmin/notifications" element={<SuperAdminRoute><SuperAdminNotifications /></SuperAdminRoute>} />

        </Route>

        {/* ── SEPARATE DOCTOR DASHBOARD ── */}
        <Route path="/doctor/*" element={<DoctorApp />} />
        <Route path="/reception/*" element={<ReceptionistApp />} />
        <Route path="/nurse/*" element={<NurseApp />} />
        <Route path="/lab/*" element={<LabApp />} />
        <Route path="/patient/*" element={<PatientRoute><PatientRoutes /></PatientRoute>} />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/login" replace />} />

          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
