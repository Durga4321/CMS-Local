import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Stethoscope,
  ClipboardList,
  CalendarClock,
} from "lucide-react";
import "./DoctorSidebar.css";
import { getRoleProfile } from "../profile/sessionProfile";
import { getClinicDisplayName } from "../utils/clinicDisplay";

/* ── Navigation items ── */
const NAV_ITEMS = [
  { label: "Dashboard",    icon: LayoutDashboard, path: "/doctor/dashboard" },
  { label: "Consultation", icon: Stethoscope,     path: "/doctor/consultation" },
  { label: "Prescription", icon: ClipboardList,   path: "/doctor/prescription" },
  { label: "Appointments", icon: ClipboardList,   path: "/doctor/appointments" },
  { label: "My Schedule",  icon: CalendarClock,   path: "/doctor/schedule" },
];

const getInitials = (name) =>
  String(name || "D")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "D";

function DoctorSidebar() {
  const profile = getRoleProfile("doctor");
  const hospitalName = getClinicDisplayName(profile, "Clinic Name");
  const branchName = String(profile.branchName || "").trim();
  const displayName = profile.name || "Dr. Doctor";

  return (
    <aside className="dr-sidebar">

      {/* ── Brand / Logo ── */}
      <div className="dr-brand">
        <div className="dr-brand-icon">
          <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
            <path d="M19 8h-3V5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v3H5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h3v3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-3h3a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z" />
          </svg>
        </div>
        <div>
          <p className="dr-brand-sub">Clinic Name</p>
          <p className="dr-brand-name">{hospitalName}</p>
          {branchName ? <p className="dr-brand-branch">{branchName}</p> : null}
        </div>
      </div>

      {/* ── Main Navigation ── */}
      <nav className="dr-nav">
        {NAV_ITEMS.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              isActive ? "dr-nav-link active" : "dr-nav-link"
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Doctor Profile (bottom) ── */}
      <div className="dr-sidebar-profile">
        <div className="dr-sidebar-avatar">{getInitials(displayName)}</div>
        <div className="dr-sidebar-profile-info">
          <p className="dr-sidebar-profile-name">{displayName}</p>
          <p className="dr-sidebar-profile-role">{hospitalName}</p>
          <p className="dr-sidebar-profile-status">
            <span className="dr-status-dot" /> Online
          </p>
        </div>
      </div>

    </aside>
  );
}

export default DoctorSidebar;
