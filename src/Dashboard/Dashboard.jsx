
import React, {
  useEffect,
  useState,
} from "react";

import "./Dashboard.css";

import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  Stethoscope,
  Users,
  Calendar,
  DollarSign,
  CalendarCheck,
  CheckCircle,
  Clock,
  UserPlus,
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "../config/api";
import {
  formatCompactIndianCurrency,
  formatIndianCurrency,
} from "../utils/format";

/* ================= API ================= */

const API = apiUrl("Dashboard");

const getAdminToken = () =>
  localStorage.getItem("adminToken") ||
  localStorage.getItem("token");

const formatCurrency = (value) =>
  formatIndianCurrency(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const formatNumber = (value) =>
  new Intl.NumberFormat("en-IN").format(
    Number(value || 0)
  );

const formatCurrencyShort = formatCompactIndianCurrency;

const getPaddedMax = (value) =>
  Math.max(
    1,
    Math.ceil(Number(value || 0) * 1.25)
  );

/* ================= COMPONENT ================= */

function Dashboard() {
  const navigate =
    useNavigate();
  const location =
    useLocation();

  const [dashboardData,
    setDashboardData] =
    useState(null);

  const [loading,
    setLoading] =
    useState(true);
  const openAddDoctor = () => {
    navigate("/doctors/add");
  };

  /* ================= LOAD DASHBOARD ================= */

  useEffect(() => {

    fetchDashboard();

  }, []);

  useEffect(() => {
    if (
      loading ||
      location.hash !== "#recent-activity"
    ) {
      return undefined;
    }

    const frameId =
      window.requestAnimationFrame(
        () => {
          document
            .getElementById(
              "recent-activity"
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
        }
      );

    return () =>
      window.cancelAnimationFrame(
        frameId
      );
  }, [
    loading,
    location.hash,
  ]);

  const fetchDashboard =
    async () => {

      try {
        const token =
          getAdminToken();

        const response =
          await fetch(API, {
            headers: {
              "ngrok-skip-browser-warning":
                "true",
              ...(token
                ? {
                    Authorization:
                      `Bearer ${token}`,
                  }
                : {}),
            },
          });

        if (!response.ok) {
          throw new Error(
            "Unable to load dashboard"
          );
        }

        const data =
          await response.json();

        console.log(
          "DASHBOARD:",
          data
        );

        setDashboardData(
          data
        );

      } catch (error) {

        console.log(error);

      } finally {

        setLoading(false);

      }
    };

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div
        style={{
          padding: "30px",
        }}
      >
        Loading dashboard...
      </div>
    );
  }

  /* ================= CHART DATA ================= */

  const revenueData =
    dashboardData?.revenueTrend?.map(
      (item) => ({
        name:
          item.month,
        value:
          item.revenue,
      })
    ) || [];

  const totalRevenue =
    dashboardData?.totalRevenue || 0;

  const growthData =
    dashboardData?.growthChart?.map(
      (item) => ({
        name:
          item.month,
        patients:
          item.patients,
        appointments:
          item.appointments,
      })
    ) || [];

  const pieData = [
    {
      name:
        "Available",
      value:
        dashboardData
          ?.clinicStatus
          ?.available || 0,
      color:
        "#0ea5a5",
    },
    {
      name:
        "Busy",
      value:
        dashboardData
          ?.clinicStatus
          ?.busy || 0,
      color:
        "#3b82f6",
    },
    {
      name:
        "On Leave",
      value:
        dashboardData
          ?.clinicStatus
          ?.onLeave || 0,
      color:
        "#f59e0b",
    },
  ];

  const summaryCards = [
    {
      label:
        "Total Doctors",
      value:
        formatNumber(
          dashboardData?.totalDoctors
        ),
      icon:
        Stethoscope,
      color:
        "",
    },
    {
      label:
        "Total Patients",
      value:
        formatNumber(
          dashboardData?.totalPatients
        ),
      icon:
        Users,
      color:
        "blue",
    },
    {
      label:
        "Total Appointments",
      value:
        formatNumber(
          dashboardData?.totalAppointments
        ),
      icon:
        Calendar,
      color:
        "purple",
    },
    {
      label:
        "Today's Appointments",
      value:
        formatNumber(
          dashboardData?.todayAppointments
        ),
      icon:
        CalendarCheck,
      color:
        "green",
    },
    {
      label:
        "Completed Appointments",
      value:
        formatNumber(
          dashboardData?.completedAppointments
        ),
      icon:
        CheckCircle,
      color:
        "teal",
    },
    {
      label:
        "Waiting Appointments",
      value:
        formatNumber(
          dashboardData?.waitingAppointments
        ),
      icon:
        Clock,
      color:
        "amber",
    },
    {
      label:
        "Total Revenue",
      value:
        formatCurrency(
          totalRevenue
        ),
      icon:
        DollarSign,
      color:
        "orange",
    },
  ];

  return (

    <div className="dashboard">

      {/* HEADER */}

      <div className="dashboard-header">

        <div>

          <h1>
            Dashboard
          </h1>

          <p>
            Welcome back —
            here's what's
            happening at
            the clinic today.
          </p>

        </div>

        <button
          type="button"
          className="dashboard-action-button"
          onClick={openAddDoctor}
          title="Add doctor"
        >
          <UserPlus size={16} />
          Add Doctor
        </button>

      </div>

      {/* STATS */}

      <div className="dashboard-stats">

        {summaryCards.map(
          ({
            label,
            value,
            icon: Icon,
            color,
          }) => (

            <div
              className="dashboard-stat-card"
              key={label}
            >

              <div
                className={`dashboard-stat-icon dashboard-stat-icon--${color || "sky"}`}
              >

                <Icon size={18} />

              </div>

              <div className="dashboard-stat-body">

                <h2 className="dashboard-stat-value">
                  {value}
                </h2>

                <p className="dashboard-stat-label">
                  {label}
                </p>

              </div>

            </div>
          )
        )}

      </div>

      {/* TOP GRID */}

      <div className="dashboard-chart-grid">

        {/* REVENUE TREND */}

        <div className="dashboard-panel">

          <div className="dashboard-panel-header">

            <div>

              <h3>
                Revenue Trend
              </h3>

              <p>
                Monthly collections
              </p>

            </div>

            <div className="dashboard-panel-metric">
              {formatCurrency(totalRevenue)}
            </div>

          </div>

          <div className="dashboard-chart">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={revenueData}
                margin={{
                  top: 18,
                  right: 26,
                  left: 8,
                  bottom: 4,
                }}
              >

                <CartesianGrid
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#64748b",
                    fontSize: 12,
                  }}
                  dy={8}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#64748b",
                    fontSize: 12,
                  }}
                  tickFormatter={formatCurrencyShort}
                  width={54}
                  domain={[
                    0,
                    getPaddedMax,
                  ]}
                />

                <Tooltip
                  cursor={{
                    fill: "rgba(15, 118, 110, 0.08)",
                  }}
                  contentStyle={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    boxShadow:
                      "0 12px 30px rgba(15, 23, 42, 0.12)",
                  }}
                  formatter={(value) => [
                    formatCurrency(value),
                    "Revenue",
                  ]}
                />

                <Bar
                  dataKey="value"
                  fill="#0f766e"
                  barSize={58}
                  radius={[
                    10,
                    10,
                    0,
                    0,
                  ]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>

        {/* CLINIC STATUS */}

        <div className="dashboard-panel">

          <div className="dashboard-panel-header">

            <div>

              <h3>
                Clinic Status
              </h3>

              <p>
                Doctor availability
              </p>

            </div>

          </div>

          <div className="dashboard-status-chart">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <PieChart>

                <Pie
                  data={pieData}
                  innerRadius={64}
                  outerRadius={92}
                  paddingAngle={2}
                  dataKey="value"
                >

                  {pieData.map(
                    (
                      entry,
                      index
                    ) => (

                      <Cell
                        key={index}
                        fill={
                          entry.color
                        }
                      />
                    )
                  )}

                </Pie>

              </PieChart>

            </ResponsiveContainer>

          </div>

          {/* LEGEND */}

          <div className="dashboard-status-legend">

            <span>

              <b
                style={{
                  color:
                    "#0ea5a5",
                }}
              >
                ●
              </b>

              {" "}Available

            </span>

            <span>

              <b
                style={{
                  color:
                    "#3b82f6",
                }}
              >
                ●
              </b>

              {" "}Busy

            </span>

            <span>

              <b
                style={{
                  color:
                    "#f59e0b",
                }}
              >
                ●
              </b>

              {" "}On Leave

            </span>

          </div>

        </div>

      </div>

      {/* BOTTOM GRID */}

      <div className="dashboard-bottom-grid">

        {/* USER GROWTH */}

        <div className="dashboard-panel dashboard-panel--large">

          <div className="dashboard-panel-header">

            <div>

              <h3>
                User Growth
              </h3>

              <p>
                Patients and appointments by month
              </p>

            </div>

            <div className="dashboard-legend-inline">

              <span className="dashboard-legend-chip dashboard-legend-chip--teal">
                Patients
              </span>

              <span className="dashboard-legend-chip dashboard-legend-chip--blue">
                Appointments
              </span>

            </div>

          </div>

          <div className="dashboard-chart">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={growthData}
                margin={{
                  top: 18,
                  right: 28,
                  left: 0,
                  bottom: 4,
                }}
              >

                <CartesianGrid
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#64748b",
                    fontSize: 12,
                  }}
                  dy={8}
                />

                <YAxis
                  axisLine={false}
                  allowDecimals={false}
                  tickLine={false}
                  tick={{
                    fill: "#64748b",
                    fontSize: 12,
                  }}
                  width={36}
                  domain={[
                    0,
                    getPaddedMax,
                  ]}
                />

                <Tooltip
                  cursor={{
                    fill: "rgba(37, 99, 235, 0.06)",
                  }}
                  contentStyle={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    boxShadow:
                      "0 12px 30px rgba(15, 23, 42, 0.12)",
                  }}
                  formatter={(value, name) => [
                    formatNumber(value),
                    name,
                  ]}
                />

                <Bar
                  dataKey="patients"
                  name="Patients"
                  fill="#0f766e"
                  barSize={52}
                  radius={[
                    8,
                    8,
                    0,
                    0,
                  ]}
                />

                <Bar
                  dataKey="appointments"
                  name="Appointments"
                  fill="#2563eb"
                  barSize={52}
                  radius={[
                    8,
                    8,
                    0,
                    0,
                  ]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>

        {/* RECENT ACTIVITY */}

        <div
          id="recent-activity"
          className="dashboard-panel dashboard-panel--activity"
        >

          <div className="dashboard-panel-header">

            <div>

              <h3>
                Recent Activity
              </h3>

              <p>
                Latest events across the clinic
              </p>

            </div>

          </div>

          <div className="dashboard-activity-list">

            {dashboardData?.recentActivities
              ?.length > 0 ? (

              dashboardData.recentActivities.map(
                (
                  item,
                  index
                ) => (

                  <div
                    className="dashboard-activity-item"
                    key={index}
                  >

                    <div className="dashboard-activity-icon">

                      <CalendarCheck size={16} />

                    </div>

                    <div>

                      <p>
                        {item.title}
                      </p>

                      <span>
                        {item.time}
                      </span>

                    </div>

                  </div>
                )
              )
            ) : (

              <p>
                No recent activities
              </p>

            )}

          </div>

        </div>

      </div>

    </div>
  );
}

export default Dashboard;
