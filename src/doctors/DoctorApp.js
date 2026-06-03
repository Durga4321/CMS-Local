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
import DoctorSettingsPage from "./pages/DoctorSettings";

/* Simple settings placeholder */
function DoctorSettings() {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
      padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 15
    }}>
      ⚙️ &nbsp; Settings — coming soon
    </div>
  );
}

function DoctorApp() {
  return (
    <Routes>
      <Route element={<DoctorLayout />}>
        {/* Default → dashboard */}
        <Route index element={<Navigate to="dashboard" replace />} />

        <Route path="dashboard" element={<DoctorDashboard />} />
        <Route path="patient-details/:patientId" element={<PatientDetails />} />
        <Route path="patient-details" element={<PatientDetails />} />
        <Route path="consultation" element={<Consultation />} />
        <Route path="prescription" element={<Prescription />} />
        <Route path="appointments" element={<DoctorAppointments />} />
        <Route path="completion" element={<Completion />} />
        <Route path="profile" element={<UserProfilePage roleType="doctor" />} />
        <Route path="settings" element={<DoctorSettingsPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}



export default DoctorApp;
