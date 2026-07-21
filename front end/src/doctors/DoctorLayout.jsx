import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import DoctorSidebar from "./DoctorSidebar";
import DoctorTopbar from "./DoctorTopbar";
import { loadStaffRolePermissions } from "../utils/staffRolePermissions";
import "./DoctorLayout.css";

const PAGE_TITLES = {
  "/doctor/dashboard":    "Dashboard",
  "/doctor/consultation": "Consultation",
  "/doctor/prescription": "Prescription",
  "/doctor/appointments": "Appointments",
};

function DoctorLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth > 768
  );
  const [doctorSearch, setDoctorSearch] = useState("");
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("doctorToken") ||
    localStorage.getItem("adminToken");
  const role =
    localStorage.getItem("doctorRole") ||
    localStorage.getItem("userRole") ||
    localStorage.getItem("adminRole") ||
    "";
  const isDoctor =
    String(role).toLowerCase() === "doctor" ||
    Boolean(localStorage.getItem("doctorToken"));

  useEffect(() => {
    loadStaffRolePermissions().catch(() => {});
  }, []);

  if (!token) return <Navigate to="/login" replace />;
  if (!isDoctor) return <Navigate to="/dashboard" replace />;

  const title =
    Object.entries(PAGE_TITLES).find(([key]) =>
      location.pathname.startsWith(key)
    )?.[1] || "Doctor Dashboard";

  return (
    <div className={`dr-layout${sidebarOpen ? "" : " dr-layout--collapsed"}`}>
      <button
        type="button"
        className="dr-sidebar-overlay"
        aria-label="Close navigation menu"
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={() => setSidebarOpen(false)}
      />
      <DoctorSidebar />
      <div className="dr-layout-body">
            <DoctorTopbar
              title={title}
              sidebarOpen={sidebarOpen}
              onMenuToggle={() => setSidebarOpen((p) => !p)}
              search={doctorSearch}
              onSearch={setDoctorSearch}
            />
            <main className="dr-layout-content">
              <Outlet context={{ doctorSearch, setDoctorSearch }} />
        </main>
      </div>
    </div>
  );
}

export default DoctorLayout;
