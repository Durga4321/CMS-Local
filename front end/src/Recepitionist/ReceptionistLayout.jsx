import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import ReceptionSidebar from "./ReceptionSidebar";
import ReceptionTopbar from "./ReceptionTopbar";
import { loadStaffRolePermissions } from "../utils/staffRolePermissions";
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
  const location = useLocation();

  useEffect(() => {
    loadStaffRolePermissions().catch(() => {});
  }, []);

  if (!isReceptionistSession()) {
    return <Navigate to="/login" replace />;
  }

  const title =
    Object.entries(TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] ||
    "Reception Dashboard";

  return (
    <div className={`rc-shell ${sidebarOpen ? "rc-sidebar-open" : ""}`}>
      {sidebarOpen && <div className="rc-overlay" onClick={() => setSidebarOpen(false)} />}
      <ReceptionSidebar onClose={() => setSidebarOpen(false)} />
      <div className="rc-main">
        <ReceptionTopbar title={title} onMenu={() => setSidebarOpen(true)} />
        <main className="rc-content" onClick={() => sidebarOpen && setSidebarOpen(false)}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default ReceptionistLayout;

