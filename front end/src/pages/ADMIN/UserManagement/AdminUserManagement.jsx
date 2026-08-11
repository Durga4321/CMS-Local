import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  HeartPulse,
  RefreshCw,
  Search,
  Stethoscope,
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
import { getClinicInvoiceBranding } from "../../../utils/clinicBranding";
import "./AdminUserManagement.css";

const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.logins)) return data.logins;
  if (Array.isArray(data?.staff)) return data.staff;
  if (Array.isArray(data?.Staff)) return data.Staff;
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

const getRoleMeta = (role = "") => {
  const normalized = String(role || "").toLowerCase();
  if (normalized.includes("nurse")) return { label: "Nurse", icon: HeartPulse, tone: "nurse" };
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

const parseBranchIds = (value) => {
  if (Array.isArray(value)) return value.flatMap(parseBranchIds);
  if (value && typeof value === "object") {
    return [
      readValue(value, ["branchId", "BranchId", "id", "Id", "clinicBranchId"], ""),
    ].filter(Boolean);
  }
  const text = String(value ?? "").trim();
  if (!text) return [];
  if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("{") && text.endsWith("}"))) {
    try {
      return parseBranchIds(JSON.parse(text));
    } catch {
      return [];
    }
  }
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

const getRecordBranchIds = (record = {}) => {
  const directIds = parseBranchIds(
    readValue(record, ["branchId", "BranchId", "branchID", "BranchID", "clinicBranchId"], "")
  );
  const multiIds = [
    ...parseBranchIds(record.branchIds),
    ...parseBranchIds(record.BranchIds),
    ...parseBranchIds(record.branchIdsJson),
    ...parseBranchIds(record.BranchIdsJson),
    ...parseBranchIds(record.branches),
    ...parseBranchIds(record.Branches),
    ...parseBranchIds(record.clinicBranches),
    ...parseBranchIds(record.ClinicBranches),
  ];
  return Array.from(new Set([...directIds, ...multiIds].map((id) => String(id).trim()).filter(Boolean)));
};

const getRecordBranchId = (record = {}) => getRecordBranchIds(record)[0] || "";

const getRecordBranchName = (record = {}) =>
  String(readValue(record, ["branchName", "BranchName", "branch", "Branch"], "")).trim();

const normalizePhone = (value) => String(value ?? "").replace(/\D/g, "");

const getPatientRecordId = (record = {}) =>
  String(
    readValue(record, ["id", "Id", "patientId", "PatientId", "pid", "PID"], "")
  ).trim();

const getPatientRecordPhone = (record = {}) =>
  normalizePhone(
    readValue(record, ["phone", "Phone", "phoneNumber", "PhoneNumber", "mobile", "Mobile", "mobileNumber", "MobileNumber"], "")
  );

const getAppointmentBranchId = (appointment = {}) =>
  String(
    readValue(appointment, ["branchId", "BranchId", "clinicBranchId", "ClinicBranchId"], "") ||
      readValue(appointment.branch || appointment.Branch || {}, ["id", "Id", "branchId", "BranchId"], "") ||
      readValue(appointment.patient || appointment.Patient || {}, ["branchId", "BranchId"], "")
  ).trim();

const getAppointmentPatientId = (appointment = {}) =>
  String(
    readValue(appointment, ["patientId", "PatientId", "pid", "PID"], "") ||
      readValue(appointment.patient || appointment.Patient || {}, ["id", "Id", "patientId", "PatientId"], "")
  ).trim();

const getAppointmentPatientPhone = (appointment = {}) =>
  normalizePhone(
    readValue(appointment, ["phone", "Phone", "patientPhone", "PatientPhone", "mobile", "Mobile", "mobileNumber", "MobileNumber"], "") ||
      readValue(appointment.patient || appointment.Patient || {}, ["phone", "Phone", "phoneNumber", "PhoneNumber", "mobile", "Mobile", "mobileNumber", "MobileNumber"], "")
  );

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
    "nurseId",
    "NurseId",
  ], `${roleFallback}-${index + 1}`);
  const branchId = getRecordBranchId(record);
  const branchIds = getRecordBranchIds(record);
  const branch = branchLookup[String(branchId)] || {};

  return {
    id,
    userId: id,
    name: readValue(record, ["userName", "UserName", "name", "Name", "fullName", "FullName", "patientName", "PatientName", "nurseName", "NurseName"], ""),
    email: readValue(record, ["email", "Email", "emailAddress", "EmailAddress"], ""),
    phone: getPatientRecordPhone(record),
    role,
    clinicId: readValue(record, ["hospitalId", "HospitalId", "clinicId", "ClinicId"], getStoredHospitalId()),
    clinicName: readValue(record, ["hospitalName", "HospitalName", "clinicName", "ClinicName"], localStorage.getItem("hospitalName") || localStorage.getItem("clinicName") || "VIMS Clinic"),
    clinicLocation: readValue(record, ["hospitalLocation", "HospitalLocation", "clinicLocation", "ClinicLocation", "address", "Address"], ""),
    branchId,
    branchIds,
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
    if (!existing) return;
    rows.set(key, {
      ...existing,
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
      const [
        loginsResult,
        doctorsResult,
        receptionistsResult,
        patientsResult,
        staffResult,
        appointmentsResult,
        offlineAppointmentsResult,
        onlineAppointmentsResult,
      ] = await Promise.allSettled([
        requestJson(`Dashboard/today-logins?branchId=${encodeURIComponent(branchId)}`),
        requestJson("Doctor"),
        requestJson("Receptionist"),
        requestJson("Patient"),
        requestJson("Staff"),
        requestJson("Appointment"),
        requestJson("Appointment/offline"),
        requestJson("Appointment/online"),
      ]);

      const loginUsers =
        loginsResult.status === "fulfilled"
          ? parseList(loginsResult.value)
              .map(normalizeUserLogin)
              .filter((user) => String(user.branchId || "").trim() === String(branchId))
          : [];
      const appointmentRows = [
        ...(appointmentsResult.status === "fulfilled" ? parseList(appointmentsResult.value) : []),
        ...(offlineAppointmentsResult.status === "fulfilled" ? parseList(offlineAppointmentsResult.value) : []),
        ...(onlineAppointmentsResult.status === "fulfilled" ? parseList(onlineAppointmentsResult.value) : []),
      ].filter((appointment) => getAppointmentBranchId(appointment) === String(branchId));
      const branchPatientIds = new Set(
        appointmentRows.map(getAppointmentPatientId).filter(Boolean)
      );
      const branchPatientPhones = new Set(
        appointmentRows.map(getAppointmentPatientPhone).filter(Boolean)
      );
      const patientBranchLookup = appointmentRows.reduce((lookup, appointment) => {
        const appointmentBranchId = getAppointmentBranchId(appointment);
        const branch = branchLookup[String(appointmentBranchId)] || {};
        const branchName =
          getRecordBranchName(appointment) ||
          readValue(appointment.branch || appointment.Branch || {}, ["name", "Name", "branchName", "BranchName"], "") ||
          branch.name ||
          "";
        const branchLocation =
          readValue(appointment, ["branchLocation", "BranchLocation"], "") ||
          readValue(appointment.branch || appointment.Branch || {}, ["address", "Address", "location", "Location"], "") ||
          branch.raw?.address ||
          branch.raw?.Address ||
          "";
        const scope = {
          branchId: appointmentBranchId,
          branchName,
          branchLocation,
        };
        const patientId = getAppointmentPatientId(appointment);
        const patientPhone = getAppointmentPatientPhone(appointment);
        if (patientId) lookup[`id:${patientId}`] = scope;
        if (patientPhone) lookup[`phone:${patientPhone}`] = scope;
        return lookup;
      }, {});

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
        ...(staffResult.status === "fulfilled"
          ? parseList(staffResult.value).map((item, index) =>
              normalizeDirectoryUser(
                item,
                readValue(item, ["role", "Role", "roleName", "RoleName", "type", "Type"], "Staff"),
                index,
                branchLookup
              )
            )
          : []),
      ].filter((user) => {
        const userBranchId = String(user.branchId || "").trim();
        const userBranchIds = Array.isArray(user.branchIds) ? user.branchIds.map((id) => String(id).trim()) : [];
        const userBranchName = String(user.branchName || "").trim().toLowerCase();
        const selectedBranch = branchLookup[String(branchId)];
        const selectedBranchName = String(selectedBranch?.name || "").trim().toLowerCase();
        const userRole = String(user.role || "").trim().toLowerCase();
        const isPatient = userRole.includes("patient");
        const patientId = getPatientRecordId(user.raw || user);
        const patientPhone = getPatientRecordPhone(user.raw || user) || normalizePhone(user.phone);
        const appointmentBranch =
          patientBranchLookup[`id:${patientId}`] || patientBranchLookup[`phone:${patientPhone}`] || null;
        const belongsToBranch =
          userBranchId === String(branchId) ||
          userBranchIds.includes(String(branchId)) ||
          (selectedBranchName && userBranchName === selectedBranchName) ||
          (isPatient && (branchPatientIds.has(patientId) || branchPatientPhones.has(patientPhone)));

        if (belongsToBranch && isPatient && appointmentBranch) {
          user.branchId = user.branchId || appointmentBranch.branchId;
          user.branchName = user.branchName || appointmentBranch.branchName;
          user.branchLocation = user.branchLocation || appointmentBranch.branchLocation;
        }

        return belongsToBranch;
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
          const clinicBranding = getClinicInvoiceBranding({
            clinicId: user.clinicId || user.hospitalId || getStoredHospitalId(),
            clinicName: user.clinicName,
          });
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
                <span className="admin-users-clinic-logo admin-users-clinic-logo--emerald">
                  <img src={clinicBranding.logoUrl} alt="" />
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
