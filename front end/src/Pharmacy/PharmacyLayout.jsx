import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import UserProfileMenu from "../profile/UserProfileMenu";
import { isPharmacistSession } from "./pharmacySession";
import PharmacySidebar from "./PharmacySidebar";
import "./Pharmacy.css";
import "./PharmacyChrome.css";

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
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const results = Object.entries(PAGE_TITLES).filter(([, label]) => label.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => { setSidebarOpen(false); setSearchOpen(false); setQuery(""); }, [location.pathname]);
  useEffect(() => {
    const close = (event) => { if (event.key === "Escape") { setSidebarOpen(false); setSearchOpen(false); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const title = Object.entries(PAGE_TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] || "Pharmacy";

  if (!isPharmacistSession()) return <Navigate to="/login" replace />;

  return (
    <div className={`pharmacy-shell${sidebarOpen ? " pharmacy-shell--open" : ""}${collapsed ? " pharmacy-shell--collapsed" : ""}`}>
      {sidebarOpen ? <button type="button" className="pharmacy-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} /> : null}
      <PharmacySidebar onNavigate={() => setSidebarOpen(false)} />
      <div className="pharmacy-main">
        <header className="pharmacy-topbar">
          <button type="button" className="pharmacy-menu-button" aria-label="Toggle navigation" aria-controls="pharmacy-navigation" aria-expanded={sidebarOpen} onClick={() => { if (window.matchMedia("(max-width: 900px)").matches) setSidebarOpen((open) => !open); else setCollapsed((value) => !value); }}>
            <Menu size={20} />
          </button>
          <div className="pharmacy-topbar-title">
            <h1>{title}</h1>
            <span>Pharmacy workspace</span>
          </div>
          <form className="pharmacy-topbar-search" role="search" onSubmit={(event) => { event.preventDefault(); if (results[0]) navigate(results[0][0]); setSearchOpen(false); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}>
            <Search size={18} aria-hidden="true" />
            <input aria-label="Search pharmacy pages" placeholder="Search medicines, stock, billing..." value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} />
            {searchOpen && <div className="pharmacy-search-results">{results.length ? results.map(([path, label]) => <button type="button" key={path} onClick={() => { navigate(path); setSearchOpen(false); }}>{label}</button>) : <span>No matching pages</span>}</div>}
          </form>
          <UserProfileMenu roleType="pharmacist" />
        </header>
        <main className="pharmacy-content"><Outlet /></main>
      </div>
    </div>
  );
}

export default PharmacyLayout;
