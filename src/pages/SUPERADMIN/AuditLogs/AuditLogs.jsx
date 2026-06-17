import React, { useEffect, useMemo, useState } from "react";
import Header from "../../../components/superadmin/Header";
import DataTable from "../../../components/superadmin/DataTable";
import SearchFilter from "../../../components/superadmin/SearchFilter";
import { fetchAuditLogs } from "../superAdminApi";

function AuditLogs() {
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("All");
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadLogs = async () => {
      setLoading(true);
      setError("");

      try {
        const logs = await fetchAuditLogs();
        if (active) setAuditLogs(logs);
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load audit logs.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadLogs();

    return () => {
      active = false;
    };
  }, []);

  const modules = useMemo(
    () => ["All", ...Array.from(new Set(auditLogs.map((log) => log.module).filter(Boolean)))],
    [auditLogs]
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const matchesSearch = [log.user, log.action, log.timestamp, log.module, log.role, log.ipAddress]
        .some((value) => String(value).toLowerCase().includes(query));
      const matchesModule = module === "All" || log.module === module;
      return matchesSearch && matchesModule;
    });
  }, [auditLogs, search, module]);

  const columns = [
    { key: "user", label: "User", width: "minmax(220px, 1.2fr)", cellClassName: "sa-table-cell--nowrap" },
    { key: "action", label: "Action", width: "minmax(240px, 1.6fr)" },
    { key: "timestamp", label: "Timestamp", width: "minmax(170px, 1fr)" },
    { key: "module", label: "Module" },
    { key: "role", label: "Role" },
    { key: "ipAddress", label: "IP Address" },
  ];

  return (
    <>
      <Header title="Audit Logs" subtitle="Track user, action, and timestamp records." />
      <SearchFilter
        value={search}
        onChange={setSearch}
        placeholder="Search audit logs by user, action, or timestamp..."
        filters={modules}
        selectedFilter={module}
        onFilterChange={setModule}
      />
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        emptyMessage="No audit logs match your filters."
      />
    </>
  );
}

export default AuditLogs;
