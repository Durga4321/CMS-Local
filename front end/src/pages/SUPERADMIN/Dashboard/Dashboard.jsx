import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Building2, IndianRupee, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "../../../components/superadmin/Header";
import DashboardCards from "../../../components/superadmin/DashboardCards";
import Charts from "../../../components/superadmin/Charts";
import { fetchDashboardData, getDashboardMetric } from "../superAdminApi";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(Number(value || 0)) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

const getActivityTone = (activity = {}) => {
  const text = `${activity.title || ""} ${activity.detail || ""}`.toLowerCase();
  if (text.includes("logout") || text.includes("logged out") || text.includes("signed out")) return "logout";
  if (text.includes("login") || text.includes("logged in") || text.includes("signed in")) return "login";
  return "default";
};

const getActivityIcon = (tone) => {
  if (tone === "logout") return LogOut;
  if (tone === "login") return LogIn;
  return Activity;
};

function ActivityItem({ activity }) {
  const tone = getActivityTone(activity);
  const Icon = getActivityIcon(tone);

  return (
    <div className={`sa-activity-item sa-activity-item--${tone}`}>
      <div className={`sa-activity-icon sa-activity-icon--${tone}`}>
        <Icon size={17} />
      </div>
      <div className="sa-activity-copy">
        <b>{activity.title}</b>
        <p>{activity.detail}</p>
      </div>
      <span>{activity.time}</span>
    </div>
  );
}

function Dashboard() {
  const pageRef = useRef(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState({});
  const [summary, setSummary] = useState({});
  const [revenueData, setRevenueData] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await fetchDashboardData();
        if (!active) return;

        setDashboard(data.dashboard);
        setSummary(data.summary);
        setRevenueData(data.revenueData);
        setActivities(data.activities);
        setError(data.error);
      } catch (requestError) {
        if (active) {
          setError(requestError.message || "Unable to load dashboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const content = pageRef.current?.closest(".content");
    content?.classList.add("sa-dashboard-content");

    return () => {
      content?.classList.remove("sa-dashboard-content");
    };
  }, []);

  const cards = useMemo(() => {
    const metrics = { ...dashboard, ...summary };

    return [
      {
        label: "Total Clinics",
        value: getDashboardMetric(metrics, ["totalClinics", "clinics", "clinicCount"]),
        icon: Building2,
        tone: "teal",
        onClick: () => navigate("/superadmin/clinics"),
      },
      {
        label: "Total Admins",
        value: getDashboardMetric(metrics, ["totalAdmins", "admins", "adminCount"]),
        icon: ShieldCheck,
        tone: "blue",
        onClick: () => navigate("/superadmin/admins"),
      },
      {
        label: "Revenue Summary",
        value: formatCurrency(getDashboardMetric(metrics, ["totalRevenue", "revenue", "revenueSummary"])),
        icon: IndianRupee,
        tone: "amber",
        onClick: () => navigate("/superadmin/reports"),
      },
    ];
  }, [dashboard, navigate, summary]);

  if (loading) {
    return <div className="sa-state">Loading Super Admin dashboard...</div>;
  }

  return (
    <div className="sa-dashboard-page" ref={pageRef}>
      <Header
        title="Super Admin Dashboard"
        subtitle="Platform-wide clinics, revenue, and operational activity."
      />

      {error ? <div className="sa-state sa-state--error">{error}</div> : null}

      <div className="sa-dashboard-shell">
        <DashboardCards cards={cards} />

        <div className="sa-grid">
          <div className="sa-panel sa-panel--highlighted">
            <div className="sa-panel__header">
              <div>
                <h3>Charts & Statistics</h3>
                <p>Revenue growth across all clinics.</p>
              </div>
              <button type="button" className="sa-chip">This Month</button>
            </div>

            <Charts data={revenueData} dataKey="revenue" />
          </div>

          <div className="sa-panel sa-panel--activity">
            <div className="sa-panel__header sa-activity-panel-header">
              <div>
                <h3>Recent Activities</h3>
                <p>Latest platform events.</p>
              </div>
              <button type="button" className="sa-btn sa-btn--ghost">View All</button>
            </div>

            <div className="sa-activity-list">
              {activities.length ? activities.map((activity) => (
                <ActivityItem
                  activity={activity}
                  key={activity.id || `${activity.title}-${activity.time}`}
                />
              )) : (
                <div className="sa-empty-state">
                  <span className="sa-empty-state-icon">
                    <Activity size={28} />
                  </span>
                  <b>No Recent Activities</b>
                  <p>There are currently no Super Admin actions, logins, or system events to show.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
