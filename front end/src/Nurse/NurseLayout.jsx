import React, { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import NurseSidebar from "./NurseSidebar";
import NurseTopbar from "./NurseTopbar";
import { getNurseProfile, isNurseSession } from "./nurseSession";
import "../Recepitionist/Receptionist.css";

const TITLES = {
  "/nurse/dashboard": "Nurse Dashboard",
  "/nurse/patients": "Patients",
  "/nurse/medical-history": "Medical History",
  "/nurse/appointments/online": "Online Bookings",
  "/nurse/appointments/offline": "Offline Bookings",
  "/nurse/consultant-room": "Consultant Room",
};

function NurseLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (!isNurseSession()) {
    return <Navigate to="/login" replace />;
  }

  const title =
    Object.entries(TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] ||
    "Nurse Dashboard";

  return (
    <div className={`rc-shell ${sidebarOpen ? "rc-sidebar-open" : ""}`}>
      {sidebarOpen && <div className="rc-overlay" onClick={() => setSidebarOpen(false)} />}
      <NurseSidebar
        onClose={() => setSidebarOpen(false)}
        basePath="/nurse"
        dashboardLabel="Nurse Dashboard"
        sectionLabel="Nurse Desk"
        profile={getNurseProfile()}
        showBookAppointment={false}
        showConsultantRoom
      />
      <div className="rc-main">
        <NurseTopbar title={title} onMenu={() => setSidebarOpen(true)} areaLabel="Nurse" roleType="nurse" />
        <main className="rc-content" onClick={() => sidebarOpen && setSidebarOpen(false)}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default NurseLayout;
