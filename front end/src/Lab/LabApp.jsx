import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LabDashboard from "./LabDashboard";
import LabDataPage from "./LabDataPage";
import LabLayout from "./LabLayout";
import LabReportCreate from "./LabReportCreate";
import PermissionRoute from "../components/PermissionRoute";

function LabApp() {
  return (
    <Routes>
      <Route element={<LabLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<PermissionRoute roleType="lab" module="Lab Dashboard"><LabDashboard /></PermissionRoute>} />
        <Route path="patients" element={<PermissionRoute roleType="lab" module="Patients"><LabDataPage type="patients" /></PermissionRoute>} />
        <Route path="diagnosis-tests" element={<PermissionRoute roleType="lab" module="Diagnosis Tests"><LabDataPage type="tests" /></PermissionRoute>} />
        <Route path="sample-collection" element={<PermissionRoute roleType="lab" module="Sample Collection"><LabDataPage type="samples" /></PermissionRoute>} />
        <Route path="reports" element={<PermissionRoute roleType="lab" module="Reports"><LabDataPage type="reports" /></PermissionRoute>} />
        <Route path="report-create" element={<PermissionRoute roleType="lab" module="Create Report"><LabReportCreate /></PermissionRoute>} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default LabApp;
