import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import UserProfilePage from "../profile/UserProfilePage";
import PharmacyDashboard from "./PharmacyDashboard";
import PharmacyLayout from "./PharmacyLayout";
import PharmacyMedicineImport from "./PharmacyMedicineImport";
import PharmacyBilling from "./PharmacyBilling";
import PharmacyPendingPrescriptions from "./PharmacyPendingPrescriptions";

function PharmacyApp() {
  return (
    <Routes>
      <Route element={<PharmacyLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<PharmacyDashboard />} />
        <Route path="medicines" element={<PharmacyMedicineImport />} />
        <Route path="stock" element={<PharmacyMedicineImport stockOnly />} />
        <Route path="billing" element={<PharmacyBilling />} />
        <Route path="prescriptions" element={<PharmacyPendingPrescriptions />} />
        <Route path="profile" element={<UserProfilePage roleType="pharmacist" />} />
        <Route path="change-password" element={<Navigate to="/pharmacy/profile?tab=password" replace />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default PharmacyApp;
