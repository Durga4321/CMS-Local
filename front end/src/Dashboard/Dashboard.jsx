
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
  CalendarCheck,
  DollarSign,
  UserPlus,
  UserRoundCheck,
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "../config/api";
import {
  formatCompactIndianCurrency,
  formatIndianCurrency,
} from "../utils/format";
import {
  canUsePermission,
  fetchAndStoreRolePermissions,
} from "../utils/authorization";
import { useToast } from "../components/ToastProvider";
import { getClinicDisplayName } from "../utils/clinicDisplay";

/* ================= API ================= */

const API = apiUrl("Dashboard");
const RECEPTIONIST_API = apiUrl("Receptionist");

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

const pickValue = (record = {}, keys = [], fallback = "") => {
  for (const key of keys) {
    const value =
      key
        .split(".")
        .reduce(
          (current, part) =>
            current && current[part] !== undefined
              ? current[part]
              : undefined,
          record
        );

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== "" &&
      String(value).trim().toLowerCase() !== "string"
    ) {
      return value;
    }
  }

  return fallback;
};

const getClinicStatusText = (clinic = {}, dashboardData = {}) => {
  const status =
    pickValue(
      clinic,
      ["status", "Status"],
      pickValue(dashboardData, ["clinicStatusText", "status"], "")
    );

  if (typeof status === "boolean") {
    return status ? "Active" : "Inactive";
  }

  const activeValue =
    pickValue(clinic, ["isActive", "active"], "");

  if (typeof activeValue === "boolean") {
    return activeValue ? "Active" : "Inactive";
  }

  const text = String(status || "Active").trim();
  return text.toLowerCase() === "inactive" ? "Inactive" : "Active";
};

/* ================= COMPONENT ================= */

function Dashboard() {
  const navigate =
    useNavigate();
  const location =
    useLocation();
  const toast = useToast();

  const [dashboardData,
    setDashboardData] =
    useState(null);

  const [loading,
    setLoading] =
    useState(true);
  const [permissionsLoading,
    setPermissionsLoading] =
    useState(true);
  const [permissionRecord,
    setPermissionRecord] =
    useState(null);
  const [clinicCardFlipped,
    setClinicCardFlipped] =
    useState(false);
  const canCreateDoctor =
    !permissionsLoading &&
    canUsePermission(
      permissionRecord,
      "create"
    );
  const openAddDoctor = () => {
    if (!canCreateDoctor) {
      toast.error(
        permissionsLoading
          ? "Loading permissions. Please try again."
          : "Create permission is disabled by Super Admin."
      );
      return;
    }

    navigate("/doctors/add");
  };

  /* ================= LOAD DASHBOARD ================= */

  useEffect(() => {

    fetchDashboard();

  }, []);

  useEffect(() => {
    let active = true;

    const loadPermissions = async () => {
      setPermissionsLoading(true);
      const record =
        await fetchAndStoreRolePermissions();

      if (active) {
        setPermissionRecord(record);
        setPermissionsLoading(false);
      }
    };

    loadPermissions();

    return () => {
      active = false;
    };
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

        let merged = { ...data };

        try {
          const clinicResp = await fetch(`${API}/ClincData`, {
            headers: {
              "ngrok-skip-browser-warning": "true",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });

          if (clinicResp.ok) {
            const clinicData = await clinicResp.json();
            merged = {
              ...merged,
              clinic: {
                ...(merged.clinic || {}),
                ...clinicData,
              },
              clinicName: merged.clinicName || clinicData?.clinicName || merged.clinic?.clinicName,
            };
          }
        } catch (e) {
          console.log("Failed to load clinic details:", e.message || e);
        }

        const receptionistCount =
          getDashboardMetricValue(
            [
              "totalReceptionists",
              "receptionistCount",
              "receptionists",
              "receptionistTotal",
              "receptionist_count",
            ],
            null
          );

        if (
          receptionistCount === null ||
          receptionistCount === 0
        ) {
          try {
            const receptionistResp = await fetch(RECEPTIONIST_API, {
              headers: {
                "ngrok-skip-browser-warning": "true",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            });

            if (receptionistResp.ok) {
              const receptionistData = await receptionistResp.json();
              const receptionists =
                Array.isArray(receptionistData)
                  ? receptionistData
                  : receptionistData?.data || receptionistData?.rows || [];
              merged = {
                ...merged,
                receptionistCount: receptionists.length,
              };
            }
          } catch (e) {
            console.log("Failed to load receptionist count:", e.message || e);
          }
        }

        setDashboardData(merged);

      } catch (error) {

        console.log(error);

      } finally {

        setLoading(false);

      }
    };
  /* ================= LOADING ================= */

  // Helper skeleton component (lightweight) used for placeholders while loading
  const Skeleton = ({ width = "100%", height = 16, style = {} }) => (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 6, ...style }}
    />
  );

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

  const clinicRecord =
    dashboardData?.clinic ||
    dashboardData?.clinicDetails ||
    dashboardData?.hospital ||
    dashboardData?.hospitalDetails ||
    {};

  const clinicInfo = {
    name:
      dashboardData?.clinic?.clinicName ||
      dashboardData?.clinicName ||
      getClinicDisplayName(
        {
          ...dashboardData,
          ...clinicRecord,
        },
        "Clinic"
      ),
    contactNumber:
      pickValue(
        dashboardData?.clinic || clinicRecord,
        [
          "contactNumber",
          "phoneNumber",
          "phone",
          "mobile",
          "contact",
        ],
        pickValue(
          dashboardData,
          [
            "clinicContactNumber",
            "contactNumber",
            "phoneNumber",
            "phone",
          ],
          "-"
        )
      ),
    email:
      pickValue(
        dashboardData?.clinic || clinicRecord,
        ["email", "clinicEmail", "hospitalEmail"],
        pickValue(
          dashboardData,
          ["clinicEmail", "email", "hospitalEmail"],
          "-"
        )
      ),
    status:
      getClinicStatusText(
        dashboardData?.clinic || clinicRecord,
        dashboardData
      ),
    address:
      pickValue(
        dashboardData?.clinic || clinicRecord,
        [
          "fullAddress",
          "address",
          "clinicAddress",
          "hospitalAddress",
        ],
        pickValue(
          dashboardData,
          [
            "clinicFullAddress",
            "fullAddress",
            "clinicAddress",
            "address",
          ],
          "-"
        )
      ),
  };

  const getDashboardMetricValue = (keys = [], fallback = 0) => {
    const value = pickValue(dashboardData, keys, fallback);
    if (Array.isArray(value)) {
      return value.length;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const summaryCards = [
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
        "blue",
      route:
        "/appointments",
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
        "purple",
      route:
        "/reports",
    },
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
        "teal",
      route:
        "/doctors",
    },
    {
      label:
        "Total Receptionists",
      value:
        formatNumber(
          getDashboardMetricValue(
            [
              "totalReceptionists",
              "receptionistCount",
              "receptionists",
              "receptionistTotal",
              "receptionist_count",
              "receptionistCount",
            ],
            0
          )
        ),
      icon:
        Users,
      color:
        "green",
      route:
        "/receptionists",
    },
    {
      label:
        "Total Patients",
      value:
        formatNumber(
          dashboardData?.totalPatients
        ),
      icon:
        UserRoundCheck,
      color:
        "orange",
      route:
        "/patients",
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
          disabled={!canCreateDoctor}
          title={
            canCreateDoctor
              ? "Add doctor"
              : permissionsLoading
                ? "Loading permissions"
                : "Permission disabled by Super Admin"
          }
        >
          <UserPlus size={16} />
          Add Doctor
        </button>

      </div>

      {/* STATS */}

      <div className="dashboard-stats">

        <div
          className={`dashboard-clinic-flip-card ${clinicCardFlipped ? "is-flipped" : ""}`}
          onClick={() => setClinicCardFlipped((prev) => !prev)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              setClinicCardFlipped((prev) => !prev);
            }
          }}
          aria-label="Flip clinic details card"
        >
          <div className="dashboard-clinic-flip-card-inner">
            <div className="dashboard-clinic-flip-front">
              <div className="dashboard-clinic-flip-header">Clinic Info</div>
              <div className="dashboard-clinic-flip-row">
                <span className="dashboard-clinic-flip-label">Clinic Name</span>
                <span className="dashboard-clinic-flip-value">{clinicInfo.name || "-"}</span>
                {loading && <Skeleton width="70%" height={20} style={{float: 'right'}} />}
              </div>
              <div className="dashboard-clinic-flip-row">
                <span className="dashboard-clinic-flip-label">Contact Number</span>
                <span className="dashboard-clinic-flip-value">{clinicInfo.contactNumber || "-"}</span>
                {loading && <Skeleton width="50%" height={18} style={{float: 'right'}} />}
              </div>
              <div className="dashboard-clinic-flip-row">
                <span className="dashboard-clinic-flip-label">Email</span>
                <span className="dashboard-clinic-flip-value">{clinicInfo.email || "-"}</span>
                {loading && <Skeleton width="60%" height={18} style={{float: 'right'}} />}
              </div>
              <div className="dashboard-clinic-flip-row">
                <span className="dashboard-clinic-flip-label">Status</span>
                <span className={`dashboard-clinic-flip-status ${clinicInfo.status?.toLowerCase() === "active" ? "active" : "inactive"}`}>
                  {loading ? <Skeleton width={76} height={18} /> : clinicInfo.status || "-"}
                </span>
              </div>
              <div className="dashboard-clinic-flip-footer">
                Tap or press Enter to view full address.
              </div>
            </div>
            <div className="dashboard-clinic-flip-back">
              <div className="dashboard-clinic-flip-header">Full Address</div>
              <div className="dashboard-clinic-flip-address">
                {loading ? <Skeleton width="100%" height={18} /> : clinicInfo.address || "-"}
              </div>
              <div className="dashboard-clinic-flip-footer">
                Tap or press Enter to flip back.
              </div>
            </div>
          </div>
        </div>

        {summaryCards.map(
          ({
            label,
            value,
            icon: Icon,
            color,
            route,
          }) => (

            <div
              className="dashboard-stat-card"
              key={label}
              role={route ? "button" : undefined}
              tabIndex={route ? 0 : undefined}
              onClick={() => route && navigate(route)}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && route) {
                  navigate(route);
                }
              }}
              aria-label={route ? `Go to ${label}` : label}
            >

              <div
                className={`dashboard-stat-icon dashboard-stat-icon--${color || "sky"}`}
              >

                <Icon size={18} />

              </div>

                <div className="dashboard-stat-body">

                <p className="dashboard-stat-label">
                  {label}
                </p>

                <h2 className="dashboard-stat-value">
                  {loading ? <Skeleton width={80} height={28} /> : value}
                </h2>

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

            {loading ? (
              <div style={{ height: 240 }}>
                <Skeleton width="100%" height={240} />
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={240}
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

          )}

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
            {loading ? (
              <Skeleton width="100%" height={180} />
            ) : (
              <ResponsiveContainer
                width="100%"
                height={180}
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
            )}

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
            {loading ? (
              <Skeleton width="100%" height={240} />
            ) : (

              <ResponsiveContainer
                width="100%"
                height={240}
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

            )}

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

            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div className="dashboard-activity-item" key={`s-${idx}`}>
                  <div className="dashboard-activity-icon">
                    <Skeleton width={36} height={36} />
                  </div>
                  <div>
                    <p><Skeleton width="60%" height={14} /></p>
                    <span><Skeleton width="30%" height={12} /></span>
                  </div>
                </div>
              ))
            ) : (
              (dashboardData?.recentActivities?.length > 0 ? (
                dashboardData.recentActivities.map((item, index) => (
                  <div className="dashboard-activity-item" key={index}>
                    <div className="dashboard-activity-icon"><CalendarCheck size={16} /></div>
                    <div>
                      <p>{item.title}</p>
                      <span>{item.time}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p>No recent activities</p>
              ))
            )}

          </div>

        </div>

      </div>

    </div>
  );
}

export default Dashboard;
