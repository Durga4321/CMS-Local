import React from "react";
import { NavLink } from "react-router-dom";
import {
  CalendarClock,
  ClipboardList,
  Cross,
  LayoutDashboard,
  Leaf,
  Stethoscope,
  Sun,
} from "lucide-react";
import "./DoctorSidebar.css";
import { getRoleProfile } from "../profile/sessionProfile";
import { getClinicDisplayName } from "../utils/clinicDisplay";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/doctor/dashboard" },
  { label: "Consultation", icon: Stethoscope, path: "/doctor/consultation" },
  { label: "Prescription", icon: ClipboardList, path: "/doctor/prescription" },
  { label: "Appointments", icon: ClipboardList, path: "/doctor/appointments" },
  { label: "My Schedule", icon: CalendarClock, path: "/doctor/schedule" },
];

const getInitials = (name) =>
  String(name || "D")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "D";

const DoctorClinicToothLogo = () => (
  <svg className="dr-clinic-tooth-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7.45 3.8c1.2-.52 2.35-.28 3.18.17.86.47 1.88.47 2.74 0 .83-.45 1.98-.69 3.18-.17 2.2.95 3.13 3.25 2.43 5.87l-1.56 5.84c-.45 1.69-1.28 4.72-3.03 4.72-1.24 0-1.31-1.49-1.68-3.08-.18-.78-.43-1.37-.71-1.37s-.53.59-.71 1.37c-.37 1.59-.44 3.08-1.68 3.08-1.75 0-2.58-3.03-3.03-4.72L5.02 9.67C4.32 7.05 5.25 4.75 7.45 3.8Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const getClinicLogo = (clinicName = "") => {
  const name = String(clinicName).toLowerCase();
  if (name.includes("dental")) return { type: "tooth", text: "", tone: "dental" };
  if (name.includes("pragathi")) return { type: "icon", icon: Leaf, text: "PRAGATHI", tone: "green" };
  if (name.includes("sai ram")) return { type: "icon", icon: Sun, text: "SAI RAM", tone: "sky" };
  if (name.includes("primo")) return { type: "icon", icon: Sun, text: "PRIMO", tone: "amber" };
  if (name.includes("pirnav")) return { type: "icon", icon: Sun, text: "PIRNAV", tone: "amber" };
  if (name.includes("nri")) return { type: "icon", icon: Cross, text: "NC", tone: "emerald" };
  if (name.includes("vims")) return { type: "icon", icon: Cross, text: "VIMS", tone: "emerald" };
  const fallbackText = String(clinicName || "CLINIC")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return { type: "icon", icon: Cross, text: fallbackText || "CL", tone: "emerald" };
};

function DoctorSidebar() {
  const profile = getRoleProfile("doctor");
  const hospitalName = getClinicDisplayName(profile, "Clinic Name");
  const branchName = String(profile.branchName || "").trim();
  const displayName = profile.name || "Dr. Doctor";
  const clinicLogo = getClinicLogo(hospitalName);
  const ClinicLogoIcon = clinicLogo.icon;

  return (
    <aside className="dr-sidebar">
      <div className="dr-brand">
        <div className={`dr-brand-icon dr-clinic-logo dr-clinic-logo--${clinicLogo.tone}`}>
          {clinicLogo.type === "tooth" ? <DoctorClinicToothLogo /> : <ClinicLogoIcon size={22} />}
          {clinicLogo.text ? <small>{clinicLogo.text}</small> : null}
        </div>
        <div>
          <p className="dr-brand-sub">Clinic Name</p>
          <p className="dr-brand-name">{hospitalName}</p>
          {branchName ? <p className="dr-brand-branch">{branchName}</p> : null}
        </div>
      </div>

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
