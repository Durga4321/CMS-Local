import React, { useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import Sidebar from "../Sidebar/Sidebar";
import Topbar from "../Topbar/Topbar";
import "./AppLayout.css";

const normalizeRole = (role = "") =>
  String(role || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const getSessionValue = (key) =>
  sessionStorage.getItem(key) || localStorage.getItem(key) || "";

const useAuth = () => {
  const token =
    getSessionValue("token") ||
    getSessionValue("adminToken") ||
    getSessionValue("doctorToken") ||
    getSessionValue("receptionistToken") ||
    getSessionValue("nurseToken") ||
    getSessionValue("labToken") ||
    getSessionValue("patientToken");

  const role =
    getSessionValue("adminRole") ||
    getSessionValue("receptionistRole") ||
    getSessionValue("nurseRole") ||
    getSessionValue("labRole") ||
    getSessionValue("userRole") ||
    "";

  const normalizedRole = normalizeRole(role);

  const isDoctor = normalizedRole === "doctor" || Boolean(getSessionValue("doctorToken"));
  const isReceptionist = normalizedRole === "receptionist" || Boolean(getSessionValue("receptionistToken"));
  const isNurse = normalizedRole === "nurse" || Boolean(getSessionValue("nurseToken"));
  const isLab = normalizedRole === "labtechnician" || normalizedRole === "lab" || Boolean(getSessionValue("labToken"));
  const isPatient = normalizedRole === "patient" || Boolean(getSessionValue("patientToken"));
  const isSuperAdmin = normalizedRole === "superadmin";

  return {
    user: token ? { name: "Admin", isDoctor, isReceptionist, isNurse, isLab, isPatient, isSuperAdmin } : null,
  };
};

function AppLayout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;
  if (user.isDoctor) return <Navigate to="/doctor/dashboard" replace />;
  if (user.isReceptionist) return <Navigate to="/reception/dashboard" replace />;
  if (user.isNurse) return <Navigate to="/nurse/dashboard" replace />;
  if (user.isLab) return <Navigate to="/lab/dashboard" replace />;
  if (user.isPatient) return <Navigate to="/patient/dashboard" replace />;

  if (location.pathname.startsWith("/superadmin") && !user.isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="layout">
      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="main">
        <Topbar onMenu={() => setOpen(true)} />

        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
