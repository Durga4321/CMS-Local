import React from "react";
import { NavLink } from "react-router-dom";
import {
  CalendarPlus,
  ClipboardList,
  Cross,
  Gauge,
  HeartPulse,
  Leaf,
  ListChecks,
  Sun,
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

const ReceptionClinicToothLogo = () => (
  <svg className="rc-clinic-tooth-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function ReceptionSidebar({ onClose = () => {} }) {
  const profile = getReceptionistProfile();
  const profileName = profile.name || "Receptionist";
  const hospitalName = getClinicDisplayName(profile, "Clinic Name");
  const branchName = String(profile.branchName || "").trim();
  const clinicLogo = getClinicLogo(hospitalName);
  const ClinicLogoIcon = clinicLogo.icon;

  return (
    <aside className="rc-sidebar">
      <div className="rc-brand">
        <div className={`rc-brand-icon rc-clinic-logo rc-clinic-logo--${clinicLogo.tone}`}>
          {clinicLogo.type === "tooth" ? <ReceptionClinicToothLogo /> : <ClinicLogoIcon size={22} />}
          {clinicLogo.text ? <small>{clinicLogo.text}</small> : null}
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
