import { DashboardGreeting, useDashboardLayout } from "../components/superadmin/DashboardCards";
﻿import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Boxes, ClipboardList, Package, ReceiptText, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { API_ENDPOINTS, collection, pharmacyRequest, invalidatePharmacyReads } from "./pharmacyApi";
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
  const layout = useDashboardLayout();
  const [metrics, setMetrics] = useState(initialMetrics);
  const [medicineStock, setMedicineStock] = useState(null);
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
    await Promise.allSettled(sources.map(async (source, index) => {
      try {
        const payload = await pharmacyRequest(source.path, { cacheMs: 15000 });
        const rows = collection(payload, source.keys);
        if (!rows) throw new Error("Unexpected response format.");
        if (requestVersion !== version.current) return;
        const values = index === 0 ? (() => {
          const normalizedRows = rows.map((row) => normalizeMedicine(row));
          setMedicineStock(normalizedRows);
          return {
            medicines: normalizedRows.length,
            stock: normalizedRows.reduce((sum, row) => {
              const quantity = Number(row.Quantity ?? 0);
              return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
            }, 0),
          };
        })() : index === 1 ? { prescriptions: rows.length } : { bills: rows.length };
        setMetrics((previous) => ({ ...previous, ...values }));
      } catch (error) {
        if (requestVersion === version.current) {
          if (index === 0) setMedicineStock([]);
          setErrors((previous) => [...previous, source.name + ": " + error.message]);
        }
      }
    }));
    if (requestVersion !== version.current) return;
    setUpdatedAt(new Date()); setLoading(false);
  }, []);
  useEffect(() => {
    loadCounts();
    return () => { version.current += 1; };
  }, [loadCounts]);
  const stockCharts = useMemo(() => {
    if (!medicineStock) return null;
    const medicines = medicineStock.map((row, index) => {
      const quantityValue = Number(row.Quantity);
      const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 0;
      const thresholdValue = row.ReorderLevel ?? row.MinimumStock;
      const threshold = thresholdValue === "" || thresholdValue == null ? null : Number(thresholdValue);
      const status = quantity === 0 ? "Out of stock"
        : Number.isFinite(threshold) && threshold >= 0 && quantity <= threshold ? "Low stock"
          : "In stock";
      return {
        name: String(row.Name || row.GenericName || `Medicine ${index + 1}`),
        quantity,
        threshold: Number.isFinite(threshold) && threshold > 0 ? threshold : null,
        status,
      };
    });
    const priority = (medicine) => medicine.quantity === 0 ? 0
      : medicine.threshold === null ? 3
        : medicine.quantity <= medicine.threshold ? 1 : 2;
    const prioritizedMedicines = [...medicines]
      .sort((first, second) => {
        const priorityDifference = priority(first) - priority(second);
        if (priorityDifference) return priorityDifference;
        if (first.threshold !== null && second.threshold !== null) {
          return first.quantity / first.threshold - second.quantity / second.threshold;
        }
        return first.quantity - second.quantity;
      })
      .slice(0, 5);
    const maxTopQuantity = Math.max(0, ...prioritizedMedicines.map((medicine) => medicine.quantity));
    const topMedicines = prioritizedMedicines.map((medicine) => {
      const scale = medicine.threshold === null
        ? maxTopQuantity
        : Math.max(medicine.quantity, medicine.threshold);
      return {
        ...medicine,
        stockWidth: scale ? medicine.quantity / scale * 100 : 0,
        thresholdPosition: medicine.threshold === null ? null : medicine.threshold / scale * 100,
      };
    });
    const statusCounts = [
      { name: "In stock", value: medicines.filter((medicine) => medicine.status === "In stock").length, color: "#0f8b8d" },
      { name: "Low stock", value: medicines.filter((medicine) => medicine.status === "Low stock").length, color: "#f59e0b" },
      { name: "Out of stock", value: medicines.filter((medicine) => medicine.status === "Out of stock").length, color: "#ef4444" },
    ];
    let piePosition = 0;
    const stockPieSegments = statusCounts.map((status) => {
      const start = piePosition;
      piePosition += medicines.length ? status.value / medicines.length * 100 : 0;
      return `${status.color} ${start}% ${piePosition}%`;
    });
    const stockPieBackground = medicines.length
      ? `conic-gradient(${stockPieSegments.join(", ")})`
      : "#e2e8f0";
    return { topMedicines, statusCounts, medicineCount: medicines.length, stockPieBackground };
  }, [medicineStock]);

  return (
    <section className="pharmacy-dashboard pharmacy-count-dashboard role-single-screen" ref={layout.ref}>
      <header className="pharmacy-dashboard-heading" data-page-header>
        <DashboardGreeting role="Pharmacist" />
        <button type="button" className="pharmacy-dashboard-refresh" onClick={() => { invalidatePharmacyReads(); loadCounts(); }} disabled={loading}><RefreshCw size={17} />{loading ? "Refreshing..." : "Refresh counts"}</button>
      </header>
      {errors.length > 0 && <div className="pharmacy-import-message is-error" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
      <div className="pharmacy-count-grid" aria-busy={loading}>
        {modules.map(({ key, title, description, to, icon: Icon, tone }) => (
          <Link className={`pharmacy-count-card pharmacy-count-card--${tone}`} to={to} key={key} aria-label={`Open ${title}`}>
            <div className="pharmacy-count-card-top"><span className="pharmacy-count-icon"><Icon size={23} /></span><span className="pharmacy-count-arrow"><ArrowRight size={19} /></span></div>
            <span className="pharmacy-count-title">{title}</span>
            <strong className="pharmacy-count-value">{metrics[key] === null ? (loading ? "..." : "Unavailable") : metrics[key].toLocaleString("en-IN")}</strong>
            <span className="pharmacy-count-description">{description}</span>
            <span className="pharmacy-count-link">View {title.toLowerCase()} <ArrowRight size={15} /></span>
          </Link>
        ))}
      </div>
      {(loading || errors.length > 0) && (
        <p className="pharmacy-dashboard-updated" role="status">
          {loading ? "Loading counts from the backend..." : "Some counts could not be loaded."}
        </p>
      )}
      <section className="pharmacy-inventory-charts" aria-label="Medicine and stock charts">
        <article className="pharmacy-inventory-chart-card">
          <h2>Top medicines by stock</h2>
          {stockCharts?.topMedicines.length ? (
            <ol className="pharmacy-top-medicines">
              {stockCharts.topMedicines.map((medicine, index) => (
                <li
                  className={`pharmacy-top-medicine${medicine.quantity === 0 ? " is-out-of-stock" : medicine.threshold !== null && medicine.quantity <= medicine.threshold ? " is-low-stock" : ""}`}
                  key={`${medicine.name}-${index}`}
                  title={`${medicine.name}: ${medicine.quantity.toLocaleString("en-IN")} in stock${medicine.threshold === null ? "" : `, reorder level ${medicine.threshold.toLocaleString("en-IN")}`}`}
                >
                  <div className="pharmacy-top-medicine-heading">
                    <span>{medicine.name}</span>
                    <strong>{medicine.threshold === null
                      ? medicine.quantity.toLocaleString("en-IN")
                      : `${medicine.quantity.toLocaleString("en-IN")} / ${medicine.threshold.toLocaleString("en-IN")}`}</strong>
                  </div>
                  <div
                    className="pharmacy-top-medicine-track"
                    role="img"
                    aria-label={`${medicine.quantity.toLocaleString("en-IN")} in stock${medicine.threshold === null ? "" : `; reorder level ${medicine.threshold.toLocaleString("en-IN")}`}`}
                  >
                    <span style={{ width: `${medicine.stockWidth}%` }} />
                    {medicine.thresholdPosition !== null && (
                      <span className="pharmacy-top-medicine-threshold" style={{ left: `${medicine.thresholdPosition}%` }} />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className="pharmacy-chart-empty">{medicineStock === null ? "Loading medicine data..." : "No medicine stock data available."}</p>}
        </article>
        <article className="pharmacy-inventory-chart-card">
          <h2>Stock availability</h2>
          {stockCharts ? (
            <div className="pharmacy-stock-overview">
              <div className="pharmacy-stock-counts">
                {stockCharts.statusCounts.map((status) => (
                  <div className="pharmacy-stock-count" key={status.name} style={{ "--stock-status-color": status.color }}>
                    <span>{status.name}</span>
                    <strong>{status.value.toLocaleString("en-IN")}</strong>
                  </div>
                ))}
              </div>
              <div
                className="pharmacy-stock-pie"
                role="img"
                aria-label={stockCharts.statusCounts.map((status) => `${status.value} ${status.name.toLowerCase()}`).join(", ")}
                style={{ background: stockCharts.stockPieBackground }}
              >
                <span>{stockCharts.medicineCount.toLocaleString("en-IN")}</span>
              </div>
            </div>
          ) : <p className="pharmacy-chart-empty">Loading medicine data...</p>}
        </article>
      </section>
    </section>
  );
}
export default PharmacyDashboard;
