import React from "react";
import { NavLink } from "react-router-dom";
import {
  CalendarPlus,
  ClipboardList,
  Gauge,
  HeartPulse,
  ListChecks,
  Stethoscope,
  UserPlus,
  X,
} from "lucide-react";
import { getInitials } from "../profile/sessionProfile";
import { getReceptionistProfile } from "./receptionSession";
import { getClinicDisplayName } from "../utils/clinicDisplay";

const items = [
  { to: "/reception/dashboard", label: "Reception Dashboard", icon: Gauge },
  { to: "/reception/patients", label: "Patients", icon: UserPlus },
  { to: "/reception/medical-history", label: "Medical History", icon: HeartPulse },
  {
    label: "Appointments",
    icon: CalendarPlus,
    children: [
      { to: "/reception/appointments", label: "Book Appointment", icon: CalendarPlus },
      { to: "/reception/appointments/online", label: "Online Bookings", icon: ListChecks },
      { to: "/reception/appointments/offline", label: "Offline Bookings", icon: ListChecks },
    ],
  },
  { to: "/reception/consultant-room", label: "Consultant Room", icon: ClipboardList },
  { to: "/reception/billing", label: "Billing", icon: ClipboardList },
];

function ReceptionSidebar({ onClose = () => {} }) {
  const profile = getReceptionistProfile();
  const profileName = profile.name || "Receptionist";
  const hospitalName = getClinicDisplayName(profile, "Clinic Name");
  const branchName = String(profile.branchName || "").trim();

  return (
    <aside className="rc-sidebar">
      <div className="rc-brand">
        <div className="rc-brand-icon">
          <Stethoscope size={22} />
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

      <div className="rc-section-label">Front Desk</div>

      <nav className="rc-nav">
        {items.map((item) => {
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
                        end={child.to === "/reception/appointments"}
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

