import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ReceptionistLayout from "./ReceptionistLayout";
import ReceptionDashboard from "./pages/ReceptionDashboard";
import ReceptionPatients from "./pages/ReceptionPatients";
import ReceptionAppointments from "./pages/ReceptionAppointments";
import ReceptionBilling from "./pages/ReceptionBilling";
import ReceptionMedicalHistory from "./pages/ReceptionMedicalHistory";
import ReceptionOnlineBookings from "./pages/ReceptionOnlineBookings";
import ReceptionOfflineBookings from "./pages/ReceptionOfflineBookings";
import UserProfilePage from "../profile/UserProfilePage";
import PermissionRoute from "../components/PermissionRoute";

function ReceptionistApp() {
  return (
    <Routes>
      <Route element={<ReceptionistLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<PermissionRoute roleType="receptionist" module="Reception Dashboard"><ReceptionDashboard /></PermissionRoute>} />
        <Route path="patients" element={<PermissionRoute roleType="receptionist" module="Patients"><ReceptionPatients /></PermissionRoute>} />
        <Route path="medical-history" element={<PermissionRoute roleType="receptionist" module="Medical History"><ReceptionMedicalHistory /></PermissionRoute>} />
        <Route path="appointments" element={<PermissionRoute roleType="receptionist" module="Book Appointment"><ReceptionAppointments /></PermissionRoute>} />
        <Route path="appointments/online" element={<PermissionRoute roleType="receptionist" module="Online Bookings"><ReceptionOnlineBookings /></PermissionRoute>} />
        <Route path="appointments/offline" element={<PermissionRoute roleType="receptionist" module="Offline Bookings"><ReceptionOfflineBookings /></PermissionRoute>} />
        <Route path="billing" element={<PermissionRoute roleType="receptionist" module="Billing"><ReceptionBilling /></PermissionRoute>} />
        <Route path="profile" element={<UserProfilePage roleType="receptionist" />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default ReceptionistApp;
