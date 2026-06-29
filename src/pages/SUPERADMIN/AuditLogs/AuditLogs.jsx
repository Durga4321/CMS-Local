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

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const matchesSearch = [
        log.userName,
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

  const columns = [
    { key: "userName", label: "User Name", width: "minmax(170px, 1.25fr)" },
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
        rows={rows}
        loading={loading}
        error={error}
        emptyMessage={view === "login" ? "No login history found from the backend." : "No audit logs match your filters."}
      />
    </>
  );
}

export default AuditLogs;
