import { Sun, Moon, Sunrise } from "lucide-react";
import React, { useLayoutEffect, useRef, useState, useEffect } from "react";

function DashboardCards({ cards = [] }) {
  if (!cards.length) {
    return <div className="sa-empty">No dashboard metrics available.</div>;
  }

  return (
    <div className="sa-card-grid">
      {cards.map(({ label, value, icon: Icon, tone, onClick, className = "" }) => (
        <button
          type="button"
          className={`sa-stat-card sa-stat-card--${tone || "teal"}${className ? ` ${className}` : ""}`}
          key={label}
          onClick={onClick}
          disabled={!onClick}
        >
          <div className={`sa-stat-icon sa-stat-icon--${tone || "teal"}`}>
            {Icon ? <Icon size={18} /> : null}
          </div>
          <div className="sa-stat-copy">
            <p>{label}</p>
            <h2>{value}</h2>
          </div>
        </button>
      ))}
    </div>
  );
}

export default DashboardCards;


// Shared viewport sizing keeps every role dashboard at the available screen height.
export function useDashboardLayout() {
  const ref = useRef(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(3);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const fit = () => {
      const height = Math.max(200, window.innerHeight - node.getBoundingClientRect().top - 12);
      node.style.setProperty("--role-dashboard-height", height + "px");
      setPageSize(height < 560 ? 2 : 3);
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (node.parentElement) observer.observe(node.parentElement);
    window.addEventListener("resize", fit);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  });
  return { ref, page, setPage, pageSize, rows: (rows) => rows.slice(page * pageSize, (page + 1) * pageSize) };
}
export function DashboardPager({ layout, total }) {
  const pages = Math.max(1, Math.ceil(total / layout.pageSize));
  useEffect(() => { if (layout.page >= pages) layout.setPage(pages - 1); }, [pages, layout.page, layout.setPage]);
  return <div className="role-dashboard-pager" aria-label="Dashboard list pages"><span>{total} records</span><button type="button" disabled={layout.page === 0} onClick={() => layout.setPage(page => page - 1)}>Previous</button><span>{Math.min(layout.page + 1,pages)} / {pages}</span><button type="button" disabled={layout.page >= pages - 1} onClick={() => layout.setPage(page => page + 1)}>Next</button></div>;
}

export function DashboardGreeting({ role, name }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(timer); }, []);
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const Icon = hour < 12 ? Sunrise : hour < 17 ? Sun : Moon;
  const key = ({ Doctor: "doctor", Nurse: "nurse", Receptionist: "receptionist", Patient: "patient", Pharmacist: "pharmacist", "Lab Technician": "lab" })[role];
  const displayName = name || (key && (sessionStorage.getItem(key + "Name") || localStorage.getItem(key + "Name"))) || role;
  return <div className="role-dashboard-greeting"><span className="role-greeting-icon" aria-hidden="true"><Icon size={25}/></span><div><h1>{greeting}, {displayName}!</h1><p>Here's your overview for today.</p></div></div>;
}
