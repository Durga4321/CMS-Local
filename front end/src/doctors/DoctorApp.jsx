import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DoctorLayout from "./DoctorLayout";
import DoctorDashboard from "./pages/DoctorDashboard";
import PatientDetails from "./pages/PatientDetails";
import Consultation from "./pages/Consultation";
import Prescription from "./pages/Prescription";
import DoctorAppointments from "./pages/DoctorAppointments";
import Completion from "./pages/Completion";
import UserProfilePage from "../profile/UserProfilePage";
import DoctorSchedule from "../pages/DOCTORS/DoctorSchedule";
import PermissionRoute from "../components/PermissionRoute";

function DoctorApp() {
  return (
    <Routes>
      <Route element={<DoctorLayout />}>
        {/* Default → dashboard */}
        <Route index element={<Navigate to="dashboard" replace />} />

        <Route path="dashboard" element={<PermissionRoute roleType="doctor" module="Dashboard"><DoctorDashboard /></PermissionRoute>} />
        <Route path="patient-details/:patientId" element={<PatientDetails />} />
        <Route path="patient-details" element={<PatientDetails />} />
        <Route path="consultation" element={<PermissionRoute roleType="doctor" module="Consultation"><Consultation /></PermissionRoute>} />
        <Route path="prescription" element={<PermissionRoute roleType="doctor" module="Prescription"><Prescription /></PermissionRoute>} />
        <Route path="appointments" element={<PermissionRoute roleType="doctor" module="Appointments"><DoctorAppointments /></PermissionRoute>} />
        <Route path="schedule" element={<PermissionRoute roleType="doctor" module="My Schedule"><DoctorSchedule selfMode /></PermissionRoute>} />
        <Route path="completion" element={<Completion />} />
        <Route path="profile" element={<UserProfilePage roleType="doctor" />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}



export default DoctorApp;
