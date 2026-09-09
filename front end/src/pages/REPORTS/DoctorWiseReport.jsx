import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./ReportsTheme.css";
import "./DoctorWiseReport.css";

import {
  Activity,
  ArrowLeft,
  BarChart3,
  Download,
  Filter,
  IndianRupee,
  RefreshCw,
  Stethoscope,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { apiUrl } from "../../config/api";
import { getApiHeaders } from "../../utils/branchApi";
import {
  dedupeBillingRows,
  fetchRevenueBillingRows,
  getBillingType,
  getMonthLabel,
  getMonthSortKey,
  getRevenueAmount,
  getRowDate,
  parseList,
  pick,
} from "../../utils/billingRevenue";
import { formatIndianCurrency } from "../../utils/format";
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import { getClinicInvoiceBranding } from "../../utils/clinicBranding";

// ================= APIs =================

const DOCTOR_API =
  apiUrl("Doctor");
const REPORT_API =
  apiUrl("Dashboard/reports/doctors");

const normalizeId = (value) => String(value ?? "").trim();

const getDoctorId = (doctor = {}) =>
  normalizeId(doctor.id ?? doctor.Id ?? doctor.doctorId ?? doctor.DoctorId);

const getDoctorName = (doctor = {}) =>
  String(doctor.name ?? doctor.Name ?? doctor.doctorName ?? doctor.DoctorName ?? "").trim();

const normalizeDoctorName = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/^dr\.?\s+/i, "");

const getDoctorSpecialization = (doctor = {}) =>
  String(doctor.specialization ?? doctor.Specialization ?? "-").trim() || "-";

const getRowDoctorId = (row = {}) =>
  normalizeId(pick(row, ["doctorId", "DoctorId", "doctor.id", "Doctor.Id", "doctor.doctorId", "Doctor.DoctorId"], ""));

const getRowDoctorName = (row = {}) =>
  String(pick(row, ["doctorName", "DoctorName", "doctor.name", "Doctor.Name", "doctor", "Doctor"], "")).trim();

const getRowSpecialization = (row = {}) =>
  String(pick(row, ["specialization", "Specialization", "doctor.specialization", "Doctor.Specialization"], "-")).trim() || "-";

const fetchJsonOrEmpty = async (url, headers) => {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return [];
    return await response.json().catch(() => []);
  } catch {
    return [];
  }
};

const fetchBillingRows = async ({ fromDate, toDate, doctorId, headers }) => {
  const params = new URLSearchParams();
  if (doctorId) params.set("doctorId", String(doctorId));
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  return fetchRevenueBillingRows({ apiUrl, headers, params });
};

const normalizeDoctorReportRows = (value = []) =>
  parseList(value).map((row, index) => {
    const doctorName = getRowDoctorName(row) || getDoctorName(row) || `Doctor ${index + 1}`;
    const date = getRowDate(row) || pick(row, ["month", "Month", "period", "Period", "date", "Date"], "");
    const month = pick(row, ["month", "Month", "period", "Period", "name", "Name"], "") || getMonthLabel(date, index);
    return {
      ...row,
      doctorId: getRowDoctorId(row) || getDoctorId(row),
      doctorName,
      specialization: getRowSpecialization(row),
      month,
      monthSort: getMonthSortKey(date),
      chartLabel: pick(row, ["chartLabel", "label", "Label"], `${doctorName} ${month}`),
      appointments: Number(pick(row, ["appointments", "appointmentCount", "totalAppointments", "count"], 0)) || 0,
      revenue: getRevenueAmount(row),
    };
  });

const withinDateRange = (row = {}, fromDate = "", toDate = "") => {
  const value = getRowDate(row);
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return true;
  if (fromDate && date < new Date(fromDate)) return false;
  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    if (date > end) return false;
  }
  return true;
};

const groupDoctorRevenue = (rows = [], doctors = [], selectedDoctorId = "") => {
  const doctorLookup = doctors.reduce((lookup, doctor) => {
    const id = getDoctorId(doctor);
    if (id) {
      lookup[id] = {
        doctorId: id,
        doctorName: getDoctorName(doctor),
        specialization: getDoctorSpecialization(doctor),
      };
    }
    return lookup;
  }, {});
  const doctorNameLookup = doctors.reduce((lookup, doctor) => {
    const name = normalizeDoctorName(getDoctorName(doctor));
    if (name) {
      lookup[name] = {
        doctorId: getDoctorId(doctor),
        doctorName: getDoctorName(doctor),
        specialization: getDoctorSpecialization(doctor),
      };
    }
    return lookup;
  }, {});
  const selectedDoctor = selectedDoctorId ? doctorLookup[String(selectedDoctorId)] : null;

  const grouped = new Map();
  rows.forEach((row, index) => {
    if (getBillingType(row) !== "op") return;
    const rowDoctorId = getRowDoctorId(row);
    const rawDoctorName = getRowDoctorName(row);
    const namedDoctor = doctorNameLookup[normalizeDoctorName(rawDoctorName)] || {};
    const doctor = doctorLookup[rowDoctorId] || namedDoctor || {};
    const doctorName = doctor.doctorName || rawDoctorName || "Unknown Doctor";
    if (selectedDoctorId) {
      const matchesId = rowDoctorId && rowDoctorId === String(selectedDoctorId);
      const matchesName = selectedDoctor?.doctorName && normalizeDoctorName(doctorName) === normalizeDoctorName(selectedDoctor.doctorName);
      if (!matchesId && !matchesName) return;
    }
    const date = getRowDate(row);
    const month = getMonthLabel(date, index);
    const monthSort = getMonthSortKey(date);
    const key = `${monthSort}|${rowDoctorId || doctorName}`;
    const current = grouped.get(key) || {
      month,
      monthSort,
      doctorId: rowDoctorId,
      doctorName,
      chartLabel: `${doctorName} ${month}`,
      specialization: doctor.specialization || getRowSpecialization(row),
      appointments: 0,
      revenue: 0,
    };
    current.appointments += 1;
    current.revenue += getRevenueAmount(row);
    grouped.set(key, current);
  });

  return Array.from(grouped.values()).sort((left, right) => {
    const monthCompare = String(left.monthSort).localeCompare(String(right.monthSort));
    if (monthCompare) return monthCompare;
    return String(left.doctorName).localeCompare(String(right.doctorName));
  });
};

// ================= COMPONENT =================

function DoctorWiseReport() {
  const navigate = useNavigate();

  const [data, setData] =
    useState([]);

  const [doctors, setDoctors] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const [doctorId, setDoctorId] =
    useState("");
  const [metricMode, setMetricMode] =
    useState("revenue");
  const doctorsRef = useRef([]);

  const chartData = useMemo(() => {
    return data.map((item) => {
      const rawName = item.doctorName || "Doctor";
      const cleanName = rawName.replace(/^Dr\.\s*/i, "").trim();
      const shortName = cleanName.length > 18 ? `${cleanName.slice(0, 16)}...` : cleanName;
      return {
        ...item,
        displayLabel: doctorId ? (item.month || "Month") : `Dr. ${shortName}`,
        fullName: rawName.startsWith("Dr.") ? rawName : `Dr. ${rawName}`,
      };
    });
  }, [data, doctorId]);

  useEffect(() => {
    doctorsRef.current = doctors;
  }, [doctors]);

  // ================= LOAD =================

  const fetchDoctors = useCallback(
    async () => {

      try {

        const response =
          await fetch(DOCTOR_API, {
            headers: getApiHeaders(),
          });

        const result =
          await response.json();

        const nextDoctors = parseList(result);
        doctorsRef.current = nextDoctors;
        setDoctors(nextDoctors);

      } catch (error) {

        console.log(error);
      }
    },
    []
  );

  const fetchReport = useCallback(
    async () => {

      try {

        setLoading(true);

        const headers = getApiHeaders();
        const params = new URLSearchParams();
        if (doctorId) params.set("doctorId", String(doctorId));
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);
        const reportUrl = params.toString() ? `${REPORT_API}?${params.toString()}` : REPORT_API;
        const backendReportRows = normalizeDoctorReportRows(await fetchJsonOrEmpty(reportUrl, headers));
        const backendHasRevenue = backendReportRows.some((row) => Number(row.revenue || 0) > 0);
        if (backendReportRows.length && backendHasRevenue) {
          setData(backendReportRows);
          return;
        }

        const billingRows = await fetchBillingRows({ fromDate, toDate, doctorId, headers });
        const opRows = dedupeBillingRows([
          ...billingRows,
        ]).filter((row) => withinDateRange(row, fromDate, toDate));

        setData(groupDoctorRevenue(opRows, doctorsRef.current, doctorId));
      } catch (error) {
        console.log(error);
        setData([]);
      } finally {
        setLoading(false);
      }
    },
    [doctorId, fromDate, toDate]
  );

  useEffect(() => {

    let isMounted = true;
    const loadInitialData = async () => {
      await fetchDoctors();
      if (isMounted) await fetchReport();
    };
    loadInitialData();
    return () => {
      isMounted = false;
    };

  }, []);
  // ================= TOTALS =================

  const totals = useMemo(() => {
    return data.reduce(
      (sum, row) => ({
        appointments: sum.appointments + Number(row.appointments || 0),
        revenue: sum.revenue + Number(row.revenue || 0),
      }),
      { appointments: 0, revenue: 0 }
    );
  }, [data]);

  // ================= EXPORT PDF =================

  const exportPDF = () => {
    const generatedAt = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const clinicName = getClinicDisplayName(
      {
        hospitalName: localStorage.getItem("hospitalName") || localStorage.getItem("clinicName"),
        clinicName: localStorage.getItem("clinicName"),
      },
      "Clinic"
    );
    const clinicId = localStorage.getItem("hospitalId") || localStorage.getItem("clinicId") || "";
    const branding = getClinicInvoiceBranding({ clinicId, clinicName });
    const selectedDoctor = doctors.find((doctor) => getDoctorId(doctor) === String(doctorId));
    const rowsHtml = data.length
      ? data
          .map(
            (row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${row.month}</td>
                <td>${row.doctorName}</td>
                <td>${row.specialization}</td>
                <td>${row.appointments}</td>
                <td>${formatIndianCurrency(row.revenue)}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="6" class="empty-row">No OP billing data found.</td></tr>`;

    const reportWindow = window.open("", "_blank", "width=980,height=900");
    if (!reportWindow) return;

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Doctor-wise OP Revenue Report</title>
          <style>
            body { margin: 0; background: #f5f7fb; color: #111827; font-family: Arial, sans-serif; }
            main { max-width: 1100px; margin: 0 auto; background: #fff; min-height: 100vh; padding: 32px; box-sizing: border-box; }
            header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #0f9d9d; padding-bottom: 18px; }
            .brand { display: flex; align-items: center; gap: 14px; }
            .brand img { width: 62px; height: 62px; object-fit: contain; }
            h1 { margin: 0 0 8px; font-size: 28px; }
            p { margin: 4px 0; color: #475569; }
            .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 22px 0; }
            .metric { border: 1px solid #dbe7ee; border-radius: 10px; padding: 14px; }
            .metric span { display: block; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
            .metric b { display: block; margin-top: 7px; font-size: 22px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border: 1px solid #e2e8f0; padding: 11px 10px; text-align: left; }
            th { background: #edf4f7; color: #334155; }
            td:nth-child(1), td:nth-child(5), td:nth-child(6) { text-align: right; }
            .empty-row { text-align: center !important; color: #64748b; }
            footer { margin-top: 24px; color: #64748b; font-size: 12px; }
            @media print { body { background: #fff; } main { padding: 0; } }
          </style>
        </head>
        <body>
          <main>
            <header>
              <div class="brand">
                <img src="${branding.logoUrl}" alt="Clinic logo" />
                <div>
                <h1>${branding.headerTitle}</h1>
                <p>Monthly doctor revenue based on paid OP bills.</p>
                <p>Doctor-wise OP Revenue Report</p>
                </div>
              </div>
              <div>
                <p>Generated: ${generatedAt}</p>
                <p>Doctor: ${selectedDoctor ? getDoctorName(selectedDoctor) : "All doctors"}</p>
                <p>Period: ${fromDate || "Start"} to ${toDate || "Today"}</p>
              </div>
            </header>
            <section class="metrics">
              <div class="metric"><span>Total OP Appointments</span><b>${totals.appointments}</b></div>
              <div class="metric"><span>Total OP Revenue</span><b>${formatIndianCurrency(totals.revenue)}</b></div>
            </section>
            <table>
              <thead>
                <tr><th>S.No.</th><th>Month</th><th>Doctor</th><th>Specialization</th><th>OP Bills</th><th>OP Revenue</th></tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            <footer>This report is generated from saved backend OP billing records.</footer>
          </main>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };

  return (
    <div className="report-page doctor-wise-report-page">
      {/* MEDICAL & HOSPITALIZED AMBIENT TELEMETRY BACKGROUND */}
      <div className="rep-medical-bg" aria-hidden="true">
        <div className="rep-ecg-track">
          <svg className="rep-ecg-svg" viewBox="0 0 1200 60" preserveAspectRatio="none">
            <path
              className="rep-ecg-line-base"
              d="M0,30 L180,30 L195,12 L205,48 L215,6 L225,40 L235,30 L460,30 L475,10 L485,50 L495,4 L505,42 L515,30 L760,30 L775,12 L785,48 L795,6 L805,40 L815,30 L1020,30 L1035,10 L1045,50 L1055,4 L1065,42 L1075,30 L1200,30"
            />
            <path
              className="rep-ecg-line-pulse"
              d="M0,30 L180,30 L195,12 L205,48 L215,6 L225,40 L235,30 L460,30 L475,10 L485,50 L495,4 L505,42 L515,30 L760,30 L775,12 L785,48 L795,6 L805,40 L815,30 L1020,30 L1035,10 L1045,50 L1055,4 L1065,42 L1075,30 L1200,30"
            />
          </svg>
        </div>
        <div className="rep-watermark-cross rep-watermark-cross--tl">+</div>
        <div className="rep-watermark-cross rep-watermark-cross--br">+</div>
      </div>

      {/* TOP HOSPITAL TELEMETRY HUD BAR */}
      <div className="rep-telemetry-bar">
        <span className="rep-telemetry-badge">
          <span className="rep-telemetry-cross">+</span>
          CLINICIAN AUDIT TELEMETRY
        </span>
        <span className="rep-telemetry-badge">
          <Activity size={12} className="rep-telemetry-wave-icon" />
          SYSTEM ONLINE
          <span className="rep-telemetry-bead-live"></span>
        </span>
      </div>

      {/* HEADER WITH SURGICAL INSTRUMENTS */}
      <div className="report-header">
        <div className="rep-header-title-group">
          {/* ALL REPORTS NAVIGATION BUTTON */}
          <button
            type="button"
            className="report-back rep-instrument--retractor"
            onClick={() => navigate("/reports")}
            title="Return to Reports"
          >
            <ArrowLeft size={16} />
            <span>All reports</span>
          </button>

          <span className="rep-header-badge">
            <span className="rep-header-badge-pulse">+</span>
            CLINICIAN PERFORMANCE TELEMETRY
          </span>
          <h2>Doctor-wise Report</h2>
          <p>Performance and consultation revenue audit per doctor</p>
        </div>

        {/* EXPORT PDF BUTTON */}
        <button
          type="button"
          className="export rep-instrument--recorder"
          onClick={exportPDF}
          title="Export PDF"
        >
          <Download size={15} />
          <span>Export PDF</span>
        </button>
      </div>

      {/* DIAGNOSTIC LABORATORY FILTER PANEL */}
      <div className="filter-card">
        {/* FROM */}
        <div>
          <label>From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        {/* TO */}
        <div>
          <label>To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        {/* DOCTOR WITH ROTATING SYRINGE */}
        <div>
          <label>Doctor</label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            <option value="">All doctors</option>
            {doctors.map((doctor) => (
              <option
                key={getDoctorId(doctor)}
                value={getDoctorId(doctor)}
              >
                Dr. {getDoctorName(doctor)}
              </option>
            ))}
          </select>
        </div>

        {/* CLEAN PROFESSIONAL APPLY BUTTON */}
        <button
          type="button"
          className="report-apply-clean"
          onClick={fetchReport}
          disabled={loading}
          title="Apply Date & Doctor Filters"
        >
          <Filter size={15} />
          <span>{loading ? "Applying..." : "Apply"}</span>
        </button>
      </div>

      {/* MEDICAL TELEMETRY STAT SUMMARY CARDS */}
      <div className="rep-stats-grid">
        <div className="rep-stat-card">
          <div className="rep-stat-icon-wrap emerald">
            <IndianRupee size={20} />
          </div>
          <div className="rep-stat-info">
            <span className="rep-stat-label">Total OP Revenue</span>
            <span className="rep-stat-value">{formatIndianCurrency(totals.revenue)}</span>
          </div>
        </div>

        <div className="rep-stat-card">
          <div className="rep-stat-icon-wrap cyan">
            <Stethoscope size={20} />
          </div>
          <div className="rep-stat-info">
            <span className="rep-stat-label">Total OP Consultations</span>
            <span className="rep-stat-value">{totals.appointments}</span>
          </div>
        </div>

        <div className="rep-stat-card">
          <div className="rep-stat-icon-wrap purple">
            <Users size={20} />
          </div>
          <div className="rep-stat-info">
            <span className="rep-stat-label">Active Clinicians</span>
            <span className="rep-stat-value">{doctors.length} Doctors</span>
          </div>
        </div>
      </div>

      {/* DOCTOR PERFORMANCE VISUALIZATION */}
      <div className="chart-card">
        <div className="rep-chart-header">
          <div className="rep-chart-title-wrap">
            <div className="rep-chart-title-icon">
              <BarChart3 size={18} />
            </div>
            <h3>Doctor Performance</h3>
          </div>
          <div className="rep-chart-controls">
            <div className="rep-model-switch">
              <button
                type="button"
                className={`rep-model-btn ${metricMode === "revenue" ? "active" : ""}`}
                onClick={() => setMetricMode("revenue")}
                title="View OP Revenue"
              >
                <IndianRupee size={13} />
                <span>Revenue (₹)</span>
              </button>
              <button
                type="button"
                className={`rep-model-btn ${metricMode === "consultations" ? "active" : ""}`}
                onClick={() => setMetricMode("consultations")}
                title="View Consultations Volume"
              >
                <Stethoscope size={13} />
                <span>Consultations</span>
              </button>
            </div>
            <span className="rep-chart-telemetry-status">
              <span className="rep-telemetry-bead-live"></span>
              Doctor Analytics Active
            </span>
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading doctor performance...</div>
        ) : chartData.length === 0 ? (
          <div className="empty">No report data found</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={chartData}
              margin={{ top: 25, right: 30, left: 15, bottom: 35 }}
            >
              <defs>
                <linearGradient id="docRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.92} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.68} />
                </linearGradient>
                <linearGradient id="docConsultGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity={0.92} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.68} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

              <XAxis
                dataKey="displayLabel"
                tick={{ fill: "#334155", fontSize: 12.5, fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
                interval={0}
              />

              <YAxis
                allowDecimals={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickFormatter={(val) =>
                  metricMode === "revenue"
                    ? val >= 1000 ? `₹${(val / 1000).toFixed(1)}k` : `₹${val}`
                    : val
                }
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />

              <Tooltip
                cursor={{ fill: "rgba(15, 23, 42, 0.03)" }}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.12)",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
                formatter={(value) => [
                  metricMode === "revenue"
                    ? formatIndianCurrency(value)
                    : `${value} consultations`,
                  metricMode === "revenue" ? "OP Revenue" : "Consultations",
                ]}
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload;
                  return row?.doctorName
                    ? `${row.doctorName} ${row.specialization ? `(${row.specialization})` : ""}`
                    : label;
                }}
              />

              <Bar
                dataKey={metricMode === "revenue" ? "revenue" : "appointments"}
                fill={metricMode === "revenue" ? "url(#docRevenueGrad)" : "url(#docConsultGrad)"}
                radius={[8, 8, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* CLINICAL MEDICAL AUDIT RECORD TABLE */}
      <div className="table-card">
        <div className="rep-table-banner">
          <div className="rep-table-banner-title">
            <span>+</span>
            <span>Clinician OP Billing Audit Registry</span>
          </div>
          <span className="rep-table-badge">{data.length} Doctor Records</span>
        </div>

        <div className="thead">
          <span>S.No.</span>
          <span>Doctor</span>
          <span>Specialization</span>
          <span>Month</span>
          <span>OP Bills</span>
          <span>OP Revenue</span>
        </div>

        {data.map((d, i) => (
          <div className="row" key={i}>
            <span>{i + 1}</span>
            <span>Dr. {d.doctorName}</span>
            <span>{d.specialization}</span>
            <span>{d.month}</span>
            <span>{d.appointments}</span>
            <span>{formatIndianCurrency(d.revenue)}</span>
          </div>
        ))}

        {!loading && data.length === 0 && (
          <div className="empty-table">No report data found.</div>
        )}
      </div>
    </div>
  );
}

export default DoctorWiseReport;
