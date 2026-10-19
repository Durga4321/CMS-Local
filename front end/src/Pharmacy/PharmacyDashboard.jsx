import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Boxes, ClipboardList, Package, ReceiptText, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { API_ENDPOINTS, collection, pharmacyRequest } from "./pharmacyApi";
import { normalizeMedicine } from "./medicineColumns";
import "./PharmacyDashboard.css";

const modules = [
  { key: "medicines", title: "Medicines", description: "Medicine records in the catalogue", to: "/pharmacy/medicines", icon: Package, tone: "teal" },
  { key: "stock", title: "Stock", description: "Total available stock units", to: "/pharmacy/stock", icon: Boxes, tone: "purple" },
  { key: "prescriptions", title: "Prescriptions", description: "Pending prescriptions to dispense", to: "/pharmacy/prescriptions", icon: ClipboardList, tone: "blue" },
  { key: "bills", title: "Billing", description: "Recorded pharmacy bills", to: "/pharmacy/billing", icon: ReceiptText, tone: "orange" },
];
const initialMetrics = { medicines: null, stock: null, prescriptions: null, bills: null };

function PharmacyDashboard() {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const version = useRef(0);
  const loadCounts = useCallback(async () => {
    const requestVersion = ++version.current;
    setLoading(true); setErrors([]);
    const sources = [
      { path: API_ENDPOINTS.pharmacy.medicines, keys: ["medicines", "catalogue", "catalog"], name: "Medicines and stock" },
      { path: API_ENDPOINTS.pharmacy.pendingPrescriptions, keys: ["prescriptions"], name: "Pending prescriptions" },
      { path: API_ENDPOINTS.billing.pharmacy, keys: ["bills", "billings"], name: "Pharmacy bills" },
    ];
    const results = await Promise.allSettled(sources.map(async (source) => {
      const payload = await pharmacyRequest(source.path);
      const rows = collection(payload, source.keys);
      if (!rows) throw new Error("Unexpected response format.");
      return rows;
    }));
    if (requestVersion !== version.current) return;
    const next = { ...initialMetrics };
    const failures = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") { failures.push(`${sources[index].name}: ${result.reason.message}`); return; }
      const rows = result.value;
      if (index === 0) {
        next.medicines = rows.length;
        next.stock = rows.reduce((sum, row) => {
          const quantity = Number(normalizeMedicine(row).Quantity ?? 0);
          return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
        }, 0);
      } else if (index === 1) next.prescriptions = rows.length;
      else next.bills = rows.length;
    });
    setMetrics(next); setErrors(failures); setUpdatedAt(new Date()); setLoading(false);
  }, []);
  useEffect(() => {
    loadCounts();
    return () => { version.current += 1; };
  }, [loadCounts]);

  return (
    <section className="pharmacy-dashboard pharmacy-count-dashboard">
      <header className="pharmacy-dashboard-heading">
        <h2>Welcome to Pharmacy Dashboard</h2>
        <button type="button" className="pharmacy-dashboard-refresh" onClick={loadCounts} disabled={loading}><RefreshCw size={17} />{loading ? "Refreshing..." : "Refresh counts"}</button>
      </header>
      {errors.length > 0 && <div className="pharmacy-import-message is-error" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
      <div className="pharmacy-count-grid" aria-busy={loading}>
        {modules.map(({ key, title, description, to, icon: Icon, tone }) => (
          <Link className={`pharmacy-count-card pharmacy-count-card--${tone}`} to={to} key={key} aria-label={`Open ${title}`}>
            <div className="pharmacy-count-card-top"><span className="pharmacy-count-icon"><Icon size={23} /></span><span className="pharmacy-count-arrow"><ArrowRight size={19} /></span></div>
            <span className="pharmacy-count-title">{title}</span>
            <strong className="pharmacy-count-value">{loading ? "..." : metrics[key] === null ? "Unavailable" : metrics[key].toLocaleString("en-IN")}</strong>
            <span className="pharmacy-count-description">{description}</span>
            <span className="pharmacy-count-link">View {title.toLowerCase()} <ArrowRight size={15} /></span>
          </Link>
        ))}
      </div>
      <p className="pharmacy-dashboard-updated" role="status">{loading ? "Loading counts from the backend..." : `${errors.length ? "Some counts could not be loaded. " : ""}Last refreshed ${updatedAt?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) || ""}`}</p>
    </section>
  );
}
export default PharmacyDashboard;
