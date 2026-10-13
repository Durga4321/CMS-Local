import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import UserProfilePage from "../profile/UserProfilePage";
import PharmacyDashboard from "./PharmacyDashboard";
import PharmacyLayout from "./PharmacyLayout";
import PharmacyMedicineImport from "./PharmacyMedicineImport";
import PharmacyModulePlaceholder from "./PharmacyModulePlaceholder";
import PharmacyPendingPrescriptions from "./PharmacyPendingPrescriptions";

function PharmacyApp() {
  return (
    <Routes>
      <Route element={<PharmacyLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<PharmacyDashboard />} />
        <Route path="medicines" element={<PharmacyMedicineImport />} />
        <Route path="stock" element={<PharmacyModulePlaceholder title="Stock" description="Stock visibility will be connected to the medicine catalogue in a later pharmacy API step." />} />
        <Route path="billing" element={<PharmacyModulePlaceholder title="Billing" description="Pharmacy billing will be connected after the medicine and prescription workflow." />} />
        <Route path="prescriptions" element={<PharmacyPendingPrescriptions />} />
        <Route path="profile" element={<UserProfilePage roleType="pharmacist" />} />
        <Route path="change-password" element={<Navigate to="/pharmacy/profile?tab=password" replace />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default PharmacyApp;
