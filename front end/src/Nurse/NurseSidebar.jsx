import React from "react";
import { NavLink } from "react-router-dom";
import {
  CalendarPlus,
  Gauge,
  HeartPulse,
  ListChecks,
  UserPlus,
  X,
} from "lucide-react";
import { getInitials } from "../profile/sessionProfile";
import { getNurseProfile } from "./nurseSession";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { getDefaultClinicLogo, useClinicInvoiceBranding } from "../utils/clinicBranding";
import { filterItemsByViewPermission, hasAnySavedModulePermissions, useRolePermissionsSync } from "../utils/rolePermissions";

const items = [
  { to: "/nurse/dashboard", label: "Nurse Dashboard", icon: Gauge },
  { to: "/nurse/patients", label: "Patients", icon: UserPlus },
  { to: "/nurse/medical-history", label: "Medical History", icon: HeartPulse },
  {
    label: "Appointments",
    modules: ["Appointments", "Book Appointment", "Online Bookings", "Offline Bookings"],
    icon: CalendarPlus,
    children: [
      { to: "/nurse/appointments", label: "Book Appointment", modules: ["Book Appointment", "Appointments"], icon: CalendarPlus },
      { to: "/nurse/appointments/online", label: "Online Bookings", icon: ListChecks },
      { to: "/nurse/appointments/offline", label: "Offline Bookings", icon: ListChecks },
    ],
  },
];

const buildItems = ({ basePath = "/nurse", dashboardLabel = "Nurse Dashboard", showBookAppointment = true } = {}) =>
  items
    .map((item) => {
      const mapToBase = (to) => to.replace(/^\/nurse/, basePath);
      if (item.children) {
        const children = item.children.filter((child) => showBookAppointment || child.to !== "/nurse/appointments");
        return {
          ...item,
          children: children.map((child) => ({
            ...child,
            to: mapToBase(child.to),
          })),
        };
      }
      return {
        ...item,
        to: mapToBase(item.to),
        label: item.to === "/nurse/dashboard" ? dashboardLabel : item.label,
      };
    });

function NurseSidebar({ onClose = () => {}, basePath = "/nurse", dashboardLabel = "Nurse Dashboard", sectionLabel = "Nurse Desk", profile: providedProfile = null, showBookAppointment = true, showConsultantRoom = false }) {
  const profile = providedProfile || getNurseProfile();
  const { loading: permissionsLoading } = useRolePermissionsSync(profile);
  const profileName = profile.name || "Nurse";
  const hospitalName = getClinicDisplayName(profile, "Clinic Name");
  const branchName = String(profile.branchName || "").trim();
  const clinicIdForLogo = profile.clinicId || profile.hospitalId || localStorage.getItem("hospitalId") || localStorage.getItem("clinicId") || "";
  const clinicBranding = useClinicInvoiceBranding({
    clinicId: clinicIdForLogo,
    clinicName: hospitalName,
  });
  const baseItems = buildItems({ basePath, dashboardLabel, showBookAppointment });
  const navItems =
    permissionsLoading && !hasAnySavedModulePermissions(profile)
      ? []
      : filterItemsByViewPermission(baseItems, profile);
  return (
    <aside className="rc-sidebar">
      <div className="rc-brand">
        <div className="rc-brand-icon rc-clinic-logo rc-clinic-logo--emerald">
          <img src={clinicBranding.logoUrl} alt="" onError={(event) => { event.currentTarget.src = getDefaultClinicLogo(hospitalName, clinicIdForLogo); }} />
        </div>
        <div>
          <span>Clinic Name</span>
          <strong>{hospitalName}</strong>
          {branchName ? <em className="rc-brand-branch">{branchName}</em> : null}
        </div>
        <button className="rc-sidebar-close" onClick={onClose} type="button" aria-label="Close sidebar">
          <X size={18} />
        </button>
      </div>

      <div className="rc-section-label">{sectionLabel}</div>

      <nav className="rc-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.children) {
            return (
              <div className="rc-nav-group" key={item.label}>
                <div className="rc-nav-group-title">
                  <Icon size={17} />
                  <span>{item.label}</span>
                </div>
                <div className="rc-nav-children">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    return (
                      <NavLink key={child.to} to={child.to} end={child.to === `${basePath}/appointments`} className={({ isActive }) => `rc-nav-link rc-nav-child${isActive ? " active" : ""}`}>
                        <ChildIcon size={16} />
                        <span>{child.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `rc-nav-link${isActive ? " active" : ""}`}>
              <Icon size={17} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="rc-sidebar-profile">
        <div className="rc-sidebar-avatar">{getInitials(profileName)}</div>
        <div className="rc-sidebar-profile-info">
          <strong>{profileName}</strong>
          <span>{hospitalName}</span>
          <p>
            <span className="rc-status-dot" /> Online
          </p>
        </div>
      </div>
    </aside>
  );
}

export default NurseSidebar;
