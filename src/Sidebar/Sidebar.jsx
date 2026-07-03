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
  HeartPulse,
  ListChecks,
  ShieldCheck,
  UserCog,
  X,
} from "lucide-react";

import "./Sidebar.css";
import { getInitials, getRoleProfile } from "../profile/sessionProfile";
import { getClinicDisplayName } from "../utils/clinicDisplay";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/doctors", label: "Doctors", icon: Stethoscope },
  { to: "/receptionists", label: "Receptionists", icon: UserCheck },
  { to: "/patients", label: "Patients", icon: UserRound },
  { to: "/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/DoctorSchedule/schedule", label: "Schedule Settings", icon: Settings2 },
  { to: "/reports", label: "Reports", icon: FileBarChart2 },
];

const patientItems = [
  { to: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patient/profile", label: "My Profile", icon: UserRound },
  { to: "/patient/book", label: "Book Appointment", icon: Stethoscope },
  { to: "/patient/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/patient/history", label: "Medical History", icon: FileBarChart2 },
  { to: "/patient/prescriptions", label: "Prescriptions", icon: ListChecks },
  { to: "/patient/billing", label: "Billing & Payments", icon: Building2 },
  { to: "/patient/notifications", label: "Notifications", icon: Bell },
];

const superAdminItems = [
  { to: "/superadmin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/superadmin/clinics", label: "Clinics", icon: Building2 },
  { to: "/superadmin/admins", label: "Admins", icon: UserCog },
  { to: "/superadmin/users", label: "Users", icon: Users },
  { to: "/superadmin/roles", label: "Roles & Permissions", icon: ShieldCheck },
  { to: "/superadmin/settings", label: "Settings", icon: Settings2 },
  { to: "/superadmin/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/superadmin/audit-logs", label: "Audit Logs", icon: ListChecks },
  { to: "/superadmin/notifications", label: "Notifications", icon: Bell },
];

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

  return (
    <>
      <div className={`sidebar ${open ? 'open' : ''}`}>

      {/* HEADER */}
      <div className="sidebar-header">
        <div className="logo">
          <HeartPulse size={18} />
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
