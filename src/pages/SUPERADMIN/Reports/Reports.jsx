import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, IndianRupee, Search, Users } from "lucide-react";
import Header from "../../../components/superadmin/Header";
import Charts from "../../../components/superadmin/Charts";
import DashboardCards from "../../../components/superadmin/DashboardCards";
import DataTable from "../../../components/superadmin/DataTable";
import SearchFilter from "../../../components/superadmin/SearchFilter";
import { fetchReports } from "../superAdminApi";
import { formatIndianCurrency } from "../../../utils/format";

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
const toNumber = (value) => Number(value || 0);
const getPerformance = (row) => (row.status === "Active" ? "Healthy" : "Needs Review");
const reportTabs = ["Reports Dashboard", "Revenue Report", "User Activity"];

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

const buildRowsHtml = (rows, columns) =>
  rows
    .map(
      (row) => `
      <tr>${columns.map((column) => `<td>${htmlEscape(row[column] ?? "-")}</td>`).join("")}</tr>
    `
    )
    .join("");

function Reports() {
  const [rows, setRows] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [activityRows, setActivityRows] = useState([]);
  const [activeTab, setActiveTab] = useState(reportTabs[0]);
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
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
        setActivityRows(reports.activityRows || []);
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

    setLoading(true);
    setError("");

    try {
      const reports = await fetchReports();
      setRows(reports.rows);
      setChartData(reports.chartData);
      setActivityRows(reports.activityRows || []);
      setError(reports.error);
    } catch (requestError) {
      setError(requestError.message || "Unable to fetch report data.");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      key: "serial",
      label: "S.No.",
      width: "minmax(60px, 0.4fr)",
      render: (_item, index) => index + 1,
    },
    { key: "adminName", label: "Admin" },
    { key: "name", label: "Clinic" },
    {
      key: "revenue",
      label: "Total Revenue",
      render: (clinic) => formatIndianCurrency(clinic.revenue),
    },
    {
      key: "users",
      label: "Users",
      render: (clinic) =>
        clinic.users !== undefined && clinic.users !== null && clinic.users !== ""
          ? Number(clinic.users).toLocaleString("en-IN")
          : "-",
    },
    {
      key: "performance",
      label: "Clinic Performance",
      render: (clinic) => (clinic.status === "Active" ? "Healthy" : "Needs Review"),
    },
  ];

  const statusFilters = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((row) => row.status).filter(Boolean)))],
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch = [row.adminName, row.adminEmail, row.name, row.revenue, row.users, row.status]
        .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus = status === "All" || row.status === status;
      return matchesSearch && matchesStatus && isInsideDateRange(row, startDate, endDate);
    });
  }, [rows, search, status, startDate, endDate]);

  const filteredChartData = useMemo(
    () => chartData.filter((row) => isInsideDateRange(row, startDate, endDate)),
    [chartData, startDate, endDate]
  );

  const filteredActivityRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activityRows.filter((row) => {
      const matchesSearch = [row.title, row.detail, row.time]
        .some((value) => String(value).toLowerCase().includes(query));
      return matchesSearch && isInsideDateRange(row, startDate, endDate);
    });
  }, [activityRows, search, startDate, endDate]);

  const reportSummary = useMemo(() => {
    const revenueRows = filteredRows.filter((row) => toNumber(row.revenue) > 0);
    const userRows = revenueRows.length ? revenueRows : filteredRows;
    const totalRevenue = filteredRows.reduce((sum, row) => sum + toNumber(row.revenue), 0);
    const userCount = userRows.reduce((sum, row) => sum + toNumber(row.users), 0);
    const activeClinics = filteredRows.filter((row) => row.status === "Active").length;

    return {
      totalRevenue,
      userCount,
      activeClinics,
      clinicCount: filteredRows.length,
    };
  }, [filteredRows]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Revenue",
        value: formatIndianCurrency(reportSummary.totalRevenue),
        icon: IndianRupee,
        tone: "teal",
      },
      {
        label: "Users",
        value: reportSummary.userCount.toLocaleString("en-IN"),
        icon: Users,
        tone: "amber",
      },
      {
        label: "Active Clinics",
        value: `${reportSummary.activeClinics}/${reportSummary.clinicCount}`,
        icon: BarChart3,
        tone: "green",
      },
    ],
    [reportSummary]
  );

  const exportRows = useMemo(
    () =>
      filteredRows.map((row) => ({
        Admin: row.adminName || "-",
        "Admin Email": row.adminEmail || "-",
        Clinic: row.name || "-",
        Revenue: formatIndianCurrency(row.revenue),
        Users: row.users || 0,
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
        Users: point.users || 0,
      })),
    [filteredChartData]
  );

  const summaryRows = useMemo(
    () => [
      { Metric: "Total Revenue", Value: formatIndianCurrency(reportSummary.totalRevenue) },
      { Metric: "Users", Value: reportSummary.userCount.toLocaleString("en-IN") },
      { Metric: "Active Clinics", Value: `${reportSummary.activeClinics}/${reportSummary.clinicCount}` },
      { Metric: "Date Range", Value: `${startDate || "All"} to ${endDate || "All"}` },
      { Metric: "Filter", Value: status },
      { Metric: "Search", Value: search.trim() || "All records" },
    ],
    [endDate, reportSummary, search, startDate, status]
  );

  const hasReportContent = exportRows.length > 0 || chartRows.length > 0;

  const exportExcel = () => {
    const summaryHtml = buildRowsHtml(summaryRows, ["Metric", "Value"]);
    const chartHtml = buildRowsHtml(chartRows, ["Period", "Revenue", "Users"]);
    const detailHtml = buildRowsHtml(exportRows, [
      "Admin",
      "Admin Email",
      "Clinic",
      "Revenue",
      "Users",
      "Status",
      "Performance",
    ]);
    const workbook = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <h2>Super Admin Reports</h2>
          <p>Generated ${htmlEscape(new Date().toLocaleString("en-IN"))}</p>
          <h3>Summary Metrics</h3>
          <table border="1"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${summaryHtml}</tbody></table>
          <h3>Usage Analytics</h3>
          <table border="1"><thead><tr><th>Period</th><th>Revenue</th><th>Users</th></tr></thead><tbody>${chartHtml || '<tr><td colspan="3">No chart data found.</td></tr>'}</tbody></table>
          <h3>Filtered Report Data</h3>
          <table border="1">
            <thead><tr><th>Admin</th><th>Admin Email</th><th>Clinic</th><th>Revenue</th><th>Users</th><th>Status</th><th>Performance</th></tr></thead>
            <tbody>${detailHtml || '<tr><td colspan="7">No report records found.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `;
    downloadFile("superadmin-reports.xls", workbook, "application/vnd.ms-excel;charset=utf-8");
  };

  const exportPdf = () => {
    const summaryHtml = buildRowsHtml(summaryRows, ["Metric", "Value"]);
    const chartHtml = buildRowsHtml(chartRows, ["Period", "Revenue", "Users"]);
    const rowsHtml = buildRowsHtml(exportRows, [
      "Admin",
      "Admin Email",
      "Clinic",
      "Revenue",
      "Users",
      "Status",
      "Performance",
    ]);
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Super Admin Reports</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            h2 { margin: 24px 0 10px; font-size: 16px; }
            p { margin: 0 0 14px; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th, td { border: 1px solid #dbe3ed; padding: 10px; text-align: left; font-size: 12px; }
            th { background: #f1f5f9; }
            .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 18px 0; }
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
          <h1>Super Admin Reports</h1>
          <p>Generated ${new Date().toLocaleString("en-IN")}</p>
          <div class="metrics">
            <div class="metric"><b>${formatIndianCurrency(reportSummary.totalRevenue)}</b><span>Total Revenue</span></div>
            <div class="metric"><b>${reportSummary.userCount.toLocaleString("en-IN")}</b><span>Users</span></div>
            <div class="metric"><b>${reportSummary.activeClinics}/${reportSummary.clinicCount}</b><span>Active Clinics</span></div>
          </div>
          <h2>Summary Metrics</h2>
          <table>
            <thead><tr><th>Metric</th><th>Value</th></tr></thead>
            <tbody>${summaryHtml}</tbody>
          </table>
          <h2>Usage Analytics</h2>
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
          <table>
            <thead><tr><th>Period</th><th>Revenue</th><th>Users</th></tr></thead>
            <tbody>${chartHtml || '<tr><td colspan="3">No chart data found.</td></tr>'}</tbody>
          </table>
          <h2>Filtered Report Data</h2>
          <table>
            <thead>
              <tr>
                <th>Admin</th>
                <th>Email</th>
                <th>Clinic</th>
                <th>Revenue</th>
                <th>Users</th>
                <th>Status</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>${rowsHtml || '<tr><td colspan="7">No report records found.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <>
      <Header
        title="Reports"
        subtitle="Admin-wise clinic revenue, user activity, and performance reports."
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
        placeholder="Search reports by admin, clinic, revenue, users, or status..."
        filters={statusFilters}
        selectedFilter={status}
        onFilterChange={setStatus}
      />

      <div className="sa-panel" style={{ marginBottom: 16 }}>
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
        <div className="sa-form-grid" style={{ marginTop: 14 }}>
          <div className="sa-form-field">
            <label>Start Date</label>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="sa-form-field">
            <label>End Date</label>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
        </div>
        <div className="sa-page-actions" style={{ marginTop: 14 }}>
          <button className="sa-btn sa-btn-primary" type="button" onClick={handleFetchData} disabled={loading}>
            <Search size={16} />
            {loading ? "Fetching..." : "Fetch Data"}
          </button>
        </div>
      </div>

      <div className="sa-panel">
        <h3>{activeTab}</h3>
        <p>
          {activeTab === "Revenue Report"
            ? "Date-filtered revenue chart and table."
            : activeTab === "User Activity"
              ? "Recent platform user and admin activity."
              : "Platform revenue, users, and active clinic summary."}
        </p>
        {loading ? <div className="sa-state">Loading reports...</div> : null}
        {!loading && error ? <div className="sa-state sa-state--error">{error}</div> : null}
        {!loading && !error ? (
          <>
            <DashboardCards cards={summaryCards} />
            {activeTab !== "User Activity" ? (
              <Charts data={filteredChartData} type="bar" dataKey="revenue" />
            ) : (
              <div className="sa-activity-list">
                {filteredActivityRows.length ? filteredActivityRows.map((activity) => (
                  <div className="sa-activity-item" key={activity.id}>
                    <div>
                      <b>{activity.title}</b>
                      <p>{activity.detail}</p>
                    </div>
                    <span>{activity.time}</span>
                  </div>
                )) : <div className="sa-state">No user activity found for this date range.</div>}
              </div>
            )}
          </>
        ) : null}
      </div>

      {activeTab !== "User Activity" ? (
        <div style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          rows={filteredRows}
          loading={loading}
          error={error}
          emptyMessage="No report records found."
        />
        </div>
      ) : null}
    </>
  );
}

export default Reports;
