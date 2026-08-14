import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  LogIn,
  PencilLine,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
} from "lucide-react";
import Header from "../../../components/superadmin/Header";
import DataTable from "../../../components/superadmin/DataTable";
import SearchFilter from "../../../components/superadmin/SearchFilter";
import {
  fetchAuditLogs,
  fetchClinics,
  fetchLoginHistory,
} from "../superAdminApi";
import {
  buildBranchOptions,
  fetchBranchesForHospital,
  getStoredHospitalId,
} from "../../../utils/branchApi";
import { getStoredClinicName } from "../../../utils/clinicDisplay";

const views = [
  { key: "all", label: "All Audit Logs" },
  { key: "login", label: "Login History" },
];

const getInitials = (value = "") => {
  const parts = String(value || "User").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || "U").toUpperCase();
};

const getRoleTone = (role = "") => {
  const normalized = String(role).trim().toLowerCase();
  if (normalized.includes("doctor")) return "doctor";
  if (normalized.includes("reception")) return "receptionist";
  if (normalized.includes("super") && normalized.includes("admin")) return "superadmin";
  if (normalized.includes("admin")) return "admin";
  return "patient";
};

const getActionTone = (action = "") => {
  const normalized = String(action).trim().toLowerCase();
  if (normalized.includes("logout") || normalized.includes("logged out") || normalized.includes("signed out")) return "logout";
  if (normalized.includes("login") || normalized.includes("logged in") || normalized.includes("signed in")) return "login";
  if (normalized.includes("update") || normalized.includes("edit")) return "update";
  if (normalized.includes("delete") || normalized.includes("remove")) return "delete";
  if (normalized.includes("create") || normalized.includes("add")) return "create";
  return "login";
};

const getActionLabel = (row = {}) => {
  const value = String(row.action || row.systemAction || row.module || "").toLowerCase();
  if (row.isLogoutActivity || value.includes("logout") || value.includes("logged out") || value.includes("signed out")) return "Logout";
  if (row.isLoginActivity || value.includes("login") || value.includes("logged in") || value.includes("signed in")) return "Login";
  return row.action || "-";
};

const roleIcons = {
  admin: ShieldCheck,
  superadmin: ShieldCheck,
  doctor: Stethoscope,
  receptionist: UsersRound,
  patient: UserRound,
};

const normalizeKey = (value = "") => String(value || "").trim().toLowerCase();
const UNASSIGNED_BRANCH_KEYS = new Set(["unassigned", "unassigned branch", "no branch", "n/a", "na", "-"]);

const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return "";
};

const getNestedText = (source = {}, paths = []) => {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => current?.[key], source);
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return "";
};

const getRowClinicKey = (row = {}) =>
  normalizeKey(firstValue(
    row.clinicId,
    row.hospitalId,
    row.assignedClinicId,
    row.raw?.clinicId,
    row.raw?.ClinicId,
    row.raw?.clinicID,
    row.raw?.ClinicID,
    row.raw?.hospitalId,
    row.raw?.HospitalId,
    row.raw?.hospitalID,
    row.raw?.HospitalID,
    row.raw?.assignedClinicId,
    row.raw?.AssignedClinicId,
    getNestedText(row.raw, ["clinic.id", "clinic.clinicId", "clinic.hospitalId", "hospital.id", "hospital.hospitalId"])
  ));

const getRowClinicName = (row = {}) =>
  normalizeKey(firstValue(
    row.clinicName,
    row.hospitalName,
    row.assignedClinic,
    row.clinic,
    row.raw?.clinicName,
    row.raw?.ClinicName,
    row.raw?.hospitalName,
    row.raw?.HospitalName,
    row.raw?.assignedClinic,
    row.raw?.AssignedClinic,
    row.raw?.clinic,
    row.raw?.Clinic,
    getNestedText(row.raw, ["clinic.name", "clinic.clinicName", "clinic.hospitalName", "hospital.name", "hospital.hospitalName"])
  ));

const getRowBranchKey = (row = {}) =>
  normalizeKey(firstValue(
    row.branchId,
    row.raw?.branchId,
    row.raw?.BranchId,
    row.raw?.branchID,
    row.raw?.BranchID,
    getNestedText(row.raw, ["branch.id", "branch.branchId"])
  ));

const getRowBranchName = (row = {}) =>
  normalizeKey(firstValue(
    row.branchName,
    row.branch,
    row.raw?.branchName,
    row.raw?.BranchName,
    row.raw?.branch,
    row.raw?.Branch,
    getNestedText(row.raw, ["branch.name", "branch.branchName"])
  ));

const getClinicNameCandidates = (clinic = {}) =>
  [
    clinic.name,
    clinic.clinicName,
    clinic.hospitalName,
    clinic.raw?.name,
    clinic.raw?.Name,
    clinic.raw?.clinicName,
    clinic.raw?.ClinicName,
    clinic.raw?.hospitalName,
    clinic.raw?.HospitalName,
  ]
    .map(normalizeKey)
    .filter(Boolean);

const getBranchIdCandidates = (branch = {}) =>
  [
    branch.id,
    branch.branchId,
    branch.raw?.id,
    branch.raw?.Id,
    branch.raw?.branchId,
    branch.raw?.BranchId,
    branch.raw?.branchID,
    branch.raw?.BranchID,
  ]
    .map(normalizeKey)
    .filter(Boolean);

const getBranchNameCandidates = (branch = {}) =>
  [
    branch.name,
    branch.branchName,
    branch.raw?.name,
    branch.raw?.Name,
    branch.raw?.branchName,
    branch.raw?.BranchName,
  ]
    .map(normalizeKey)
    .filter(Boolean);

const matchesClinic = (row = {}, clinic = null) => {
  if (!clinic) return true;
  const clinicIds = getClinicIdCandidates(clinic).map(normalizeKey);
  const clinicNames = getClinicNameCandidates(clinic);
  const rowClinicKey = getRowClinicKey(row);
  const rowClinicName = getRowClinicName(row);
  return (
    (rowClinicKey && clinicIds.includes(rowClinicKey)) ||
    (rowClinicName && clinicNames.includes(rowClinicName))
  );
};

const matchesBranch = (row = {}, branch = null) => {
  if (!branch) return true;
  const branchIds = getBranchIdCandidates(branch);
  const branchNames = getBranchNameCandidates(branch);
  const rowBranchKey = getRowBranchKey(row);
  const rowBranchName = getRowBranchName(row);
  return (
    (rowBranchKey && branchIds.includes(rowBranchKey)) ||
    (rowBranchName && branchNames.includes(rowBranchName))
  );
};

const getClinicIdCandidates = (clinic = {}) =>
  Array.from(
    new Set(
      [
        clinic.id,
        clinic.clinicId,
        clinic.hospitalId,
        clinic.raw?.id,
        clinic.raw?.Id,
        clinic.raw?.clinicId,
        clinic.raw?.ClinicId,
        clinic.raw?.clinicID,
        clinic.raw?.hospitalId,
        clinic.raw?.HospitalId,
        clinic.raw?.hospitalID,
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

const getBranchClinicKey = (branch = {}) =>
  normalizeKey(firstValue(
    branch.hospitalId,
    branch.clinicId,
    branch.raw?.hospitalId,
    branch.raw?.HospitalId,
    branch.raw?.hospitalID,
    branch.raw?.HospitalID,
    branch.raw?.clinicId,
    branch.raw?.ClinicId,
    branch.raw?.clinicID,
    branch.raw?.ClinicID
  ));

const filterBranchOptionsForClinic = (options = [], clinic = {}) => {
  const clinicIds = getClinicIdCandidates(clinic).map(normalizeKey);
  if (!clinicIds.length) return options;

  const related = options.filter((branch) => {
    const branchClinicKey = getBranchClinicKey(branch);
    return branchClinicKey && clinicIds.includes(branchClinicKey);
  });

  return related;
};

const mergeBranchOptions = (...optionGroups) => {
  const seen = new Set();
  const merged = [];

  optionGroups.flat().forEach((option) => {
    const id = String(option?.id || option?.branchId || "").trim();
    const name = String(option?.name || option?.branchName || "").trim();
    if (!id && !name) return;
    if (UNASSIGNED_BRANCH_KEYS.has(normalizeKey(name || id))) return;

    const key = id ? `id:${normalizeKey(id)}` : `name:${normalizeKey(name)}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      ...option,
      id: id || name,
      name: name || id,
    });
  });

  return merged;
};

const getBranchOptionsFromRows = (rows = [], clinic = null) =>
  rows
    .filter((row) => matchesClinic(row, clinic))
    .map((row) => {
      const id = getRowBranchKey(row);
      const name = firstValue(row.branchName, row.branch, row.raw?.branchName, row.raw?.BranchName, row.raw?.branch, row.raw?.Branch);
      return {
        id: id || String(name || "").trim(),
        name: String(name || id || "").trim(),
        raw: row.raw || row,
        isActive: true,
      };
    })
    .filter((branch) => branch.id && branch.name && !UNASSIGNED_BRANCH_KEYS.has(normalizeKey(branch.name)));

const toDateInputValue = (date) => {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return toDateInputValue(date);
};

const getRowDateValue = (row = {}) => {
  const rawValue =
    row.timestampRaw ||
    row.createdAt ||
    row.loginTime ||
    row.logoutTime ||
    row.raw?.timestamp ||
    row.raw?.createdAt ||
    row.raw?.loginTime ||
    row.raw?.logoutTime ||
    row.timestamp ||
    "";
  const parsed = new Date(rawValue);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return row.sortTime ? new Date(row.sortTime) : null;
};

const isWithinDateRange = (row = {}, startDate = "", endDate = "") => {
  const rowDate = getRowDateValue(row);
  if (!rowDate) return true;
  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (rowDate < start) return false;
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999`);
    if (rowDate > end) return false;
  }
  return true;
};

const isDataChangeLog = (row = {}) => {
  const action = getActionLabel(row).toLowerCase();
  return !["login", "logout"].includes(action);
};

function AuditLogs() {
  const [search, setSearch] = useState("");
  const [systemAction, setSystemAction] = useState("All");
  const [view, setView] = useState("login");
  const [auditLogs, setAuditLogs] = useState([]);
  const [allAuditLogs, setAllAuditLogs] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedClinic = useMemo(
    () =>
      clinics.find((clinic) =>
        getClinicIdCandidates(clinic).some((id) => String(id) === String(selectedClinicId))
      ) || null,
    [clinics, selectedClinicId]
  );

  const derivedBranchOptions = useMemo(
    () =>
      selectedClinic
        ? getBranchOptionsFromRows(
            [...allAuditLogs, ...loginHistory, ...auditLogs],
            selectedClinic
          )
        : [],
    [allAuditLogs, auditLogs, loginHistory, selectedClinic]
  );

  const branchOptions = useMemo(
    () => mergeBranchOptions(branches, derivedBranchOptions),
    [branches, derivedBranchOptions]
  );

  const selectedBranch = useMemo(
    () =>
      branchOptions.find((branch) =>
        getBranchIdCandidates(branch).some((id) => String(id) === String(selectedBranchId))
      ) || null,
    [branchOptions, selectedBranchId]
  );

  const loadLogs = useCallback(async (active = true) => {
    setLoading(true);
    setError("");

    try {
      const filters = {
        startDate,
        endDate,
        clinicId: selectedClinicId,
        clinicName: selectedClinic?.name,
        branchId: selectedBranchId,
        branchName: selectedBranch?.name,
      };
      const logs = view === "login" ? await fetchLoginHistory(filters) : await fetchAuditLogs(filters);
      if (active) {
        setAuditLogs(logs);
        if (view === "login") setLoginHistory(logs);
        else setAllAuditLogs(logs);
      }
    } catch (requestError) {
      if (active) setError(requestError.message || "Unable to load audit logs.");
    } finally {
      if (active) setLoading(false);
    }
  }, [endDate, selectedBranch?.name, selectedBranchId, selectedClinic?.name, selectedClinicId, startDate, view]);

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      fetchAuditLogs({
        startDate,
        endDate,
        clinicId: selectedClinicId,
        clinicName: selectedClinic?.name,
        branchId: selectedBranchId,
        branchName: selectedBranch?.name,
      }),
      fetchLoginHistory({
        startDate,
        endDate,
        clinicId: selectedClinicId,
        clinicName: selectedClinic?.name,
        branchId: selectedBranchId,
        branchName: selectedBranch?.name,
      }),
    ]).then(([allResult, loginResult]) => {
      if (!active) return;
      if (allResult.status === "fulfilled") setAllAuditLogs(allResult.value);
      if (loginResult.status === "fulfilled") setLoginHistory(loginResult.value);
    });

    return () => {
      active = false;
    };
  }, [endDate, selectedBranch?.name, selectedBranchId, selectedClinic?.name, selectedClinicId, startDate]);

  useEffect(() => {
    let active = true;
    loadLogs(active);

    return () => {
      active = false;
    };
  }, [loadLogs]);

  useEffect(() => {
    let active = true;

    fetchClinics()
      .then((rows) => {
        if (active) setClinics(rows);
      })
      .catch(() => {
        if (active) setClinics([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const clinic = clinics.find((item) =>
      getClinicIdCandidates(item).some((id) => String(id) === String(selectedClinicId))
    );

    setSelectedBranchId("");
    if (!clinic) {
      setBranches([]);
      return () => {
        active = false;
      };
    }

    setLoadingBranches(true);
    (async () => {
      const candidates = getClinicIdCandidates(clinic);
      const storedHospitalId = getStoredHospitalId();
      const storedClinicName = getStoredClinicName();
      if (
        storedHospitalId &&
        getClinicNameCandidates(clinic).includes(normalizeKey(storedClinicName))
      ) {
        candidates.unshift(String(storedHospitalId));
      }
      const seenBranchKeys = new Set();
      const mergeOptions = (options = []) => {
        const next = [];
        options.forEach((option) => {
          const key = `${option.id || ""}:${normalizeKey(option.name)}`;
          if (!key.trim() || seenBranchKeys.has(key)) return;
          seenBranchKeys.add(key);
          next.push(option);
        });
        return next;
      };

      for (const candidate of candidates) {
        try {
          const rows = await fetchBranchesForHospital(candidate);
          const options = buildBranchOptions(rows);
          const merged = mergeOptions(options);
          if (merged.length) return merged;
        } catch {
          // Try the next clinic/hospital id shape.
        }
      }

      try {
        const rows = await fetchBranchesForHospital("");
        return mergeOptions(filterBranchOptionsForClinic(buildBranchOptions(rows), clinic));
      } catch {
        return [];
      }
    })()
      .then((options) => {
        if (active) setBranches(options);
      })
      .finally(() => {
        if (active) setLoadingBranches(false);
      });

    return () => {
      active = false;
    };
  }, [clinics, selectedClinicId]);

  const systemActions = useMemo(
    () => ["All", ...Array.from(new Set(auditLogs.map(getActionLabel).filter(Boolean)))],
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
      const matchesSystemAction = systemAction === "All" || getActionLabel(log) === systemAction;
      return (
        matchesSearch &&
        matchesSystemAction &&
        isWithinDateRange(log, startDate, endDate) &&
        matchesClinic(log, selectedClinic) &&
        matchesBranch(log, selectedBranch)
      );
    });
  }, [auditLogs, endDate, search, selectedBranch, selectedClinic, startDate, systemAction]);

  const scopedRows = useMemo(() => {
    const rows = allAuditLogs.length ? allAuditLogs : auditLogs;
    return rows.filter(
      (row) =>
        isWithinDateRange(row, startDate, endDate) &&
        matchesClinic(row, selectedClinic) &&
        matchesBranch(row, selectedBranch)
    );
  }, [allAuditLogs, auditLogs, endDate, selectedBranch, selectedClinic, startDate]);

  const loginSummaryRows = useMemo(() => {
    const rows = loginHistory.length ? loginHistory : auditLogs.filter((row) => row.isLoginActivity);
    return rows.filter(
      (row) =>
        isWithinDateRange(row, startDate, endDate) &&
        matchesClinic(row, selectedClinic) &&
        matchesBranch(row, selectedBranch)
    );
  }, [auditLogs, endDate, loginHistory, selectedBranch, selectedClinic, startDate]);

  const dashboardTotalLogs = scopedRows.length;
  const dashboardLoginActivities = loginSummaryRows.length;
  const dashboardDataChanges = scopedRows.filter(isDataChangeLog).length;

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Logs",
        value: dashboardTotalLogs,
        detail: "All time records",
        icon: FileText,
        tone: "total",
      },
      {
        label: "Login Activities",
        value: dashboardLoginActivities,
        detail: "This period",
        icon: LogIn,
        tone: "login",
      },
      {
        label: "Data Changes",
        value: dashboardDataChanges,
        detail: "This period",
        icon: PencilLine,
        tone: "changes",
      },
    ],
    [dashboardDataChanges, dashboardLoginActivities, dashboardTotalLogs]
  );

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, systemAction, view, auditLogs, selectedClinicId, selectedBranchId, startDate, endDate]);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage]);

  const columns = [
    {
      key: "serial",
      label: "S.No.",
      width: "42px",
      render: (_log, index) => index + 1,
    },
    {
      key: "userName",
      label: "User",
      width: "minmax(105px, 0.75fr)",
      render: (row) => {
        const name = row.userName || row.user || row.action || "-";
        const tone = getRoleTone(row.role);
        return (
          <span className="sa-audit-user">
            <span className={`sa-audit-avatar sa-audit-avatar--${tone}`}>{getInitials(name)}</span>
            <b>{name}</b>
          </span>
        );
      },
    },
    {
      key: "email",
      label: "Email Address",
      width: "minmax(170px, 1fr)",
      cellClassName: "sa-table-cell--nowrap",
      render: (row) => (
        <span title={row.email || row.userEmail || ""} className="sa-table-text-overflow">
          {row.email || row.userEmail || "-"}
        </span>
      ),
    },
    {
      key: "action",
      label: "Action",
      width: "minmax(78px, 0.5fr)",
      render: (row) => {
        const action = getActionLabel(row);
        return <span className={`sa-audit-pill sa-audit-pill--${getActionTone(action)}`}>{action}</span>;
      },
    },
    {
      key: "ipAddress",
      label: "IP Address",
      width: "minmax(220px, 1.2fr)",
      cellClassName: "sa-table-cell--nowrap",
      render: (row) => (
        <span title={row.ipAddress || ""} className="sa-table-text-overflow">
          {row.ipAddress || "-"}
        </span>
      ),
    },
    {
      key: "isLoginActivity",
      label: "Login",
      width: "52px",
      render: (row) => (
        <span className={`sa-audit-login ${row.isLoginActivity ? "is-yes" : "is-no"}`}>
          {row.isLoginActivity ? "Yes" : "No"}
        </span>
      ),
    },
    {
      key: "timestamp",
      label: "Timestamp",
      width: "minmax(130px, 0.82fr)",
      cellClassName: "sa-table-cell--nowrap",
      render: (row) => (
        <span title={row.timestamp || ""} className="sa-table-text-overflow">
          {row.timestamp || "-"}
        </span>
      ),
    },
    {
      key: "role",
      label: "Role",
      width: "minmax(92px, 0.58fr)",
      render: (row) => {
        const role = row.role || "-";
        const tone = getRoleTone(role);
        const RoleIcon = roleIcons[tone] || UserRound;
        return (
          <span className={`sa-audit-role sa-audit-role--${tone}`}>
            <RoleIcon size={11} />
            {role}
          </span>
        );
      },
    },
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
      <div className="sa-audit-summary-grid">
        {summaryCards.map((card) => {
          const SummaryIcon = card.icon;
          return (
            <article className="sa-audit-summary-card" key={card.label}>
              <span className={`sa-audit-summary-icon sa-audit-summary-icon--${card.tone}`}>
                <SummaryIcon size={22} />
              </span>
              <span>
                <b>{card.label}</b>
                <strong>{card.value}</strong>
                <small>{card.detail}</small>
              </span>
            </article>
          );
        })}
      </div>
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
      <div className="sa-audit-scope-filter" aria-label="Audit clinic and branch filters">
        <label>
          <span>Start Date</span>
          <input
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label>
          <span>End Date</span>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
        <label>
          <span>Clinic</span>
          <select
            value={selectedClinicId}
            onChange={(event) => setSelectedClinicId(event.target.value)}
          >
            <option value="">All Clinics</option>
            {clinics.map((clinic) => (
              <option key={clinic.id || clinic.name} value={getClinicIdCandidates(clinic)[0] || clinic.id}>
                {clinic.name || `Clinic ${clinic.id}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Branch</span>
          <select
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
            disabled={!selectedClinicId || loadingBranches}
          >
            <option value="">
              {!selectedClinicId
                ? "Select clinic first"
                : loadingBranches
                  ? "Loading branches..."
                  : "All Branches"}
            </option>
            {branchOptions.map((branch) => (
              <option key={branch.id || branch.name} value={getBranchIdCandidates(branch)[0] || branch.id}>
                {branch.name || `Branch ${branch.id}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DataTable
        className="sa-table--audit"
        columns={columns}
        rows={pagedRows}
        loading={loading}
        error={error}
        rowIndexOffset={(currentPage - 1) * pageSize}
        preserveColumnFractions
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
