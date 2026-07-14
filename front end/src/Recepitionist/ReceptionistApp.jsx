import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ReceptionistLayout from "./ReceptionistLayout";
import ReceptionDashboard from "./pages/ReceptionDashboard";
import ReceptionPatients from "./pages/ReceptionPatients";
import ReceptionAppointments from "./pages/ReceptionAppointments";
import ReceptionBilling from "./pages/ReceptionBilling";
import ReceptionMedicalHistory from "./pages/ReceptionMedicalHistory";
import UserProfilePage from "../profile/UserProfilePage";

function ReceptionistApp() {
  return (
    <Routes>
      <Route element={<ReceptionistLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ReceptionDashboard />} />
        <Route path="patients" element={<ReceptionPatients />} />
        <Route path="medical-history" element={<ReceptionMedicalHistory />} />
        <Route path="appointments" element={<ReceptionAppointments />} />
        <Route path="billing" element={<ReceptionBilling />} />
        <Route path="profile" element={<UserProfilePage roleType="receptionist" />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default ReceptionistApp;
