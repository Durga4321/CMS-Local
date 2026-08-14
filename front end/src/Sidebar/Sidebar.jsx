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
  FlaskConical,
  FolderUp,
  Settings2,
  FileBarChart2,
  Cross,
  ListChecks,
  UserCog,
  ShieldCheck,
  X,
} from "lucide-react";

import "./Sidebar.css";
import { getInitials, getRoleProfile } from "../profile/sessionProfile";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { useClinicInvoiceBranding } from "../utils/clinicBranding";
import { filterItemsByViewPermission, hasAnySavedModulePermissions, useRolePermissionsSync } from "../utils/rolePermissions";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/branches", label: "Branches", icon: Building2 },
  { to: "/doctors", label: "Doctors", icon: Stethoscope },
  { to: "/receptionists", label: "Receptionists", icon: UserCheck },
  { to: "/nurses", label: "Nurses", icon: UserCog },
  { to: "/lab-technicians", label: "Lab Technicians", icon: FlaskConical },
  { to: "/lab-files", label: "Lab Files", icon: FolderUp },
  { to: "/patients", label: "Patients", icon: UserRound },
  { to: "/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/DoctorSchedule/schedule", label: "Schedule Settings", icon: Settings2 },
  { to: "/roles", label: "Roles & Permissions", icon: ShieldCheck },
  { to: "/users", label: "User Management", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings2 },
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

function Sidebar({ open = false, onClose = () => {} }) {
  const location = useLocation();
  const isSuperAdmin = location.pathname.startsWith("/superadmin");
  const isPatient =
    location.pathname === "/patient" ||
    location.pathname.startsWith("/patient/");
  let profile;
  if (isSuperAdmin) profile = getRoleProfile("admin");
  else if (location.pathname.startsWith("/doctor")) profile = getRoleProfile("doctor");
  else if (location.pathname.startsWith("/reception")) profile = getRoleProfile("receptionist");
  else if (location.pathname.startsWith("/nurse")) profile = getRoleProfile("nurse");
  else if (isPatient) profile = getRoleProfile("patient");
  else profile = getRoleProfile("admin");
  const { loading: permissionsLoading } = useRolePermissionsSync(profile);
  const baseNavItems = isSuperAdmin ? superAdminItems : isPatient ? patientItems : items;
  const navItems =
    isSuperAdmin || isPatient
      ? baseNavItems
      : permissionsLoading && !hasAnySavedModulePermissions(profile)
        ? []
        : filterItemsByViewPermission(baseNavItems, profile);
  const profileName = profile.name;
  const profileSub = isSuperAdmin ? "Super Admin" : isPatient ? "Patient" : getClinicDisplayName(profile, "Admin");
  const brandName = isSuperAdmin ? "CMS" : isPatient ? "Patient Portal" : getClinicDisplayName(profile, "CMS");
  const clinicBranding = useClinicInvoiceBranding({
    clinicId: profile.clinicId || profile.hospitalId || localStorage.getItem("hospitalId") || localStorage.getItem("clinicId") || "",
    clinicName: brandName,
    enabled: !isSuperAdmin && !isPatient,
  });
  const brandLogo = isSuperAdmin || isPatient
    ? { type: "icon", icon: Cross, text: isSuperAdmin ? "CMS" : "PAT", tone: "emerald" }
    : { type: "image", image: clinicBranding.logoUrl, text: "", tone: "emerald" };
  const BrandLogoIcon = brandLogo.icon;

  return (
    <>
      <div className={`sidebar ${open ? 'open' : ''}`}>

      {/* HEADER */}
      <div className="sidebar-header">
        <div className={`logo sidebar-clinic-logo sidebar-clinic-logo--${brandLogo.tone}`}>
          {brandLogo.type === "image" ? (
            <img src={brandLogo.image} alt="" />
          ) : <BrandLogoIcon size={22} />}
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
