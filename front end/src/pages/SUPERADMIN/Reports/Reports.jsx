import React, { useEffect, useMemo, useState } from "react";
import { Building2, Download, Eye, IndianRupee, Search, TrendingUp } from "lucide-react";
import Header from "../../../components/superadmin/Header";
import DataTable from "../../../components/superadmin/DataTable";
import SearchFilter from "../../../components/superadmin/SearchFilter";
import { fetchReports, fetchSuperAdminClinicRevenue } from "../superAdminApi";
import { formatIndianCurrency } from "../../../utils/format";
import { getDefaultClinicLogo } from "../../../utils/clinicBranding";

const downloadFile = (filename, content, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const htmlEscape = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const toNumber = (value) => {
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : 0;
  }

  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};
const getAdminDisplayName = (value) => String(value || "").trim() || "Not Assigned";
const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};
const getPerformance = (row) => (row.status === "Active" ? "Active" : "Inactive");
const reportTabs = ["Revenue Report"];
const chartPalette = ["#0f9f8f", "#2563eb", "#8b5cf6", "#f59e0b", "#94a3b8"];

const toDateInputValue = (date) => date.toISOString().slice(0, 10);
const getDefaultStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return toDateInputValue(date);
};
const getDefaultEndDate = () => toDateInputValue(new Date());

const getRowDateValue = (row = {}) =>
  row.date ||
  row.createdAt ||
  row.timestampRaw ||
  row.timestamp ||
  row.time ||
  row.lastActive ||
  row.raw?.date ||
  row.raw?.createdAt ||
  "";

const isInsideDateRange = (row, startDate, endDate) => {
  const value = getRowDateValue(row);
  if (!value) return true;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;

  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

  return (!start || date >= start) && (!end || date <= end);
};

const isFutureDate = (value) => {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
};

const buildRowsHtml = (rows, columns) =>
  rows
    .map(
      (row) => `
      <tr>${columns.map((column) => `<td>${htmlEscape(row[column] ?? "-")}</td>`).join("")}</tr>
    `
    )
    .join("");

const getInitials = (value = "") => {
  const parts = String(value || "NA").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || "NA").toUpperCase();
};

const getPerformanceScore = (row, maxRevenue = 1) => {
  if (row.performanceScore != null) return Math.round(toNumber(row.performanceScore));
  const score = Math.round((toNumber(row.revenue) / Math.max(maxRevenue, 1)) * 100);
  return Math.min(100, Math.max(row.status === "Active" ? 45 : 0, score));
};

function Reports() {
  const [rows, setRows] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [backendSummary, setBackendSummary] = useState(null);
  const [activeTab, setActiveTab] = useState(reportTabs[0]);
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [detailLoadingId, setDetailLoadingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      setLoading(true);
      setError("");

      try {
        const reports = await fetchReports();
        if (!active) return;

        setRows(reports.rows);
        setChartData(reports.chartData);
        setBackendSummary(reports.summary || null);
        setError(reports.error);
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load reports.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadReports();

    return () => {
      active = false;
    };
  }, []);

  const handleFetchData = async () => {
    if (startDate && endDate && startDate > endDate) {
      setError("Start date must be before end date.");
      return;
    }

    if (isFutureDate(startDate) || isFutureDate(endDate)) {
      setError("Future dates are not allowed.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const reports = await fetchReports();
      setRows(reports.rows);
      setChartData(reports.chartData);
      setBackendSummary(reports.summary || null);
      setError(reports.error);
    } catch (requestError) {
      setError(requestError.message || "Unable to fetch report data.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewClinicRevenue = async (clinic) => {
    const hospitalId = clinic.hospitalId || clinic.clinicId || clinic.id;
    if (!hospitalId) {
      setError("Hospital id not found for this clinic.");
      return;
    }

    setDetailLoadingId(String(hospitalId));
    setError("");

    try {
      const detail = await fetchSuperAdminClinicRevenue(hospitalId);
      const detailRows = Array.isArray(detail) ? detail : detail?.data || detail?.items || detail?.results || [];
      const source = detailRows[0] || detail?.data || detail || {};
      const enrichedClinic = {
        ...clinic,
        ...source,
        id: clinic.id,
        name: source.name || source.clinicName || source.hospitalName || clinic.name,
        adminName: source.adminName || clinic.adminName,
        adminEmail: source.adminEmail || clinic.adminEmail,
        opRevenue: toNumber(source.opRevenue ?? source.OPRevenue ?? source["OP Revenue"] ?? source["op revenue"] ?? clinic.opRevenue),
        diagnosticRevenue: toNumber(source.diagnosticRevenue ?? source.DiagnosticRevenue ?? source["Diagnostic Revenue"] ?? source["diagnostic revenue"] ?? clinic.diagnosticRevenue),
        pharmacyRevenue: toNumber(source.pharmacyRevenue ?? source.PharmacyRevenue ?? source["Pharmacy Revenue"] ?? source["pharmacy revenue"] ?? clinic.pharmacyRevenue),
        cgstAmount: toNumber(source.cgstAmount ?? source.CGSTAmount ?? source["CGST Amount"] ?? source["cgst amount"] ?? source.cgst ?? source.CGST ?? clinic.cgstAmount),
        sgstAmount: toNumber(source.sgstAmount ?? source.SGSTAmount ?? source["SGST Amount"] ?? source["sgst amount"] ?? source.sgst ?? source.SGST ?? clinic.sgstAmount),
        gstAmount: toNumber(source.gstAmount ?? source.GSTAmount ?? source.totalGst ?? source.TotalGst ?? source["Total GST"] ?? source["total GST"] ?? source.GST ?? clinic.gstAmount),
        revenue: toNumber(source.revenue ?? source.Revenue ?? source.totalRevenue ?? source.TotalRevenue ?? source["Total Revenue"] ?? source["total revenue"] ?? clinic.revenue),
      };

      setRows((currentRows) =>
        currentRows.map((row) =>
          String(row.id || row.clinicId || row.hospitalId) === String(hospitalId)
            ? { ...row, ...enrichedClinic }
            : row
        )
      );
    } catch (requestError) {
      setError(requestError.message || "Unable to load clinic revenue.");
    } finally {
      setDetailLoadingId("");
    }
  };

  const columns = [
    {
      key: "serial",
      label: "S.No.",
      width: "46px",
      render: (_item, index) => index + 1,
    },
    {
      key: "adminName",
      label: "Admin",
      width: "minmax(180px, 1fr)",
      render: (clinic) => {
        const adminName = getAdminDisplayName(clinic.adminName);
        return (
          <span className="sa-report-admin">
            <span>{getInitials(adminName)}</span>
            <b>{adminName}</b>
          </span>
        );
      },
    },
    { key: "name", label: "Clinic", width: "minmax(170px, 1fr)" },
    {
      key: "opRevenue",
      label: "OP",
      width: "minmax(110px, 0.7fr)",
      render: (clinic) => formatIndianCurrency(clinic.opRevenue),
    },
    {
      key: "diagnosticRevenue",
      label: "Diagnostic",
      width: "minmax(120px, 0.75fr)",
      render: (clinic) => formatIndianCurrency(clinic.diagnosticRevenue),
    },
    {
      key: "pharmacyRevenue",
      label: "Pharmacy",
      width: "minmax(120px, 0.75fr)",
      render: (clinic) => formatIndianCurrency(clinic.pharmacyRevenue),
    },
    {
      key: "gstAmount",
      label: "GST",
      width: "minmax(110px, 0.7fr)",
      render: (clinic) => formatIndianCurrency(clinic.gstAmount),
    },
    {
      key: "revenue",
      label: "Total Revenue",
      width: "minmax(140px, 0.8fr)",
      render: (clinic) => formatIndianCurrency(clinic.revenue),
    },
    {
      key: "performance",
      label: "Clinic Performance",
      width: "minmax(230px, 1.1fr)",
      cellClassName: "sa-table-cell--performance",
      render: (clinic) => {
        const maxRevenue = Math.max(...rows.map((row) => toNumber(row.revenue)), 1);
        const score = getPerformanceScore(clinic, maxRevenue);
        return (
          <span className="sa-report-performance">
            <i><b style={{ width: `${score}%` }} /></i>
            <strong>{score}%</strong>
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      width: "76px",
      cellClassName: "sa-table-cell--actions",
      render: (clinic) => (
        <button
          className="sa-icon-btn sa-icon-btn--view"
          type="button"
          title={`Refresh ${clinic.name || "clinic"} revenue`}
          disabled={detailLoadingId === String(clinic.hospitalId || clinic.clinicId || clinic.id)}
          onClick={() => handleViewClinicRevenue(clinic)}
        >
          <Eye size={14} />
        </button>
      ),
    },
  ];

  const statusFilters = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((row) => row.status).filter(Boolean)))],
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch = [row.adminName, row.adminEmail, row.name, row.revenue, row.status]
        .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus = status === "All" || row.status === status;
      return matchesSearch && matchesStatus && isInsideDateRange(row, startDate, endDate);
    });
  }, [rows, search, status, startDate, endDate]);

  const filteredChartData = useMemo(
    () => chartData.filter((row) => isInsideDateRange(row, startDate, endDate)),
    [chartData, startDate, endDate]
  );

  const reportSummary = useMemo(() => {
    const clinicCount = backendSummary?.clinicCount || backendSummary?.clinics || filteredRows.length;
    const activeClinicRows = filteredRows.filter((row) => row.status === "Active").length;
    const activeClinics = Math.min(activeClinicRows, clinicCount);
    const totalRevenue = filteredRows.reduce((sum, row) => sum + toNumber(row.revenue), 0);

    return {
      totalRevenue,
      activeClinics,
      clinicCount: filteredRows.length,
    };
  }, [filteredRows, backendSummary]);

  const maxChartRevenue = useMemo(
    () => Math.max(...filteredChartData.map((point) => toNumber(point.revenue)), 1),
    [filteredChartData]
  );

  const maxClinicRevenue = useMemo(
    () => Math.max(...filteredRows.map((row) => toNumber(row.revenue)), 1),
    [filteredRows]
  );

  const avgClinicPerformance = useMemo(() => {
    if (!filteredRows.length) return 0;
    const total = filteredRows.reduce((sum, row) => sum + getPerformanceScore(row, maxClinicRevenue), 0);
    return Math.round(total / filteredRows.length);
  }, [filteredRows, maxClinicRevenue]);

  const clinicBreakdown = useMemo(() => {
    const sorted = [...filteredRows].sort((left, right) => toNumber(right.revenue) - toNumber(left.revenue));
    const topRows = sorted.slice(0, 4);
    const otherRevenue = sorted.slice(4).reduce((sum, row) => sum + toNumber(row.revenue), 0);
    const rowsForChart = otherRevenue > 0
      ? [...topRows, { name: "Others", revenue: otherRevenue }]
      : topRows;
    const total = Math.max(rowsForChart.reduce((sum, row) => sum + toNumber(row.revenue), 0), 1);

    return rowsForChart.map((row, index) => ({
      name: row.name || "Clinic",
      revenue: toNumber(row.revenue),
      color: chartPalette[index % chartPalette.length],
      percent: Math.round((toNumber(row.revenue) / total) * 1000) / 10,
    }));
  }, [filteredRows]);

  const donutGradient = useMemo(() => {
    if (!clinicBreakdown.length) return "#e2e8f0 0 100%";
    let current = 0;
    return clinicBreakdown
      .map((item) => {
        const start = current;
        current += item.percent;
        return `${item.color} ${start}% ${current}%`;
      })
      .join(", ");
  }, [clinicBreakdown]);

  const reportCards = useMemo(
    () => [
      {
        label: "Total Revenue",
        value: formatIndianCurrency(reportSummary.totalRevenue),
        helper: "Across all clinics",
        icon: IndianRupee,
        tone: "mint",
      },
      {
        label: "Avg. Clinic Performance",
        value: `${avgClinicPerformance}%`,
        helper: "Performance Score",
        icon: TrendingUp,
        tone: "violet",
      },
      {
        label: "Total Clinics",
        value: `${reportSummary.clinicCount}`,
        helper: "Active clinics",
        icon: Building2,
        tone: "amber",
      },
    ],
    [avgClinicPerformance, reportSummary]
  );

  const exportRows = useMemo(
    () =>
      filteredRows.map((row) => ({
        Admin: getAdminDisplayName(row.adminName),
        "Admin Email": row.adminEmail || "-",
        Clinic: row.name || "-",
        "OP Revenue": formatIndianCurrency(row.opRevenue),
        "Diagnostic Revenue": formatIndianCurrency(row.diagnosticRevenue),
        "Pharmacy Revenue": formatIndianCurrency(row.pharmacyRevenue),
        CGST: formatIndianCurrency(row.cgstAmount),
        SGST: formatIndianCurrency(row.sgstAmount),
        "Total GST": formatIndianCurrency(row.gstAmount),
        "Total Revenue": formatIndianCurrency(row.revenue),
        Status: row.status || "-",
        Performance: getPerformance(row),
      })),
    [filteredRows]
  );

  const chartRows = useMemo(
    () =>
      filteredChartData.map((point) => ({
        Period: point.name || "-",
        Revenue: formatIndianCurrency(point.revenue),
      })),
    [filteredChartData]
  );

  const summaryRows = useMemo(
    () => [
      { Metric: "Total Revenue", Value: formatIndianCurrency(reportSummary.totalRevenue) },
      { Metric: "OP Revenue", Value: formatIndianCurrency(filteredRows.reduce((sum, row) => sum + toNumber(row.opRevenue), 0)) },
      { Metric: "Diagnostic Revenue", Value: formatIndianCurrency(filteredRows.reduce((sum, row) => sum + toNumber(row.diagnosticRevenue), 0)) },
      { Metric: "Pharmacy Revenue", Value: formatIndianCurrency(filteredRows.reduce((sum, row) => sum + toNumber(row.pharmacyRevenue), 0)) },
      { Metric: "CGST", Value: formatIndianCurrency(filteredRows.reduce((sum, row) => sum + toNumber(row.cgstAmount), 0)) },
      { Metric: "SGST", Value: formatIndianCurrency(filteredRows.reduce((sum, row) => sum + toNumber(row.sgstAmount), 0)) },
      { Metric: "Total GST", Value: formatIndianCurrency(filteredRows.reduce((sum, row) => sum + toNumber(row.gstAmount), 0)) },
      { Metric: "Clinic Count", Value: reportSummary.clinicCount.toLocaleString("en-IN") },
      { Metric: "Date Range", Value: `${startDate || "All"} to ${endDate || "All"}` },
      { Metric: "Filter", Value: status },
      { Metric: "Search", Value: search.trim() || "All records" },
    ],
    [endDate, filteredRows, reportSummary, search, startDate, status]
  );

  const hasReportContent = exportRows.length > 0 || chartRows.length > 0;

  const buildClinicReportHtml = () => {
    const summaryHtml = buildRowsHtml(summaryRows, ["Metric", "Value"]);
    const chartHtml = buildRowsHtml(chartRows, ["Period", "Revenue"]);
    const rowsHtml = buildRowsHtml(exportRows, [
      "Admin",
      "Admin Email",
      "Clinic",
      "OP Revenue",
      "Diagnostic Revenue",
      "Pharmacy Revenue",
      "CGST",
      "SGST",
      "Total GST",
      "Total Revenue",
      "Status",
      "Performance",
    ]);
    const platformLogo = getDefaultClinicLogo("CMS");

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Clinic Reports</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            h2 { margin: 24px 0 10px; font-size: 16px; }
            p { margin: 0 0 14px; color: #475569; }
            .brand { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 12px; text-align: center; }
            .brand img { width: 64px; height: 64px; object-fit: contain; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th, td { border: 1px solid #dbe3ed; padding: 10px; text-align: left; font-size: 12px; }
            th { background: #f1f5f9; }
            .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 18px 0; }
            .metric { border: 1px solid #dbe3ed; padding: 12px; border-radius: 8px; }
            .metric b { display: block; font-size: 16px; }
            .metric span { color: #475569; font-size: 11px; }
            .bars { display: grid; gap: 8px; margin-bottom: 16px; }
            .bar-row { display: grid; grid-template-columns: 90px 1fr 80px; gap: 8px; align-items: center; font-size: 12px; }
            .bar { height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
            .bar i { display: block; height: 100%; background: #0f766e; }
          </style>
        </head>
        <body>
          <div class="brand">
            <img src="${platformLogo}" alt="CMS logo" />
            <div>
              <h1>CMS</h1>
              <p>Clinic Reports</p>
            </div>
          </div>
          <p>Generated ${htmlEscape(formatDateTime(new Date()))}</p>
          <div class="metrics">
            <div class="metric"><b>${formatIndianCurrency(reportSummary.totalRevenue)}</b><span>Total Revenue</span></div>
            <div class="metric"><b>${reportSummary.clinicCount.toLocaleString("en-IN")}</b><span>Clinic Count</span></div>
            <div class="metric"><b>${formatIndianCurrency(filteredRows.reduce((sum, row) => sum + toNumber(row.opRevenue), 0))}</b><span>OP Revenue</span></div>
            <div class="metric"><b>${formatIndianCurrency(filteredRows.reduce((sum, row) => sum + toNumber(row.diagnosticRevenue), 0))}</b><span>Diagnostic Revenue</span></div>
            <div class="metric"><b>${formatIndianCurrency(filteredRows.reduce((sum, row) => sum + toNumber(row.pharmacyRevenue), 0))}</b><span>Pharmacy Revenue</span></div>
            <div class="metric"><b>${formatIndianCurrency(filteredRows.reduce((sum, row) => sum + toNumber(row.gstAmount), 0))}</b><span>Total GST</span></div>
          </div>
          <h3>Summary Metrics</h3>
          <table border="1"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${summaryHtml}</tbody></table>
          <h3>Revenue Analytics</h3>
          <div class="bars">
            ${
              chartRows
                .map((row) => {
                  const maxRevenue = Math.max(...filteredChartData.map((point) => toNumber(point.revenue)), 1);
                  const sourcePoint = filteredChartData.find((point) => point.name === row.Period) || {};
                  const width = Math.max(4, Math.round((toNumber(sourcePoint.revenue) / maxRevenue) * 100));
                  return `<div class="bar-row"><span>${htmlEscape(row.Period)}</span><div class="bar"><i style="width:${width}%"></i></div><strong>${htmlEscape(row.Revenue)}</strong></div>`;
                })
                .join("") || "<p>No chart data found.</p>"
            }
          </div>
          <table border="1"><thead><tr><th>Period</th><th>Revenue</th></tr></thead><tbody>${chartHtml || '<tr><td colspan="2">No chart data found.</td></tr>'}</tbody></table>
          <h3>Clinic Data</h3>
          <table border="1">
            <thead><tr><th>Admin</th><th>Admin Email</th><th>Clinic</th><th>OP Revenue</th><th>Diagnostic Revenue</th><th>Pharmacy Revenue</th><th>CGST</th><th>SGST</th><th>Total GST</th><th>Total Revenue</th><th>Status</th><th>Performance</th></tr></thead>
            <tbody>${rowsHtml || '<tr><td colspan="12">No clinic records found.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `;
  };

  const exportExcel = () => {
    const workbook = buildClinicReportHtml();
    downloadFile("superadmin-reports.xls", workbook, "application/vnd.ms-excel;charset=utf-8");
  };

  const exportPdf = () => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    printWindow.document.write(buildClinicReportHtml());
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <>
      <Header
        title="Clinic Reports"
        subtitle="Clinic revenue, count, and performance reports."
        action={
          <>
            <button className="sa-btn" onClick={exportPdf} disabled={!filteredRows.length}>
              <Download size={16} />
              Export PDF
            </button>
            <button className="sa-btn sa-btn-primary" onClick={exportExcel} disabled={!hasReportContent}>
              <Download size={16} />
              Export Excel
            </button>
          </>
        }
      />

      <SearchFilter
        value={search}
        onChange={setSearch}
        placeholder="Search reports by admin, clinic, revenue, or status..."
        filters={statusFilters}
        selectedFilter={status}
        onFilterChange={setStatus}
      />

      <div className="sa-report-shell">
        <div className="sa-tabs">
          {reportTabs.map((tab) => (
            <button
              className={`sa-tab ${activeTab === tab ? "active" : ""}`}
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="sa-report-filters">
          <div className="sa-form-field">
            <label>Start Date</label>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="sa-form-field">
            <label>End Date</label>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <button className="sa-btn sa-btn-primary" type="button" onClick={handleFetchData} disabled={loading}>
            <Search size={16} />
            {loading ? "Fetching..." : "Fetch Report"}
          </button>
        </div>
      </div>

      {loading ? <div className="sa-state">Loading reports...</div> : null}
      {!loading && error ? <div className="sa-state sa-state--error">{error}</div> : null}
      {!loading && !error ? (
        <>
          <div className="sa-report-card-grid">
            {reportCards.map(({ label, value, helper, icon: Icon, tone }) => (
              <div className="sa-report-metric" key={label}>
                <span className={`sa-report-metric-icon sa-report-metric-icon--${tone}`}>
                  <Icon size={20} />
                </span>
                <div>
                  <p>{label}</p>
                  <h2>{value}</h2>
                  <small>{helper}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="sa-report-chart-grid">
            <section className="sa-report-panel">
              <h3>Revenue Overview</h3>
              <div className="sa-report-bars">
                {filteredChartData.length ? filteredChartData.map((point) => {
                  const height = Math.max(10, Math.round((toNumber(point.revenue) / maxChartRevenue) * 100));
                  return (
                    <div className="sa-report-bar-item" key={point.name}>
                      <span style={{ height: `${height}%` }} title={`${point.name}: ${formatIndianCurrency(point.revenue)}`} />
                      <small>{point.name}</small>
                    </div>
                  );
                }) : <div className="sa-empty">No revenue data found.</div>}
              </div>
              <div className="sa-report-legend">
                <i />
                Revenue
              </div>
            </section>

            <section className="sa-report-panel">
              <h3>Revenue by Clinic</h3>
              <div className="sa-report-donut-wrap">
                <div className="sa-report-donut" style={{ background: `conic-gradient(${donutGradient})` }}>
                  <span />
                </div>
                <div className="sa-report-donut-list">
                  {clinicBreakdown.map((item) => (
                    <div key={item.name}>
                      <span><i style={{ background: item.color }} />{item.name}</span>
                      <b>{formatIndianCurrency(item.revenue)} ({item.percent}%)</b>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="sa-report-table-wrap">
            <DataTable
              className="sa-table--report"
              columns={columns}
              rows={filteredRows.slice(0, 10)}
              loading={false}
              error=""
              preserveColumnFractions
              emptyMessage="No clinic report records found."
            />
            <div className="sa-table-footer">
              <div className="sa-table-summary">
                Showing {Math.min(filteredRows.length, 10)} of {filteredRows.length} records
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

export default Reports;
