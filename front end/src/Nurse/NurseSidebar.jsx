import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  CalendarHeart,
  Droplet,
  HeartPulse,
  ListChecks,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Thermometer,
  X,
} from "lucide-react";
import { getInitials } from "../profile/sessionProfile";
import { getNurseProfile } from "./nurseSession";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { getDefaultClinicLogo, useClinicInvoiceBranding } from "../utils/clinicBranding";
import { filterItemsByViewPermission, hasAnySavedModulePermissions, useRolePermissionsSync } from "../utils/rolePermissions";

const items = [
  {
    to: "/nurse/dashboard",
    label: "Nurse Dashboard",
    icon: Activity,
    tone: "cyan",
    badge: "Live",
  },
  {
    to: "/nurse/patients",
    label: "Patients",
    icon: Thermometer,
    tone: "emerald",
    badge: "Vitals",
  },
  {
    to: "/nurse/medical-history",
    label: "Medical History",
    icon: HeartPulse,
    tone: "rose",
    badge: "Records",
  },
  {
    label: "Appointments",
    modules: ["Appointments", "Book Appointment", "Online Bookings", "Offline Bookings"],
    icon: CalendarHeart,
    tone: "indigo",
    isDropdown: true,
    children: [
      {
        to: "/nurse/appointments/online",
        label: "Online Bookings",
        icon: Activity,
        tone: "cyan",
        badge: "Online",
      },
      {
        to: "/nurse/appointments/offline",
        label: "Offline Bookings",
        icon: ListChecks,
        tone: "amber",
        badge: "Desk",
      },
    ],
  },
];

const buildItems = ({
  basePath = "/nurse",
  dashboardLabel = "Nurse Dashboard",
  showBookAppointment = false,
} = {}) =>
  items
    .map((item) => {
      const mapToBase = (to) => to.replace(/^\/nurse/, basePath);
      if (item.children) {
        const children = item.children
          .filter((child) => showBookAppointment || child.to !== "/nurse/appointments")
          .map((child) => ({
            ...child,
            to: mapToBase(child.to),
          }));
        return {
          ...item,
          children,
        };
      }
      return {
        ...item,
        to: mapToBase(item.to),
        label: item.to === "/nurse/dashboard" ? dashboardLabel : item.label,
      };
    });

function NurseSidebar({
  onClose = () => {},
  basePath = "/nurse",
  dashboardLabel = "Nurse Dashboard",
  sectionLabel = "Nurse Desk",
  profile: providedProfile = null,
  showBookAppointment = false,
}) {
  const location = useLocation();
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

  // State to manage Appointments collapsible dropdown
  const [appointmentsOpen, setAppointmentsOpen] = useState(
    location.pathname.startsWith(`${basePath}/appointments`) || true
  );

  const baseItems = buildItems({ basePath, dashboardLabel, showBookAppointment });
  const navItems =
    permissionsLoading && !hasAnySavedModulePermissions(profile)
      ? []
      : filterItemsByViewPermission(baseItems, profile);

  return (
    <aside className="rc-sidebar">
      {/* Subtle Medical Instruments Backdrop Layer */}
      <div className="rc-sidebar-med-backdrop" aria-hidden="true">
        <div className="rc-sidebar-med-bg-img" />
        <div className="rc-sidebar-med-particles">
          <div className="rc-med-float-instrument med-float-1" title="Stethoscope">
            <Stethoscope size={26} />
          </div>
          <div className="rc-med-float-instrument med-float-2" title="Syringe">
            <Syringe size={20} />
          </div>
          <div className="rc-med-float-instrument med-float-3" title="Thermometer">
            <Thermometer size={22} />
          </div>
          <div className="rc-med-float-instrument med-float-4" title="Heart Pulse">
            <HeartPulse size={24} />
          </div>
        </div>
      </div>

      {/* Mobile-only drawer close button (Hidden on desktop) */}
      <button type="button" className="rc-sidebar-close" onClick={onClose} aria-label="Close menu">
        <X size={18} />
      </button>

      {/* Clinic Brand Card (NO cross symbol) */}
      <div className="rc-brand">
        <div className="rc-brand-icon rc-clinic-logo rc-clinic-logo--emerald">
          <img
            src={clinicBranding.logoUrl}
            alt=""
            onError={(event) => {
              event.currentTarget.src = getDefaultClinicLogo(hospitalName, clinicIdForLogo);
            }}
          />
        </div>
        <div className="rc-brand-text">
          <span className="rc-brand-tag">Clinic Center</span>
          <strong>{hospitalName}</strong>
          {branchName ? <em className="rc-brand-branch">{branchName}</em> : null}
        </div>
      </div>

      {/* Medical Section Header & ECG Wave */}
      <div className="rc-section-label">
        <span>{sectionLabel}</span>
        <span className="rc-sec-badge"><Activity size={10} /> Station Active</span>
      </div>

      <div className="rc-sidebar-ecg-wave" aria-hidden="true">
        <svg viewBox="0 0 200 20" className="rc-ecg-svg" preserveAspectRatio="none">
          <path
            d="M0,10 L45,10 L52,10 L58,3 L64,17 L70,5 L76,13 L82,10 L135,10 L141,2 L147,18 L153,6 L159,12 L165,10 L200,10"
            fill="none"
            stroke="rgba(14, 165, 233, 0.45)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="82" cy="10" r="2.2" fill="#0ea5e9" className="rc-ecg-runner" />
        </svg>
      </div>

      {/* Multi-color Transparent Medical Navigation Links */}
      <nav className="rc-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const toneClass = `rc-tone--${item.tone || "cyan"}`;

          if (item.children) {
            return (
              <div className={`rc-nav-group ${toneClass}`} key={item.label}>
                <button
                  type="button"
                  className={`rc-nav-group-title rc-dropdown-toggle rc-syringe-dropdown-btn ${
                    appointmentsOpen ? "rc-syringe-group--open" : ""
                  }`}
                  onClick={() => setAppointmentsOpen((prev) => !prev)}
                  aria-expanded={appointmentsOpen}
                  title={`Click syringe to ${appointmentsOpen ? "close" : "inject"} ${item.label}`}
                >
                  <span className="rc-nav-icon-wrap">
                    <Icon size={16} />
                  </span>
                  <span className="rc-nav-label">{item.label}</span>

                  {/* Syringe replacing the dropdown arrow */}
                  <span
                    className={`rc-syringe-trigger ${appointmentsOpen ? "rc-syringe--active" : ""}`}
                    title={appointmentsOpen ? "Syringe injected (click to close)" : "Click syringe to inject blood drop items"}
                  >
                    <Syringe size={17} className="rc-syringe-icon" />
                    {appointmentsOpen ? (
                      <>
                        <span className="rc-syringe-drip-bead" />
                        <span className="rc-syringe-falling-drop" />
                      </>
                    ) : null}
                  </span>
                </button>

                {appointmentsOpen ? (
                  <div className="rc-nav-children rc-blood-drops-flow">
                    {/* Capillary blood stream line */}
                    <div className="rc-blood-capillary-stream" aria-hidden="true">
                      <span className="rc-blood-capillary-drop-1" />
                      <span className="rc-blood-capillary-drop-2" />
                    </div>

                    {item.children.map((child, idx) => {
                      const ChildIcon = child.icon;
                      const childToneClass = `rc-tone--${child.tone || "indigo"}`;
                      return (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={({ isActive }) =>
                            `rc-nav-link rc-nav-child rc-blood-drop-item ${childToneClass}${
                              isActive ? " active" : ""
                            }`
                          }
                          style={{ animationDelay: `${idx * 0.1}s` }}
                        >
                          {/* Blood droplet container holding the medical icon */}
                          <span className="rc-blood-drop-badge" title="Blood droplet">
                            <Droplet size={15} className="rc-blood-drop-svg" />
                            <ChildIcon size={13} className="rc-blood-drop-inner-icon" />
                          </span>

                          <span className="rc-nav-label rc-blood-drop-text">{child.label}</span>
                          {child.badge ? (
                            <span className="rc-med-nav-pill rc-blood-drop-pill">{child.badge}</span>
                          ) : null}
                        </NavLink>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `rc-nav-link ${toneClass}${isActive ? " active" : ""}`}
            >
              <span className="rc-nav-icon-wrap">
                <Icon size={16} />
              </span>
              <span className="rc-nav-label">{item.label}</span>
              {item.badge ? <span className="rc-med-nav-pill">{item.badge}</span> : null}
            </NavLink>
          );
        })}
      </nav>

      {/* Medical Staff Profile Docked at Bottom */}
      <div className="rc-sidebar-footer">
        <div className="rc-sidebar-profile">
          <div className="rc-sidebar-avatar-wrap">
            <div className="rc-sidebar-avatar">{getInitials(profileName)}</div>
            <span className="rc-staff-med-badge" title="Clinical Nursing Station">
              <ShieldCheck size={11} />
            </span>
          </div>
          <div className="rc-sidebar-profile-info">
            <strong title={profileName}>{profileName}</strong>
            <span title={hospitalName}>{hospitalName}</span>
            <p>
              <span className="rc-status-dot" /> Online <span className="rc-role-tag">Nurse Desk</span>
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default NurseSidebar;
