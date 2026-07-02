import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import DoctorApp from "./doctors/DoctorApp";
import ReceptionistApp from "./Recepitionist/ReceptionistApp";
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
          <Route path="patients/:id" element={<PatientDetails />} />

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

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
