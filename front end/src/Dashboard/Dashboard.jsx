import React, {
  useEffect,
  useState,
  useCallback,
} from "react";

import "./Dashboard.css";
import icon3dCalendar from "../assets/3d_calendar_icon.jpg";
import icon3dMoney from "../assets/3d_money_icon.jpg";
import icon3dStethoscope from "../assets/3d_medical_stethoscope.jpg";
import icon3dHeartNurse from "../assets/3d_heart_nurse_icon.jpg";
import icon3dPatientAvatar from "../assets/3d_patient_avatar_icon.jpg";
import icon3dFlask from "../assets/3d_medical_flask.jpg";
import icon3dShield from "../assets/3d_medical_shield.jpg";
import hospitalDomeImg from "../assets/hospital_dome_building.png";

import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
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
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clinicCardFlipped, setClinicCardFlipped] = useState(false);
  const [timeFilter, setTimeFilter] = useState("month");

  const openAddDoctor = () => {
    navigate("/doctors/add");
  };

  useEffect(() => {
    if (loading || location.hash !== "#recent-activity") {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      document.getElementById("recent-activity")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [loading, location.hash]);

  const getDashboardMetricValue = (keys = [], fallback = 0) => {
    const value = pickValue(dashboardData, keys, fallback);
    if (Array.isArray(value)) {
      return value.length;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const fetchDashboard = useCallback(async () => {
    try {
      const token = getAdminToken();
      const headers = {
        "ngrok-skip-browser-warning": "true",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const storedHospitalId = getStoredHospitalId();
      const urlParams = new URLSearchParams();
      if (storedHospitalId) {
        urlParams.set("hospitalId", String(storedHospitalId));
        urlParams.set("clinicId", String(storedHospitalId));
      }
      const dashboardUrl = urlParams.toString() ? `${API}?${urlParams.toString()}` : API;

      const response = await fetchWithTimeout(dashboardUrl, { headers });

      if (!response.ok) {
        throw new Error("Unable to load dashboard");
      }

      const data = await response.json();
      let merged = { ...data };
      setDashboardData(merged);
      setLoading(false);

      const receptionistCount = pickValue(
        merged,
        [
          "totalReceptionists",
          "receptionistCount",
          "receptionists",
          "receptionistTotal",
          "receptionist_count",
        ],
        null
      );
      const nurseCount = pickValue(
        merged,
        [
          "totalNurses",
          "nurseCount",
          "nurses",
          "nurseTotal",
          "nurse_count",
        ],
        null
      );
      const labTechnicianCount = pickValue(
        merged,
        [
          "totalLabTechnicians",
          "labTechnicianCount",
          "labTechnicians",
          "labtechnicians",
          "labTechCount",
          "labTechs",
          "lab_count",
        ],
        null
      );

      Promise.allSettled([
        fetchWithTimeout(`${API}/ClincData`, { headers }, 2500),
        fetchWithTimeout(APPOINTMENT_API, { headers }, 2500),
        fetchWithTimeout(REVENUE_API, { headers }, 2500),
        receptionistCount === null || receptionistCount === 0
          ? fetchWithTimeout(RECEPTIONIST_API, { headers }, 2500)
          : Promise.resolve(null),
        nurseCount === null || nurseCount === 0
          ? fetchWithTimeout(
              storedHospitalId
                ? `${STAFF_API}?role=Nurse&hospitalId=${encodeURIComponent(storedHospitalId)}`
                : `${STAFF_API}?role=Nurse`,
              { headers },
              2500
            )
          : Promise.resolve(null),
        labTechnicianCount === null || labTechnicianCount === 0
          ? fetchWithTimeout(
              storedHospitalId
                ? `${STAFF_API}?role=LabTechnician&hospitalId=${encodeURIComponent(storedHospitalId)}`
                : `${STAFF_API}?role=LabTechnician`,
              { headers },
              2500
            )
          : Promise.resolve(null),
      ]).then(async ([clinicResult, appointmentResult, revenueResult, receptionistResult, nurseResult, labTechnicianResult]) => {
        let nextMerged = { ...data };
        let hasDashboardRevenue = false;

        if (clinicResult.status === "fulfilled" && clinicResult.value?.ok) {
          const clinicData = await clinicResult.value.json().catch(() => ({}));
          nextMerged = {
            ...nextMerged,
            clinic: {
              ...(nextMerged.clinic || {}),
              ...clinicData,
            },
            clinicName: nextMerged.clinicName || clinicData?.clinicName || nextMerged.clinic?.clinicName,
          };
        }

        if (appointmentResult.status === "fulfilled" && appointmentResult.value?.ok) {
          const appointmentData = await appointmentResult.value.json().catch(() => []);
          nextMerged = {
            ...nextMerged,
            todayAppointments: countTodayAppointments(appointmentData),
            recentAppointmentsList: parseList(appointmentData).slice(0, 4),
          };
        }

        if (revenueResult.status === "fulfilled" && revenueResult.value?.ok) {
          const revenueData = await revenueResult.value.json().catch(() => ({}));
          const parsedRevenue = parseRevenueDashboard(revenueData);
          hasDashboardRevenue = parsedRevenue.totalRevenue > 0 || parsedRevenue.revenueTrend.length > 0;
          nextMerged = {
            ...nextMerged,
            totalRevenue: parsedRevenue.totalRevenue || nextMerged.totalRevenue || 0,
            revenueTrend: parsedRevenue.revenueTrend.length
              ? parsedRevenue.revenueTrend
              : nextMerged.revenueTrend,
          };
        }

        const storedHospitalId = getStoredHospitalId();
        const revenueReportParams = new URLSearchParams();
        if (storedHospitalId) {
          revenueReportParams.set("hospitalId", String(storedHospitalId));
          revenueReportParams.set("clinicId", String(storedHospitalId));
        }
        const revenueReportUrl = revenueReportParams.toString()
          ? `${REVENUE_REPORT_API}?${revenueReportParams.toString()}`
          : REVENUE_REPORT_API;
        const revenueReportResponse = await fetchWithTimeout(revenueReportUrl, { headers }, 2500).catch(() => null);
        const revenueReportData = revenueReportResponse?.ok ? await revenueReportResponse.json().catch(() => []) : [];
        const revenueReportRows = parseRevenueReportRows(revenueReportData);
        const billingRows = await fetchRevenueBillingRows({ apiUrl, headers });
        const scopedBillingRows = billingRows.filter((row) =>
          passesRevenueFilters(row, { clinicId: storedHospitalId || "" })
        );
        const billingTotals = getRevenueTotals(scopedBillingRows);
        const dashboardRevenueMissing = !hasDashboardRevenue && toNumericAmount(nextMerged.totalRevenue) <= 0;
        if (dashboardRevenueMissing && revenueReportRows.length) {
          const reportTotals = getRevenueTotals(revenueReportRows);
          const reportTrend = groupRevenueByMonth(revenueReportRows);
          const useBillingTotals = scopedBillingRows.length && billingTotals.revenue > reportTotals.revenue;
          nextMerged = {
            ...nextMerged,
            totalRevenue: useBillingTotals ? billingTotals.revenue : reportTotals.revenue,
            opRevenue: useBillingTotals ? billingTotals.opRevenue : reportTotals.opRevenue,
            diagnosticRevenue: useBillingTotals ? billingTotals.diagnosticRevenue : reportTotals.diagnosticRevenue,
            pharmacyRevenue: useBillingTotals ? billingTotals.pharmacyRevenue : reportTotals.pharmacyRevenue,
            revenueTrend: (useBillingTotals ? groupRevenueByMonth(scopedBillingRows) : reportTrend).map((row) => ({
              ...row,
              name: row.month,
            })),
          };
        } else if (dashboardRevenueMissing) {
          if (scopedBillingRows.length) {
            nextMerged = {
              ...nextMerged,
              totalRevenue: billingTotals.revenue,
              opRevenue: billingTotals.opRevenue,
              diagnosticRevenue: billingTotals.diagnosticRevenue,
              pharmacyRevenue: billingTotals.pharmacyRevenue,
              revenueTrend: groupRevenueByMonth(scopedBillingRows).map((row) => ({
                ...row,
                name: row.month,
              })),
            };
          }
        }

        if (receptionistResult.status === "fulfilled" && receptionistResult.value?.ok) {
          const receptionistData = await receptionistResult.value.json().catch(() => []);
          const receptionists =
            Array.isArray(receptionistData)
              ? receptionistData
              : receptionistData?.data || receptionistData?.rows || [];
          nextMerged = {
            ...nextMerged,
            receptionistCount: receptionists.length,
          };
        }

        if (nurseResult.status === "fulfilled" && nurseResult.value?.ok) {
          const nurseData = await nurseResult.value.json().catch(() => []);
          const nurseRows = parseList(nurseData);
          const nurses = nurseRows.filter(isNurseRecord);
          nextMerged = {
            ...nextMerged,
            nurseCount: nurses.length || nurseRows.length,
          };
        }

        if (labTechnicianResult.status === "fulfilled" && labTechnicianResult.value?.ok) {
          const labTechnicianData = await labTechnicianResult.value.json().catch(() => []);
          const labTechnicianRows = parseList(labTechnicianData);
          const labTechnicians = labTechnicianRows.filter(isLabTechnicianRecord);
          nextMerged = {
            ...nextMerged,
            labTechnicianCount: labTechnicians.length || labTechnicianRows.length,
          };
        }

        setDashboardData(nextMerged);
      });

    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }, []);

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
        "Hp Clinic"
      ),
    contactNumber:
      pickValue(
        dashboardData?.clinic || clinicRecord,
        ["contactNumber", "phoneNumber", "phone", "mobile", "contact"],
        pickValue(dashboardData, ["clinicContactNumber", "contactNumber", "phone"], "7869054321")
      ),
    email:
      pickValue(
        dashboardData?.clinic || clinicRecord,
        ["email", "clinicEmail", "hospitalEmail"],
        pickValue(dashboardData, ["clinicEmail", "email"], "hpclinic@gmail.com")
      ),
    status: getClinicStatusText(dashboardData?.clinic || clinicRecord, dashboardData),
    address:
      pickValue(
        dashboardData?.clinic || clinicRecord,
        ["fullAddress", "address", "clinicAddress", "hospitalAddress"],
        pickValue(dashboardData, ["clinicFullAddress", "fullAddress", "address"], "Hyderabad, Telangana")
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
    1
  );

  const nurseCount = getDashboardMetricValue(
    [
      "totalNurses",
      "nurseCount",
      "nurses",
      "nurseTotal",
      "nurse_count",
    ],
    1
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
    1
  );

  const displayRecentAppointments = dashboardData?.recentAppointmentsList?.length
    ? dashboardData.recentAppointmentsList.map((apt) => ({
        name: apt.patientName || apt.patient?.name || "Ramesh Kumar",
        subtitle: apt.chiefComplaints || apt.complaint || "General Checkup",
        time: apt.time || apt.slotTime || "09:30 AM",
        date: apt.date || "04 Sep, 2026",
        status: apt.status || "Confirmed",
      }))
    : [
        {
          name: "Ramesh Kumar",
          subtitle: "General Checkup",
          time: "09:30 AM",
          date: "04 Sep, 2026",
          status: "Confirmed",
        },
      ];

  const Skeleton = ({ width = "100%", height = 16, style = {} }) => (
    <div className="skeleton" style={{ width, height, borderRadius: 6, ...style }} />
  );

  return (
    <div className="db-dashboard">
      {/* 3D Hospital Theme Animated Background Overlays */}
      <div className="db-3d-bg-overlay" />
      <div className="db-3d-floating-particle p1" />
      <div className="db-3d-floating-particle p2" />
      <div className="db-3d-floating-particle p3" />
      <div className="db-3d-ecg-wave">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="db-ecg-svg">
          <path
            d="M0 60 L300 60 L310 40 L320 80 L330 20 L345 100 L355 60 L370 60 L400 60 L700 60 L710 35 L720 85 L730 15 L745 105 L755 60 L770 60 L1200 60"
            fill="none"
            stroke="rgba(99, 102, 241, 0.25)"
            strokeWidth="2.5"
            strokeDasharray="1200"
            strokeDashoffset="1200"
            className="ecg-path"
          />
        </svg>
      </div>

      {/* PAGE HEADER */}
      <div className="db-header">
        <div>
          <h1 className="db-title">Dashboard 👋</h1>
          <p className="db-subtitle">Welcome back, Ravi! Here's what's happening at the clinic today.</p>
        </div>
        <button
          type="button"
          className="db-add-doctor-btn"
          onClick={openAddDoctor}
          title="Add Doctor"
        >
          <Plus size={16} />
          <span>Add Doctor</span>
        </button>
      </div>

      {/* TOP SECTION: CLINIC INFO (LEFT) + 6 KPI CARDS (RIGHT 2x3 GRID) */}
      <div className="db-top-main-grid">
        {/* LEFT: CLINIC INFORMATION CARD */}
        <div
          className={`db-clinic-card ${clinicCardFlipped ? "is-flipped" : ""}`}
          onClick={() => setClinicCardFlipped((prev) => !prev)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setClinicCardFlipped((prev) => !prev);
          }}
          aria-label="Flip clinic details card"
        >
          <div className="db-clinic-card-inner">
            {/* FRONT FACE */}
            <div className="db-clinic-front">
              <div className="db-clinic-badge-header">
                <div className="db-clinic-header-left">
                  <div className="db-clinic-badge-icon">
                    <Info size={16} />
                  </div>
                  <span>CLINIC INFORMATION</span>
                </div>
              </div>

              <div className="db-clinic-body">
                <div className="db-clinic-left-info">
                  <div className="db-info-row">
                    <div className="db-info-label">
                      <Building2 size={15} />
                      <span>Clinic Name</span>
                    </div>
                    <div className="db-info-val">
                      {loading ? <Skeleton width={110} height={18} /> : clinicInfo.name}
                    </div>
                  </div>

                  <div className="db-info-row">
                    <div className="db-info-label">
                      <Phone size={15} />
                      <span>Contact Number</span>
                    </div>
                    <div className="db-info-val">
                      {loading ? <Skeleton width={100} height={18} /> : clinicInfo.contactNumber}
                    </div>
                  </div>

                  <div className="db-info-row">
                    <div className="db-info-label">
                      <Mail size={15} />
                      <span>Email</span>
                    </div>
                    <div className="db-info-val db-info-email">
                      {loading ? <Skeleton width={140} height={18} /> : clinicInfo.email}
                    </div>
                  </div>

                  <div className="db-info-row">
                    <div className="db-info-label">
                      <Plus size={15} />
                      <span>Status</span>
                    </div>
                    <div className="db-info-val">
                      <span className={`db-status-pill ${clinicInfo.status.toLowerCase()}`}>
                        {loading ? <Skeleton width={60} height={18} /> : clinicInfo.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="db-clinic-footer">
                <Info size={13} />
                <span>Tap or press Enter to view full address.</span>
              </div>
            </div>

            {/* BACK FACE (FULL ADDRESS) */}
            <div className="db-clinic-back">
              <div className="db-clinic-badge-header">
                <div className="db-clinic-header-left">
                  <div className="db-clinic-badge-icon">
                    <Info size={16} />
                  </div>
                  <span>FULL ADDRESS</span>
                </div>
              </div>
              <div className="db-clinic-address-text">
                {loading ? <Skeleton width="100%" height={24} /> : clinicInfo.address}
              </div>
              <div className="db-clinic-footer">
                Tap or press Enter to flip back.
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: 6 KPI CARDS (2 ROWS x 3 COLS GRID) WITH SPARKLINE GRAPHS */}
        <div className="db-6-kpi-grid">
          {/* 1. TODAY'S APPOINTMENTS */}
          <div
            className="db-kpi-card card-purple-theme"
            onClick={() => navigate("/appointments")}
            role="button"
            tabIndex={0}
          >
            <div className="db-kpi-content-wrap">
              <div className="db-kpi-header">
                <div className="db-kpi-icon-box box-purple">
                  <CalendarCheck size={18} />
                </div>
                <span className="db-kpi-title">Today's Appointments</span>
              </div>
              <div className="db-kpi-num">
                {loading ? <Skeleton width={50} height={32} /> : formatNumber(dashboardData?.todayAppointments ?? 1)}
              </div>
              <div className="db-kpi-trend trend-down">
                <span>↓ -25% vs yesterday</span>
              </div>
              <svg className="db-sparkline" viewBox="0 0 160 30" preserveAspectRatio="none">
                <path d="M0 15 Q 25 28, 50 12 T 100 24 T 160 8" fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="0" cy="15" r="3" fill="#a855f7" />
                <circle cx="25" cy="24" r="3" fill="#a855f7" />
                <circle cx="50" cy="12" r="3" fill="#a855f7" />
                <circle cx="75" cy="20" r="3" fill="#a855f7" />
                <circle cx="100" cy="24" r="3" fill="#a855f7" />
                <circle cx="130" cy="14" r="3" fill="#a855f7" />
                <circle cx="160" cy="8" r="3" fill="#a855f7" />
              </svg>
            </div>
          </div>

          {/* 2. TOTAL REVENUE */}
          <div
            className="db-kpi-card card-red-theme"
            onClick={() => navigate("/RevenueReport/daily")}
            role="button"
            tabIndex={0}
          >
            <div className="db-kpi-content-wrap">
              <div className="db-kpi-header">
                <div className="db-kpi-icon-box box-red">
                  <IndianRupee size={18} />
                </div>
                <span className="db-kpi-title">Total Revenue</span>
              </div>
              <div className="db-kpi-num">
                {loading ? <Skeleton width={80} height={32} /> : formatCurrency(totalRevenue || 502)}
              </div>
              <div className="db-kpi-trend trend-up">
                <span>↑ +12.5% vs last month</span>
              </div>
              <svg className="db-sparkline" viewBox="0 0 160 30" preserveAspectRatio="none">
                <path d="M0 24 Q 25 18, 50 22 T 100 12 T 160 6" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="0" cy="24" r="3" fill="#f43f5e" />
                <circle cx="25" cy="19" r="3" fill="#f43f5e" />
                <circle cx="50" cy="22" r="3" fill="#f43f5e" />
                <circle cx="75" cy="16" r="3" fill="#f43f5e" />
                <circle cx="100" cy="12" r="3" fill="#f43f5e" />
                <circle cx="130" cy="10" r="3" fill="#f43f5e" />
                <circle cx="160" cy="6" r="3" fill="#f43f5e" />
              </svg>
            </div>
          </div>

          {/* 3. TOTAL DOCTORS */}
          <div
            className="db-kpi-card card-green-theme"
            onClick={() => navigate("/doctors")}
            role="button"
            tabIndex={0}
          >
            <div className="db-kpi-content-wrap">
              <div className="db-kpi-header">
                <div className="db-kpi-icon-box box-green">
                  <Stethoscope size={18} />
                </div>
                <span className="db-kpi-title">Total Doctors</span>
              </div>
              <div className="db-kpi-num">
                {loading ? <Skeleton width={50} height={32} /> : formatNumber(dashboardData?.totalDoctors ?? 2)}
              </div>
              <div className="db-kpi-trend trend-neutral">
                <span>0% vs last month</span>
              </div>
              <svg className="db-sparkline" viewBox="0 0 160 30" preserveAspectRatio="none">
                <path d="M0 15 H 160" fill="none" stroke="#10b981" strokeWidth="2.5" strokeDasharray="4 4" />
                <circle cx="0" cy="15" r="3" fill="#10b981" />
                <circle cx="32" cy="15" r="3" fill="#10b981" />
                <circle cx="64" cy="15" r="3" fill="#10b981" />
                <circle cx="96" cy="15" r="3" fill="#10b981" />
                <circle cx="128" cy="15" r="3" fill="#10b981" />
                <circle cx="160" cy="15" r="3" fill="#10b981" />
              </svg>
            </div>
          </div>

          {/* 4. TOTAL NURSES */}
          <div
            className="db-kpi-card card-orange-theme"
            onClick={() => navigate("/nurses")}
            role="button"
            tabIndex={0}
          >
            <div className="db-kpi-content-wrap">
              <div className="db-kpi-header">
                <div className="db-kpi-icon-box box-orange">
                  <UserCog size={18} />
                </div>
                <span className="db-kpi-title">Total Nurses</span>
              </div>
              <div className="db-kpi-num">
                {loading ? <Skeleton width={50} height={32} /> : formatNumber(nurseCount)}
              </div>
              <div className="db-kpi-trend trend-neutral">
                <span>0% vs last month</span>
              </div>
              <svg className="db-sparkline" viewBox="0 0 160 30" preserveAspectRatio="none">
                <path d="M0 24 Q 25 20, 50 24 T 100 18 T 160 10" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="0" cy="24" r="3" fill="#f97316" />
                <circle cx="25" cy="21" r="3" fill="#f97316" />
                <circle cx="50" cy="24" r="3" fill="#f97316" />
                <circle cx="75" cy="20" r="3" fill="#f97316" />
                <circle cx="100" cy="18" r="3" fill="#f97316" />
                <circle cx="130" cy="14" r="3" fill="#f97316" />
                <circle cx="160" cy="10" r="3" fill="#f97316" />
              </svg>
            </div>
          </div>

          {/* 5. TOTAL PATIENTS */}
          <div
            className="db-kpi-card card-pink-theme"
            onClick={() => navigate("/patients")}
            role="button"
            tabIndex={0}
          >
            <div className="db-kpi-content-wrap">
              <div className="db-kpi-header">
                <div className="db-kpi-icon-box box-pink">
                  <UserRoundCheck size={18} />
                </div>
                <span className="db-kpi-title">Total Patients</span>
              </div>
              <div className="db-kpi-num">
                {loading ? <Skeleton width={50} height={32} /> : formatNumber(dashboardData?.totalPatients ?? 2)}
              </div>
              <div className="db-kpi-trend trend-up">
                <span>↑ 18% vs last month</span>
              </div>
              <svg className="db-sparkline" viewBox="0 0 160 30" preserveAspectRatio="none">
                <path d="M0 25 Q 25 20, 50 24 T 100 16 T 160 8" fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="0" cy="25" r="3" fill="#ec4899" />
                <circle cx="25" cy="21" r="3" fill="#ec4899" />
                <circle cx="50" cy="24" r="3" fill="#ec4899" />
                <circle cx="75" cy="19" r="3" fill="#ec4899" />
                <circle cx="100" cy="16" r="3" fill="#ec4899" />
                <circle cx="130" cy="12" r="3" fill="#ec4899" />
                <circle cx="160" cy="8" r="3" fill="#ec4899" />
              </svg>
            </div>
          </div>

          {/* 6. TOTAL LAB TECHNICIANS */}
          <div
            className="db-kpi-card card-blue-theme"
            onClick={() => navigate("/lab-technicians")}
            role="button"
            tabIndex={0}
          >
            <div className="db-kpi-content-wrap">
              <div className="db-kpi-header">
                <div className="db-kpi-icon-box box-blue">
                  <FlaskConical size={18} />
                </div>
                <span className="db-kpi-title">Total Lab Technicians</span>
              </div>
              <div className="db-kpi-num">
                {loading ? <Skeleton width={50} height={32} /> : formatNumber(labTechnicianCount)}
              </div>
              <div className="db-kpi-trend trend-up">
                <span>↑ +8% vs last month</span>
              </div>
              <svg className="db-sparkline" viewBox="0 0 160 30" preserveAspectRatio="none">
                <path d="M0 26 Q 25 22, 50 24 T 100 18 T 160 8" fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="0" cy="26" r="3" fill="#0284c7" />
                <circle cx="25" cy="23" r="3" fill="#0284c7" />
                <circle cx="50" cy="24" r="3" fill="#0284c7" />
                <circle cx="75" cy="20" r="3" fill="#0284c7" />
                <circle cx="100" cy="18" r="3" fill="#0284c7" />
                <circle cx="130" cy="14" r="3" fill="#0284c7" />
                <circle cx="160" cy="8" r="3" fill="#0284c7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE SECTION: RECENT APPOINTMENTS (LEFT) & CLINIC STATISTICS (RIGHT) */}
      <div className="db-middle-grid">
        {/* RECENT APPOINTMENTS PANEL */}
        <div className="db-panel" id="recent-activity">
          <div className="db-panel-head">
            <div className="db-panel-title">
              <div className="db-panel-icon db-icon-purple-sm">
                <Calendar size={18} />
              </div>
              <h3>Recent Appointments</h3>
            </div>
            <button
              type="button"
              className="db-view-all-btn"
              onClick={() => navigate("/appointments")}
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="db-appointments-list">
            {displayRecentAppointments.map((apt, index) => (
              <div className="db-apt-item" key={index}>
                <div className="db-apt-avatar">
                  <UserPlus size={18} />
                </div>
                <div className="db-apt-details">
                  <h4>{apt.name}</h4>
                  <p>{apt.subtitle}</p>
                </div>
                <div className="db-apt-time-col">
                  <span className="db-apt-time">{apt.time}</span>
                  <span className="db-apt-date">{apt.date}</span>
                </div>
                <div className="db-apt-status-col">
                  <span className="db-apt-badge confirmed">{apt.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 3 SUMMARY PILL CARDS AT BOTTOM OF RECENT APPOINTMENTS */}
          <div className="db-apt-summary-row">
            <div className="db-apt-sum-card sum-purple">
              <div className="db-sum-icon">
                <Users size={16} />
              </div>
              <div>
                <div className="db-sum-val"><b>1</b> Today</div>
                <div className="db-sum-sub red">-25% vs yesterday</div>
              </div>
            </div>

            <div className="db-apt-sum-card sum-blue">
              <div className="db-sum-icon">
                <CalendarCheck size={16} />
              </div>
              <div>
                <div className="db-sum-val"><b>5</b> This Week</div>
                <div className="db-sum-sub green">+12% vs last week</div>
              </div>
            </div>

            <div className="db-apt-sum-card sum-orange">
              <div className="db-sum-icon">
                <TrendingUp size={16} />
              </div>
              <div>
                <div className="db-sum-val"><b>18</b> This Month</div>
                <div className="db-sum-sub green">+20% vs last month</div>
              </div>
            </div>
          </div>
        </div>

        {/* CLINIC STATISTICS PANEL */}
        <div className="db-panel">
          <div className="db-panel-head">
            <div className="db-panel-title">
              <div className="db-panel-icon db-icon-green-sm">
                <TrendingUp size={18} />
              </div>
              <h3>Clinic Statistics</h3>
            </div>
            <div className="db-filter-select-wrapper">
              <select
                className="db-filter-select"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
              >
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
              </select>
              <span className="db-select-syringe-wrapper" aria-hidden="true" title="Filter duration">
                <Syringe size={14} className="db-select-syringe-icon" />
                <span className="db-syringe-blood-drip" />
              </span>
            </div>
          </div>

          <div className="db-stats-metrics-bar">
            <div className="db-metric-item">
              <span className="db-metric-sub">Appointments</span>
              <div className="db-metric-val-row">
                <span className="db-metric-val">12</span>
                <span className="db-growth-pill green">↑ 20% vs last month</span>
              </div>
            </div>
          </div>

          <div className="db-chart-container">
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorGreen)"
                  dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#ffffff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 4 MINI METRIC PILL BOXES AT BOTTOM OF CLINIC STATISTICS */}
          <div className="db-stat-mini-pills">
            <div className="db-mini-pill">
              <div className="db-mini-icon pill-blue">
                <UserPlus size={14} />
              </div>
              <div className="db-mini-text">
                <span>Patients</span>
                <b>8 <small className="green">↑ 15%</small></b>
              </div>
            </div>

            <div className="db-mini-pill">
              <div className="db-mini-icon pill-purple">
                <Stethoscope size={14} />
              </div>
              <div className="db-mini-text">
                <span>Consultations</span>
                <b>12 <small className="green">↑ 10%</small></b>
              </div>
            </div>

            <div className="db-mini-pill">
              <div className="db-mini-icon pill-green">
                <IndianRupee size={14} />
              </div>
              <div className="db-mini-text">
                <span>Revenue</span>
                <b>₹502 <small className="green">↑ 12.5%</small></b>
              </div>
            </div>

            <div className="db-mini-pill">
              <div className="db-mini-icon pill-orange">
                <TrendingUp size={14} />
              </div>
              <div className="db-mini-text">
                <span>Growth</span>
                <b>20% <small className="green">↑ 3%</small></b>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: QUICK ACTIONS (LEFT) & NOTIFICATIONS (RIGHT) */}
      <div className="db-bottom-grid">
        {/* QUICK ACTIONS PANEL */}
        <div className="db-panel db-qa-panel">
          <div className="db-panel-head">
            <div className="db-panel-title">
              <div className="db-panel-icon db-icon-purple-sm">
                <Rocket size={18} />
              </div>
              <h3>Quick Actions</h3>
            </div>
          </div>

          <div className="db-quick-actions-grid">
            <button
              type="button"
              className="db-qa-chip qa-purple"
              onClick={openAddDoctor}
            >
              <UserPlus size={18} />
              <span>Add Doctor</span>
            </button>

            <button
              type="button"
              className="db-qa-chip qa-mint"
              onClick={() => navigate("/patients")}
            >
              <UserRoundCheck size={18} />
              <span>Add Patient</span>
            </button>

            <button
              type="button"
              className="db-qa-chip qa-sky"
              onClick={() => navigate("/appointments")}
            >
              <CalendarPlus size={18} />
              <span>New Appointment</span>
            </button>

            <button
              type="button"
              className="db-qa-chip qa-amber"
              onClick={() => navigate("/reports")}
            >
              <FileSpreadsheet size={18} />
              <span>Generate Report</span>
            </button>

            <button
              type="button"
              className="db-qa-chip qa-rose"
              onClick={() => navigate("/settings")}
            >
              <Send size={18} />
              <span>Send Notification</span>
            </button>
          </div>
        </div>

        {/* NOTIFICATIONS PANEL */}
        <div className="db-panel db-noti-panel">
          <div className="db-panel-head">
            <div className="db-panel-title">
              <div className="db-panel-icon db-icon-blue-sm">
                <Bell size={18} />
              </div>
              <h3>Notifications</h3>
            </div>
            <button
              type="button"
              className="db-view-all-btn"
              onClick={() => navigate("/notifications")}
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="db-notifications-list">
            <div className="db-notification-item">
              <div className="db-noti-icon noti-purple">
                <Calendar size={18} />
              </div>
              <div className="db-noti-content">
                <h4>New appointment booked</h4>
                <p>Ramesh Kumar - 09:30 AM</p>
              </div>
              <div className="db-noti-time">
                <span>10m ago</span>
                <span className="db-noti-dot" />
              </div>
            </div>

            <div className="db-notification-item">
              <div className="db-noti-icon noti-green">
                <FileSpreadsheet size={18} />
              </div>
              <div className="db-noti-content">
                <h4>Lab Report Generated</h4>
                <p>Blood Test results ready for Dr. Anitha</p>
              </div>
              <div className="db-noti-time">
                <span>45m ago</span>
              </div>
            </div>

            <div className="db-notification-item">
              <div className="db-noti-icon noti-blue">
                <UserRoundCheck size={18} />
              </div>
              <div className="db-noti-content">
                <h4>New Patient Registered</h4>
                <p>Suresh Varma - Patient ID #4092</p>
              </div>
              <div className="db-noti-time">
                <span>2h ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
