import React, { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import ReceptionSidebar from "./ReceptionSidebar";
import ReceptionTopbar from "./ReceptionTopbar";
import { isReceptionistSession } from "./receptionSession";
import "./Receptionist.css";

const TITLES = {
  "/reception/dashboard": "Reception Dashboard",
  "/reception/patients": "Patients",
  "/reception/medical-history": "Medical History",
  "/reception/appointments/online": "Online Bookings",
  "/reception/appointments/offline": "Offline Bookings",
  "/reception/appointments": "Appointment Booking",
  "/reception/billing": "Billing",
};

function ReceptionistLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("reception_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("reception_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const location = useLocation();

  if (!isReceptionistSession()) {
    return <Navigate to="/login" replace />;
  }

  const title =
    Object.entries(TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] ||
    "Reception Dashboard";

  return (
    <div className={`rc-shell ${sidebarOpen ? "rc-sidebar-open" : ""} ${collapsed ? "rc-sidebar-collapsed" : ""}`}>
      {sidebarOpen && <div className="rc-overlay" onClick={() => setSidebarOpen(false)} />}
      <ReceptionSidebar
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <div className={`rc-main ${collapsed ? "collapsed" : ""}`}>
        <ReceptionTopbar
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

export default ReceptionistLayout;

