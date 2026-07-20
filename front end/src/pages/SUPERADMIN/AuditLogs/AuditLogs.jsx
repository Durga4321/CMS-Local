import React, { useCallback, useEffect, useMemo, useState } from "react";
import Header from "../../../components/superadmin/Header";
import DataTable from "../../../components/superadmin/DataTable";
import SearchFilter from "../../../components/superadmin/SearchFilter";
import { fetchAuditLogs, fetchLoginHistory } from "../superAdminApi";

const views = [
  { key: "all", label: "All Audit Logs" },
  { key: "login", label: "Login History" },
];

function AuditLogs() {
  const [search, setSearch] = useState("");
  const [systemAction, setSystemAction] = useState("All");
  const [view, setView] = useState("login");
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLogs = useCallback(async (active = true) => {
    setLoading(true);
    setError("");

    try {
      const logs = view === "login" ? await fetchLoginHistory() : await fetchAuditLogs();
      if (active) setAuditLogs(logs);
    } catch (requestError) {
      if (active) setError(requestError.message || "Unable to load audit logs.");
    } finally {
      if (active) setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    let active = true;
    loadLogs(active);

    return () => {
      active = false;
    };
  }, [loadLogs]);

  const systemActions = useMemo(
    () => ["All", ...Array.from(new Set(auditLogs.map((log) => log.systemAction || log.module).filter(Boolean)))],
    [auditLogs]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const matchesSearch = [
        log.userName,
        log.user,
        log.userEmail,
        log.email,
        log.action,
        log.systemAction,
        log.ipAddress,
        log.timestamp,
        log.role,
      ]
        .some((value) => String(value).toLowerCase().includes(query));
      const matchesSystemAction = systemAction === "All" || (log.systemAction || log.module) === systemAction;
      return matchesSearch && matchesSystemAction;
    });
  }, [auditLogs, search, systemAction]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, systemAction, view, auditLogs]);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage]);

  const columns = [
    {
      key: "serial",
      label: "S.No.",
      width: "minmax(52px, 0.25fr)",
      render: (_log, index) => index + 1,
    },
    {
      key: "userName",
      label: "User",
      width: "minmax(120px, 0.7fr)",
      render: (row) => row.userName || row.user || row.action || "-",
    },
    {
      key: "email",
      label: "Email Address",
      width: "minmax(260px, 1.1fr)",
      cellClassName: "sa-table-cell--nowrap",
      render: (row) => (
        <span title={row.email || row.userEmail || ""} className="sa-table-text-overflow">
          {row.email || row.userEmail || "-"}
        </span>
      ),
    },
    { key: "action", label: "Action", width: "minmax(180px, 1.2fr)" },
    { key: "systemAction", label: "System Action", width: "minmax(120px, 0.75fr)" },
    { key: "ipAddress", label: "IP Address", width: "minmax(112px, 0.75fr)" },
    {
      key: "isLoginActivity",
      label: "Login",
      width: "minmax(58px, 0.35fr)",
      render: (row) => (row.isLoginActivity ? "Yes" : "No"),
    },
    { key: "timestamp", label: "Timestamp", width: "minmax(138px, 0.9fr)" },
    { key: "role", label: "Role", width: "minmax(105px, 0.75fr)" },
  ];

  return (
    <>
      <Header
        title="Audit Logs"
        subtitle="Trace backend audit records, login activity, IP address, and timestamps."
        action={
          <button className="sa-btn" type="button" onClick={() => loadLogs()} disabled={loading}>
            Refresh
          </button>
        }
      />
      <div className="sa-tabs" role="tablist" aria-label="Audit log views">
        {views.map((item) => (
          <button
            className={`sa-tab${view === item.key ? " active" : ""}`}
            key={item.key}
            type="button"
            role="tab"
            aria-selected={view === item.key}
            onClick={() => {
              setView(item.key);
              setSystemAction("All");
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <SearchFilter
        value={search}
        onChange={setSearch}
        placeholder="Search by user name, action, IP address, or timestamp..."
        filters={systemActions}
        selectedFilter={systemAction}
        onFilterChange={setSystemAction}
      />
      <DataTable
        columns={columns}
        rows={pagedRows}
        loading={loading}
        error={error}
        rowIndexOffset={(currentPage - 1) * pageSize}
        emptyMessage={view === "login" ? "No login history found from the backend." : "No audit logs match your filters."}
      />

      <div className="sa-table-footer">
        <div className="sa-table-summary">
          Showing {pagedRows.length} of {filteredRows.length} records
        </div>
        <div className="sa-pagination">
          <button
            type="button"
            className="sa-btn"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            First
          </button>
          <button
            type="button"
            className="sa-btn"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </button>
          <span className="sa-pagination-label">
            Page {currentPage} of {pageCount}
          </span>
          <button
            type="button"
            className="sa-btn"
            onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
            disabled={currentPage === pageCount}
          >
            Next
          </button>
          <button
            type="button"
            className="sa-btn"
            onClick={() => setCurrentPage(pageCount)}
            disabled={currentPage === pageCount}
          >
            Last
          </button>
        </div>
      </div>
    </>
  );
}

export default AuditLogs;
