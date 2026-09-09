import React, { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import NurseSidebar from "./NurseSidebar";
import NurseTopbar from "./NurseTopbar";
import { getNurseProfile, isNurseSession } from "./nurseSession";
import "../Recepitionist/Receptionist.css";
import "./Nurse.css";

const TITLES = {
  "/nurse/dashboard": "Nurse Dashboard",
  "/nurse/patients": "Patients",
  "/nurse/medical-history": "Medical History",
  "/nurse/appointments/online": "Online Bookings",
  "/nurse/appointments/offline": "Offline Bookings",
};

function NurseLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("nurse_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("nurse_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const location = useLocation();

  if (!isNurseSession()) {
    return <Navigate to="/login" replace />;
  }

  const title =
    Object.entries(TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] ||
    "Nurse Dashboard";

  return (
    <div className={`rc-shell ${sidebarOpen ? "rc-sidebar-open" : ""} ${collapsed ? "rc-sidebar-collapsed" : ""}`}>
      {sidebarOpen && <div className="rc-overlay" onClick={() => setSidebarOpen(false)} />}
      <NurseSidebar
        onClose={() => setSidebarOpen(false)}
        basePath="/nurse"
        dashboardLabel="Nurse Dashboard"
        sectionLabel="Nurse Desk"
        profile={getNurseProfile()}
        showBookAppointment={false}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <div className={`rc-main ${collapsed ? "collapsed" : ""}`}>
        <NurseTopbar
          title={title}
          onMenu={() => {
            if (typeof window !== "undefined" && window.innerWidth <= 900) {
              setSidebarOpen((prev) => !prev);
            } else {
              handleToggleCollapse();
            }
          }}
          areaLabel="Nurse"
          roleType="nurse"
        />
        <main className="rc-content" onClick={() => sidebarOpen && setSidebarOpen(false)}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default NurseLayout;
