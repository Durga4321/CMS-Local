import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cross,
  Leaf,
  RefreshCw,
  Search,
  Stethoscope,
  Sun,
  UserRound,
  UsersRound,
} from "lucide-react";
import { apiUrl } from "../../../config/api";
import {
  buildBranchOptions,
  fetchBranchesForHospital,
  getApiHeaders,
  getStoredHospitalId,
} from "../../../utils/branchApi";
import "./AdminUserManagement.css";

const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.logins)) return data.logins;
  return [];
};

const readValue = (record = {}, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
};

const getStoredBranchId = () =>
  String(
    localStorage.getItem("branchId") ||
      localStorage.getItem("BranchId") ||
      localStorage.getItem("doctorBranchId") ||
      ""
  ).trim();

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatLastActive = (value) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDisplayStatus = (user = {}) => {
  const status = String(user.status || "").trim();
  if (status) {
    const normalized = status.toLowerCase();
    if (["true", "active", "online", "1"].includes(normalized)) return "Active";
    if (["false", "inactive", "offline", "0"].includes(normalized)) return "Inactive";
    return status;
  }
  return user.isOnline ? "Active" : "Inactive";
};

const getInitials = (value = "") =>
  String(value || "U")
    .replace(/^Dr\.\s*/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

const ClinicToothLogo = () => (
  <svg className="admin-users-clinic-tooth-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7.45 3.8c1.2-.52 2.35-.28 3.18.17.86.47 1.88.47 2.74 0 .83-.45 1.98-.69 3.18-.17 2.2.95 3.13 3.25 2.43 5.87l-1.56 5.84c-.45 1.69-1.28 4.72-3.03 4.72-1.24 0-1.31-1.49-1.68-3.08-.18-.78-.43-1.37-.71-1.37s-.53.59-.71 1.37c-.37 1.59-.44 3.08-1.68 3.08-1.75 0-2.58-3.03-3.03-4.72L5.02 9.67C4.32 7.05 5.25 4.75 7.45 3.8Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const getClinicLogo = (clinicName = "") => {
  const name = String(clinicName).toLowerCase();
  if (name.includes("dental")) return { type: "tooth", text: "", tone: "dental" };
  if (name.includes("pragathi")) return { type: "icon", icon: Leaf, text: "PRAGATHI", tone: "green" };
  if (name.includes("sai ram")) return { type: "icon", icon: Sun, text: "SAI RAM", tone: "sky" };
  if (name.includes("primo")) return { type: "icon", icon: Sun, text: "PRIMO", tone: "amber" };
  if (name.includes("pirnav")) return { type: "icon", icon: Sun, text: "PIRNAV", tone: "amber" };
  if (name.includes("nri")) return { type: "icon", icon: Cross, text: "NC", tone: "emerald" };
  if (name.includes("vims")) return { type: "icon", icon: Cross, text: "VIMS", tone: "emerald" };
  const fallbackText = String(clinicName || "CLINIC")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return { type: "icon", icon: Cross, text: fallbackText || "CL", tone: "emerald" };
};

const getRoleMeta = (role = "") => {
  const normalized = String(role || "").toLowerCase();
  if (normalized.includes("reception")) return { label: "Receptionist", icon: UsersRound, tone: "receptionist" };
  if (normalized.includes("patient")) return { label: "Patient", icon: UserRound, tone: "patient" };
  if (normalized.includes("doctor")) return { label: "Doctor", icon: Stethoscope, tone: "doctor" };
  return { label: role || "User", icon: UserRound, tone: "default" };
};

const normalizeUserLogin = (record = {}, index = 0) => {
  const userId = readValue(record, ["userId", "UserId", "userID"], "");
  const id = readValue(record, ["id", "Id", "loginId", "LoginId"], userId || index + 1);
  const isOnlineValue = readValue(record, ["isOnline", "IsOnline"], false);
  const logoutTime = readValue(record, ["logoutTime", "LogoutTime"], "");

  return {
    id,
    userId,
    name: readValue(record, ["userName", "UserName", "name", "Name"], ""),
    email: readValue(record, ["email", "Email", "emailAddress", "EmailAddress"], ""),
    role: readValue(record, ["role", "Role", "roleName", "RoleName"], ""),
    clinicId: readValue(record, ["hospitalId", "HospitalId", "clinicId", "ClinicId"], ""),
    clinicName: readValue(record, ["hospitalName", "HospitalName", "clinicName", "ClinicName"], ""),
    clinicLocation: readValue(record, ["hospitalLocation", "HospitalLocation", "clinicLocation", "ClinicLocation"], ""),
    branchId: readValue(record, ["branchId", "BranchId"], ""),
    branchName: readValue(record, ["branchName", "BranchName"], ""),
    branchLocation: readValue(record, ["branchLocation", "BranchLocation"], ""),
    action: readValue(record, ["action", "Action"], ""),
    systemAction: readValue(record, ["systemAction", "SystemAction"], ""),
    ipAddress: readValue(record, ["ipAddress", "IpAddress", "IP"], ""),
    browser: readValue(record, ["browser", "Browser"], ""),
    device: readValue(record, ["device", "Device"], ""),
    loginTime: readValue(record, ["loginTime", "LoginTime"], ""),
    lastActive: readValue(record, ["loginTime", "LoginTime"], ""),
    status: readValue(record, ["status", "Status"], isOnlineValue ? "Active" : "Inactive"),
    logoutTime,
    isOnline: isOnlineValue === true || String(isOnlineValue).toLowerCase() === "true",
    raw: record,
  };
};

const getRecordBranchId = (record = {}) =>
  String(readValue(record, ["branchId", "BranchId", "branchID", "BranchID", "clinicBranchId"], "")).trim();

const getRecordBranchName = (record = {}) =>
  String(readValue(record, ["branchName", "BranchName", "branch", "Branch"], "")).trim();

const normalizeDirectoryUser = (record = {}, roleFallback = "", index = 0, branchLookup = {}) => {
  const role = readValue(record, ["role", "Role", "roleName", "RoleName", "type", "Type"], roleFallback);
  const id = readValue(record, [
    "userId",
    "UserId",
    "id",
    "Id",
    "doctorId",
    "DoctorId",
    "receptionistId",
    "ReceptionistId",
    "patientId",
    "PatientId",
  ], `${roleFallback}-${index + 1}`);
  const branchId = getRecordBranchId(record);
  const branch = branchLookup[String(branchId)] || {};

  return {
    id,
    userId: id,
    name: readValue(record, ["userName", "UserName", "name", "Name", "fullName", "FullName", "patientName", "PatientName"], ""),
    email: readValue(record, ["email", "Email", "emailAddress", "EmailAddress"], ""),
    role,
    clinicId: readValue(record, ["hospitalId", "HospitalId", "clinicId", "ClinicId"], getStoredHospitalId()),
    clinicName: readValue(record, ["hospitalName", "HospitalName", "clinicName", "ClinicName"], localStorage.getItem("hospitalName") || localStorage.getItem("clinicName") || "VIMS Clinic"),
    clinicLocation: readValue(record, ["hospitalLocation", "HospitalLocation", "clinicLocation", "ClinicLocation", "address", "Address"], ""),
    branchId,
    branchName: getRecordBranchName(record) || branch.name || "",
    branchLocation: readValue(record, ["branchLocation", "BranchLocation"], branch.raw?.address || branch.raw?.Address || ""),
    action: "",
    systemAction: "",
    ipAddress: "",
    browser: "",
    device: "",
    loginTime: "",
    lastActive: readValue(record, ["lastActive", "LastActive", "updatedAt", "UpdatedAt", "modifiedAt", "ModifiedAt"], ""),
    logoutTime: "",
    status: readValue(record, ["status", "Status", "isActive", "IsActive"], "Active"),
    isOnline: false,
    raw: record,
  };
};

const userIdentityKey = (user = {}) => {
  const role = String(user.role || "").trim().toLowerCase();
  const userId = String(user.userId || user.id || "").trim();
  const name = String(user.name || "").trim().toLowerCase();
  return `${role}:${userId || name}`;
};

const mergeUsers = (baseUsers = [], loginUsers = []) => {
  const rows = new Map();
  const nameLookup = new Map();
  baseUsers.forEach((user) => {
    const key = userIdentityKey(user);
    if (key !== ":") {
      rows.set(key, user);
      const nameKey = `${String(user.role || "").trim().toLowerCase()}:${String(user.name || "").trim().toLowerCase()}`;
      if (nameKey !== ":") nameLookup.set(nameKey, key);
    }
  });

  loginUsers.forEach((login) => {
    const loginNameKey = `${String(login.role || "").trim().toLowerCase()}:${String(login.name || "").trim().toLowerCase()}`;
    const key = nameLookup.get(loginNameKey) || userIdentityKey(login);
    if (key === ":") return;
    const existing = rows.get(key);
    rows.set(key, {
      ...(existing || {}),
      ...login,
      name: existing?.name || login.name,
      email: existing?.email || login.email,
      role: existing?.role || login.role,
      clinicName: existing?.clinicName || login.clinicName,
      clinicLocation: existing?.clinicLocation || login.clinicLocation,
      branchId: existing?.branchId || login.branchId,
      branchName: existing?.branchName || login.branchName,
      branchLocation: existing?.branchLocation || login.branchLocation,
      lastActive: login.lastActive || existing?.lastActive,
      status: existing?.status || login.status,
      raw: existing?.raw || login.raw,
    });
    if (loginNameKey !== ":") nameLookup.set(loginNameKey, key);
  });

  return Array.from(rows.values());
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      ...getApiHeaders(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const validationMessage =
      data?.errors && typeof data.errors === "object"
        ? Object.values(data.errors).flat().filter(Boolean).join(" ")
        : "";
    throw new Error(
      data?.message ||
        validationMessage ||
        data?.title ||
        (typeof data === "string" ? data : "") ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
};

function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(getStoredBranchId());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      let branchId = selectedBranchId;
      if (!branchId) {
        const branchOptions = buildBranchOptions(await fetchBranchesForHospital(getStoredHospitalId()));
        setBranches(branchOptions);
        branchId = branchOptions[0]?.id || "";
        setSelectedBranchId(branchId);
      }

      if (!branchId) {
        setUsers([]);
        setError("Branch not found for this clinic.");
        return;
      }

      const activeBranches = branches.length
        ? branches
        : buildBranchOptions(await fetchBranchesForHospital(getStoredHospitalId()));
      if (!branches.length) setBranches(activeBranches);
      const branchLookup = activeBranches.reduce((lookup, branch) => {
        lookup[String(branch.id)] = branch;
        return lookup;
      }, {});
      const [loginsResult, doctorsResult, receptionistsResult, patientsResult, usersResult] = await Promise.allSettled([
        requestJson(`Dashboard/today-logins?branchId=${encodeURIComponent(branchId)}`),
        requestJson("Doctor"),
        requestJson("Receptionist"),
        requestJson("Patient"),
        requestJson("users"),
      ]);

      const loginUsers =
        loginsResult.status === "fulfilled"
          ? parseList(loginsResult.value)
              .map(normalizeUserLogin)
              .filter((user) => String(user.branchId || "").trim() === String(branchId))
          : [];
      const directoryUsers = [
        ...(doctorsResult.status === "fulfilled"
          ? parseList(doctorsResult.value).map((item, index) => normalizeDirectoryUser(item, "Doctor", index, branchLookup))
          : []),
        ...(receptionistsResult.status === "fulfilled"
          ? parseList(receptionistsResult.value).map((item, index) => normalizeDirectoryUser(item, "Receptionist", index, branchLookup))
          : []),
        ...(patientsResult.status === "fulfilled"
          ? parseList(patientsResult.value).map((item, index) => normalizeDirectoryUser(item, "Patient", index, branchLookup))
          : []),
        ...(usersResult.status === "fulfilled"
          ? parseList(usersResult.value).map((item, index) => normalizeDirectoryUser(item, "", index, branchLookup))
          : []),
      ].filter((user) => {
        const userBranchId = String(user.branchId || "").trim();
        const userBranchName = String(user.branchName || "").trim().toLowerCase();
        const selectedBranch = branchLookup[String(branchId)];
        const selectedBranchName = String(selectedBranch?.name || "").trim().toLowerCase();
        return (
          userBranchId === String(branchId) ||
          (selectedBranchName && userBranchName === selectedBranchName)
        );
      });

      setUsers(mergeUsers(directoryUsers, loginUsers));
    } catch (loadError) {
      setUsers([]);
      setError(loadError.message || "Unable to load user management data.");
    } finally {
      setLoading(false);
    }
  }, [branches, selectedBranchId]);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const branchOptions = buildBranchOptions(await fetchBranchesForHospital(getStoredHospitalId()));
        setBranches(branchOptions);
        setSelectedBranchId((currentBranchId) => currentBranchId || branchOptions[0]?.id || "");
      } catch {
        setBranches([]);
      }
    };

    loadBranches();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selectedStatus = status.toLowerCase();
    return users.filter((user) => {
      const matchesSearch = [
        user.name,
        user.email,
        user.role,
        user.clinicName,
        user.branchName,
      ].some((value) => String(value || "").toLowerCase().includes(query));
      const userStatus = getDisplayStatus(user).toLowerCase();
      const matchesStatus =
        selectedStatus === "all" ||
        (selectedStatus === "active" ? userStatus === "active" : userStatus !== "active");
      return matchesSearch && matchesStatus;
    });
  }, [search, status, users]);

  return (
    <div className="admin-users-page">
      <div className="admin-users-header">
        <div>
          <h2>User Management</h2>
          <p>{loading ? "Loading users..." : `${filteredUsers.length} Users Found`}</p>
        </div>
        <button className="admin-users-btn" type="button" onClick={loadUsers} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="admin-users-toolbar">
        <label className="admin-users-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users by name, email, clinic, branch, or type..."
          />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="All">All</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <select value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)}>
          <option value="">Select Branch</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {success ? <div className="admin-users-success">{success}</div> : null}
      {error ? <div className="admin-users-error">{error}</div> : null}

      <div className="admin-users-table">
        <div className="admin-users-table-head">
          <span>S.No.</span>
          <span>Name</span>
          <span>Email</span>
          <span>Clinic</span>
          <span>Branch</span>
          <span>Role</span>
          <span>Status</span>
          <span>Last Active</span>
        </div>

        {loading ? <div className="admin-users-state">Loading user management data...</div> : null}
        {!loading && !filteredUsers.length ? <div className="admin-users-state">No names found.</div> : null}

        {filteredUsers.map((user, index) => {
          const avatarTone = index % 4;
          const clinicLogo = getClinicLogo(user.clinicName);
          const ClinicLogoIcon = clinicLogo.icon;
          const roleMeta = getRoleMeta(user.role);
          const RoleIcon = roleMeta.icon;
          const lastActive = formatLastActive(user.lastActive || user.loginTime);

          return (
            <div className="admin-users-row" key={`${user.id}-${index}`}>
              <span>{index + 1}</span>
              <span className="admin-users-name-cell">
                <span className={`admin-users-avatar admin-users-avatar--${avatarTone}`}>
                  {getInitials(user.name || user.email)}
                </span>
                <b>{user.name || "-"}</b>
              </span>
              <span className="admin-users-email" title={user.email || "-"}>
                {user.email || "-"}
              </span>
              <span className="admin-users-clinic-cell">
                <span className={`admin-users-clinic-logo admin-users-clinic-logo--${clinicLogo.tone}`}>
                  {clinicLogo.type === "tooth" ? <ClinicToothLogo /> : <ClinicLogoIcon size={17} />}
                  {clinicLogo.text ? <small>{clinicLogo.text}</small> : null}
                </span>
                <b>{user.clinicName || "-"}</b>
              </span>
              <span>{user.branchName || "-"}</span>
              <span>
                <span className={`admin-users-role admin-users-role--${roleMeta.tone}`}>
                  <RoleIcon size={15} />
                  {roleMeta.label}
                </span>
              </span>
              <span>
                <span className={`admin-users-status ${getDisplayStatus(user).toLowerCase() === "active" ? "is-online" : "is-offline"}`}>
                  {getDisplayStatus(user)}
                </span>
              </span>
              <span className="admin-users-last-active" title={formatDateTime(user.lastActive || user.loginTime)}>
                {lastActive}
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
}

export default AdminUserManagement;
