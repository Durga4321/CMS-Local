import React, { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import UserProfileMenu from "../profile/UserProfileMenu";
import { isPharmacistSession } from "./pharmacySession";
import PharmacySidebar from "./PharmacySidebar";
import "./Pharmacy.css";

const PAGE_TITLES = {
  "/pharmacy/dashboard": "Pharmacy Dashboard",
  "/pharmacy/medicines": "Medicines",
  "/pharmacy/stock": "Stock",
  "/pharmacy/billing": "Billing",
  "/pharmacy/prescriptions": "Prescriptions",
  "/pharmacy/profile": "Profile",
};

function PharmacyLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const title = Object.entries(PAGE_TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] || "Pharmacy";

  if (!isPharmacistSession()) return <Navigate to="/login" replace />;

  return (
    <div className={`pharmacy-shell${sidebarOpen ? " pharmacy-shell--open" : ""}`}>
      {sidebarOpen ? <button type="button" className="pharmacy-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} /> : null}
      <PharmacySidebar onNavigate={() => setSidebarOpen(false)} />
      <div className="pharmacy-main">
        <header className="pharmacy-topbar">
          <button type="button" className="pharmacy-menu-button" aria-label="Toggle navigation" onClick={() => setSidebarOpen((open) => !open)}>
            <span aria-hidden="true">☰</span>
          </button>
          <div className="pharmacy-topbar-title">
            <h1>{title}</h1>
            <span>Pharmacy workspace</span>
          </div>
          <UserProfileMenu roleType="pharmacist" />
        </header>
        <main className="pharmacy-content"><Outlet /></main>
      </div>
    </div>
  );
}

export default PharmacyLayout;
