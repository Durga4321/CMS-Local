import React, { useState } from "react";
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
  ListChecks,
  UserCog,
  ShieldCheck,
  X,
  ChevronRight,
  ArrowLeftToLine,
  Activity,
} from "lucide-react";

import "./Sidebar.css";
import { getInitials, getRoleProfile } from "../profile/sessionProfile";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { filterItemsByViewPermission, hasAnySavedModulePermissions, useRolePermissionsSync } from "../utils/rolePermissions";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tone: "blue" },
  { to: "/branches", label: "Branches", icon: Building2, tone: "pink" },
  { to: "/doctors", label: "Doctors", icon: Stethoscope, tone: "green" },
  { to: "/receptionists", label: "Receptionists", icon: UserCheck, tone: "rose" },
  { to: "/nurses", label: "Nurses", icon: UserCog, tone: "orange" },
  { to: "/lab-technicians", label: "Lab Technicians", icon: FlaskConical, tone: "cyan" },
  { to: "/lab-files", label: "Lab Files", icon: FolderUp, tone: "indigo" },
  { to: "/patients", label: "Patients", icon: UserRound, tone: "purple" },
  { to: "/appointments", label: "Appointments", icon: CalendarDays, tone: "emerald" },
  { to: "/DoctorSchedule/schedule", label: "Schedule Settings", icon: Settings2, tone: "red" },
  { to: "/roles", label: "Roles & Permissions", icon: ShieldCheck, tone: "amber" },
  { to: "/users", label: "User Management", icon: Users, tone: "teal" },
  { to: "/settings", label: "Settings", icon: Settings2, tone: "blue" },
  { to: "/reports", label: "Reports", icon: FileBarChart2, tone: "violet" },
];

const patientItems = [
  { to: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard, tone: "blue" },
  { to: "/patient/appointments/book", label: "Book Appointment", icon: Stethoscope, tone: "green" },
  { to: "/patient/appointments", label: "Appointments", icon: CalendarDays, tone: "emerald" },
  { to: "/patient/medical-history", label: "Medical History", icon: FileBarChart2, tone: "purple" },
  { to: "/patient/prescriptions", label: "Prescriptions", icon: ListChecks, tone: "orange" },
  { to: "/patient/bills", label: "Billing & Payments", icon: Building2, tone: "blue" },
  { to: "/patient/notifications", label: "Notifications", icon: Bell, tone: "rose" },
];

const superAdminItems = [
  { to: "/superadmin/dashboard", label: "Dashboard", icon: LayoutDashboard, tone: "blue" },
  { to: "/superadmin/clinics", label: "Clinics", icon: Building2, tone: "pink" },
  { to: "/superadmin/admins", label: "Admins", icon: UserCog, tone: "orange" },
  { to: "/superadmin/roles", label: "Roles & Permissions", icon: ShieldCheck, tone: "amber" },
  { to: "/superadmin/settings", label: "Settings", icon: Settings2, tone: "blue" },
  { to: "/superadmin/reports", label: "Reports", icon: FileBarChart2, tone: "violet" },
  { to: "/superadmin/audit-logs", label: "Audit Logs", icon: ListChecks, tone: "emerald" },
  { to: "/superadmin/notifications", label: "Notifications", icon: Bell, tone: "rose" },
];

function Sidebar({
  open = false,
  onClose = () => {},
  collapsed: controlledCollapsed,
  onToggleCollapse,
}) {
  const location = useLocation();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isControlled = controlledCollapsed !== undefined;
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;
  const handleToggleCollapse = isControlled
    ? onToggleCollapse
    : () => setInternalCollapsed((prev) => !prev);

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

  const brandName = isSuperAdmin ? "CMS" : isPatient ? "Patient Portal" : getClinicDisplayName(profile, "Hp Clinic");

  return (
    <>
      <div className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>

      {/* BRAND LOGO HEADER (NO CROSS SYMBOL) */}
      <div className="sidebar-header" title={brandName}>
        <div className="sidebar-brand-icon">
          <Activity size={20} className="brand-icon" />
        </div>
        <div className="sidebar-brand-text">
          <h3 title={brandName}>{brandName}</h3>
          <span>Admin Console</span>
        </div>
      </div>

      {/* NAV ITEMS LIST WITH COLORFUL NAMES */}
      <div className="nav">
        {navItems.map(({ to, label, icon: Icon, tone = "blue" }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `nav-item nav-item-${tone} ${isActive ? "active" : ""}`
            }
          >
            <div className={`nav-icon-box tone-${tone}`}>
              <Icon size={18} />
            </div>
            <span className={`nav-label text-${tone}`}>{label}</span>
            <ChevronRight size={14} className="nav-arrow" />
          </NavLink>
        ))}
      </div>

      {/* BOTTOM COLLAPSE MENU TOGGLE */}
      <div className="sidebar-bottom">
        <button
          type="button"
          className="collapse-btn"
          onClick={handleToggleCollapse}
          title={collapsed ? "Expand Menu" : "Collapse Menu"}
        >
          <ArrowLeftToLine
            size={16}
            style={{
              transform: collapsed ? "rotate(180deg)" : "none",
              transition: "transform 0.25s ease",
            }}
          />
          <span>Collapse Menu</span>
        </button>
      </div>
      </div>
      <div className={`sidebar-overlay ${open ? 'visible' : ''}`} onClick={onClose} />
    </>
  );
}

export default Sidebar;
