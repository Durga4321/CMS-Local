import React from "react";
import { NavLink } from "react-router-dom";
import { FileBarChart2, FlaskConical, Gauge, TestTube2, UserRound, X } from "lucide-react";
import { getInitials } from "../profile/sessionProfile";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { getDefaultClinicLogo, useClinicInvoiceBranding } from "../utils/clinicBranding";
import { getLabProfile } from "./labSession";
import { filterItemsByViewPermission, hasAnySavedModulePermissions, useRolePermissionsSync } from "../utils/rolePermissions";

const items = [
  { to: "/lab/dashboard", label: "Lab Dashboard", icon: Gauge },
  { to: "/lab/patients", label: "Patients", icon: UserRound },
  { to: "/lab/diagnosis-tests", label: "Diagnosis Tests", icon: FlaskConical },
  { to: "/lab/sample-collection", label: "Sample Collection", icon: TestTube2 },
  { to: "/lab/report-create", label: "Create Report", icon: FileBarChart2 },
  { to: "/lab/reports", label: "Reports", icon: FileBarChart2 },
];

function LabSidebar({ onClose = () => {} }) {
  const profile = getLabProfile();
  const { loading: permissionsLoading } = useRolePermissionsSync(profile);
  const hospitalName = getClinicDisplayName(profile, "Clinic Name");
  const clinicIdForLogo = profile.clinicId || profile.hospitalId || localStorage.getItem("hospitalId") || localStorage.getItem("clinicId") || "";
  const branding = useClinicInvoiceBranding({ clinicId: clinicIdForLogo, clinicName: hospitalName });
  const navItems =
    permissionsLoading && !hasAnySavedModulePermissions(profile)
      ? []
      : filterItemsByViewPermission(items, profile);

  return (
    <aside className="rc-sidebar lab-sidebar">
      <div className="rc-brand">
        <div className="rc-brand-icon rc-clinic-logo rc-clinic-logo--emerald">
          <img src={branding.logoUrl} alt="" onError={(event) => { event.currentTarget.src = getDefaultClinicLogo(hospitalName, clinicIdForLogo); }} />
        </div>
        <div>
          <span>Clinic Name</span>
          <strong>{hospitalName}</strong>
          {profile.branchName ? <em className="rc-brand-branch">{profile.branchName}</em> : null}
        </div>
        <button className="rc-sidebar-close" onClick={onClose} type="button" aria-label="Close sidebar">
          <X size={18} />
        </button>
      </div>
      <div className="rc-section-label">Lab Desk</div>
      <nav className="rc-nav">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `rc-nav-link${isActive ? " active" : ""}`}>
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="rc-sidebar-profile">
        <div className="rc-sidebar-avatar">{getInitials(profile.name)}</div>
        <div className="rc-sidebar-profile-info">
          <strong>{profile.name}</strong>
          <span>{hospitalName}</span>
          <p><span className="rc-status-dot" /> Online</p>
        </div>
      </div>
    </aside>
  );
}

export default LabSidebar;
