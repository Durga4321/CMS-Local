import React, { Suspense, lazy } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import "./pages/SUPERADMIN/SuperAdmin.css";
import { ToastProvider } from "./components/ToastProvider";

// Pages
const DoctorApp = lazy(() => import("./doctors/DoctorApp"));
const ReceptionistApp = lazy(() => import("./Recepitionist/ReceptionistApp"));
const NurseApp = lazy(() => import("./Nurse/NurseApp"));
const PatientRoutes = lazy(() => import("./pages/PATIENTS/PatientRoutes"));
const UserProfilePage = lazy(() => import("./profile/UserProfilePage"));
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
const Doctors = lazy(() => import("./pages/DOCTORS/Doctors"));
const AddDoctor = lazy(() => import("./pages/DOCTORS/AddDoctor"));
const DoctorSchedule = lazy(() => import("./pages/DOCTORS/DoctorSchedule"));
const AdminRolesPermissions = lazy(() => import("./pages/ADMIN/RolesPermissions/AdminRolesPermissions"));
const AdminUserManagement = lazy(() => import("./pages/ADMIN/UserManagement/AdminUserManagement"));
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

const isCurrentUserSuperAdmin = () =>
  normalizeRole(localStorage.getItem("adminRole") || localStorage.getItem("userRole")) === "superadmin";

const SuperAdminRoute = ({ children }) =>
  isCurrentUserSuperAdmin() ? children : <Navigate to="/dashboard" replace />;

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="app-route-loading">Loading...</div>}>
          <Routes>

        {/* DEFAULT */}
        <Route path="/" element={<Navigate to="/login" replace />} />

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
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<UserProfilePage roleType="admin" />} />

          {/* MODULES */}
          <Route path="branches" element={<Branches />} />
          <Route path="doctors" element={<Doctors />} />
          <Route path="doctors/add" element={<AddDoctor />} />
          <Route path="doctors/register" element={<Navigate to="/doctors/add" replace />} />
          <Route path="doctors/schedule" element={<DoctorSchedule />} />
          <Route path="DoctorSchedule/schedule" element={<Doctorschedulepage />} />
          <Route path="receptionists" element={<Receptionists />} />
          <Route path="nurses" element={<Nurses />} />
          <Route path="roles" element={<AdminRolesPermissions />} />
          <Route path="roles-permissions" element={<Navigate to="/roles" replace />} />
          <Route path="users" element={<AdminUserManagement />} />

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
        <Route path="/patient/*" element={<PatientRoutes />} />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/login" replace />} />

          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
