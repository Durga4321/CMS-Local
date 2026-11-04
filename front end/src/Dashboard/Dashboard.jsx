import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
} from "react";

import "./Dashboard.css";
import DashboardCards from "../components/superadmin/DashboardCards";

import {
  Bar,
  ComposedChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
  Pill,
  Sun,
  Moon,
  RefreshCw,
  ChevronDown,
  Stethoscope,
  Users,
  CalendarCheck,
  IndianRupee,
  FlaskConical,
  UserPlus,
  UserCog,
  UserRoundCheck,
  LayoutGrid,
  Phone,
  Mail,
  Info,
  ArrowRight,
  Droplet,
  Syringe,
  Calendar,
  TrendingUp,
  Building2,
  Pencil,
  Zap,
  BarChart3,
  FileText,
  CalendarPlus,
  Plus,
  Rocket,
  Bell,
  Send,
  FileSpreadsheet,
  TrendingDown,
  Activity,
  ChevronRight,
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "../config/api";
import { getStoredHospitalId } from "../utils/branchApi";
import {
  formatCompactIndianCurrency,
  formatIndianCurrency,
} from "../utils/format";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { getRoleProfile } from "../profile/sessionProfile";
import {
  fetchRevenueBillingRows,
  getRevenueAmount,
  getRevenueTotals,
  groupRevenueByMonth,
  parseList as parseRevenueList,
  passesRevenueFilters,
} from "../utils/billingRevenue";

/* ================= API ================= */

const API = apiUrl("Dashboard");
const REVENUE_API = apiUrl("Dashboard/revenue");
const REVENUE_REPORT_API = apiUrl("Dashboard/reports/revenue");
const APPOINTMENT_API = apiUrl("Appointment");
const RECEPTIONIST_API = apiUrl("Receptionist");
const STAFF_API = apiUrl("Staff");
const REQUEST_TIMEOUT_MS = 3500;

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

const toNumericAmount = (value) => {
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const fetchWithTimeout = (url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeoutId));
};

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

const parseList = (data) => {
  if (data?.data && !Array.isArray(data.data)) return parseList(data.data);
  for (const key of ["rows", "results", "records", "doctors", "patients", "pharmacists", "users"]) { if (Array.isArray(data?.[key])) return data[key]; }
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.appointments)) return data.appointments;
  if (Array.isArray(data?.nurses)) return data.nurses;
  if (Array.isArray(data?.Nurses)) return data.Nurses;
  if (Array.isArray(data?.staff)) return data.staff;
  if (Array.isArray(data?.Staff)) return data.Staff;
  return [];
};

const parseRevenueDashboard = (data = {}) => {
  const source = data?.data && !Array.isArray(data.data) ? data.data : data || {};
  const rows = parseRevenueList(source).length
    ? parseRevenueList(source)
    : parseRevenueList(source.revenueTrend || source.monthlyRevenue || source.monthly || source.chartData || source.items);
  const totalRevenue =
    toNumericAmount(
      pickValue(
        source,
        [
          "totalRevenue",
          "revenue",
          "revenueSummary",
          "total",
          "amount",
          "grandTotal",
          "netRevenue",
        ],
        0
      )
    ) || rows.reduce((sum, row) => sum + getRevenueAmount(row), 0);

  const revenueTrend = rows.map((row, index) => ({
    ...row,
    month: pickValue(row, ["month", "Month", "name", "label", "period"], `Item ${index + 1}`),
    revenue: toNumericAmount(pickValue(row, ["revenue", "Revenue", "totalRevenue", "TotalRevenue", "Total Revenue", "total revenue", "amount", "Amount", "total", "Total"], 0)) || getRevenueAmount(row),
  }));

  return { totalRevenue, revenueTrend };
};

const parseRevenueReportRows = (data = {}) =>
  parseRevenueList(data).map((row, index) => ({
    ...row,
    month: pickValue(row, ["month", "Month", "name", "Name", "date", "Date"], `Item ${index + 1}`),
    revenue: toNumericAmount(pickValue(row, ["revenue", "Revenue", "totalRevenue", "TotalRevenue", "Total Revenue", "total revenue", "amount", "Amount", "total", "Total"], 0)) || getRevenueAmount(row),
  }));

const isNurseRecord = (record = {}) => {
  const role = String(
    pickValue(record, ["role", "Role", "staffRole", "StaffRole", "userRole", "UserRole"], "")
  ).trim().toLowerCase();

  if (role) return role === "nurse" || role.includes("nurse");

  return Boolean(
    pickValue(record, ["nurseId", "NurseId"], "")
  );
};

const isLabTechnicianRecord = (record = {}) => {
  const role = String(
    pickValue(record, ["role", "Role", "staffRole", "StaffRole", "userRole", "UserRole"], "")
  ).trim().toLowerCase();

  if (role) return role === "labtechnician" || role === "labtech" || role === "lab" || role.includes("lab technician");

  return Boolean(
    pickValue(record, ["labTechnicianId", "LabTechnicianId", "labId", "LabId"], "")
  );
};

const formatToday = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

const getAppointmentDateValue = (appointment = {}) =>
  pickValue(
    appointment,
    [
      "date",
      "Date",
      "appointmentDate",
      "AppointmentDate",
      "scheduledDate",
      "ScheduledDate",
      "slotDate",
      "SlotDate",
      "bookingDate",
      "BookingDate",
    ],
    ""
  );

const getLocalDateKey = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const isoDateTimeMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (isoDateTimeMatch) {
    const [, year, month, day, hour, minute, second = "00"] = isoDateTimeMatch;
    if (hour === "00" && minute === "00" && second === "00") return `${year}-${month}-${day}`;

    const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
    const date = new Date(hasTimezone ? raw : `${raw}Z`);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
  }

  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) return `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`;

  return raw;
};

const toDateOnly = (value) => {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const key = getLocalDateKey(value);
  if (!key) return null;

  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const isValidDate = (date) =>
  date instanceof Date && !Number.isNaN(date.getTime());

const isSameDay = (date, comparisonDate) =>
  isValidDate(date) &&
  isValidDate(comparisonDate) &&
  date.getFullYear() === comparisonDate.getFullYear() &&
  date.getMonth() === comparisonDate.getMonth() &&
  date.getDate() === comparisonDate.getDate();

const isThisWeek = (date, comparisonDate) => {
  if (!isValidDate(date) || !isValidDate(comparisonDate)) return false;

  const weekStart = new Date(comparisonDate);
  weekStart.setDate(comparisonDate.getDate() - comparisonDate.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return date >= weekStart && date < weekEnd;
};

const isSameMonth = (date, comparisonDate) =>
  isValidDate(date) &&
  isValidDate(comparisonDate) &&
  date.getFullYear() === comparisonDate.getFullYear() &&
  date.getMonth() === comparisonDate.getMonth();

const isSameYear = (date, comparisonDate) =>
  isValidDate(date) &&
  isValidDate(comparisonDate) &&
  date.getFullYear() === comparisonDate.getFullYear();

const isSameQuarter = (date, comparisonDate) =>
  isSameYear(date, comparisonDate) &&
  Math.floor(date.getMonth() / 3) === Math.floor(comparisonDate.getMonth() / 3);

const countTodayAppointments = (data) => {
  const todayKey = formatToday();
  return parseList(data).filter((appointment) => getLocalDateKey(getAppointmentDateValue(appointment)) === todayKey).length;
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
  const navigate = useNavigate();
  const location = useLocation();
  const adminProfile = getRoleProfile("admin");
  const adminName = adminProfile?.name || "Admin";
  const storedHospitalId = getStoredHospitalId();
  const storedClinicId = localStorage.getItem("hospitalId") || localStorage.getItem("clinicId") || "";
  const storedClinicName = localStorage.getItem("hospitalName") || localStorage.getItem("clinicName") || "";
  const hasClinic = Boolean(storedClinicId && storedClinicName);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef(null);
  const [clock, setClock] = useState(() => new Date());
  const [moduleCounts, setModuleCounts] = useState({});
  const [dashboardError, setDashboardError] = useState("");
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 30000); return () => window.clearInterval(timer); }, []);
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const fit = () => page.style.setProperty("--admin-dashboard-height", Math.max(200, window.innerHeight - page.getBoundingClientRect().top - 12) + "px");
    fit(); const observer = new ResizeObserver(fit);
    if (page.parentElement) observer.observe(page.parentElement);
    window.addEventListener("resize", fit);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  });
  const [timeFilter, setTimeFilter] = useState("month");

  const openAddDoctor = () => {
    navigate("/doctors/add");
  };

  const getDashboardMetricValue = (keys = [], fallback = 0) => {
    const value = pickValue(dashboardData, keys, fallback);
    if (Array.isArray(value)) {
      return value.length;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setDashboardError("");
    const token = getAdminToken();
    const headers = { "ngrok-skip-browser-warning": "true", ...(token ? { Authorization: "Bearer " + token } : {}) };
    const scopedUrl = (path) => {
      const url = apiUrl(path);
      return storedHospitalId ? url + (url.includes("?") ? "&" : "?") + "hospitalId=" + encodeURIComponent(storedHospitalId) : url;
    };
    const read = async (path) => {
      const response = await fetchWithTimeout(scopedUrl(path), { headers, cache: "no-store" }, 10000);
      if (!response.ok) throw new Error(path + " (HTTP " + response.status + ")");
      return response.json();
    };
    const scopedRows = (payload) => parseList(payload).filter(row => {
      const clinicId = row.hospitalId ?? row.HospitalId ?? row.clinicId ?? row.ClinicId;
      return !clinicId || !storedHospitalId || String(clinicId) === String(storedHospitalId);
    });
    const modules = [
      ["Doctors", "Doctor"], ["Patients", "Patient"], ["Nurses", "Staff?role=Nurse"],
      ["Receptionists", "Receptionist"], ["Lab Technicians", "Staff/lab-technicians"], ["Pharmacists", "pharmacists"],
    ];
    const results = await Promise.allSettled([
      read("Dashboard"), ...modules.map(([,path]) => read(path)),
      read("Appointment"), read("Dashboard/ClincData"), read("Dashboard/revenue"),
    ]);
    let next = results[0].status === "fulfilled" ? (results[0].value?.data ?? results[0].value) : {};
    const counts = {};
    const failed = [];
    modules.forEach(([label], index) => {
      const result = results[index + 1];
      if (result.status !== "fulfilled") { counts[label] = null; failed.push(label); return; }
      let rows = scopedRows(result.value);
      if (label === "Nurses") rows = rows.filter(isNurseRecord);
      counts[label] = rows.length;
    });
    const appointments = results[7];
    if (appointments.status === "fulfilled") {
      const rows = scopedRows(appointments.value);
      next = { ...next, recentAppointmentsList: rows, todayAppointments: countTodayAppointments(rows) };
    }
    if (results[8].status === "fulfilled") next.clinic = { ...(next.clinic || {}), ...(results[8].value?.data ?? results[8].value) };
    if (results[9].status === "fulfilled") next = { ...next, ...parseRevenueDashboard(results[9].value) };
    setModuleCounts(counts);
    setDashboardData(next);
    if (failed.length) setDashboardError("Unable to load: " + failed.join(", ") + ". Use Refresh to retry.");
    setLoading(false);
  }, [storedHospitalId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  /* ================= CHART & RECORD COMPUTATION ================= */

  const totalRevenue = dashboardData?.totalRevenue || 0;

  const chartPoints = dashboardData?.growthChart?.length
    ? dashboardData.growthChart.map((item) => ({
        name: item.month,
        value: item.appointments || item.patients || 0,
      }))
    : [
        { name: "Aug 28", value: 4 },
        { name: "Aug 29", value: 7 },
        { name: "Aug 30", value: 5 },
        { name: "Aug 31", value: 9 },
        { name: "Sep 01", value: 8 },
        { name: "Sep 02", value: 12 },
        { name: "Sep 03", value: 9 },
        { name: "Sep 04", value: 11 },
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
        ["contactNumber", "phoneNumber", "phone", "mobile", "contact"],
        pickValue(dashboardData, ["clinicContactNumber", "contactNumber", "phone"], "-")
      ),
    email:
      pickValue(
        dashboardData?.clinic || clinicRecord,
        ["email", "clinicEmail", "hospitalEmail"],
        pickValue(dashboardData, ["clinicEmail", "email"], "-")
      ),
    status: getClinicStatusText(dashboardData?.clinic || clinicRecord, dashboardData),
    address:
      pickValue(
        dashboardData?.clinic || clinicRecord,
        ["fullAddress", "address", "clinicAddress", "hospitalAddress"],
        pickValue(dashboardData, ["clinicFullAddress", "fullAddress", "address"], "-")
      ),
  };

  const receptionistCount = getDashboardMetricValue(
    [
      "totalReceptionists",
      "receptionistCount",
      "receptionists",
      "receptionistTotal",
      "receptionist_count",
    ],
    0
  );

  const nurseCount = getDashboardMetricValue(
    [
      "totalNurses",
      "nurseCount",
      "nurses",
      "nurseTotal",
      "nurse_count",
    ],
    0
  );

  const labTechnicianCount = getDashboardMetricValue(
    [
      "totalLabTechnicians",
      "labTechnicianCount",
      "labTechnicians",
      "labtechnicians",
      "labTechCount",
      "labTechs",
      "lab_count",
    ],
    0
  );

  const appointmentRows = Array.isArray(dashboardData?.recentAppointmentsList)
    ? dashboardData.recentAppointmentsList
    : [];

  const appointmentDates = appointmentRows
    .map((appointment) => toDateOnly(getAppointmentDateValue(appointment)))
    .filter(Boolean);
  const today = toDateOnly(new Date());
  const todayAppointmentCount = dashboardData?.todayAppointments ?? appointmentDates.filter((date) => isSameDay(date, today)).length;
  const weekAppointmentCount = appointmentDates.filter((date) => isThisWeek(date, today)).length;
  const monthAppointmentCount = appointmentDates.filter((date) => isSameMonth(date, today)).length;
  const selectedPeriodAppointmentCount =
    timeFilter === "year"
      ? appointmentDates.filter((date) => isSameYear(date, today)).length
      : timeFilter === "quarter"
        ? appointmentDates.filter((date) => isSameQuarter(date, today)).length
        : monthAppointmentCount;
  const totalPatients = dashboardData?.totalPatients ?? 0;
  const consultationCount = selectedPeriodAppointmentCount;
  const growthValue = chartPoints.length
    ? chartPoints.reduce((sum, point) => sum + toNumericAmount(point.value), 0)
    : selectedPeriodAppointmentCount;

  const displayRecentAppointments = appointmentRows.length
    ? appointmentRows.slice(0, 4).map((apt) => ({
        name: apt.patientName || apt.patient?.name || apt.name || "Unknown Patient",
        subtitle: apt.chiefComplaints || apt.complaint || apt.reason || "General Checkup",
        time: apt.time || apt.slotTime || apt.appointmentTime || "--",
        date: getAppointmentDateValue(apt) || "--",
        status: apt.status || apt.appointmentStatus || "Scheduled",
      }))
    : [];

  const Skeleton = ({ width = "100%", height = 16, style = {} }) => (
    <div className="skeleton" style={{ width, height, borderRadius: 6, ...style }} />
  );

  if (!hasClinic) {
    return (
      <div className="db-dashboard db-no-clinic-dashboard">
        <div className="db-3d-bg-overlay" />
        <section className="db-no-clinic-card">
          <div className="db-no-clinic-icon">
            <Building2 size={30} />
          </div>
          <div>
            <h1 className="db-title">Clinic Setup Required</h1>
            <p className="db-subtitle">
              Welcome back, {adminName}. Create your clinic first, then dashboard counts and clinic modules will load from that clinic.
            </p>
          </div>
          <button type="button" className="db-no-clinic-button" onClick={() => navigate("/clinic/setup")}>
            <Plus size={18} />
            Create Clinic
          </button>
        </section>
      </div>
    );
  }

  const hour = clock.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const GreetingIcon = hour >= 17 ? Moon : Sun;
  const cards = [
    { label: "Doctors", value: getDashboardMetricValue(["totalDoctors", "doctorCount"]), icon: Stethoscope, path: "/doctors" },
    { label: "Patients", value: totalPatients, icon: Users, path: "/patients" },
    { label: "Nurses", value: nurseCount, icon: UserCog, path: "/nurses" },
    { label: "Receptionists", value: receptionistCount, icon: UserRoundCheck, path: "/receptionists" },
    { label: "Lab Technicians", value: labTechnicianCount, icon: FlaskConical, path: "/lab-technicians" },
    { label: "Pharmacists", value: 0, icon: Pill, path: "/pharmacists" },
  ].map(card => ({ ...card, value: loading ? "..." : moduleCounts[card.label] == null ? "Unavailable" : formatNumber(moduleCounts[card.label]), tone: "teal", onClick: () => navigate(card.path) }));
  return (
    <div className="db-dashboard db-admin-overview" ref={pageRef}>
      <header className="admin-overview-heading"><span className="admin-greeting-icon"><GreetingIcon size={27}/></span><div><h1>{greeting}, {adminName}!</h1><p>Here's what's happening at your clinic today.</p></div><button type="button" className="admin-refresh" onClick={fetchDashboard} disabled={loading}><RefreshCw size={16}/><span>Refresh</span></button></header>
      <div className="admin-metrics-section"><DashboardCards cards={cards}/>{dashboardError && <p className="admin-count-error" role="status">{dashboardError}</p>}</div>
      <div className="admin-overview-columns">
        <section className="admin-detail-section"><div className="admin-section-heading"><h2>Clinic Information</h2><Building2 size={19}/></div>
          <dl className="admin-clinic-details">{[["Clinic Name",clinicInfo.name],["Contact Number",clinicInfo.contactNumber],["Email",clinicInfo.email],["Address",clinicInfo.address]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{loading ? "Loading..." : value}</dd></div>)}</dl>
          <div className="admin-section-footer"><span>Clinic Status</span><strong className="admin-status-tag">{clinicInfo.status}</strong></div>
        </section>
        <section className="admin-detail-section" id="recent-activity"><div className="admin-section-heading"><h2>Recent Appointments</h2><button type="button" onClick={() => navigate("/appointments")}>View All <ArrowRight size={13}/></button></div>
          <div className="admin-appointment-list">{loading ? <p className="admin-empty">Loading appointments...</p> : displayRecentAppointments.length ? displayRecentAppointments.map((apt,index) => <article className="admin-appointment" key={index}><span className="admin-appointment-icon"><UserPlus size={18}/></span><div><strong>{apt.name}</strong><p>{apt.subtitle}</p><small>{apt.date}{" | "}{apt.time}</small></div><span className="admin-status-tag">{apt.status}</span></article>) : <p className="admin-empty">No recent appointments.</p>}</div>
          <div className="admin-section-footer admin-appointment-totals">{[["Today",todayAppointmentCount],["This Week",weekAppointmentCount],["This Month",monthAppointmentCount]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{formatNumber(value)}</strong></div>)}</div>
        </section>
        <section className="admin-detail-section admin-clinic-statistics"><div className="admin-section-heading"><h2>Clinic Status</h2><select aria-label="Statistics period" value={timeFilter} onChange={e => setTimeFilter(e.target.value)}><option value="month">This Month</option><option value="quarter">This Quarter</option><option value="year">This Year</option></select></div>
          <div className="admin-chart-summary"><span>Appointments</span><strong>{formatNumber(selectedPeriodAppointmentCount)}</strong></div>
          <div className="admin-overview-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={dashboardData?.growthChart?.length ? chartPoints : []} margin={{top:12,right:8,left:-25,bottom:0}}><CartesianGrid stroke="#dce8e9" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{fontSize:10}} tickLine={false} axisLine={false}/><YAxis tick={{fontSize:10}} tickLine={false} axisLine={false}/><Tooltip/><Area type="monotone" dataKey="value" name="Appointments" stroke="var(--theme-primary-dark)" fill="var(--theme-primary-soft)" strokeWidth={2}/></ComposedChart></ResponsiveContainer></div>
          <div className="admin-section-footer admin-stat-totals"><div><span>Patients</span><strong>{formatNumber(totalPatients)}</strong></div><div><span>Revenue</span><strong>{formatCurrency(totalRevenue)}</strong></div></div>
        </section>
      </div>
    </div>
  );
}
export default Dashboard;
