import React, { useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import Sidebar from "../Sidebar/Sidebar";
import Topbar from "../Topbar/Topbar";
import "./AppLayout.css";

const normalizeRole = (role = "") =>
  String(role || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const useAuth = () => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("doctorToken") ||
    localStorage.getItem("receptionistToken") ||
    localStorage.getItem("patientToken");

  const role =
    localStorage.getItem("adminRole") ||
    localStorage.getItem("receptionistRole") ||
    localStorage.getItem("userRole") ||
    "";

  const normalizedRole = normalizeRole(role);

  const isDoctor = normalizedRole === "doctor" || Boolean(localStorage.getItem("doctorToken"));
  const isReceptionist = normalizedRole === "receptionist" || Boolean(localStorage.getItem("receptionistToken"));
  const isPatient = normalizedRole === "patient" || Boolean(localStorage.getItem("patientToken"));
  const isSuperAdmin = normalizedRole === "superadmin";

  return {
    user: token ? { name: "Admin", isDoctor, isReceptionist, isPatient, isSuperAdmin } : null,
  };
};

function AppLayout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;
  if (user.isDoctor) return <Navigate to="/doctor/dashboard" replace />;
  if (user.isReceptionist) return <Navigate to="/reception/dashboard" replace />;
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
