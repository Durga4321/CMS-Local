import React, { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import "../Recepitionist/Receptionist.css";
import "./Lab.css";
import LabSidebar from "./LabSidebar";
import LabTopbar from "./LabTopbar";
import { isLabSession } from "./labSession";

const TITLES = {
  "/lab/dashboard": "Lab Dashboard",
  "/lab/patients": "Patients",
  "/lab/diagnosis-tests": "Diagnosis Tests",
  "/lab/sample-collection": "Sample Collection",
  "/lab/report-create": "Create Report",
  "/lab/imports": "Imports",
  "/lab/exports": "Exports",
  "/lab/reports": "Reports",
  "/lab/profile": "Profile",
};

function LabLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("lab_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("lab_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const location = useLocation();
  if (!isLabSession()) return <Navigate to="/login" replace />;
  const title = Object.entries(TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] || "Lab Dashboard";

  return (
    <div className={`rc-shell lab-shell ${sidebarOpen ? "rc-sidebar-open" : ""} ${collapsed ? "rc-sidebar-collapsed" : ""}`}>
      {sidebarOpen && <div className="rc-overlay" onClick={() => setSidebarOpen(false)} />}
      <LabSidebar
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <div className={`rc-main ${collapsed ? "collapsed" : ""}`}>
        <LabTopbar
          title={title}
          onMenu={() => {
            if (typeof window !== "undefined" && window.innerWidth <= 900) {
              setSidebarOpen((prev) => !prev);
            } else {
              handleToggleCollapse();
            }
          }}
        />
        <main className="rc-content" onClick={() => sidebarOpen && setSidebarOpen(false)}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default LabLayout;
