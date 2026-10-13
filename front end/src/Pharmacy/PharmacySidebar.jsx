import React from "react";
import { NavLink } from "react-router-dom";
import { Boxes, ClipboardList, LayoutDashboard, Package, ReceiptText } from "lucide-react";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { getPharmacistProfile } from "./pharmacySession";

const navigation = [
  { to: "/pharmacy/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/pharmacy/medicines", label: "Medicines", icon: Package },
  { to: "/pharmacy/stock", label: "Stock", icon: Boxes },
  { to: "/pharmacy/billing", label: "Billing", icon: ReceiptText },
  { to: "/pharmacy/prescriptions", label: "Prescriptions", icon: ClipboardList },
];

function PharmacySidebar({ onNavigate }) {
  const profile = getPharmacistProfile();
  const clinicName = getClinicDisplayName(profile, "Clinic");

  return (
    <aside className="pharmacy-sidebar">
      <div className="pharmacy-brand">
        <span className="pharmacy-brand-icon"><Package size={22} /></span>
        <div><strong>{clinicName}</strong><span>Pharmacy</span></div>
      </div>
      <div className="pharmacy-section-label">PHARMACY WORKSPACE</div>
      <nav className="pharmacy-nav" aria-label="Pharmacy navigation">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate} className={({ isActive }) => `pharmacy-nav-link${isActive ? " is-active" : ""}`}>
            <Icon size={19} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="pharmacy-sidebar-user">
        <span className="pharmacy-avatar">{String(profile.name || "P").trim().charAt(0).toUpperCase()}</span>
        <div><strong>{profile.name || "Pharmacist"}</strong><span>{profile.branchName || "Pharmacist account"}</span></div>
      </div>
    </aside>
  );
}

export default PharmacySidebar;
