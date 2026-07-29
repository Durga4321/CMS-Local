import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Bell,
  Building2,
  LayoutDashboard,
  Stethoscope,
  Users,
  UserRound,
  UserCheck,
  CalendarDays,
  Settings2,
  FileBarChart2,
  Cross,
  ListChecks,
  Leaf,
  Sun,
  UserCog,
  ShieldCheck,
  X,
} from "lucide-react";

import "./Sidebar.css";
import { getInitials, getRoleProfile } from "../profile/sessionProfile";
import { getClinicDisplayName } from "../utils/clinicDisplay";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/branches", label: "Branches", icon: Building2 },
  { to: "/doctors", label: "Doctors", icon: Stethoscope },
  { to: "/receptionists", label: "Receptionists", icon: UserCheck },
  { to: "/patients", label: "Patients", icon: UserRound },
  { to: "/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/DoctorSchedule/schedule", label: "Schedule Settings", icon: Settings2 },
  { to: "/roles", label: "Roles & Permissions", icon: ShieldCheck },
  { to: "/users", label: "User Management", icon: Users },
  { to: "/reports", label: "Reports", icon: FileBarChart2 },
];

const patientItems = [
  { to: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patient/appointments/book", label: "Book Appointment", icon: Stethoscope },
  { to: "/patient/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/patient/medical-history", label: "Medical History", icon: FileBarChart2 },
  { to: "/patient/prescriptions", label: "Prescriptions", icon: ListChecks },
  { to: "/patient/bills", label: "Billing & Payments", icon: Building2 },
  { to: "/patient/notifications", label: "Notifications", icon: Bell },
];

const superAdminItems = [
  { to: "/superadmin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/superadmin/clinics", label: "Clinics", icon: Building2 },
  { to: "/superadmin/admins", label: "Admins", icon: UserCog },
  { to: "/superadmin/roles", label: "Roles & Permissions", icon: ShieldCheck },
  { to: "/superadmin/settings", label: "Settings", icon: Settings2 },
  { to: "/superadmin/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/superadmin/audit-logs", label: "Audit Logs", icon: ListChecks },
  { to: "/superadmin/notifications", label: "Notifications", icon: Bell },
];

const ToothLogo = () => (
  <svg className="sidebar-clinic-tooth-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M7.45 3.8c1.2-.52 2.35-.28 3.18.17.86.47 1.88.47 2.74 0 .83-.45 1.98-.69 3.18-.17 2.2.95 3.13 3.25 2.43 5.87l-1.56 5.84c-.45 1.69-1.28 4.72-3.03 4.72-1.24 0-1.31-1.49-1.68-3.08-.18-.78-.43-1.37-.71-1.37s-.53.59-.71 1.37c-.37 1.59-.44 3.08-1.68 3.08-1.75 0-2.58-3.03-3.03-4.72L5.02 9.67C4.32 7.05 5.25 4.75 7.45 3.8Z"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
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

function Sidebar({ open = false, onClose = () => {} }) {
  const location = useLocation();
  const isSuperAdmin = location.pathname.startsWith("/superadmin");
  const isPatient =
    location.pathname === "/patient" ||
    location.pathname.startsWith("/patient/");
  const navItems = isSuperAdmin ? superAdminItems : isPatient ? patientItems : items;
  const profile = isPatient ? getRoleProfile('patient') : getRoleProfile("admin");
  const profileName = profile.name;
  const profileSub = isSuperAdmin ? "Super Admin" : isPatient ? "Patient" : getClinicDisplayName(profile, "Admin");
  const brandName = isSuperAdmin ? "CMS" : isPatient ? "Patient Portal" : getClinicDisplayName(profile, "CMS");
  const brandLogo = isSuperAdmin || isPatient
    ? { type: "icon", icon: Cross, text: isSuperAdmin ? "CMS" : "PAT", tone: "emerald" }
    : getClinicLogo(brandName);
  const BrandLogoIcon = brandLogo.icon;

  return (
    <>
      <div className={`sidebar ${open ? 'open' : ''}`}>

      {/* HEADER */}
      <div className="sidebar-header">
        <div className={`logo sidebar-clinic-logo sidebar-clinic-logo--${brandLogo.tone}`}>
          {brandLogo.type === "tooth" ? <ToothLogo /> : <BrandLogoIcon size={22} />}
          {brandLogo.text ? <small>{brandLogo.text}</small> : null}
        </div>
        <div>
          <h3>{brandName}</h3>
          <span>{isSuperAdmin ? "Super Admin Console" : "Admin Console"}</span>
        </div>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close sidebar">
          <X size={18} />
        </button>
      </div>

      {/* NAV */}
      <div className="nav">
        <p className="menu-title">{isSuperAdmin ? "SUPER ADMIN" : "MAIN MENU"}</p>

        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="sidebar-profile">
        <div className="sidebar-avatar">{getInitials(profileName)}</div>
        <div className="sidebar-profile-info">
          <b>{profileName}</b>
          <span>{profileSub}</span>
          <p>
            <span className="sidebar-status-dot" /> Online
          </p>
        </div>
      </div>
      </div>
      <div className={`sidebar-overlay ${open ? 'visible' : ''}`} onClick={onClose} />
    </>
  );
}

export default Sidebar;
