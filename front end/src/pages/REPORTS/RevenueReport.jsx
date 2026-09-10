import React, { useCallback, useEffect, useMemo, useState } from "react";

import "./ReportsTheme.css";
import "./RevenueReport.css";

import {
  Activity,
  ArrowLeft,
  BarChart3,
  Download,
  Filter,
  FlaskConical,
  IndianRupee,
  Pill,
  Receipt,
  RefreshCw,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiUrl } from "../../config/api";
import {
  fetchBranchesForHospital,
  getApiHeaders,
  getBranchId as getBranchOptionId,
  getBranchName as getBranchOptionName,
  getStoredHospitalId,
} from "../../utils/branchApi";
import { formatIndianCurrency } from "../../utils/format";
import { getClinicDisplayName } from "../../utils/clinicDisplay";
import { getClinicInvoiceBranding } from "../../utils/clinicBranding";
import {
  dedupeBillingRows as dedupeRevenueRows,
  fetchRevenueBillingRows,
  getBranchId as getRevenueBranchId,
  getBranchName as getRevenueBranchName,
  groupRevenueByMonth,
  groupRevenueByMonthBranch,
  passesRevenueFilters,
} from "../../utils/billingRevenue";

// ================= API =================

const REPORT_API =
  apiUrl("Dashboard/reports/revenue");

const parseList = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  for (const key of ["data", "items", "results", "records", "reports", "billing"]) {
    if (Array.isArray(value[key])) return value[key];
  }

  return [];
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const pick = (source, keys, fallback = "") => {
  if (!source || typeof source !== "object") return fallback;

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return fallback;
};

const getRevenueAmount = (row = {}) =>
  toNumber(
    pick(
      row,
      [
        "revenue",
        "totalRevenue",
        "amount",
        "totalAmount",
        "grandTotal",
        "total",
        "paidAmount",
        "paymentAmount",
        "consultationCharge",
      ],
      0
    )
  );

const getRowDate = (row = {}) =>
  pick(row, ["month", "date", "createdAt", "paidAt", "paymentDate", "invoiceDate", "appointmentDate"], "");

const getMonthLabel = (value, index = 0) => {
  if (!value) return `Item ${index + 1}`;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

const normalizeRevenueRows = (value) =>
  parseList(value)
    .map((row, index) => ({
      month: pick(row, ["month", "name", "date", "label"], getMonthLabel(getRowDate(row), index)),
      revenue: getRevenueAmount(row),
      growth: toNumber(pick(row, ["growth", "growthPercentage", "change"], 0)),
    }))
    .filter((row) => row.month || row.revenue);

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const readValue = (record = {}, keys = []) => {
  for (const key of keys) {
    const value = String(key).split(".").reduce((current, part) => (
      current && current[part] !== undefined ? current[part] : undefined
    ), record);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
};

const getAppointmentLookupKey = (record = {}) =>
  String(readValue(record, [
    "appointmentId",
    "AppointmentId",
    "appointment.id",
    "appointment.Id",
    "appointment.appointmentId",
    "appointment.AppointmentId",
    "appointmentNumber",
    "AppointmentNumber",
    "appointmentNo",
    "AppointmentNo",
    "id",
    "Id",
  ]) || "").trim().toLowerCase();

const enrichBillingBranch = (row = {}, { appointmentLookup, branches }) => {
  const rowBranchId = getRevenueBranchId(row);
  const rowBranchName = getRevenueBranchName(row);
  if (rowBranchId && normalizeText(rowBranchName) !== "unassigned branch") return row;

  const branchFromAppointment = appointmentLookup.get(getAppointmentLookupKey(row));
  const branchFromId = rowBranchId
    ? branches.find((branch) => String(getBranchOptionId(branch)) === String(rowBranchId))
    : null;
  const onlyBranch = branches.length === 1 ? branches[0] : null;
  const branch = branchFromAppointment || (
    branchFromId
      ? { branchId: getBranchOptionId(branchFromId), branchName: getBranchOptionName(branchFromId) }
      : onlyBranch
        ? { branchId: getBranchOptionId(onlyBranch), branchName: getBranchOptionName(onlyBranch) }
        : null
  );

  if (!branch?.branchId && !branch?.branchName) return row;
  return {
    ...row,
    branchId: row.branchId || row.BranchId || branch.branchId,
    BranchId: row.BranchId || row.branchId || branch.branchId,
    branchName: normalizeText(rowBranchName) === "unassigned branch" ? branch.branchName : row.branchName || branch.branchName,
    BranchName: normalizeText(rowBranchName) === "unassigned branch" ? branch.branchName : row.BranchName || branch.branchName,
  };
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// ================= COMPONENT =================

function RevenueReport() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [branchRows, setBranchRows] = useState([]);

  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(false);

  const [fromDate, setFromDate] = useState("");

  const [toDate, setToDate] = useState("");

  const [branchId, setBranchId] = useState("");
  const [graphModel, setGraphModel] = useState("bar");

  // ================= LOAD =================

  const fetchBranches = useCallback(async () => {
    try {
      setBranches(await fetchBranchesForHospital(getStoredHospitalId()));
    } catch (error) {
      console.log(error);
      setBranches([]);
    }
  }, []);

  const fetchRevenue = useCallback(async () => {
    try {
      setLoading(true);

      const storedHospitalId = getStoredHospitalId();
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (storedHospitalId) {
        params.set("hospitalId", String(storedHospitalId));
        params.set("clinicId", String(storedHospitalId));
      }

      const query = params.toString();
      const url = query ? `${REPORT_API}?${query}` : REPORT_API;
      const headers = getApiHeaders();

      const response = await fetch(url, {
        headers,
      });

      const result = await response.json();
      const reportRows = normalizeRevenueRows(result);

      const backendBillingRows = await fetchRevenueBillingRows({ apiUrl, headers, params });

      const selectedBranch = branches.find(
        (branch) => String(getBranchOptionId(branch)) === String(branchId)
      );
      const selectedBranchName = selectedBranch ? getBranchOptionName(selectedBranch) : "";
      const billingRows = dedupeRevenueRows([
        ...backendBillingRows,
      ])
        .map((row) => enrichBillingBranch(row, { appointmentLookup: new Map(), branches }))
        .map((row) => ({ ...row, __selectedBranchName: selectedBranchName }))
        .filter((row) => {
          const rowBranchId = getRevenueBranchId(row);
          const rowBranchName = getRevenueBranchName(row);
          return Boolean(rowBranchId) || normalizeText(rowBranchName) !== "unassigned branch";
        })
        .filter((row) =>
          passesRevenueFilters(row, {
          clinicId: storedHospitalId,
          branchId: branchId || "",
          fromDate,
          toDate,
          })
        );

      const nextBranchRows = groupRevenueByMonthBranch(billingRows);
      setBranchRows(nextBranchRows);
      if (nextBranchRows.length) {
        setData(groupRevenueByMonth(billingRows));
      } else if (branchId) {
        setData([]);
        setBranchRows([]);
      } else {
        setData(reportRows);
        setBranchRows(
          reportRows.map((row) => ({
            month: row.month,
            monthSort: row.month,
            branchId: "",
            branchName: "All Branches",
            opRevenue: row.revenue,
            diagnosticRevenue: 0,
            pharmacyRevenue: 0,
            revenue: row.revenue,
            growth: row.growth,
          }))
        );
      }
    } catch (error) {
      console.log(error);
      setData([]);
      setBranchRows([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, branches, fromDate, toDate]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  // ================= TOTALS =================

  const totals = useMemo(() => {
    return branchRows.reduce(
      (sum, row) => ({
        opRevenue: sum.opRevenue + Number(row.opRevenue || 0),
        diagnosticRevenue: sum.diagnosticRevenue + Number(row.diagnosticRevenue || 0),
        pharmacyRevenue: sum.pharmacyRevenue + Number(row.pharmacyRevenue || 0),
        cgstAmount: sum.cgstAmount + Number(row.cgstAmount || 0),
        sgstAmount: sum.sgstAmount + Number(row.sgstAmount || 0),
        gstAmount: sum.gstAmount + Number(row.gstAmount || 0),
        revenue: sum.revenue + Number(row.revenue || 0),
      }),
      {
        opRevenue: 0,
        diagnosticRevenue: 0,
        pharmacyRevenue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        gstAmount: 0,
        revenue: 0,
      }
    );
  }, [branchRows]);

  // ================= EXPORT PDF =================

  const exportPDF = () => {
    const storedHospitalId = getStoredHospitalId();
    const clinicName = getClinicDisplayName({
      clinicName: localStorage.getItem("clinicName"),
      hospitalName: localStorage.getItem("hospitalName"),
      name: localStorage.getItem("clinicName"),
    }, "Clinic");
    const clinicPhone =
      localStorage.getItem("clinicPhone") ||
      localStorage.getItem("hospitalPhone") ||
      localStorage.getItem("contactNumber") ||
      "";
    const clinicEmail =
      localStorage.getItem("clinicEmail") ||
      localStorage.getItem("hospitalEmail") ||
      localStorage.getItem("adminEmail") ||
      "";
    const clinicAddress =
      localStorage.getItem("clinicAddress") ||
      localStorage.getItem("hospitalAddress") ||
      "";
    const branding = getClinicInvoiceBranding({ clinicId: storedHospitalId, clinicName });
    const generatedAt = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const printWindow = window.open("", "_blank", "width=1120,height=780");
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Revenue Report</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { margin: 0; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
            .report { padding: 18px; }
            .clinic-head { text-align: center; border-bottom: 2px solid ${escapeHtml(branding.accentColor)}; padding-bottom: 14px; margin-bottom: 14px; }
            .clinic-head img { display: block; width: 88px; height: 88px; object-fit: contain; margin: 0 auto 8px; }
            .clinic-head h1 { margin: 0; font-size: 25px; color: #0f172a; }
            .clinic-head p { margin: 4px 0 0; color: #475569; font-size: 12px; }
            .report-title { display: flex; justify-content: space-between; gap: 18px; align-items: end; margin-bottom: 12px; }
            .report-title h2 { margin: 0 0 4px; font-size: 20px; }
            .report-title p { margin: 0; color: #475569; font-size: 12px; }
            .summary { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin: 14px 0; }
            .metric { border: 1px solid #dbeafe; border-radius: 8px; padding: 9px; background: #f8fafc; }
            .metric span { display: block; color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .metric b { display: block; margin-top: 5px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d7e1ea; padding: 8px 7px; font-size: 11px; text-align: right; }
            th { background: #e8f7f5; color: #0f172a; text-transform: uppercase; font-size: 10px; }
            th:nth-child(1), th:nth-child(2), td:nth-child(1), td:nth-child(2) { text-align: left; }
            tfoot td { font-weight: 900; background: #f0fdfa; }
            @media print { body { print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <main class="report">
            <section class="clinic-head">
              <img src="${escapeHtml(branding.logoUrl)}" alt="Clinic logo" />
              <h1>${escapeHtml(branding.headerTitle || clinicName)}</h1>
              <p>${escapeHtml([branding.headerSubtitle, clinicPhone, clinicEmail].filter(Boolean).join(" | "))}</p>
              ${clinicAddress ? `<p>${escapeHtml(clinicAddress)}</p>` : ""}
            </section>
            <section class="report-title">
              <div>
                <h2>Revenue Report</h2>
                <p>Branch-wise monthly revenue including GST amounts.</p>
              </div>
              <p>Generated: ${escapeHtml(generatedAt)}</p>
            </section>
            <section class="summary">
              <div class="metric"><span>OP</span><b>${formatIndianCurrency(totals.opRevenue)}</b></div>
              <div class="metric"><span>Diagnostic</span><b>${formatIndianCurrency(totals.diagnosticRevenue)}</b></div>
              <div class="metric"><span>Pharmacy</span><b>${formatIndianCurrency(totals.pharmacyRevenue)}</b></div>
              <div class="metric"><span>CGST</span><b>${formatIndianCurrency(totals.cgstAmount)}</b></div>
              <div class="metric"><span>SGST</span><b>${formatIndianCurrency(totals.sgstAmount)}</b></div>
              <div class="metric"><span>Total GST</span><b>${formatIndianCurrency(totals.gstAmount)}</b></div>
              <div class="metric"><span>Total</span><b>${formatIndianCurrency(totals.revenue)}</b></div>
            </section>
            <table>
              <thead>
                <tr>
                  <th>Month</th><th>Branch</th><th>OP Revenue</th><th>Diagnostic Revenue</th><th>Pharmacy Revenue</th><th>CGST</th><th>SGST</th><th>Total GST</th><th>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${branchRows.map((row) => `
                  <tr>
                    <td>${row.month}</td>
                    <td>${row.branchName}</td>
                    <td>${formatIndianCurrency(row.opRevenue)}</td>
                    <td>${formatIndianCurrency(row.diagnosticRevenue)}</td>
                    <td>${formatIndianCurrency(row.pharmacyRevenue)}</td>
                    <td>${formatIndianCurrency(row.cgstAmount)}</td>
                    <td>${formatIndianCurrency(row.sgstAmount)}</td>
                    <td>${formatIndianCurrency(row.gstAmount)}</td>
                    <td>${formatIndianCurrency(row.revenue)}</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2">Total</td>
                  <td>${formatIndianCurrency(totals.opRevenue)}</td>
                  <td>${formatIndianCurrency(totals.diagnosticRevenue)}</td>
                  <td>${formatIndianCurrency(totals.pharmacyRevenue)}</td>
                  <td>${formatIndianCurrency(totals.cgstAmount)}</td>
                  <td>${formatIndianCurrency(totals.sgstAmount)}</td>
                  <td>${formatIndianCurrency(totals.gstAmount)}</td>
                  <td>${formatIndianCurrency(totals.revenue)}</td>
                </tr>
              </tfoot>
            </table>
          </main>
          <script>window.onload = () => { window.focus(); window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="report-page revenue-report-page">
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
          HOSPITAL REVENUE TELEMETRY
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
            AUDIT & EARNINGS CONSOLE
          </span>
          <h2>Revenue Report</h2>
          <p>Earnings and total revenue telemetry across clinical departments</p>
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

        {/* BRANCH WITH ROTATING SYRINGE */}
        <div>
          <label>Branch</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={getBranchOptionId(branch)} value={getBranchOptionId(branch)}>
                {getBranchOptionName(branch)}
              </option>
            ))}
          </select>
        </div>

        {/* CLEAN PROFESSIONAL APPLY BUTTON */}
        <button
          type="button"
          className="report-apply-clean"
          onClick={fetchRevenue}
          disabled={loading}
          title="Apply Date & Branch Filters"
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
            <span className="rep-stat-label">Total Revenue</span>
            <span className="rep-stat-value">{formatIndianCurrency(totals.revenue)}</span>
          </div>
        </div>

        <div className="rep-stat-card">
          <div className="rep-stat-icon-wrap cyan">
            <Stethoscope size={20} />
          </div>
          <div className="rep-stat-info">
            <span className="rep-stat-label">OP Consultations</span>
            <span className="rep-stat-value">{formatIndianCurrency(totals.opRevenue)}</span>
          </div>
        </div>

        <div className="rep-stat-card">
          <div className="rep-stat-icon-wrap purple">
            <FlaskConical size={20} />
          </div>
          <div className="rep-stat-info">
            <span className="rep-stat-label">Diagnostic Labs</span>
            <span className="rep-stat-value">{formatIndianCurrency(totals.diagnosticRevenue)}</span>
          </div>
        </div>

        <div className="rep-stat-card">
          <div className="rep-stat-icon-wrap amber">
            <Pill size={20} />
          </div>
          <div className="rep-stat-info">
            <span className="rep-stat-label">Pharmacy Dispensary</span>
            <span className="rep-stat-value">{formatIndianCurrency(totals.pharmacyRevenue)}</span>
          </div>
        </div>

        <div className="rep-stat-card">
          <div className="rep-stat-icon-wrap ruby">
            <Receipt size={20} />
          </div>
          <div className="rep-stat-info">
            <span className="rep-stat-label">Total GST Tax</span>
            <span className="rep-stat-value">{formatIndianCurrency(totals.gstAmount)}</span>
          </div>
        </div>
      </div>

      {/* REVENUE VISUALIZATION CHART SCREEN */}
      <div className="chart-card">
        <div className="rep-chart-header">
          <div className="rep-chart-title-wrap">
            <div className="rep-chart-title-icon">
              <BarChart3 size={18} />
            </div>
            <h3>Revenue Visualization</h3>
          </div>
          <div className="rep-chart-controls">
            <div className="rep-model-switch">
              <button
                type="button"
                className={`rep-model-btn ${graphModel === "bar" ? "active" : ""}`}
                onClick={() => setGraphModel("bar")}
                title="Bar Chart View"
              >
                <BarChart3 size={13} />
                <span>Bar Chart</span>
              </button>
              <button
                type="button"
                className={`rep-model-btn ${graphModel === "area" ? "active" : ""}`}
                onClick={() => setGraphModel("area")}
                title="Area Trend View"
              >
                <TrendingUp size={13} />
                <span>Area Trend</span>
              </button>
            </div>
            <span className="rep-chart-telemetry-status">
              <span className="rep-telemetry-bead-live"></span>
              Revenue Analytics Active
            </span>
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading revenue data...</div>
        ) : data.length === 0 ? (
          <div className="empty">No revenue data found</div>
        ) : graphModel === "bar" ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 25, right: 30, left: 15, bottom: 25 }}>
              <defs>
                <linearGradient id="revBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.92} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.68} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#334155", fontSize: 13, fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.12)",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
                formatter={(value) => [formatIndianCurrency(value), "Total Revenue"]}
              />
              <Bar
                dataKey="revenue"
                fill="url(#revBarGrad)"
                radius={[8, 8, 0, 0]}
                maxBarSize={55}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data} margin={{ top: 25, right: 30, left: 15, bottom: 25 }}>
              <defs>
                <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#334155", fontSize: 13, fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.12)",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
                formatter={(value) => [formatIndianCurrency(value), "Total Revenue"]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#0d9488"
                strokeWidth={3.5}
                fill="url(#revAreaGrad)"
                dot={{ r: 6, fill: "#0d9488", stroke: "#ffffff", strokeWidth: 2.5 }}
                activeDot={{ r: 8, fill: "#0f766e" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* CLINICAL MEDICAL AUDIT RECORD TABLE */}
      <div className="table-card">
        <div className="rep-table-banner">
          <div className="rep-table-banner-title">
            <span>+</span>
            <span>Clinical Audit & Monthly Revenue Log</span>
          </div>
          <span className="rep-table-badge">{branchRows.length} Monthly Entries</span>
        </div>

        <div className="thead">
          <span>S.No.</span>
          <span>Month</span>
          <span>Branch</span>
          <span>OP Revenue</span>
          <span>Diagnostic Revenue</span>
          <span>Pharmacy Revenue</span>
          <span>CGST</span>
          <span>SGST</span>
          <span>Total GST</span>
          <span>Total Revenue</span>
        </div>

        {branchRows.map((d, i) => (
          <div className="row" key={`${d.monthSort}-${d.branchId || d.branchName}-${i}`}>
            <span>{i + 1}</span>
            <span>{d.month}</span>
            <span>{d.branchName}</span>
            <span>{formatIndianCurrency(d.opRevenue)}</span>
            <span>{formatIndianCurrency(d.diagnosticRevenue)}</span>
            <span>{formatIndianCurrency(d.pharmacyRevenue)}</span>
            <span>{formatIndianCurrency(d.cgstAmount)}</span>
            <span>{formatIndianCurrency(d.sgstAmount)}</span>
            <span>{formatIndianCurrency(d.gstAmount)}</span>
            <span>{formatIndianCurrency(d.revenue)}</span>
          </div>
        ))}

        {!loading && branchRows.length === 0 && (
          <div className="empty-table">No revenue data found.</div>
        )}
      </div>
    </div>
  );
}

export default RevenueReport;
