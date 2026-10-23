import React from "react";
import { NavLink } from "react-router-dom";
import { Boxes, ClipboardList, LayoutDashboard, Package, ReceiptText } from "lucide-react";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { getDefaultClinicLogo, useClinicInvoiceBranding } from "../utils/clinicBranding";
import { getPharmacistProfile } from "./pharmacySession";

const navigation = [
  { to: "/pharmacy/dashboard", label: "Dashboard", icon: LayoutDashboard, tone: "blue", end: true },
  { to: "/pharmacy/medicines", label: "Medicines", icon: Package, tone: "teal" },
  { to: "/pharmacy/stock", label: "Stock", icon: Boxes, tone: "purple" },
  { to: "/pharmacy/billing", label: "Billing", icon: ReceiptText, tone: "orange" },
  { to: "/pharmacy/prescriptions", label: "Prescriptions", icon: ClipboardList, tone: "cyan" },
];

function PharmacySidebar({ onNavigate }) {
  const profile = getPharmacistProfile();
  const clinicName = getClinicDisplayName(profile, "Clinic");

  const clinicId = profile.hospitalId || "";
  const branding = useClinicInvoiceBranding({ clinicId, clinicName });
  const fallbackLogo = getDefaultClinicLogo(clinicName, clinicId);

  return (
    <aside id="pharmacy-navigation" className="pharmacy-sidebar">
      <div className="pharmacy-brand">
        <span className="pharmacy-brand-icon"><img src={branding.logoUrl || fallbackLogo} alt={clinicName + " logo"} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackLogo; }} /></span>
        <div><strong title={clinicName}>{clinicName}</strong><span>Pharmacy Console</span></div>
      </div>
      <div className="pharmacy-section-label">PHARMACY WORKSPACE</div>
      <nav className="pharmacy-nav" aria-label="Pharmacy navigation">
        {navigation.map(({ to, label, icon: Icon, end, tone }) => (
          <NavLink key={to} to={to} end={end} title={label} onClick={onNavigate} className={({ isActive }) => `pharmacy-nav-link pharmacy-tone-${tone}${isActive ? " is-active" : ""}`}>
            <span className="pharmacy-nav-icon"><Icon size={19} /></span><span className="pharmacy-nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="pharmacy-sidebar-user">
        <span className="pharmacy-avatar">{String(profile.name || "P").trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
        <div><strong title={profile.name}>{profile.name || "Pharmacist"}</strong><span>{clinicName}</span>{profile.branchName && <span className="pharmacy-profile-branch">{profile.branchName}</span>}<span className="pharmacy-profile-status"><i aria-hidden="true" />Online</span></div>
      </div>
    </aside>
  );
}

export default PharmacySidebar;
