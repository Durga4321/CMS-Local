import React from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  ArrowLeftToLine,
  FileBarChart2,
  FlaskConical,
  Gauge,
  Microscope,
  ShieldCheck,
  Syringe,
  TestTube2,
  UserRound,
  X,
} from "lucide-react";
import { getInitials } from "../profile/sessionProfile";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { getDefaultClinicLogo, useClinicInvoiceBranding } from "../utils/clinicBranding";
import { getLabProfile } from "./labSession";
import { filterItemsByViewPermission, hasAnySavedModulePermissions, useRolePermissionsSync } from "../utils/rolePermissions";

const items = [
  { to: "/lab/dashboard", label: "Lab Dashboard", icon: Gauge, tone: "cyan", badge: "Live" },
  { to: "/lab/patients", label: "Patients", icon: UserRound, tone: "emerald", badge: "Desk" },
  { to: "/lab/diagnosis-tests", label: "Diagnosis Tests", icon: FlaskConical, tone: "purple", badge: "Tests" },
  { to: "/lab/sample-collection", label: "Sample Collection", icon: TestTube2, tone: "amber", badge: "Samples" },
  { to: "/lab/report-create", label: "Create Report", icon: FileBarChart2, tone: "indigo", badge: "Entry" },
  { to: "/lab/reports", label: "Reports", icon: FileBarChart2, tone: "rose", badge: "Archive" },
];

function LabSidebar({ onClose = () => {}, collapsed = false, onToggleCollapse = () => {} }) {
  const profile = getLabProfile();
  const { loading: permissionsLoading } = useRolePermissionsSync(profile);
  const profileName = profile.name || "Lab Technician";
  const hospitalName = getClinicDisplayName(profile, "Clinic Name");
  const branchName = String(profile.branchName || "").trim();
  const clinicIdForLogo = profile.clinicId || profile.hospitalId || localStorage.getItem("hospitalId") || localStorage.getItem("clinicId") || "";
  const branding = useClinicInvoiceBranding({ clinicId: clinicIdForLogo, clinicName: hospitalName });
  const navItems =
    permissionsLoading && !hasAnySavedModulePermissions(profile)
      ? []
      : filterItemsByViewPermission(items, profile);

  return (
    <aside className={`rc-sidebar lab-sidebar ${collapsed ? "collapsed" : ""}`}>
      {/* Subtle Laboratory Instruments Backdrop Layer */}
      <div className="rc-sidebar-med-backdrop" aria-hidden="true">
        <div className="rc-sidebar-med-bg-img" />
        {!collapsed && (
          <div className="rc-sidebar-med-particles">
            <div className="rc-med-float-instrument med-float-1" title="Microscope">
              <Microscope size={26} />
            </div>
            <div className="rc-med-float-instrument med-float-2" title="Flask">
              <FlaskConical size={20} />
            </div>
            <div className="rc-med-float-instrument med-float-3" title="Test Tube">
              <TestTube2 size={22} />
            </div>
            <div className="rc-med-float-instrument med-float-4" title="Syringe">
              <Syringe size={24} />
            </div>
          </div>
        )}
      </div>

      <button type="button" className="rc-sidebar-close" onClick={onClose} aria-label="Close menu">
        <X size={18} />
      </button>

      {/* Brand Header */}
      <div className="rc-brand" title={collapsed ? `${hospitalName}${branchName ? ` (${branchName})` : ""}` : undefined}>
        <div className="rc-brand-icon rc-clinic-logo rc-clinic-logo--emerald">
          <img
            src={branding.logoUrl}
            alt=""
            onError={(event) => {
              event.currentTarget.src = getDefaultClinicLogo(hospitalName, clinicIdForLogo);
            }}
          />
        </div>
        {!collapsed && (
          <div className="rc-brand-text">
            <span className="rc-brand-tag">Diagnostic Lab</span>
            <strong>{hospitalName}</strong>
            {branchName ? <em className="rc-brand-branch">{branchName}</em> : null}
          </div>
        )}
      </div>

      {/* Laboratory Section Header & ECG Telemetry Wave */}
      {!collapsed && (
        <>
          <div className="rc-section-label">
            <span>Lab Desk</span>
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
        </>
      )}

      {/* Navigation with Distinct Color Tones */}
      <nav className="rc-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const toneClass = `rc-tone--${item.tone || "cyan"}`;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => `rc-nav-link ${toneClass}${isActive ? " active" : ""}`}
            >
              <span className="rc-nav-icon-wrap">
                <Icon size={18} />
              </span>
              {!collapsed && <span className="rc-nav-label">{item.label}</span>}
              {!collapsed && item.badge ? <span className="rc-med-nav-pill">{item.badge}</span> : null}
            </NavLink>
          );
        })}
      </nav>

      {/* Staff Profile Docked at Bottom */}
      <div className="rc-sidebar-footer">
        <div className="rc-sidebar-profile" title={collapsed ? `${profileName} (${hospitalName})` : undefined}>
          <div className="rc-sidebar-avatar-wrap">
            <div className="rc-sidebar-avatar">{getInitials(profileName)}</div>
            <span className="rc-staff-med-badge" title="Diagnostic Lab Technician">
              <ShieldCheck size={11} />
            </span>
          </div>
          {!collapsed && (
            <div className="rc-sidebar-profile-info">
              <strong title={profileName}>{profileName}</strong>
              <span title={hospitalName}>{hospitalName}</span>
              <p>
                <span className="rc-status-dot" /> Online <span className="rc-role-tag">Lab Tech</span>
              </p>
            </div>
          )}
        </div>

        {/* BOTTOM COLLAPSE MENU TOGGLE */}
        <div className="rc-sidebar-bottom">
          <button
            type="button"
            className="rc-collapse-btn collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand Menu" : "Collapse Menu"}
          >
            <ArrowLeftToLine
              size={16}
              style={{
                transform: collapsed ? "rotate(180deg)" : "none",
                transition: "transform 0.25s ease",
              }}
            />
            <span>{collapsed ? "Expand" : "Collapse Menu"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default LabSidebar;
