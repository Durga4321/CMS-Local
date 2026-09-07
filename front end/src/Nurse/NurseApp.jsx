import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import NurseLayout from "./NurseLayout";
import NurseDashboard from "./NurseDashboard";
import NursePatients from "./NursePatients";
import NurseAppointments from "./NurseAppointments";
import NurseMedicalHistory from "./NurseMedicalHistory";
import NurseOnlineBookings from "./NurseOnlineBookings";
import NurseOfflineBookings from "./NurseOfflineBookings";
import UserProfilePage from "../profile/UserProfilePage";
import ConsultantRoomDisplay from "../components/ConsultantRoomDisplay";
import PermissionRoute from "../components/PermissionRoute";

function NurseApp() {
  return (
    <Routes>
      <Route element={<NurseLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<PermissionRoute roleType="nurse" module="Nurse Dashboard"><NurseDashboard /></PermissionRoute>} />
        <Route path="patients" element={<PermissionRoute roleType="nurse" module="Patients"><NursePatients /></PermissionRoute>} />
        <Route path="medical-history" element={<PermissionRoute roleType="nurse" module="Medical History"><NurseMedicalHistory /></PermissionRoute>} />
        <Route path="appointments" element={<PermissionRoute roleType="nurse" module={["Book Appointment", "Appointments"]}><NurseAppointments /></PermissionRoute>} />
        <Route path="appointments/online" element={<PermissionRoute roleType="nurse" module="Online Bookings"><NurseOnlineBookings /></PermissionRoute>} />
        <Route path="appointments/offline" element={<PermissionRoute roleType="nurse" module="Offline Bookings"><NurseOfflineBookings /></PermissionRoute>} />
        <Route path="consultant-room" element={<ConsultantRoomDisplay audience="nurse" />} />
        <Route path="profile" element={<UserProfilePage roleType="nurse" />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default NurseApp;
