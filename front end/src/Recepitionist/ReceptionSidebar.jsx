import React from "react";
import { NavLink } from "react-router-dom";
import {
  CalendarPlus,
  ClipboardList,
  Gauge,
  UserPlus,
  X,
} from "lucide-react";
import { getInitials } from "../profile/sessionProfile";
import { getReceptionistProfile } from "./receptionSession";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { useClinicInvoiceBranding } from "../utils/clinicBranding";
import { filterItemsByViewPermission, useRolePermissionsSync } from "../utils/rolePermissions";

const items = [
  { to: "/reception/dashboard", label: "Reception Dashboard", icon: Gauge },
  { to: "/reception/patients", label: "Patients", icon: UserPlus },
  {
    label: "Appointments",
    icon: CalendarPlus,
    children: [
      { to: "/reception/appointments", label: "Book Appointment", icon: CalendarPlus },
    ],
  },
  { to: "/reception/billing", label: "Billing", icon: ClipboardList },
];

const buildItems = ({
  basePath = "/reception",
  dashboardLabel = "Reception Dashboard",
  showBilling = true,
  showBookAppointment = true,
  showConsultantRoom = false,
} = {}) =>
  [
    ...items,
    ...(showConsultantRoom ? [{ to: "/reception/consultant-room", label: "Consultant Room", icon: ClipboardList }] : []),
  ]
    .filter((item) => showBilling || item.to !== "/reception/billing")
    .map((item) => {
    const mapToBase = (to) => to.replace(/^\/reception/, basePath);
    if (item.children) {
      const children = item.children.filter((child) => showBookAppointment || child.to !== "/reception/appointments");
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
      label: item.to === "/reception/dashboard" ? dashboardLabel : item.label,
    };
  });

function ReceptionSidebar({
  onClose = () => {},
  basePath = "/reception",
  dashboardLabel = "Reception Dashboard",
  sectionLabel = "Front Desk",
  profile: providedProfile = null,
  showBilling = true,
  showBookAppointment = true,
  showConsultantRoom = false,
}) {
  const profile = providedProfile || getReceptionistProfile();
  useRolePermissionsSync(profile);
  const profileName = profile.name || "Receptionist";
  const hospitalName = getClinicDisplayName(profile, "Clinic Name");
  const branchName = String(profile.branchName || "").trim();
  const clinicBranding = useClinicInvoiceBranding({
    clinicId: profile.clinicId || profile.hospitalId || localStorage.getItem("hospitalId") || localStorage.getItem("clinicId") || "",
    clinicName: hospitalName,
  });
  const navItems = filterItemsByViewPermission(
    buildItems({ basePath, dashboardLabel, showBilling, showBookAppointment, showConsultantRoom }),
    profile
  );
  return (
    <aside className="rc-sidebar">
      <div className="rc-brand">
        <div className="rc-brand-icon rc-clinic-logo rc-clinic-logo--emerald">
          <img src={clinicBranding.logoUrl} alt="" />
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
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.to === `${basePath}/appointments`}
                        className={({ isActive }) => `rc-nav-link rc-nav-child${isActive ? " active" : ""}`}
                      >
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
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `rc-nav-link${isActive ? " active" : ""}`}
            >
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

export default ReceptionSidebar;
