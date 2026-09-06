import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  CalendarHeart,
  Droplet,
  HeartPulse,
  Microscope,
  Receipt,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Thermometer,
  X,
} from "lucide-react";
import { getInitials } from "../profile/sessionProfile";
import { getReceptionistProfile } from "./receptionSession";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { getDefaultClinicLogo, useClinicInvoiceBranding } from "../utils/clinicBranding";
import { filterItemsByViewPermission, hasAnySavedModulePermissions, useRolePermissionsSync } from "../utils/rolePermissions";

const items = [
  {
    to: "/reception/dashboard",
    label: "Reception Dashboard",
    icon: Activity,
    tone: "cyan",
    badge: "Live",
  },
  {
    to: "/reception/patients",
    label: "Patients",
    icon: Thermometer,
    tone: "emerald",
    badge: "Vitals",
  },
  {
    label: "Appointments",
    modules: ["Appointments", "Book Appointment"],
    icon: CalendarHeart,
    tone: "purple",
    children: [
      {
        to: "/reception/appointments",
        label: "Book Appointment",
        modules: ["Book Appointment", "Appointments"],
        icon: Stethoscope,
        tone: "indigo",
        badge: "Book",
      },
    ],
  },
  {
    to: "/reception/billing",
    label: "Billing",
    icon: Receipt,
    tone: "amber",
    badge: "Desk",
  },
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
    ...(showConsultantRoom ? [{ to: "/reception/consultant-room", label: "Consultant Room", icon: Microscope, tone: "rose", badge: "Lab" }] : []),
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
  const { loading: permissionsLoading } = useRolePermissionsSync(profile);
  const profileName = profile.name || "Receptionist";
  const hospitalName = getClinicDisplayName(profile, "Clinic Name");
  const branchName = String(profile.branchName || "").trim();
  const clinicIdForLogo = profile.clinicId || profile.hospitalId || localStorage.getItem("hospitalId") || localStorage.getItem("clinicId") || "";
  const clinicBranding = useClinicInvoiceBranding({
    clinicId: clinicIdForLogo,
    clinicName: hospitalName,
  });
  const location = useLocation();
  const [appointmentsOpen, setAppointmentsOpen] = useState(
    location.pathname.startsWith(`${basePath}/appointments`) || true
  );

  const baseItems = buildItems({ basePath, dashboardLabel, showBilling, showBookAppointment, showConsultantRoom });
  const navItems =
    permissionsLoading && !hasAnySavedModulePermissions(profile)
      ? []
      : filterItemsByViewPermission(baseItems, profile);
  return (
    <aside className="rc-sidebar">
      {/* Subtle Medical Instruments Backdrop Layer (Transparent Theme) */}
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

      <button type="button" className="rc-sidebar-close" onClick={onClose} aria-label="Close menu">
        <X size={18} />
      </button>

      {/* Brand Header with Frosted Glass styling */}
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

      {/* Medical Section Header & ECG Telemetry Wave */}
      <div className="rc-section-label">
        <span>{sectionLabel}</span>
        <span className="rc-sec-badge"><Activity size={10} /> Active</span>
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

      {/* Navigation with Medical Instruments & Distinct Colors */}
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

                  {/* Syringe trigger replacing the dropdown arrow */}
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
                          end={child.to === `${basePath}/appointments`}
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
            <span className="rc-staff-med-badge" title="Clinical Front Desk Staff">
              <ShieldCheck size={11} />
            </span>
          </div>
          <div className="rc-sidebar-profile-info">
            <strong title={profileName}>{profileName}</strong>
            <span title={hospitalName}>{hospitalName}</span>
            <p>
              <span className="rc-status-dot" /> Online <span className="rc-role-tag">Front Desk</span>
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default ReceptionSidebar;



