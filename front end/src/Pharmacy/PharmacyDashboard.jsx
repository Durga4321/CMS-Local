import React from "react";
import { ArrowRight, Boxes, ClipboardList, Package, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import { getPharmacistProfile } from "./pharmacySession";

const modules = [
  { title: "Medicines", description: "Browse the clinic medicine catalogue.", to: "/pharmacy/medicines", icon: Package },
  { title: "Stock", description: "Review available medicine stock.", to: "/pharmacy/stock", icon: Boxes },
  { title: "Prescriptions", description: "Review prescriptions for dispensing.", to: "/pharmacy/prescriptions", icon: ClipboardList },
  { title: "Billing", description: "Access pharmacy billing tools.", to: "/pharmacy/billing", icon: ReceiptText },
];

function PharmacyDashboard() {
  const profile = getPharmacistProfile();

  return (
    <section className="pharmacy-dashboard">
      <div className="pharmacy-welcome">
        <span className="pharmacy-eyebrow">PHARMACY OVERVIEW</span>
        <h2>Welcome, {profile.name || "Pharmacist"}</h2>
        <p>Your pharmacy workspace is ready. Choose a module to continue.</p>
      </div>
      <div className="pharmacy-module-grid">
        {modules.map(({ title, description, to, icon: Icon }) => (
          <Link className="pharmacy-module-card" to={to} key={to}>
            <span className="pharmacy-module-icon"><Icon size={21} /></span>
            <span className="pharmacy-module-title">{title}</span>
            <span className="pharmacy-module-description">{description}</span>
            <span className="pharmacy-module-link">Open module <ArrowRight size={15} /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default PharmacyDashboard;
