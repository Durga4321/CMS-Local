import React, { useEffect, useMemo, useState } from "react";
import DatePickerField from "../../../components/DatePickerField";
import {
  FileText,
  LogIn,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
} from "lucide-react";
import Header from "../../../components/superadmin/Header";
import DataTable from "../../../components/superadmin/DataTable";
import SearchFilter from "../../../components/superadmin/SearchFilter";
import { fetchAuditLogs, fetchLoginHistory } from "../../SUPERADMIN/superAdminApi";

const views = [
  { key: "all", label: "All Audit Logs" },
  { key: "login", label: "Login History" },
];

const normalizeRole = (value = "") => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim()) || "";
const getAuditRole = (row = {}) => normalizeRole(firstValue(row.role, row.userRole, row.raw?.role, row.raw?.Role, row.raw?.userRole, row.raw?.UserRole));

const toDateInputValue = (date) => {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().slice(0, 10);
};

const getDefaultStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return toDateInputValue(date);
};

const getInitials = (value = "") => {
  const parts = String(value || "User").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || "U").toUpperCase();
};

const getRoleTone = (role = "") => {
  const normalized = String(role).trim().toLowerCase();
  if (normalized.includes("doctor")) return "doctor";
  if (normalized.includes("reception")) return "receptionist";
  if (normalized.includes("admin")) return "admin";
  return "patient";
};

const getActionTone = (action = "") => {
  const normalized = String(action).trim().toLowerCase();
  if (normalized.includes("logout") || normalized.includes("signed out")) return "logout";
  if (normalized.includes("login") || normalized.includes("signed in")) return "login";
  if (normalized.includes("update") || normalized.includes("edit")) return "update";
  if (normalized.includes("delete") || normalized.includes("remove")) return "delete";
  if (normalized.includes("create") || normalized.includes("add")) return "create";
  return "login";
};

const getActionLabel = (row = {}) => {
  const value = String(row.action || row.systemAction || row.module || "").toLowerCase();
  if (row.isLogoutActivity || value.includes("logout") || value.includes("signed out")) return "Logout";
  if (row.isLoginActivity || value.includes("login") || value.includes("signed in")) return "Login";
  return row.action || row.systemAction || "Activity";
};

const roleIcons = {
  admin: ShieldCheck,
  doctor: Stethoscope,
  receptionist: UsersRound,
  patient: UserRound,
};

const getRowDateValue = (row = {}) =>
  row.timestampRaw || row.createdAt || row.loginTime || row.logoutTime || row.timestamp || row.raw?.timestamp || row.raw?.createdAt || "";

const parseAuditDate = (value) => {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  const text = String(value).trim();
  const isIsoDateTime = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(text);
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  return new Date(isIsoDateTime && !hasTimezone ? text + "Z" : text);
};

const formatDateTime = (value) => {
  const date = parseAuditDate(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
};

const isWithinDateRange = (row, startDate, endDate) => {
  const value = getRowDateValue(row);
  if (!value) return true;
  const date = parseAuditDate(value);
  if (Number.isNaN(date.getTime())) return true;
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
  return (!start || date >= start) && (!end || date <= end);
};

const isDataChangeLog = (row = {}) => {
  const action = String(getActionLabel(row)).toLowerCase();
  return ["create", "add", "update", "edit", "delete", "remove"].some((item) => action.includes(item));
};

function AdminAuditLogs() {
  const [rows, setRows] = useState([]);
  const [view, setView] = useState("all");
  const [summaryFilter, setSummaryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [systemAction, setSystemAction] = useState("All");
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(toDateInputValue(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadLogs = async () => {
    setLoading(true);
    setError("");
    const [auditResult, loginResult] = await Promise.allSettled([fetchAuditLogs(), fetchLoginHistory()]);
    const combined = [...(auditResult.value || []), ...(loginResult.value || [])];
    setRows(combined.filter((row) => getAuditRole(row) !== "superadmin"));
    setError(auditResult.reason?.message || loginResult.reason?.message || "");
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const actionFilters = useMemo(() => ["All", ...Array.from(new Set(rows.map(getActionLabel).filter(Boolean)))], [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const action = getActionLabel(row);
      const isLogin = Boolean(row.isLoginActivity || action === "Login");
      const matchesView = view === "all" || isLogin;
      const matchesSearch = [row.userName, row.user, row.email, row.userEmail, row.role, row.userRole, action, row.module, row.ipAddress, row.timestamp]
        .some((value) => String(value || "").toLowerCase().includes(query));
      const matchesAction = systemAction === "All" || action === systemAction;
      const matchesSummary = summaryFilter === "login" ? isLogin : summaryFilter === "changes" ? isDataChangeLog(row) : true;
      return matchesView && matchesSearch && matchesAction && matchesSummary && isWithinDateRange(row, startDate, endDate);
    });
  }, [endDate, rows, search, startDate, summaryFilter, systemAction, view]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, systemAction, view, startDate, endDate, summaryFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const loginCount = filteredRows.filter((row) => row.isLoginActivity || getActionLabel(row) === "Login").length;
  const dataChangeCount = filteredRows.filter(isDataChangeLog).length;

  const summaryCards = [
    { key: "all", label: "Total Logs", value: rows.length, helper: "All clinic records", icon: FileText, tone: "total" },
    { key: "login", label: "Login Activities", value: rows.filter((row) => row.isLoginActivity || getActionLabel(row) === "Login").length, helper: "Showing below", icon: LogIn, tone: "login" },
    { key: "changes", label: "Data Changes", value: rows.filter(isDataChangeLog).length, helper: "This period", icon: PencilLine, tone: "changes" },
  ];

  const columns = [
    { key: "serial", label: "S.No.", width: "64px", align: "center", render: (_row, index) => (currentPage - 1) * pageSize + index + 1 },
    {
      key: "userName",
      label: "User",
      width: "minmax(160px, 1fr)",
      render: (row) => {
        const name = row.userName || row.user || row.name || row.email || "User";
        const tone = getRoleTone(row.role || row.userRole);
        return <span className="sa-audit-user"><span className={`sa-audit-avatar sa-audit-avatar--${tone}`}>{getInitials(name)}</span><b>{name}</b></span>;
      },
    },
    { key: "email", label: "Email Address", width: "minmax(180px, 1fr)", render: (row) => row.email || row.userEmail || "-" },
    { key: "action", label: "Action", width: "120px", align: "center", render: (row) => <span className={`sa-audit-pill sa-audit-pill--${getActionTone(getActionLabel(row))}`}>{getActionLabel(row)}</span> },
    { key: "ipAddress", label: "IP Address", width: "120px", render: (row) => row.ipAddress || row.raw?.ipAddress || "-" },
    { key: "login", label: "Login", width: "90px", align: "center", render: (row) => <span className={`sa-audit-login ${row.isLoginActivity || getActionLabel(row) === "Login" ? "is-yes" : "is-no"}`}>{row.isLoginActivity || getActionLabel(row) === "Login" ? "Yes" : "No"}</span> },
    { key: "timestamp", label: "Timestamp", width: "170px", render: (row) => formatDateTime(getRowDateValue(row)) },
    {
      key: "role",
      label: "Role",
      width: "130px",
      align: "center",
      render: (row) => {
        const role = row.role || row.userRole || row.raw?.role || "Staff";
        const tone = getRoleTone(role);
        const RoleIcon = roleIcons[tone] || UserRound;
        return <span className={`sa-audit-role sa-audit-role--${tone}`}><RoleIcon size={11} />{role}</span>;
      },
    },
  ];

  return (
    <div className="sa-audit-logs-page">
      <Header
        title="Audit Logs"
        subtitle="Clinic audit records, login activity, IP address, and timestamps. Super Admin activity is excluded."
        action={<button type="button" className="sa-btn" onClick={loadLogs} disabled={loading}><RefreshCw size={16} />Refresh</button>}
      />

      <div className="sa-audit-summary-grid">
        {summaryCards.map(({ key, label, value, helper, icon: Icon, tone }) => (
          <button type="button" key={key} className={`sa-audit-summary-card ${summaryFilter === key ? "is-active" : ""}`} onClick={() => setSummaryFilter(key)}>
            <span className={`sa-audit-summary-icon sa-audit-summary-icon--${tone}`}><Icon size={24} /></span>
            <span><b>{label}</b><strong>{value}</strong><small>{helper}</small></span>
          </button>
        ))}
      </div>

      <div className="sa-tabs" role="tablist" aria-label="Audit log views">
        {views.map((item) => (
          <button className={`sa-tab${view === item.key ? " active" : ""}`} key={item.key} type="button" role="tab" aria-selected={view === item.key} onClick={() => setView(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      <SearchFilter value={search} onChange={setSearch} placeholder="Search by user name, action, IP address, or timestamp..." filters={actionFilters} selectedFilter={systemAction} onFilterChange={setSystemAction} />

      <div className="sa-audit-scope-filter">
        <label><span>Start Date</span><DatePickerField value={startDate} onChange={setStartDate} /></label>
        <label><span>End Date</span><DatePickerField value={endDate} onChange={setEndDate} /></label>
        <label><span>Clinic</span><select value="current" disabled><option>Current Admin Clinic</option></select></label>
        <label><span>Branch</span><select value="all" disabled><option>All Branches</option></select></label>
      </div>

      <DataTable className="sa-table--audit" columns={columns} rows={pagedRows} loading={loading} error={error} emptyMessage="No admin audit logs found." preserveColumnFractions />
      <div className="sa-table-footer">
        <div className="sa-table-summary">Showing {pagedRows.length} of {filteredRows.length} records ({loginCount} login, {dataChangeCount} changes)</div>
        <div className="sa-pagination">
          <button type="button" className="sa-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</button>
          <button type="button" className="sa-btn" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Prev</button>
          <span className="sa-pagination-label">Page {currentPage} of {pageCount}</span>
          <button type="button" className="sa-btn" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount}>Next</button>
          <button type="button" className="sa-btn" onClick={() => setCurrentPage(pageCount)} disabled={currentPage === pageCount}>Last</button>
        </div>
      </div>
    </div>
  );
}

export default AdminAuditLogs;
