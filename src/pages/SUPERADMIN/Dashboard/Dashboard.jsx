import React, { useEffect, useMemo, useState } from "react";
import { Activity, Building2, IndianRupee, ShieldCheck, UserCheck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "../../../components/superadmin/Header";
import DashboardCards from "../../../components/superadmin/DashboardCards";
import Charts from "../../../components/superadmin/Charts";
import { fetchDashboardData, getDashboardMetric } from "../superAdminApi";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

function Dashboard() {
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
        label: "Total Users",
        value: getDashboardMetric(metrics, ["totalUsers", "users", "userCount"]),
        icon: Users,
        tone: "amber",
        onClick: () => navigate("/superadmin/users"),
      },
      {
        label: "Active Users",
        value: getDashboardMetric(metrics, ["activeUsers", "activeUserCount"]),
        icon: UserCheck,
        tone: "green",
        onClick: () => navigate("/superadmin/users"),
      },
      {
        label: "Revenue Summary",
        value: formatCurrency(getDashboardMetric(metrics, ["totalRevenue", "revenue", "revenueSummary"])),
        icon: IndianRupee,
        tone: "teal",
        onClick: () => navigate("/superadmin/reports"),
      },
    ];
  }, [dashboard, navigate, summary]);

  if (loading) {
    return <div className="sa-state">Loading Super Admin dashboard...</div>;
  }

  return (
    <>
      <Header
        title="Super Admin Dashboard"
        subtitle="Platform-wide clinics, users, revenue, and operational activity."
      />

      {error ? <div className="sa-state sa-state--error">{error}</div> : null}

      <DashboardCards cards={cards} />

      <div className="sa-grid">
        <div className="sa-panel">
          <h3>Charts & Statistics</h3>
          <p>Revenue and user growth across all clinics.</p>
          <Charts data={revenueData} dataKey="revenue" secondaryKey="users" />
        </div>

        <div className="sa-panel">
          <h3>Recent Activities</h3>
          <p>Latest platform events.</p>
          <div className="sa-activity-list">
            {activities.length ? activities.map((activity) => (
              <div className="sa-activity-item" key={activity.id}>
                <div>
                  <b>{activity.title}</b>
                  <p>{activity.detail}</p>
                </div>
                <span>{activity.time}</span>
              </div>
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
    </>
  );
}

export default Dashboard;
