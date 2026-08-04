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
  "/lab/imports": "Imports",
  "/lab/exports": "Exports",
  "/lab/reports": "Reports",
  "/lab/profile": "Profile",
};

function LabLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  if (!isLabSession()) return <Navigate to="/login" replace />;
  const title = Object.entries(TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] || "Lab Dashboard";

  return (
    <div className={`rc-shell lab-shell ${sidebarOpen ? "rc-sidebar-open" : ""}`}>
      {sidebarOpen && <div className="rc-overlay" onClick={() => setSidebarOpen(false)} />}
      <LabSidebar onClose={() => setSidebarOpen(false)} />
      <div className="rc-main">
        <LabTopbar title={title} onMenu={() => setSidebarOpen(true)} />
        <main className="rc-content" onClick={() => sidebarOpen && setSidebarOpen(false)}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default LabLayout;
