import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LabDashboard from "./LabDashboard";
import LabDataPage from "./LabDataPage";
import LabLayout from "./LabLayout";

function LabApp() {
  return (
    <Routes>
      <Route element={<LabLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<LabDashboard />} />
        <Route path="patients" element={<LabDataPage type="patients" />} />
        <Route path="diagnosis-tests" element={<LabDataPage type="tests" />} />
        <Route path="sample-collection" element={<LabDataPage type="samples" />} />
        <Route path="reports" element={<LabDataPage type="reports" />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default LabApp;
