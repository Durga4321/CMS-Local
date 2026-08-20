import { apiUrl } from "../../config/api";
import {
  getRevenueBreakdown as getSharedRevenueBreakdown,
  getRevenueTotals as getSharedRevenueTotals,
} from "../../utils/billingRevenue";

export const SUPER_ADMIN_API = {
  dashboard: "SuperAdmin/dashboard",
  dashboardCompat: "dashboard/dashboard",
  createClinicAdmin: "admins",
  superAdminClinics: "Clinics",
  admins: "admins",
  clinics: "Clinics",
  notifications: "notifications",
  staffNotifications: "Notification",
  notificationSend: "notifications/send",
  notificationStats: "notifications/stats",
  auditLogs: "AuditLogs",
  loginHistory: "AuditLogs/login-history",
  dashboardSummary: "SuperAdminReports/summary",
  dashboardSummaryCompat: "SuperAdmin/summary",
  dashboardSummaryLegacy: "dashboard/summary",
  revenueOverview: "dashboard/revenue-overview",
  activities: "dashboard/activities",
  dailyAppointmentsReport: "Report/daily-appointments",
  revenueReport: "Report/revenue",
  doctorWiseReport: "Report/doctor-wise",
  reportsSummary: "SuperAdminReports/summary",
  reportsClinicRevenue: "SuperAdminReports/clinic-revenue",
  reportsClinicRevenueByHospital: "SuperAdminReports/clinic-revenue",
  dashboardRevenueReport: "Dashboard/reports/revenue",
  reportsRevenueTrend: "SuperAdminReports/revenue-trend",
  reportsTopClinics: "SuperAdminReports/top-clinics",
  reportsUserActivity: "SuperAdminReports/user-activity",
  reportsRevenue: "reports/revenue",
  reportsActivity: "reports/activity",
  revenue: "revenue",
  billing: "Billing",
  roleNames: "roles/roles",
  roles: "roles",
  users: "users",
  settings: "settings",
  settingsGeneral: "settings/general",
  settingsEmail: "settings/email",
  settingsSms: "settings/sms",
  settingsPayment: "settings/payment",
};

const LOCAL_NOTIFICATIONS_KEY = "superadmin_notifications";
const LOCAL_AUDIT_LOGS_KEY = "superadmin_audit_logs";
const readLocalList = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const writeLocalList = (key, items) => {
  localStorage.setItem(key, JSON.stringify(items));
};

const prependLocalItem = (key, item) => {
  const nextItems = [item, ...readLocalList(key)].slice(0, 100);
  writeLocalList(key, nextItems);
  return item;
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const collectionKeys = [
    "data",
    "items",
    "results",
    "records",
    "clinics",
    "admins",
    "adminManagement",
    "adminManagements",
    "notifications",
    "logs",
    "auditLogs",
    "activities",
    "reports",
    "result",
    "billing",
    "billings",
    "bills",
    "invoices",
    "users",
    "roles",
    "topClinics",
    "revenueTrend",
    "userActivity",
    "summary",
  ];

  for (const key of collectionKeys) {
    if (Array.isArray(value[key])) return value[key];
  }

  const queue = [value];
  while (queue.length) {
    const current = queue.shift();
    for (const key of Object.keys(current)) {
      const item = current[key];
      if (Array.isArray(item)) return item;
      if (item && typeof item === "object") {
        queue.push(item);
      }
    }
  }

  return [];
};

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const asObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  for (const key of ["data", "result", "summary", "dashboard"]) {
    if (value[key] && typeof value[key] === "object" && !Array.isArray(value[key])) {
      return value[key];
    }
  }

  return value;
};

const pick = (source, keys, fallback = "") => {
  if (!source || typeof source !== "object") return fallback;

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return fallback;
};

const valuesEqual = (left, right) =>
  hasValue(left) && hasValue(right) && String(left) === String(right);

const toNumber = (value) => {
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeStatus = (value) => {
  if (typeof value === "boolean") return value ? "Active" : "Inactive";
  const status = String(value || "").trim();
  if (!status) return "Active";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const normalizeActiveStatus = (value) => {
  if (typeof value === "boolean") return value ? "Active" : "Inactive";
  if (typeof value === "number") return value === 0 ? "Inactive" : "Active";

  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return "Active";
  if (normalized === "false" || normalized === "0") return "Inactive";
  return undefined;
};

const normalizeNotificationStatus = (notification = {}) => {
  const text = `${notification.title || notification.subject || ""} ${notification.message || notification.body || notification.description || ""}`.toLowerCase();
  const readValue = pick(
    notification,
    ["isRead", "read", "readStatus", "is_read", "IsRead"],
    ""
  );
  const readAt = pick(notification, ["readAt", "readOn", "readDate", "ReadAt"], "");

  if (
    readAt ||
    readValue === true ||
    readValue === 1 ||
    String(readValue).toLowerCase() === "true" ||
    String(readValue).toLowerCase() === "read"
  ) {
    return "Read";
  }

  if (
    readValue === false ||
    readValue === 0 ||
    String(readValue).toLowerCase() === "false" ||
    String(readValue).toLowerCase() === "unread"
  ) {
    return "Unread";
  }

  const rawStatus = pick(notification, ["status", "state"], "");
  const status = normalizeStatus(rawStatus);
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "read") return "Read";
  if (
    text.includes("appointment booked") ||
    text.includes("has been booked") ||
    text.includes("payment received") ||
    text.includes("invoice generated")
  ) {
    return "Unread";
  }
  if (normalizedStatus === "sent") return "Sent";
  if (normalizedStatus === "unread" || normalizedStatus === "new") return "Unread";

  return "Unread";
};

const normalizeUserStatus = (user = {}) => {
  if (isDeletedRecord(user)) {
    return "Deleted";
  }

  const rawStatus = pick(user, ["status", "Status"], "");
  const statusValue = normalizeStatus(rawStatus);
  const activeStatus = normalizeActiveStatus(
    pick(user, ["isActive", "IsActive", "active", "Active"], undefined)
  );

  const hasExplicitStatus = hasValue(rawStatus);
  const normalizedStatusKey = String(statusValue || "").trim().toLowerCase();

  if (normalizedStatusKey === "deleted") {
    return "Inactive";
  }

  if (activeStatus === "Inactive") {
    return "Inactive";
  }

  if (activeStatus && ["active", "inactive"].includes(normalizedStatusKey)) {
    return activeStatus;
  }

  if (hasExplicitStatus) {
    return statusValue;
  }

  if (activeStatus) {
    return activeStatus;
  }

  return "Active";
};

const isActiveRecord = (record = {}) => {
  const status = normalizeStatus(
    pick(record, ["status", "Status", "isActive", "IsActive", "active", "Active"], "Active")
  );
  return status.toLowerCase() === "active";
};

const formatRoleLabel = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";

  const normalized = text.toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "superadmin") return "Super Admin";
  if (normalized === "clinicadmin") return "Clinic Admin";

  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getTimestamp = (value) => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const normalizeUtcDateValue = (value) => {
  if (!value || typeof value !== "string") return value;

  const text = value.trim();
  const isIsoDateTime = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(text);
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);

  return isIsoDateTime && !hasTimezone ? `${text}Z` : text;
};

const formatAuditDateTime = (value) => formatDateTime(normalizeUtcDateValue(value));

const getAuditTimestamp = (value) => getTimestamp(normalizeUtcDateValue(value));

const normalizeString = (value) => String(value || "").trim().toLowerCase();

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = normalizeString(value);
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const AUDIT_USER_KEYS = [
  "userName",
  "UserName",
  "user",
  "User",
  "name",
  "Name",
  "fullName",
  "FullName",
  "displayName",
  "DisplayName",
  "adminName",
  "AdminName",
  "doctorName",
  "DoctorName",
  "receptionistName",
  "ReceptionistName",
];

const AUDIT_EMAIL_KEYS = [
  "email",
  "Email",
  "emailAddress",
  "EmailAddress",
  "userEmail",
  "UserEmail",
  "adminEmail",
  "AdminEmail",
  "doctorEmail",
  "DoctorEmail",
  "receptionistEmail",
  "ReceptionistEmail",
];

const AUDIT_USER_NAME_KEYS = [
  "name",
  "Name",
  "fullName",
  "FullName",
  "displayName",
  "DisplayName",
  "userName",
  "UserName",
  "adminName",
  "AdminName",
  "doctorName",
  "DoctorName",
  "receptionistName",
  "ReceptionistName",
  "user",
  "User",
  "actor",
  "Actor",
  "performedBy",
  "PerformedBy",
  "createdByUser",
  "CreatedByUser",
  "person",
  "Person",
];

const AUDIT_IP_KEYS = [
  "ipAddress",
  "IPAddress",
  "IpAddress",
  "ip",
  "IP",
  "clientIp",
  "ClientIp",
  "clientIP",
  "remoteIp",
  "RemoteIp",
  "remoteIP",
  "userIp",
  "UserIp",
  "loginIp",
  "LoginIp",
];

const AUDIT_ROLE_KEYS = [
  "role",
  "Role",
  "roleName",
  "RoleName",
  "userRole",
  "UserRole",
  "actorRole",
  "ActorRole",
  "performedByRole",
  "PerformedByRole",
  "createdByRole",
  "CreatedByRole",
];

const pickNestedValue = (source = {}, objectKeys = [], valueKeys = []) => {
  for (const objectKey of objectKeys) {
    const value = source?.[objectKey];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nestedValue = pick(value, valueKeys);
      if (nestedValue) return nestedValue;
    }
  }

  return "";
};

const isEmailAddress = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
};

const getAuditNameFromAction = (action = "") => {
  const text = String(action || "").trim();
  if (!text) return "";

  const match = text.match(/^([^-@\n]+?)\s+(logged in|logged out|signed in|signed out|created|updated|deleted|removed|added|performed)\b/i);
  return match ? String(match[1]).trim() : "";
};

const getAuditRole = (log = {}) => {
  const role =
    pick(log, AUDIT_ROLE_KEYS) ||
    pickNestedValue(
      log,
      [
        "user",
        "User",
        "actor",
        "Actor",
        "performedBy",
        "PerformedBy",
        "createdByUser",
        "CreatedByUser",
        "admin",
        "Admin",
      ],
      AUDIT_ROLE_KEYS
    );

  return formatRoleLabel(role);
};

const getAuditUserName = (log = {}) => {
  const candidateName =
    String(pick(log, AUDIT_USER_NAME_KEYS)).trim() ||
    String(
      pickNestedValue(
        log,
        ["user", "User", "actor", "Actor", "performedBy", "PerformedBy", "createdByUser", "CreatedByUser", "admin", "Admin"],
        AUDIT_USER_NAME_KEYS
      )
    ).trim();

  if (candidateName && !isEmailAddress(candidateName)) {
    return candidateName;
  }

  const actionName = getAuditNameFromAction(
    pick(log, ["action", "activity", "message", "description", "systemAction"], "")
  );
  if (actionName) {
    return actionName;
  }

  const email = getAuditEmail(log);
  return email || "System";
};

const getAuditEmail = (log = {}) => {
  const email =
    String(pick(log, AUDIT_EMAIL_KEYS)).trim() ||
    String(
      pickNestedValue(
        log,
        ["user", "User", "actor", "Actor", "performedBy", "PerformedBy", "createdByUser", "CreatedByUser", "admin", "Admin"],
        AUDIT_EMAIL_KEYS
      )
    ).trim();

  return email;
};

const isUserLoginMatch = (user = {}, log = {}) => {
  const userEmail = normalizeString(pick(user, AUDIT_EMAIL_KEYS));
  const userName = normalizeString(pick(user, ["name", "fullName", "userName", "displayName", "adminName", "doctorName", "receptionistName"]));
  const logEmail = normalizeString(pick(log, AUDIT_EMAIL_KEYS));
  const logUser = normalizeString(pick(log, AUDIT_USER_KEYS));

  if (userEmail && (logEmail === userEmail || logUser === userEmail)) return true;
  if (userName && (logUser === userName || logEmail === userName)) return true;
  return false;
};

const findMostRecentLogin = (user = {}, logs = []) => {
  let latestTime = 0;
  let latestValue = "";

  for (const log of logs) {
    if (!isUserLoginMatch(user, log)) continue;

    const timestampRaw = pick(log, ["timestampRaw", "timestamp", "createdAt", "date", "loginTime", "time"]);
    const time = getAuditTimestamp(timestampRaw);

    if (time > latestTime) {
      latestTime = time;
      latestValue = timestampRaw;
    }
  }

  return latestValue;
};

const compactAddressParts = (parts = []) =>
  parts
    .map((part) => String(part || "").trim())
    .filter(Boolean);

const continentNames = new Set([
  "africa",
  "antarctica",
  "asia",
  "australia",
  "europe",
  "north america",
  "south america",
]);

const formatClinicAddress = (clinic = {}) => {
  const streetLine = pick(clinic, [
    "street",
    "Street",
    "addressLine1",
    "AddressLine1",
  ]);
  const rawAddress = pick(clinic, [
    "address",
    "Address",
    "clinicAddress",
    "ClinicAddress",
    "location",
  ]);
  const area = pick(clinic, ["area", "Area", "locality", "Locality", "town", "Town"]);
  const city = pick(clinic, ["city", "City", "town", "Town", "locality", "Locality"]);
  const state = pick(clinic, ["state", "State", "province", "Province", "region", "Region"]);
  const country = pick(clinic, ["country", "Country"]);
  const postalCode = pick(clinic, ["postalCode", "PostalCode", "zipCode", "ZipCode", "pinCode", "PinCode"]);
  const hasStructuredLocation = area || city || state || country || postalCode;
  const rawParts = compactAddressParts(String(rawAddress || "").split(","));
  const streetFromRaw = rawParts.length ? rawParts[0] : "";
  const street = streetLine || (hasStructuredLocation ? streetFromRaw : rawAddress);

  const structuredParts = compactAddressParts([
    street,
    area,
    city,
    state,
    country && !continentNames.has(String(country).trim().toLowerCase()) ? country : "",
    postalCode,
  ]);

  if (structuredParts.length > 1) {
    return structuredParts.join(", ");
  }

  const fallbackAddress = String(rawAddress || streetLine || "").trim();
  const fallbackParts = compactAddressParts(fallbackAddress.split(","));

  if (fallbackParts.length > 1 && continentNames.has(fallbackParts[0].toLowerCase())) {
    return fallbackParts.slice(1).join(", ");
  }

  return fallbackParts.length ? fallbackParts.join(", ") : fallbackAddress;

  return rawParts.length ? rawParts.join(", ") : fallbackAddress;
};

const formatLastActive = (user = {}) => {
  const activityValue = pick(
    user,
    [
      "lastActive",
      "lastActiveAt",
      "lastActivity",
      "lastActivityAt",
      "lastLogin",
      "lastLoginAt",
      "lastSeen",
      "lastSeenAt",
      "loginTime",
      "updatedAt",
      "modifiedAt",
    ],
    ""
  );

  return formatAuditDateTime(activityValue) || "Never Logged In";
};

const readJson = async (response) => {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const getValidationMessage = (payload) => {
  if (!payload || typeof payload !== "object") return "";

  if (payload.errors && typeof payload.errors === "object") {
    return Object.entries(payload.errors)
      .flatMap(([field, messages]) => {
        const fieldMessages = Array.isArray(messages) ? messages : [messages];
        return fieldMessages
          .filter(Boolean)
          .map((message) => `${field}: ${message}`);
      })
      .join(" ");
  }

  return "";
};

const getModuleAuthToken = () => {
  const path = String(window.location?.pathname || "").toLowerCase();
  const keys = path.startsWith("/lab")
    ? ["labToken", "token", "adminToken", "superAdminToken"]
    : path.startsWith("/doctor")
      ? ["doctorToken", "token", "adminToken", "superAdminToken"]
      : path.startsWith("/nurse")
        ? ["nurseToken", "token", "adminToken", "superAdminToken"]
        : path.startsWith("/reception")
          ? ["receptionistToken", "receptionToken", "token", "adminToken", "superAdminToken"]
          : ["token", "adminToken", "superAdminToken", "labToken", "doctorToken", "nurseToken", "receptionistToken", "receptionToken"];

  return keys.map((key) => localStorage.getItem(key)).find(Boolean) || "";
};

const isStaffNotificationContext = () => {
  const path = String(window.location?.pathname || "").toLowerCase();
  return ["/doctor", "/nurse", "/reception", "/lab"].some((prefix) =>
    path.startsWith(prefix)
  );
};

const getAuthenticatedHeaders = () => {
  const token = getModuleAuthToken();
  return {
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const pendingSuperAdminGetRequests = new Map();
const SUPER_ADMIN_GET_DEDUPE_MS = 1500;

export const superAdminRequest = async (path, options = {}) => {
  const { body, headers, ...rest } = options;
  const method = String(rest.method || "GET").toUpperCase();
  const shouldDedupe =
    method === "GET" &&
    !body &&
    !headers &&
    ["roles", "admins", "notifications", "notifications/stats", "SuperAdmin/dashboard", "dashboard"].some(
      (key) => String(path).toLowerCase().startsWith(key.toLowerCase())
    );
  const dedupeKey = shouldDedupe ? `${method}:${path}` : "";
  if (dedupeKey && pendingSuperAdminGetRequests.has(dedupeKey)) {
    return pendingSuperAdminGetRequests.get(dedupeKey);
  }

  const request = (async () => {
  const response = await fetch(apiUrl(path), {
    cache: "no-store",
    ...rest,
    headers: {
      ...getAuthenticatedHeaders(),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await readJson(response);

  if (!response.ok) {
    const message =
      getValidationMessage(payload) ||
      pick(payload, ["message", "error", "title"], "") ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
  })();

  if (dedupeKey) {
    pendingSuperAdminGetRequests.set(dedupeKey, request);
    window.setTimeout(() => {
      if (pendingSuperAdminGetRequests.get(dedupeKey) === request) {
        pendingSuperAdminGetRequests.delete(dedupeKey);
      }
    }, SUPER_ADMIN_GET_DEDUPE_MS);
  }

  return request;
};

const superAdminRequestFirst = async (paths, options = {}) => {
  const errors = [];

  for (const path of paths) {
    try {
      return await superAdminRequest(path, options);
    } catch (error) {
      errors.push(error);
    }
  }

  throw errors[errors.length - 1] || new Error("Request failed.");
};

const superAdminRequestOptional = async (path, options = {}) => {
  try {
    return await superAdminRequest(path, options);
  } catch {
    return [];
  }
};

export const normalizeClinic = (clinic = {}) => ({
  id: pick(clinic, ["id", "Id", "clinicId", "ClinicId", "clinicID", "hospitalId", "HospitalId", "hospitalID", "_id"]),
  name: pick(clinic, ["name", "Name", "clinicName", "ClinicName", "clinic_name", "hospitalName", "HospitalName"]),
  type: pick(clinic, ["type", "clinicType", "ClinicType", "category"], "General"),
  address: formatClinicAddress(clinic),
  contactNumber: pick(clinic, ["contactNumber", "phone", "phoneNumber", "mobile", "contact"]),
  email: pick(clinic, ["email", "clinicEmail"]),
  status: normalizeStatus(pick(clinic, ["status", "isActive", "active"], "Active")),
  createdDate: formatDateTime(pick(clinic, ["createdDate", "createdAt", "createdOn", "CreatedDate", "CreatedAt"], "")),
  updatedDate: formatDateTime(pick(clinic, ["updatedDate", "updatedAt", "modifiedAt", "UpdatedDate", "UpdatedAt"], "")),
  revenue: toNumber(pick(clinic, ["revenue", "totalRevenue"], 0)),
  users: toNumber(pick(clinic, ["users", "userCount", "totalUsers"], 0)),
  raw: clinic,
});

export const normalizeAdmin = (admin = {}) => ({
  id: pick(admin, ["id", "Id", "adminId", "AdminId", "adminID", "userId", "UserId", "_id"]),
  name: pick(admin, ["name", "Name", "fullName", "FullName", "adminName", "AdminName", "userName", "UserName"]),
  email: pick(admin, ["email", "Email", "emailAddress", "EmailAddress", "adminEmail", "AdminEmail"]),
  phone: pick(admin, ["phone", "phoneNumber", "mobile", "mobileNumber", "MobileNumber", "adminMobileNumber", "AdminMobileNumber"]),
  assignedClinic: (() => {
    const v = pick(admin, ["assignedClinic", "AssignedClinic", "clinicName", "ClinicName", "hospitalName", "HospitalName", "clinic"]);
    if (v && typeof v === "object") {
      return pick(v, ["name", "clinicName", "ClinicName", "hospitalName", "HospitalName"], "");
    }
    return String(v || "");
  })(),
  assignedClinicId: (() => {
    const v = pick(admin, ["clinicId", "ClinicId", "hospitalId", "HospitalId", "assignedClinicId", "AssignedClinicId"]);
    if (v && typeof v === "object") return pick(v, ["id", "clinicId", "ClinicId", "hospitalId", "HospitalId"], "");
    return v;
  })(),
  hospitalId: pick(admin, ["hospitalId", "HospitalId", "clinicId", "ClinicId", "assignedClinicId", "AssignedClinicId"], ""),
  adminUserId: pick(admin, ["adminUserId", "AdminUserId", "userId", "UserId", "id", "Id", "adminId", "AdminId"], ""),
  role: "Admin",
  status: normalizeStatus(pick(admin, ["status", "isActive", "active"], "Active")),
  raw: admin,
});

const buildAdminPayload = (admin = {}, { includeBlankPassword = true } = {}) => {
  const fullName = String(
    pick(admin, ["fullName", "name", "AdminName", "adminName"], "")
  ).trim();
  const password = pick(
    admin,
    ["password", "Password", "AdminPassword"],
    ""
  );

  const payload = {
    name: String(pick(admin, ["name", "fullName", "AdminName", "adminName"], fullName)).trim(),
    fullName,
    phone: String(
      pick(
        admin,
        ["phone", "phoneNumber", "mobile", "MobileNumber", "AdminMobileNumber", "adminMobileNumber"],
        ""
      )
    ).trim(),
    email: String(pick(admin, ["email", "AdminEmail", "adminEmail"], "")).trim(),
    password,
    role: pick(admin, ["role", "Role", "AdminRole"], "Admin"),
    hospitalId: Number(pick(admin, ["hospitalId", "clinicId", "assignedClinicId", "HospitalId", "ClinicId"], 0)) || 0,
    sendWelcomeEmail: pick(admin, ["sendWelcomeEmail"], true) !== false,
  };

  if (!includeBlankPassword && !payload.password) {
    delete payload.password;
  }

  return payload;
};

export const normalizeActivity = (activity = {}, index = 0) => ({
  id: pick(activity, ["id", "activityId", "_id"], index),
  title: pick(activity, ["title", "event", "action", "activity"], "Activity"),
  detail: pick(activity, ["detail", "description", "message", "module", "user"], ""),
  time: formatDateTime(pick(activity, ["time", "createdAt", "timestamp", "date"], "")),
  sortTime: getTimestamp(pick(activity, ["time", "createdAt", "timestamp", "date"], "")),
});

export const normalizeRevenuePoint = (point = {}, index = 0) => ({
  name: pick(point, ["name", "month", "date", "label"], `Item ${index + 1}`),
  revenue: toNumber(pick(point, ["revenue", "totalRevenue", "amount"], 0)),
  users: toNumber(pick(point, ["users", "userCount", "totalUsers", "activity"], 0)),
  invoices: getReportInvoiceCount(point),
});

export const normalizeAuditLog = (log = {}) => {
  const email = getAuditEmail(log);
  const userName = getAuditUserName(log);
  const normalizedEmail = email || (/@/.test(userName) ? userName : "");
  const action = pick(log, ["action", "systemAction", "activity", "message", "description"]);
  const systemAction = pick(log, ["systemAction", "module", "moduleName", "category"], "Audit");
  const actionText = String(action || systemAction || "").toLowerCase();
  const isLogoutActivity = actionText.includes("logout") || actionText.includes("logged out") || actionText.includes("signed out");
  const isLoginActivity =
    isLogoutActivity ||
    toBoolean(pick(log, ["isLoginActivity"], false)) ||
    String(systemAction).toLowerCase().includes("login") ||
    String(action).toLowerCase() === "login" ||
    /logged in/i.test(String(action));

  return {
    id: pick(log, ["id", "logId", "_id"]),
    userName,
    user: userName,
    userEmail: normalizedEmail,
    email: normalizedEmail,
    action: isLogoutActivity ? "Logout" : isLoginActivity ? "Login" : action,
    systemAction: isLogoutActivity ? "Logout" : isLoginActivity ? "Login" : systemAction,
    isLoginActivity,
    isLogoutActivity,
    timestampRaw: pick(log, ["timestamp", "createdAt", "date"]),
    timestamp: formatAuditDateTime(pick(log, ["timestamp", "createdAt", "date"])),
    sortTime: getAuditTimestamp(pick(log, ["timestamp", "createdAt", "date"])),
    module: pick(log, ["module", "moduleName", "category", "systemAction"], "Audit"),
    ipAddress: pick(log, AUDIT_IP_KEYS, ""),
    role: getAuditRole(log),
    clinicId: pick(log, ["clinicId", "ClinicId", "hospitalId", "HospitalId", "assignedClinicId", "AssignedClinicId"], ""),
    clinicName: pick(log, ["clinicName", "ClinicName", "hospitalName", "HospitalName", "assignedClinic", "AssignedClinic", "clinic"], ""),
    branchId: pick(log, ["branchId", "BranchId", "branchID", "BranchID"], ""),
    branchName: pick(log, ["branchName", "BranchName", "branch", "Branch"], ""),
  };
};

export const normalizeLoginLog = (log = {}, index = 0) => {
  const email = getAuditEmail(log);
  const userName = getAuditUserName(log);
  const normalizedEmail = email || (/@/.test(userName) ? userName : "");
  const rawAction = pick(log, ["action", "systemAction", "activity", "message", "description"], "Logged in");
  const rawActionText = String(rawAction).toLowerCase();
  const hasLogoutTime = Boolean(pick(log, ["logoutTime", "loggedOutAt", "logoutAt", "signedOutAt"], ""));
  const isOnline = toBoolean(pick(log, ["isOnline"], true));
  const isLogoutActivity =
    rawActionText.includes("logout") ||
    rawActionText.includes("logged out") ||
    rawActionText.includes("signed out") ||
    (hasLogoutTime && isOnline === false);
  const timestampValue = isLogoutActivity
    ? pick(log, ["logoutTime", "loggedOutAt", "logoutAt", "signedOutAt", "timestamp", "createdAt", "date", "time"])
    : pick(log, ["timestamp", "createdAt", "date", "loginTime", "time"]);

  return {
    id: pick(log, ["id", "logId", "_id"], `login-${index}`),
    userName,
    user: userName,
    userEmail: normalizedEmail,
    email: normalizedEmail,
    action: isLogoutActivity ? "Logout" : "Login",
    systemAction: isLogoutActivity ? "Logout" : "Login",
    isLoginActivity: true,
    isLogoutActivity,
    timestampRaw: timestampValue,
    timestamp: formatAuditDateTime(timestampValue),
    sortTime: getAuditTimestamp(timestampValue),
    module: isLogoutActivity ? "Logout" : "Login",
    ipAddress: pick(log, AUDIT_IP_KEYS, ""),
    role: getAuditRole(log),
    clinicId: pick(log, ["clinicId", "ClinicId", "hospitalId", "HospitalId", "assignedClinicId", "AssignedClinicId"], ""),
    clinicName: pick(log, ["clinicName", "ClinicName", "hospitalName", "HospitalName", "assignedClinic", "AssignedClinic", "clinic"], ""),
    branchId: pick(log, ["branchId", "BranchId", "branchID", "BranchID"], ""),
    branchName: pick(log, ["branchName", "BranchName", "branch", "Branch"], ""),
  };
};

const normalizeNotificationTarget = (target = "") => {
  const value = String(target || "").trim();
  const normalized = value.toLowerCase();

  if (normalized.includes("admin")) return "Active Admins";
  if (normalized.includes("active user") || normalized === "active users" || normalized.includes("user"))
    return "All Active Users";

  if (normalized.includes("doctor")) return "Doctors";
  if (normalized.includes("reception")) return "Receptionists";
  if (normalized.includes("patient")) return "Patients";

  return value || "Active Admins";
};

const getNotificationTarget = (notification = {}) => {
  const targetValues = [
    notification.targetUsers,
    notification.audience,
    notification.target,
    notification.recipient,
    notification.targetAudience,
    notification.userType,
    notification.role,
    notification.targetRole,
    notification.recipientType,
    notification.sendTo,
  ].filter(hasValue);

  return normalizeNotificationTarget(targetValues[0] || "Active Admins");
};

export const normalizeNotification = (notification = {}) => ({
  id: pick(notification, ["id", "notificationId", "_id"]),
  title: pick(notification, ["title", "subject"], "Notification"),
  message: pick(notification, ["message", "body", "description"]),
  targetUsers: getNotificationTarget(notification),
  status: normalizeNotificationStatus(notification),
  createdAt: pick(notification, ["createdAt", "createdOn", "date", "timestamp"], ""),
  type: pick(notification, ["type", "notificationType", "category"], ""),
  redirectUrl: pick(notification, ["redirectUrl", "redirectPath", "targetUrl", "targetPath", "actionUrl", "actionPath", "link", "url", "route", "path", "deepLink"], ""),
});

const getNotificationAudienceCode = (target = "") =>
  normalizeNotificationTarget(target).toLowerCase().includes("admin") ? "admins" : "users";

const buildNotificationPayload = (notification = {}) => {
  const targetUsers = normalizeNotificationTarget(
    pick(
      notification,
      ["targetUsers", "audience", "target", "recipient", "targetAudience", "userType", "role"],
      "Active Admins"
    )
  );
  const audienceCode = getNotificationAudienceCode(targetUsers);

  return {
    title: String(pick(notification, ["title", "subject"], "")).trim(),
    message: String(pick(notification, ["message", "body", "description"], "")).trim(),
    targetUsers,
    audience: audienceCode,
    target: audienceCode,
    recipient: audienceCode,
    targetAudience: audienceCode,
    targetRole: audienceCode,
    targetType: audienceCode,
    recipientType: audienceCode,
    sendTo: audienceCode,
    userType: audienceCode,
    role: audienceCode,
  };
};

const getNotificationIdentity = (notification = {}) => {
  return [
    notification.title,
    notification.message,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|");
};

const mergeNotificationRecords = (notifications = []) => {
  const merged = new Map();

  notifications.forEach((notification) => {
    const key = getNotificationIdentity(notification);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, notification);
      return;
    }

    const status =
      existing.status === "Read" || notification.status === "Read" ? "Read" : notification.status;

    merged.set(key, {
      ...existing,
      ...notification,
      status,
      id: notification.id || existing.id,
    });
  });

  return Array.from(merged.values());
};

const pickNestedObject = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  }

  return {};
};

const getReportAdminName = (source = {}) => {
  const directName = pick(source, [
    "adminName",
    "AdminName",
    "administratorName",
    "AdministratorName",
    "createdBy",
    "CreatedBy",
    "createdByName",
    "CreatedByName",
    "userName",
    "UserName",
    "admin",
    "Admin",
  ]);

  if (directName && typeof directName !== "object") return directName;

  const nestedAdmin = pickNestedObject(source, [
    "admin",
    "Admin",
    "administrator",
    "Administrator",
    "createdByUser",
    "CreatedByUser",
    "user",
    "User",
  ]);

  return pick(nestedAdmin, ["name", "Name", "fullName", "FullName", "adminName", "AdminName", "userName", "UserName"], "");
};

const getReportAdminEmail = (source = {}) => {
  const directEmail = pick(source, [
    "adminEmail",
    "AdminEmail",
    "administratorEmail",
    "AdministratorEmail",
    "createdByEmail",
    "CreatedByEmail",
    "email",
    "Email",
  ]);

  if (directEmail && typeof directEmail !== "object") return directEmail;

  const nestedAdmin = pickNestedObject(source, [
    "admin",
    "Admin",
    "administrator",
    "Administrator",
    "createdByUser",
    "CreatedByUser",
    "user",
    "User",
  ]);

  return pick(nestedAdmin, ["email", "Email", "emailAddress", "EmailAddress", "adminEmail", "AdminEmail"], "");
};

const getReportUserCount = (source = {}) =>
  toNumber(
    pick(
      source,
      [
        "users",
        "Users",
        "userCount",
        "UserCount",
        "usersCount",
        "UsersCount",
        "totalUsers",
        "TotalUsers",
        "totalUserCount",
        "TotalUserCount",
        "registeredUsers",
        "RegisteredUsers",
        "memberCount",
        "MemberCount",
        "patientCount",
        "PatientCount",
        "staffCount",
        "StaffCount",
        "activity",
        "Activity",
      ],
      0
    )
  );

const getReportInvoiceCount = (source = {}) =>
  toNumber(
    pick(
      source,
      [
        "invoiceCount",
        "InvoiceCount",
        "invoices",
        "Invoices",
        "billingCount",
        "BillingCount",
        "billCount",
        "BillCount",
        "totalInvoices",
        "TotalInvoices",
        "totalInvoiceCount",
        "TotalInvoiceCount",
        "generatedInvoices",
        "GeneratedInvoices",
      ],
      0
    )
  );

export const normalizeReportRow = (row = {}, index = 0) => ({
  id: pick(row, ["id", "Id", "clinicId", "ClinicId", "hospitalId", "HospitalId", "_id"], index),
  name: pick(row, ["name", "Name", "clinic", "Clinic", "clinicName", "ClinicName", "hospitalName", "HospitalName", "label"], `Report ${index + 1}`),
  adminName: getReportAdminName(row),
  adminEmail: getReportAdminEmail(row),
  revenue: toNumber(pick(row, ["revenue", "Revenue", "totalRevenue", "TotalRevenue", "Total Revenue", "total revenue", "netRevenue", "NetRevenue", "Net Revenue", "net revenue", "amount", "Amount", "total", "Total"], 0)),
  opRevenue: toNumber(pick(row, ["opRevenue", "OPRevenue", "OP Revenue", "op revenue"], 0)),
  diagnosticRevenue: toNumber(pick(row, ["diagnosticRevenue", "DiagnosticRevenue", "Diagnostic Revenue", "diagnostic revenue"], 0)),
  pharmacyRevenue: toNumber(pick(row, ["pharmacyRevenue", "PharmacyRevenue", "Pharmacy Revenue", "pharmacy revenue"], 0)),
  cgstAmount: toNumber(pick(row, ["cgstAmount", "CGSTAmount", "CGST Amount", "cgst amount", "cgst", "CGST"], 0)),
  sgstAmount: toNumber(pick(row, ["sgstAmount", "SGSTAmount", "SGST Amount", "sgst amount", "sgst", "SGST"], 0)),
  gstAmount: toNumber(pick(row, ["gstAmount", "GSTAmount", "totalGst", "TotalGst", "Total GST", "total GST", "GST", "taxAmount", "TaxAmount"], 0)),
  users: getReportUserCount(row),
  invoiceCount: getReportInvoiceCount(row),
  status: normalizeStatus(pick(row, ["status", "Status", "isActive", "IsActive", "active", "Active"], "Active")),
});

const getBillingAmount = (item = {}) =>
  toNumber(
    pick(
      item,
      [
        "totalAmount",
        "TotalAmount",
        "grandTotal",
        "GrandTotal",
        "netAmount",
        "NetAmount",
        "payableAmount",
        "PayableAmount",
        "total",
        "Total",
        "amount",
        "Amount",
        "paidAmount",
        "PaidAmount",
        "paymentAmount",
        "PaymentAmount",
        "revenue",
        "Revenue",
        "totalRevenue",
        "TotalRevenue",
        "consultationCharge",
        "ConsultationCharge",
        "consultationFee",
        "ConsultationFee",
      ],
      0
    )
  );

const getBillingType = (item = {}) => {
  const rawType = String(
    pick(item, ["invoiceType", "InvoiceType", "billingType", "BillingType", "serviceType", "ServiceType", "type", "Type", "category", "Category"], "")
  ).toLowerCase();
  const consultation = toNumber(pick(item, ["consultationCharge", "consultationCharges", "consultationFee", "opCharge", "opCharges", "opRevenue", "OPRevenue", "OP Revenue", "op revenue"], 0));
  const medicine = toNumber(pick(item, ["medicineCharge", "medicineCharges", "pharmacyCharge", "pharmacyCharges", "pharmacyRevenue", "PharmacyRevenue", "Pharmacy Revenue", "pharmacy revenue"], 0));
  const lab = toNumber(pick(item, ["labCharge", "labCharges", "diagnosticCharge", "diagnosticCharges", "diagnosticRevenue", "DiagnosticRevenue", "Diagnostic Revenue", "diagnostic revenue"], 0));

  if ((rawType.includes("consultation") || rawType.includes("op") || rawType.includes("patient portal")) && !rawType.includes("pharmacy") && !rawType.includes("diagnostic")) return "op";
  if (consultation > 0 && lab === 0 && medicine === 0) return "op";
  if (rawType.includes("pharmacy") || rawType.includes("medicine")) return "pharmacy";
  if (rawType.includes("diagnostic") || rawType.includes("diagnosis") || rawType.includes("lab") || rawType.includes("test")) return "diagnostic";
  if (medicine > 0 && lab === 0) return "pharmacy";
  if (lab > 0 && medicine === 0) return "diagnostic";
  return "op";
};

const getBillingDate = (item = {}) =>
  pick(item, [
    "createdAt",
    "CreatedAt",
    "createdOn",
    "CreatedOn",
    "paidAt",
    "PaidAt",
    "paymentDate",
    "PaymentDate",
    "invoiceDate",
    "InvoiceDate",
    "billDate",
    "BillDate",
    "date",
    "Date",
    "appointmentDate",
    "AppointmentDate",
  ], "");

const getBillingRecordKey = (item = {}, index = 0) =>
  normalizeLookupKey(
    getBillingType(item) === "op" && getBillingAppointmentId(item)
      ? `op-appointment-${getBillingAppointmentId(item)}`
      : pick(item, [
        "invoiceNo",
        "InvoiceNo",
        "invoiceNumber",
        "InvoiceNumber",
        "billNumber",
        "BillNumber",
        "billingId",
        "BillingId",
        "billId",
        "BillId",
        "id",
        "Id",
      ], "") ||
      `${pick(item, ["patientId", "patientName"], "patient")}-${getBillingAmount(item)}-${getBillingDate(item) || index}`
  );

const dedupeBillingRows = (rows = []) => {
  const byKey = new Map();
  rows.forEach((row, index) => {
    const key = getBillingRecordKey(row, index);
    if (!byKey.has(key)) byKey.set(key, row);
  });
  return Array.from(byKey.values());
};

const getMonthLabel = (value) => {
  const text = String(value || "").trim();
  const monthOnlyMatch = text.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*$/i);
  const date = monthOnlyMatch ? new Date(`${text} 1, ${new Date().getFullYear()}`) : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "Unknown";
  if (date.getFullYear() < 2020) {
    date.setFullYear(new Date().getFullYear());
  }
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

const getBillingAppointmentId = (item = {}) =>
  String(pick(item, ["appointmentId", "AppointmentId", "appointmentID", "AppointmentID", "apptId", "bookingId"], ""));

const getAppointmentClinicId = (item = {}) =>
  String(pick(item, ["clinicId", "ClinicId", "hospitalId", "HospitalId", "assignedClinicId", "AssignedClinicId", "clinicID", "hospitalID"], ""));

const getAppointmentClinicName = (item = {}) =>
  pick(item, ["clinicName", "ClinicName", "hospitalName", "HospitalName", "clinic", "Clinic", "assignedClinic", "AssignedClinic"], "");

const buildAppointmentClinicLookup = (appointmentRows = []) => {
  const lookup = new Map();

  appointmentRows.forEach((appointment) => {
    const appointmentId = normalizeLookupKey(getBillingAppointmentId(appointment) || pick(appointment, ["id", "Id"], ""));
    if (!appointmentId) return;

    lookup.set(appointmentId, {
      clinicId: getAppointmentClinicId(appointment),
      clinicName: getAppointmentClinicName(appointment),
    });
  });

  return lookup;
};

const getBillingAppointmentClinic = (item = {}, appointmentLookup = new Map()) =>
  appointmentLookup.get(normalizeLookupKey(getBillingAppointmentId(item))) || {};

const getBillingClinicId = (item = {}, appointmentLookup = new Map()) =>
  String(
    pick(item, ["clinicId", "ClinicId", "hospitalId", "HospitalId", "assignedClinicId", "AssignedClinicId", "clinicID", "hospitalID"], "") ||
      getBillingAppointmentClinic(item, appointmentLookup).clinicId ||
      ""
  );

const getBillingClinicName = (item = {}, appointmentLookup = new Map()) =>
  pick(item, ["clinicName", "ClinicName", "hospitalName", "HospitalName", "clinic", "Clinic", "assignedClinic", "AssignedClinic"], "") ||
  getBillingAppointmentClinic(item, appointmentLookup).clinicName ||
  "";

const getBillingAdminKey = (item = {}) =>
  String(
    pick(item, ["adminId", "AdminId", "createdById", "CreatedById", "userId", "UserId", "createdBy", "CreatedBy", "adminEmail", "AdminEmail", "createdByEmail", "CreatedByEmail"], "")
  );

const buildRevenueChart = (billingRows = []) => {
  const byMonth = new Map();

  billingRows.forEach((item) => {
    const month = getMonthLabel(getBillingDate(item));
    const current = byMonth.get(month) || { name: month, revenue: 0, users: 0, invoices: 0 };
    current.revenue += getBillingAmount(item);
    current.invoices += 1;
    current.users += 1;
    byMonth.set(month, current);
  });

  return Array.from(byMonth.values());
};

const buildMonthlyRevenueRows = (revenueRows = []) => {
  const byMonth = new Map();

  revenueRows.map(normalizeRevenuePoint).forEach((point) => {
    const label = String(point.name || "").trim();
    if (!label || /^item\s+\d+$/i.test(label)) return;

    const month = getMonthLabel(label);
    const current = byMonth.get(month) || { name: month, revenue: 0, users: 0, invoices: 0 };
    current.revenue += toNumber(point.revenue);
    current.users += toNumber(point.users);
    current.invoices += toNumber(point.invoices);
    byMonth.set(month, current);
  });

  return Array.from(byMonth.values());
};

const mergeReportChartData = ({ revenueRows = [], activityRows = [], billingRows = [], rows = [] }) => {
  const billingChart = buildRevenueChart(billingRows);
  const monthlyRevenueRows = buildMonthlyRevenueRows(revenueRows);
  const baseRows = billingChart.length ? billingChart : monthlyRevenueRows;

  if (!baseRows.length) return [];

  const billingByPeriod = new Map(
    billingChart.map((point) => [normalizeLookupKey(point.name), point])
  );
  const revenueRowsOnly = rows.filter((row) => toNumber(row.revenue) > 0);
  const rowsForRevenueTotals = revenueRowsOnly.length ? revenueRowsOnly : rows;
  const totalInvoices = rowsForRevenueTotals.reduce((sum, row) => sum + getReportInvoiceCount(row), 0);
  const totalUsers = rowsForRevenueTotals.reduce((sum, row) => sum + getReportUserCount(row), 0);

  return baseRows.map((point, index) => {
    const billingPoint =
      billingByPeriod.get(normalizeLookupKey(point.name)) ||
      (baseRows.length === 1 && billingChart.length === 1 ? billingChart[0] : {});
    const hasRevenue = getBillingAmount(point) > 0 || toNumber(point.revenue) > 0;

    return {
      ...point,
      invoices:
        toNumber(point.invoices) ||
        toNumber(billingPoint.invoices) ||
        (hasRevenue ? totalInvoices : 0),
      users:
        (hasRevenue ? totalUsers : 0) ||
        toNumber(point.users) ||
        toNumber(billingPoint.users),
    };
  });
};

const getReportClinicId = (row = {}) =>
  String(pick(row, ["clinicId", "ClinicId", "hospitalId", "HospitalId", "assignedClinicId", "AssignedClinicId"], ""));

const getReportClinicName = (row = {}) =>
  pick(row, ["name", "Name", "clinic", "Clinic", "clinicName", "ClinicName", "hospitalName", "HospitalName", "assignedClinic", "AssignedClinic"], "");

const normalizeLookupKey = (key) => {
  const normalizedKey = normalizeString(key);
  return normalizedKey && normalizedKey !== "0" ? normalizedKey : "";
};

const addUserCountValue = (lookup, key) => {
  const normalizedKey = normalizeLookupKey(key);
  if (normalizedKey) {
    lookup.set(normalizedKey, (lookup.get(normalizedKey) || 0) + 1);
  }
};

const addLookupCountValue = (lookup, key) => {
  const normalizedKey = normalizeLookupKey(key);
  if (normalizedKey) {
    lookup.set(normalizedKey, (lookup.get(normalizedKey) || 0) + 1);
  }
};

const buildClinicUserCountLookup = (userRows = []) => {
  const lookup = new Map();

  userRows
    .map(normalizeUser)
    .filter((user) => !user.isDeleted)
    .forEach((user) => {
      const keys = new Set(
        [
          user.clinicId,
          user.hospitalId,
          user.clinic,
          pick(user.raw, ["clinicName", "ClinicName", "hospitalName", "HospitalName", "assignedClinic", "AssignedClinic"], ""),
        ]
          .map((value) => normalizeLookupKey(value))
          .filter(Boolean)
      );

      keys.forEach((key) => addUserCountValue(lookup, key));
    });

  return lookup;
};

const buildClinicInvoiceCountLookup = (billingRows = [], appointmentRows = []) => {
  const lookup = new Map();
  const appointmentLookup = buildAppointmentClinicLookup(appointmentRows);
  let totalRevenue = 0;

  billingRows.forEach((item) => {
    totalRevenue += getBillingAmount(item);

    const keys = new Set(
      [
        getBillingClinicId(item, appointmentLookup),
        getBillingClinicName(item, appointmentLookup),
        getBillingAdminKey(item),
        getReportAdminName(item),
        getReportAdminEmail(item),
        pick(item, ["clinicName", "ClinicName", "hospitalName", "HospitalName", "assignedClinic", "AssignedClinic"], ""),
      ]
        .map((value) => normalizeLookupKey(value))
        .filter(Boolean)
    );

    keys.forEach((key) => addLookupCountValue(lookup, key));
  });

  lookup.set("__total_count__", billingRows.length);
  lookup.set("__total_revenue__", totalRevenue);

  return lookup;
};

const getClinicUserCount = (rawRow = {}, normalizedRow = {}, clinic = {}, lookup = new Map()) => {
  const keys = [
    getReportClinicId(rawRow),
    clinic.id,
    normalizedRow.id,
    getReportClinicName(rawRow),
    clinic.name,
    normalizedRow.name,
  ];

  for (const key of keys) {
    const count = lookup.get(normalizeLookupKey(key));
    if (count !== undefined) return count;
  }

  return 0;
};

const getClinicInvoiceCount = (rawRow = {}, normalizedRow = {}, clinic = {}, lookup = new Map()) => {
  const keys = [
    getReportClinicId(rawRow),
    clinic.id,
    normalizedRow.id,
    getReportClinicName(rawRow),
    clinic.name,
    normalizedRow.name,
    getReportAdminName(rawRow),
    getReportAdminEmail(rawRow),
  ];

  for (const key of keys) {
    const count = lookup.get(normalizeLookupKey(key));
    if (count !== undefined) return count;
  }

  const totalCount = lookup.get("__total_count__") || 0;
  const totalRevenue = lookup.get("__total_revenue__") || 0;
  const rowRevenue = toNumber(normalizedRow.revenue || pick(rawRow, ["revenue", "Revenue", "totalRevenue", "TotalRevenue", "amount", "Amount"], 0));

  if (totalCount > 0 && rowRevenue > 0 && totalRevenue > 0 && rowRevenue === totalRevenue) {
    return totalCount;
  }

  return 0;
};

const buildAdminLookups = ({ clinicRows = [], adminRows = [] }) => {
  const clinics = clinicRows.map(normalizeClinic);
  const admins = adminRows.map(normalizeAdmin);
  const clinicById = new Map(clinics.map((clinic) => [String(clinic.id), clinic]));
  const clinicByName = new Map(clinics.map((clinic) => [String(clinic.name).toLowerCase(), clinic]));
  const adminByClinicId = new Map();
  const adminByClinicName = new Map();
  const adminById = new Map();
  const adminByEmail = new Map();

  admins.forEach((admin) => {
    if (admin.id) adminById.set(String(admin.id), admin);
    if (admin.email) adminByEmail.set(String(admin.email).toLowerCase(), admin);
    if (admin.assignedClinicId) adminByClinicId.set(String(admin.assignedClinicId), admin);
    if (admin.assignedClinic) adminByClinicName.set(String(admin.assignedClinic).toLowerCase(), admin);
  });

  return { admins, clinics, clinicById, clinicByName, adminByClinicId, adminByClinicName, adminById, adminByEmail };
};

const findReportAdmin = (rawRow = {}, normalizedRow = {}, lookups = {}) => {
  const rawAdminId = pick(rawRow, ["adminId", "AdminId", "createdById", "CreatedById", "userId", "UserId"], "");
  const rawAdminEmail = getReportAdminEmail(rawRow);
  const clinic = findReportClinic(rawRow, normalizedRow, lookups);
  const clinicId = getReportClinicId(rawRow);

  return (
    (rawAdminId && lookups.adminById.get(String(rawAdminId))) ||
    (rawAdminEmail && lookups.adminByEmail.get(String(rawAdminEmail).toLowerCase())) ||
    (clinicId && lookups.adminByClinicId.get(String(clinicId))) ||
    (clinic.id && lookups.adminByClinicId.get(String(clinic.id))) ||
    (normalizedRow.name && lookups.adminByClinicName.get(String(normalizedRow.name).toLowerCase())) ||
    (clinic.name && lookups.adminByClinicName.get(String(clinic.name).toLowerCase())) ||
    {}
  );
};

const findReportClinic = (rawRow = {}, normalizedRow = {}, lookups = {}) => {
  const clinicId = getReportClinicId(rawRow);
  return (
    (clinicId && lookups.clinicById.get(String(clinicId))) ||
    (normalizedRow.name && lookups.clinicByName.get(String(normalizedRow.name).toLowerCase())) ||
    {}
  );
};

const enrichReportRows = ({ rows = [], clinicRows = [], adminRows = [], userRows = [], billingRows = [], appointmentRows = [] }) => {
  const lookups = buildAdminLookups({ clinicRows, adminRows });
  const userCountLookup = buildClinicUserCountLookup(userRows);
  const invoiceCountLookup = buildClinicInvoiceCountLookup(billingRows, appointmentRows);

  return rows.map((row, index) => {
    const normalizedRow = normalizeReportRow(row, index);
    const clinic = findReportClinic(row, normalizedRow, lookups);
    const admin = findReportAdmin(row, normalizedRow, lookups);
    const clinicUsers = getClinicUserCount(row, normalizedRow, clinic, userCountLookup);
    const assignedClinicUsers = toNumber(pick(clinic, ["users"], 0));
    const users = clinicUsers || assignedClinicUsers || normalizedRow.users;
    const invoiceCount = Math.max(
      normalizedRow.invoiceCount,
      getClinicInvoiceCount(row, normalizedRow, clinic, invoiceCountLookup)
    );

    return {
      ...normalizedRow,
      opRevenue: toNumber(row.opRevenue ?? row.OPRevenue ?? row["OP Revenue"] ?? row["op revenue"] ?? normalizedRow.opRevenue),
      diagnosticRevenue: toNumber(row.diagnosticRevenue ?? row.DiagnosticRevenue ?? row["Diagnostic Revenue"] ?? row["diagnostic revenue"] ?? normalizedRow.diagnosticRevenue),
      pharmacyRevenue: toNumber(row.pharmacyRevenue ?? row.PharmacyRevenue ?? row["Pharmacy Revenue"] ?? row["pharmacy revenue"] ?? normalizedRow.pharmacyRevenue),
      cgstAmount: toNumber(row.cgstAmount ?? row.CGSTAmount ?? row["CGST Amount"] ?? row["cgst amount"] ?? row.cgst ?? row.CGST ?? normalizedRow.cgstAmount),
      sgstAmount: toNumber(row.sgstAmount ?? row.SGSTAmount ?? row["SGST Amount"] ?? row["sgst amount"] ?? row.sgst ?? row.SGST ?? normalizedRow.sgstAmount),
      gstAmount: toNumber(row.gstAmount ?? row.GSTAmount ?? row.totalGst ?? row.TotalGst ?? row["Total GST"] ?? row["total GST"] ?? row.GST ?? normalizedRow.gstAmount),
      revenue: toNumber(row.revenue ?? row.Revenue ?? row.totalRevenue ?? row.TotalRevenue ?? row["Total Revenue"] ?? row["total revenue"] ?? normalizedRow.revenue),
      adminName: normalizedRow.adminName || admin.name || "",
      adminEmail: normalizedRow.adminEmail || admin.email || "",
      users,
      invoiceCount,
    };
  });
};

const buildClinicRevenueRowsFromBilling = ({ billingRows = [], clinicRows = [], adminRows = [], userRows = [], appointmentRows = [] }) => {
  const lookups = buildAdminLookups({ clinicRows, adminRows });
  const userCountLookup = buildClinicUserCountLookup(userRows);
  const invoiceCountLookup = buildClinicInvoiceCountLookup(billingRows, appointmentRows);
  const appointmentLookup = buildAppointmentClinicLookup(appointmentRows);
  const grouped = new Map();

  billingRows.forEach((bill, index) => {
    const clinicId = getBillingClinicId(bill, appointmentLookup);
    const clinicName = getBillingClinicName(bill, appointmentLookup);
    const normalized = normalizeReportRow({
      ...bill,
      clinicId,
      hospitalId: clinicId,
      clinicName,
      hospitalName: clinicName,
    }, index);
    const clinic = findReportClinic({ ...bill, clinicId, hospitalId: clinicId, clinicName, hospitalName: clinicName }, normalized, lookups);
    const name = clinic.name || clinicName || normalized.name || "Unassigned Clinic";
    const id = clinic.id || clinicId || normalized.id || name;
    const key = normalizeLookupKey(id) || normalizeLookupKey(name) || `clinic-${index}`;
    const admin = findReportAdmin({ ...bill, clinicId, hospitalId: clinicId, clinicName, hospitalName: clinicName }, { ...normalized, id, name }, lookups);
    const current = grouped.get(key) || {
      id,
      clinicId: id,
      hospitalId: id,
      name,
      adminName: admin.name || getReportAdminName(bill) || "Admin",
      adminEmail: admin.email || getReportAdminEmail(bill) || "",
      revenue: 0,
      opRevenue: 0,
      diagnosticRevenue: 0,
      pharmacyRevenue: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      gstAmount: 0,
      users: Math.max(toNumber(pick(clinic, ["users"], 0)), getClinicUserCount(bill, normalized, clinic, userCountLookup)),
      invoiceCount: 0,
      status: clinic.status || "Active",
      raw: { _matchedClinic: clinic.raw || clinic },
    };
    const breakdown = getSharedRevenueBreakdown(bill);
    current.opRevenue += breakdown.opRevenue;
    current.diagnosticRevenue += breakdown.diagnosticRevenue;
    current.pharmacyRevenue += breakdown.pharmacyRevenue;
    current.revenue += breakdown.revenue || getBillingAmount(bill);
    current.cgstAmount += toNumber(pick(bill, ["cgstAmount", "CGSTAmount", "cgst", "CGST"], 0));
    current.sgstAmount += toNumber(pick(bill, ["sgstAmount", "SGSTAmount", "sgst", "SGST"], 0));
    current.gstAmount += toNumber(pick(bill, ["gstAmount", "GSTAmount", "taxAmount", "TaxAmount"], 0));
    current.invoiceCount = Math.max(current.invoiceCount + 1, getClinicInvoiceCount(bill, normalized, clinic, invoiceCountLookup));
    grouped.set(key, current);
  });

  return Array.from(grouped.values());
};

const getClinicRecordId = (clinic = {}) =>
  String(pick(clinic, ["id", "Id", "clinicId", "ClinicId", "hospitalId", "HospitalId", "_id"], "")).trim();

const getClinicRecordName = (clinic = {}) =>
  String(pick(clinic, ["name", "Name", "clinicName", "ClinicName", "hospitalName", "HospitalName"], "Clinic")).trim();

const fetchClinicRevenueDetailRows = async (clinicRows = []) => {
  const results = await Promise.allSettled(
    clinicRows.map(async (clinic) => {
      const clinicId = getClinicRecordId(clinic);
      if (!clinicId) return [];
      const value = await superAdminRequestOptional(`${SUPER_ADMIN_API.reportsClinicRevenueByHospital}/${encodeURIComponent(clinicId)}`);
      return asArray(value).map((row) => ({
        ...row,
        clinicId,
        ClinicId: clinicId,
        hospitalId: clinicId,
        HospitalId: clinicId,
        clinicName: getClinicRecordName(clinic),
        ClinicName: getClinicRecordName(clinic),
        hospitalName: getClinicRecordName(clinic),
        HospitalName: getClinicRecordName(clinic),
      }));
    })
  );
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
};

const asRevenueRows = (value) => {
  const directRows = asArray(value);
  if (directRows.length) return directRows;
  if (!value || typeof value !== "object") return [];

  for (const key of ["data", "result", "results", "records", "items", "reports", "revenue", "rows"]) {
    const nestedRows = asArray(value[key]);
    if (nestedRows.length) return nestedRows;
  }

  return [];
};

const fetchClinicDashboardRevenueRows = async (clinicRows = []) => {
  const results = await Promise.allSettled(
    clinicRows.map(async (clinic) => {
      const clinicId = getClinicRecordId(clinic);
      if (!clinicId) return [];
      const params = new URLSearchParams();
      params.set("hospitalId", clinicId);
      params.set("clinicId", clinicId);
      const value = await superAdminRequestOptional(`${SUPER_ADMIN_API.dashboardRevenueReport}?${params.toString()}`);
      return asRevenueRows(value).map((row) => ({
        ...row,
        clinicId,
        ClinicId: clinicId,
        hospitalId: clinicId,
        HospitalId: clinicId,
        clinicName: getClinicRecordName(clinic),
        ClinicName: getClinicRecordName(clinic),
        hospitalName: getClinicRecordName(clinic),
        HospitalName: getClinicRecordName(clinic),
      }));
    })
  );
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
};

const getReportRowRevenue = (row = {}) => {
  const direct = toNumber(pick(row, ["revenue", "Revenue", "totalRevenue", "TotalRevenue", "Total Revenue", "total revenue", "netRevenue", "NetRevenue", "Net Revenue", "net revenue", "amount", "Amount", "total", "Total"], 0));
  if (direct) return direct;
  const breakdown = getSharedRevenueBreakdown(row);
  return breakdown.revenue;
};

const buildClinicRevenueRowsFromReportRows = ({ reportRows = [], clinicRows = [], adminRows = [], userRows = [] }) => {
  const lookups = buildAdminLookups({ clinicRows, adminRows });
  const userCountLookup = buildClinicUserCountLookup(userRows);
  const grouped = new Map();

  reportRows.forEach((row, index) => {
    const normalized = normalizeReportRow(row, index);
    const clinic = findReportClinic(row, normalized, lookups);
    const clinicId = clinic.id || getReportClinicId(row) || normalized.id;
    const clinicName = clinic.name || getReportClinicName(row) || normalized.name;
    const key = normalizeLookupKey(clinicId) || normalizeLookupKey(clinicName) || `clinic-${index}`;
    const admin = findReportAdmin(row, { ...normalized, id: clinicId, name: clinicName }, lookups);
    const current = grouped.get(key) || {
      id: clinicId || key,
      clinicId: clinicId || key,
      hospitalId: clinicId || key,
      name: clinicName || "Clinic",
      adminName: admin.name || normalized.adminName || "Admin",
      adminEmail: admin.email || normalized.adminEmail || "",
      revenue: 0,
      opRevenue: 0,
      diagnosticRevenue: 0,
      pharmacyRevenue: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      gstAmount: 0,
      users: Math.max(normalized.users, getClinicUserCount(row, normalized, clinic, userCountLookup)),
      invoiceCount: normalized.invoiceCount,
      status: clinic.status || normalized.status || "Active",
      raw: { ...row, _matchedClinic: clinic.raw || clinic },
    };
    const breakdown = getSharedRevenueBreakdown(row);
    current.opRevenue += breakdown.opRevenue;
    current.diagnosticRevenue += breakdown.diagnosticRevenue;
    current.pharmacyRevenue += breakdown.pharmacyRevenue;
    current.revenue += getReportRowRevenue(row);
    current.cgstAmount += toNumber(pick(row, ["cgstAmount", "CGSTAmount", "CGST Amount", "cgst amount", "cgst", "CGST"], 0));
    current.sgstAmount += toNumber(pick(row, ["sgstAmount", "SGSTAmount", "SGST Amount", "sgst amount", "sgst", "SGST"], 0));
    current.gstAmount += toNumber(pick(row, ["gstAmount", "GSTAmount", "totalGst", "TotalGst", "Total GST", "total GST", "GST", "taxAmount", "TaxAmount"], 0));
    grouped.set(key, current);
  });

  return Array.from(grouped.values());
};

const getClinicRevenueRowKey = (row = {}) =>
  normalizeLookupKey(row.id || row.clinicId || row.hospitalId || getReportClinicId(row)) ||
  normalizeLookupKey(row.name || row.clinicName || row.hospitalName);

const mergeRevenueRow = (current = {}, next = {}) => {
  const opRevenue = Math.max(toNumber(current.opRevenue), toNumber(next.opRevenue));
  const diagnosticRevenue = Math.max(toNumber(current.diagnosticRevenue), toNumber(next.diagnosticRevenue));
  const pharmacyRevenue = Math.max(toNumber(current.pharmacyRevenue), toNumber(next.pharmacyRevenue));
  const cgstAmount = Math.max(toNumber(current.cgstAmount), toNumber(next.cgstAmount));
  const sgstAmount = Math.max(toNumber(current.sgstAmount), toNumber(next.sgstAmount));
  const gstAmount = Math.max(toNumber(current.gstAmount), toNumber(next.gstAmount), cgstAmount + sgstAmount);
  const splitTotal = opRevenue + diagnosticRevenue + pharmacyRevenue;
  const revenue = Math.max(toNumber(current.revenue), toNumber(next.revenue), splitTotal);

  return {
    ...current,
    ...next,
    adminName: current.adminName || next.adminName,
    adminEmail: current.adminEmail || next.adminEmail,
    opRevenue,
    diagnosticRevenue,
    pharmacyRevenue,
    cgstAmount,
    sgstAmount,
    gstAmount,
    revenue,
    users: Math.max(toNumber(current.users), toNumber(next.users)),
    invoiceCount: Math.max(toNumber(current.invoiceCount), toNumber(next.invoiceCount)),
  };
};

const mergeClinicRevenueSources = (...rowGroups) => {
  const merged = new Map();

  rowGroups.flat().forEach((row, index) => {
    if (!row) return;
    const key = getClinicRevenueRowKey(row) || `clinic-revenue-${index}`;
    const existing = merged.get(key);
    merged.set(key, existing ? mergeRevenueRow(existing, row) : row);
  });

  return Array.from(merged.values());
};

export const normalizeRole = (role = {}, index = 0) => {
  if (typeof role === "string") {
    return {
      id: "",
      key: `role-${index}-${role || "role"}`,
      canPersistPermissions: false,
      name: role || "Role",
      roleName: role || "Role",
      module: "General",
      users: 0,
      status: "Active",
      permissions: ["View"],
      modulePermissions: {},
      raw: role,
    };
  }

  const formatPermission = (permission = "") => {
    const value = String(permission || "").trim().toLowerCase();

    if (value === "view") return "View";
    if (value === "create") return "Create";
    if (value === "edit") return "Edit";
    if (value === "delete") return "Delete";
    return "";
  };
  const permissions = pick(role, ["permissions", "permissionNames", "claims"], []);
  const normalizedPermissions = Array.isArray(permissions)
    ? permissions.map((permission) =>
        formatPermission(
          typeof permission === "string"
            ? permission
            : pick(permission, ["name", "permission", "claimValue", "value"])
        )
      )
    : [];
  const booleanPermissions = [
    pick(role, ["canView", "CanView"], false) ? "View" : "",
    pick(role, ["canCreate", "CanCreate"], false) ? "Create" : "",
    pick(role, ["canEdit", "CanEdit"], false) ? "Edit" : "",
    pick(role, ["canDelete", "CanDelete"], false) ? "Delete" : "",
  ].filter(Boolean);

  const id = pick(role, ["id", "Id", "roleId", "RoleId", "_id"], "");
  const name = pick(role, ["name", "Name", "roleName", "RoleName", "title", "Title"], "Role");
  const roleName = pick(role, ["roleName", "RoleName", "name", "Name", "title", "Title"], "Role");
  const directModulePermissions =
    pick(role, ["modulePermissions", "ModulePermissions", "permissionsByModule", "PermissionsByModule"], {}) || {};
  const modulePermissionRows = [
    ...(Array.isArray(role.permissionModules) ? role.permissionModules : []),
    ...(Array.isArray(role.PermissionModules) ? role.PermissionModules : []),
    ...(Array.isArray(role.rolePermissions) ? role.rolePermissions : []),
    ...(Array.isArray(role.RolePermissions) ? role.RolePermissions : []),
    ...(Array.isArray(role.selectedModules) ? role.selectedModules : []),
    ...(Array.isArray(role.SelectedModules) ? role.SelectedModules : []),
  ];
  const modulePermissions =
    directModulePermissions && typeof directModulePermissions === "object" && !Array.isArray(directModulePermissions)
      ? { ...directModulePermissions }
      : {};
  modulePermissionRows.forEach((permissionModule) => {
    if (!permissionModule || typeof permissionModule !== "object") return;
    const module = pick(permissionModule, ["module", "Module", "moduleName", "ModuleName", "name", "Name"], "");
    if (!module) return;
    const rowPermissions = [
      ...(Array.isArray(permissionModule.permissions) ? permissionModule.permissions : []),
      ...(Array.isArray(permissionModule.Permissions) ? permissionModule.Permissions : []),
      ...(Array.isArray(permissionModule.permissionNames) ? permissionModule.permissionNames : []),
      ...(Array.isArray(permissionModule.PermissionNames) ? permissionModule.PermissionNames : []),
      pick(permissionModule, ["canView", "CanView"], false) ? "View" : "",
      pick(permissionModule, ["canCreate", "CanCreate"], false) ? "Create" : "",
      pick(permissionModule, ["canEdit", "CanEdit"], false) ? "Edit" : "",
      pick(permissionModule, ["canDelete", "CanDelete"], false) ? "Delete" : "",
    ].filter(Boolean);
    modulePermissions[module] = rowPermissions;
  });

  return {
    id,
    key: id || `role-${index}-${roleName || name}`,
    canPersistPermissions: hasValue(id),
    hospitalId: pick(role, ["hospitalId", "HospitalId", "hospitalID", "HospitalID", "clinicId", "ClinicId", "clinicID", "ClinicID"], ""),
    adminUserId: pick(role, ["adminUserId", "AdminUserId", "adminUserID", "AdminUserID", "adminId", "AdminId", "userId", "UserId"], ""),
    adminId: pick(role, ["adminId", "AdminId", "adminUserId", "AdminUserId", "userId", "UserId"], ""),
    userId: pick(role, ["userId", "UserId", "adminUserId", "AdminUserId", "adminId", "AdminId"], ""),
    name,
    roleName,
    module: pick(role, ["module", "Module", "moduleName", "ModuleName"], ""),
    users: toNumber(pick(role, ["users", "userCount", "assignedUsers", "totalUsers"], 0)),
    status: normalizeStatus(pick(role, ["status", "isActive", "active"], "Active")),
    permissions: normalizedPermissions.filter(Boolean).length
      ? normalizedPermissions.filter(Boolean)
      : booleanPermissions,
    modulePermissions:
      modulePermissions && typeof modulePermissions === "object" && !Array.isArray(modulePermissions)
        ? modulePermissions
        : {},
    raw: role,
  };
};

const isDeletedRecord = (record = {}) => {
  const deletedValue = pick(
    record,
    ["isDeleted", "deleted", "isRemoved", "removed", "IsDeleted", "Deleted"],
    false
  );
  const status = String(pick(record, ["status", "Status"], "")).trim().toLowerCase();
  const deletedAt = pick(record, ["deletedAt", "DeletedAt", "deleted_at", "removedAt", "RemovedAt", "removed_at"], "");

  return (
    deletedValue === true ||
    deletedValue === 1 ||
    String(deletedValue).toLowerCase() === "true" ||
    status === "deleted" ||
    hasValue(deletedAt)
  );
};

export const normalizeUser = (user = {}, index = 0) => ({
  id: pick(user, ["id", "userId", "_id"], index),
  name: pick(user, ["name", "fullName", "userName", "displayName"], "User"),
  email: pick(user, ["email", "emailAddress"]),
  clinic: pick(user, ["clinic", "clinicName", "assignedClinic", "clinicId"]),
  hospitalId: pick(user, ["hospitalId", "HospitalId"], 0),
  clinicId: pick(user, ["clinicId", "ClinicId"], 0),
  type: pick(user, ["type", "userType", "role", "roleName"], "User"),
  role: pick(user, ["role", "roleName", "type", "userType"], "User"),
  status: normalizeUserStatus(user),
  lastActive: formatLastActive(user),
  phone: pick(user, ["phone", "phoneNumber", "mobile", "contactNumber"]),
  mobileNumber: pick(user, ["mobileNumber", "mobile", "phoneNumber", "phone"]),
  isDeleted: isDeletedRecord(user),
  raw: user,
});

const buildUserPayload = (user = {}, { includeBlankPassword = true } = {}) => {
  const phone = String(pick(user, ["phone", "phoneNumber", "mobile", "contactNumber"], "")).trim();
  const mobileNumber = String(pick(user, ["mobileNumber", "mobile", "phoneNumber", "phone"], phone)).trim();
  const type = pick(user, ["type", "userType"], pick(user, ["role", "roleName"], "User"));
  const role = pick(user, ["role", "roleName"], type);

  const payload = {
    name: String(pick(user, ["name", "fullName", "userName", "displayName"], "")).trim(),
    email: String(pick(user, ["email", "emailAddress"], "")).trim(),
    clinic: String(pick(user, ["clinic", "clinicName", "assignedClinic"], "")).trim(),
    hospitalId: Number(pick(user, ["hospitalId", "HospitalId"], 0)) || 0,
    clinicId: Number(pick(user, ["clinicId", "ClinicId", "hospitalId", "HospitalId"], 0)) || 0,
    type,
    role,
    status: pick(user, ["status"], "Active"),
    phone,
    mobileNumber,
    password: pick(user, ["password", "Password"], ""),
  };

  if (!includeBlankPassword && !payload.password) {
    delete payload.password;
  }

  return payload;
};

const defaultSettingsPayload = {
  applicationName: "CMS Platform",
  generalName: "CMS Platform",
  supportEmail: "",
  supportPhone: "",
  address: "",
  configurationNotes: "Update settings used across all clinics.",
  status: "Enabled",
  emailNotificationsEnabled: true,
  smsNotificationsEnabled: true,
};

const asSettingsBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (!hasValue(value)) return fallback;

  const normalized = normalizeString(value);
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "enabled";
};

const buildSettingsPayload = (settings = {}) => {
  const payload = asObject(settings);
  const general = payload.general || payload.generalSettings || {};
  const email = payload.email || payload.emailSettings || {};
  const sms = payload.sms || payload.smsSettings || {};

  return {
    applicationName: String(
      pick(payload, ["applicationName", "appName", "platformName", "name"], pick(general, ["applicationName", "appName", "platformName", "name"], defaultSettingsPayload.applicationName))
    ).trim(),
    generalName: String(
      pick(payload, ["generalName", "name"], pick(general, ["generalName", "name"], defaultSettingsPayload.generalName))
    ).trim(),
    supportEmail: String(
      pick(payload, ["supportEmail", "fromEmail", "senderEmail", "email"], pick(email, ["supportEmail", "fromEmail", "senderEmail", "email"], defaultSettingsPayload.supportEmail))
    ).trim(),
    supportPhone: String(
      pick(payload, ["supportPhone", "phone", "phoneNumber", "mobile", "contactNumber"], defaultSettingsPayload.supportPhone)
    ).trim(),
    address: String(pick(payload, ["address", "location"], defaultSettingsPayload.address)).trim(),
    configurationNotes: String(
      pick(payload, ["configurationNotes", "notes", "description"], pick(general, ["configurationNotes", "notes", "description"], defaultSettingsPayload.configurationNotes))
    ).trim(),
    status: String(
      pick(payload, ["status"], pick(general, ["status"], defaultSettingsPayload.status))
    ).trim() || defaultSettingsPayload.status,
    emailNotificationsEnabled: asSettingsBoolean(
      pick(payload, ["emailNotificationsEnabled", "emailEnabled", "enableEmailNotifications"], pick(email, ["emailNotificationsEnabled", "enabled", "isEnabled"], defaultSettingsPayload.emailNotificationsEnabled)),
      defaultSettingsPayload.emailNotificationsEnabled
    ),
    smsNotificationsEnabled: asSettingsBoolean(
      pick(payload, ["smsNotificationsEnabled", "smsEnabled", "enableSmsNotifications"], pick(sms, ["smsNotificationsEnabled", "enabled", "isEnabled"], defaultSettingsPayload.smsNotificationsEnabled)),
      defaultSettingsPayload.smsNotificationsEnabled
    ),
  };
};

export const normalizeSettings = (settings = {}) => {
  const payload = buildSettingsPayload({ ...defaultSettingsPayload, ...asObject(settings) });

  return {
    general: {
      appName: payload.applicationName,
      timezone: pick(settings, ["timezone", "timeZone", "defaultTimezone"], "Asia/Kolkata"),
      currency: pick(settings, ["currency", "defaultCurrency", "currencyCode"], "INR"),
      name: payload.generalName,
      status: payload.status,
      notes: payload.configurationNotes,
      applicationName: payload.applicationName,
      generalName: payload.generalName,
      supportEmail: payload.supportEmail,
      supportPhone: payload.supportPhone,
      address: payload.address,
      configurationNotes: payload.configurationNotes,
      emailNotificationsEnabled: payload.emailNotificationsEnabled,
      smsNotificationsEnabled: payload.smsNotificationsEnabled,
    },
    email: {
      name: payload.generalName,
      fromEmail: payload.supportEmail,
      smtpHost: pick(settings, ["smtpHost", "host", "server"], ""),
      smtpPort: pick(settings, ["smtpPort", "port"], "587"),
      username: pick(settings, ["username", "userName", "smtpUsername"], ""),
      password: pick(settings, ["password", "smtpPassword"], ""),
      status: payload.status,
      notes: payload.configurationNotes,
      applicationName: payload.applicationName,
      generalName: payload.generalName,
      supportEmail: payload.supportEmail,
      supportPhone: payload.supportPhone,
      address: payload.address,
      configurationNotes: payload.configurationNotes,
      emailNotificationsEnabled: payload.emailNotificationsEnabled,
      smsNotificationsEnabled: payload.smsNotificationsEnabled,
    },
    sms: {
      name: payload.generalName,
      provider: pick(settings, ["provider", "providerName", "gatewayName"], ""),
      senderId: pick(settings, ["senderId", "senderID", "sender"], ""),
      apiKey: pick(settings, ["apiKey", "key", "token"], ""),
      apiSecret: pick(settings, ["apiSecret", "secret"], ""),
      status: payload.status,
      notes: payload.configurationNotes,
      applicationName: payload.applicationName,
      generalName: payload.generalName,
      supportEmail: payload.supportEmail,
      supportPhone: payload.supportPhone,
      address: payload.address,
      configurationNotes: payload.configurationNotes,
      emailNotificationsEnabled: payload.emailNotificationsEnabled,
      smsNotificationsEnabled: payload.smsNotificationsEnabled,
    },
    payment: {
      name: payload.generalName,
      provider: pick(settings, ["provider", "providerName", "gatewayName"], ""),
      merchantId: pick(settings, ["merchantId", "merchantID", "accountId"], ""),
      publicKey: pick(settings, ["publicKey", "keyId", "publishableKey"], ""),
      secretKey: pick(settings, ["secretKey", "secret", "privateKey"], ""),
      mode: pick(settings, ["mode", "environment"], "Test"),
      status: payload.status,
      notes: payload.configurationNotes,
      applicationName: payload.applicationName,
      generalName: payload.generalName,
      supportEmail: payload.supportEmail,
      supportPhone: payload.supportPhone,
      address: payload.address,
      configurationNotes: payload.configurationNotes,
      emailNotificationsEnabled: payload.emailNotificationsEnabled,
      smsNotificationsEnabled: payload.smsNotificationsEnabled,
    },
  };
};

export const fetchClinics = async () =>
  asArray(await superAdminRequest(SUPER_ADMIN_API.clinics)).map(normalizeClinic);

export const fetchClinic = async (id) =>
  normalizeClinic(await superAdminRequest(`${SUPER_ADMIN_API.clinics}/${id}`));

export const saveClinic = async (clinic, id) => {
  const result = await superAdminRequest(id ? `${SUPER_ADMIN_API.clinics}/${id}` : SUPER_ADMIN_API.clinics, {
    method: id ? "PUT" : "POST",
    body: clinic,
  });
  recordSuperAdminActivity(
    id ? "Updated clinic" : "Created clinic",
    "Clinics",
    pick(clinic, ["ClinicName", "name"], id || "Clinic record")
  );
  return result;
};

export const deleteClinic = async (id) => {
  const result = await superAdminRequest(`${SUPER_ADMIN_API.clinics}/${id}`, { method: "DELETE" });
  recordSuperAdminActivity("Deleted clinic", "Clinics", `Clinic ID ${id}`);
  return result;
};

export const updateClinicStatus = async (id, status) => {
  const result = await superAdminRequest(`${SUPER_ADMIN_API.clinics}/${id}/status`, {
    method: "PATCH",
    body: { status },
  });
  recordSuperAdminActivity("Updated clinic status", "Clinics", `Clinic ID ${id} marked ${status}`);
  return result;
};

export const fetchAdmins = async () =>
  asArray(await superAdminRequest(SUPER_ADMIN_API.admins)).map(normalizeAdmin);

export const fetchAdmin = async (id) =>
  normalizeAdmin(await superAdminRequest(`${SUPER_ADMIN_API.admins}/${id}`));

export const createClinicAdmin = async (admin) => {
  const result = await superAdminRequest(SUPER_ADMIN_API.createClinicAdmin, {
    method: "POST",
    body: buildAdminPayload(admin),
  });
  recordSuperAdminActivity("Created clinic admin", "Admins", pick(admin, ["name", "fullName", "email"], "Admin record"));
  return result;
};

export const saveAdmin = async (admin, id) => {
  const result = await superAdminRequest(id ? `${SUPER_ADMIN_API.admins}/${id}` : SUPER_ADMIN_API.admins, {
    method: id ? "PUT" : "POST",
    body: buildAdminPayload(admin, { includeBlankPassword: !id }),
  });
  recordSuperAdminActivity(
    id ? "Updated admin" : "Created admin",
    "Admins",
    pick(admin, ["name", "fullName", "email"], id || "Admin record")
  );
  return result;
};

const getEntityId = (item = {}) =>
  pick(item, ["id", "doctorId", "receptionistId", "userId", "_id"], "");

const getEntityClinicId = (item = {}) =>
  pick(item, ["clinicId", "hospitalId", "assignedClinicId", "ClinicId", "HospitalId"], "");

const getEntityClinicName = (item = {}) =>
  pick(item, ["clinicName", "hospitalName", "assignedClinic", "clinic", "ClinicName"], "");

const isAdminOwnedStaff = (item = {}, admin = {}) => {
  const adminId = pick(admin.raw || admin, ["id", "adminId", "userId", "_id"], admin.id);
  const adminEmail = pick(admin.raw || admin, ["email", "adminEmail", "AdminEmail"], admin.email);
  const adminName = pick(admin.raw || admin, ["name", "adminName", "AdminName", "fullName"], admin.name);
  const ownerId = pick(item, ["adminId", "createdById", "userId", "AdminId"], "");
  const ownerEmail = pick(item, ["adminEmail", "createdByEmail", "AdminEmail"], "");
  const ownerName = pick(item, ["adminName", "createdBy", "userName", "AdminName"], "");

  return (
    valuesEqual(ownerId, adminId) ||
    valuesEqual(ownerEmail, adminEmail) ||
    valuesEqual(ownerName, adminName)
  );
};

const isStaffInClinic = (item = {}, clinicId, clinicName) =>
  valuesEqual(getEntityClinicId(item), clinicId) ||
  valuesEqual(String(getEntityClinicName(item)).toLowerCase(), String(clinicName || "").toLowerCase());

const getAdminOwnerFields = (admin = {}) => ({
  adminId: pick(admin.raw || admin, ["id", "adminId", "userId", "_id"], admin.id),
  adminEmail: pick(admin.raw || admin, ["email", "adminEmail", "AdminEmail"], admin.email),
  adminName: pick(admin.raw || admin, ["name", "adminName", "AdminName", "fullName"], admin.name),
});

const buildDoctorClinicUpdateBody = (doctor = {}, clinicId, clinicName, admin = {}) => {
  const body = new FormData();
  const owner = getAdminOwnerFields(admin);
  const fields = {
    Name: pick(doctor, ["name", "Name"], ""),
    name: pick(doctor, ["name", "Name"], ""),
    Specialization: pick(doctor, ["specialization", "Specialization"], ""),
    specialization: pick(doctor, ["specialization", "Specialization"], ""),
    Experience: pick(doctor, ["experience", "Experience"], 0),
    experience: pick(doctor, ["experience", "Experience"], 0),
    Fees: pick(doctor, ["fees", "Fees", "consultationFee"], 0),
    consultationFee: pick(doctor, ["consultationFee", "fees", "Fees"], 0),
    Qualification: pick(doctor, ["qualification", "Qualification"], ""),
    qualification: pick(doctor, ["qualification", "Qualification"], ""),
    Email: pick(doctor, ["email", "Email"], ""),
    email: pick(doctor, ["email", "Email"], ""),
    Phone: pick(doctor, ["phone", "Phone", "phoneNumber"], ""),
    phoneNumber: pick(doctor, ["phoneNumber", "phone", "Phone"], ""),
    Password: "",
    IsActive:
      typeof doctor.isActive === "boolean"
        ? String(doctor.isActive)
        : String(pick(doctor, ["isActive", "status"], "true")).toLowerCase() !== "inactive",
    isActive:
      typeof doctor.isActive === "boolean"
        ? String(doctor.isActive)
        : String(pick(doctor, ["isActive", "status"], "true")).toLowerCase() !== "inactive",
    HospitalId: clinicId,
    ClinicId: clinicId,
    HospitalName: clinicName,
    ClinicName: clinicName,
    AdminId: owner.adminId,
    AdminEmail: owner.adminEmail,
    AdminName: owner.adminName,
  };

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) body.append(key, String(value));
  });

  return body;
};

const buildReceptionistClinicUpdateBody = (receptionist = {}, clinicId, clinicName, admin = {}) => {
  const owner = getAdminOwnerFields(admin);

  return {
    ...receptionist,
    password: "",
    hospitalId: clinicId,
    clinicId,
    assignedClinicId: clinicId,
    hospitalName: clinicName,
    clinicName,
    assignedClinic: clinicName,
    adminId: owner.adminId,
    adminEmail: owner.adminEmail,
    adminName: owner.adminName,
  };
};

const updateStaffClinic = async ({ path, item, admin, clinicId, clinicName, buildBody }) => {
  const id = getEntityId(item);
  if (!id) return false;

  const body = buildBody(item, clinicId, clinicName, admin);
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("superAdminToken");
  const response = await fetch(apiUrl(`${path}/${id}`), {
    method: "PUT",
    headers:
      body instanceof FormData
        ? {
            "ngrok-skip-browser-warning": "true",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          }
        : {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Unable to update ${path.toLowerCase()} ${id}.`);
  }

  return true;
};

export const syncAdminStaffClinic = async ({
  admin,
  previousClinicId,
  previousClinicName,
  clinicId,
  clinicName,
}) => {
  if (!hasValue(clinicId)) {
    return { updated: 0 };
  }

  const [doctorsResult] = await Promise.allSettled([
    superAdminRequest("Doctor"),
  ]);
  const staffGroups = [
    {
      path: "Doctor",
      rows: doctorsResult.status === "fulfilled" ? asArray(doctorsResult.value) : [],
      buildBody: buildDoctorClinicUpdateBody,
    },
  ];
  const updates = [];

  staffGroups.forEach(({ path, rows, buildBody }) => {
    const ownedRows = rows.filter((item) => isAdminOwnedStaff(item, admin));
    const targetRows = ownedRows.length
      ? ownedRows
      : rows.filter((item) => isStaffInClinic(item, previousClinicId, previousClinicName));

    targetRows.forEach((item) => {
      if (!isStaffInClinic(item, clinicId, clinicName)) {
        updates.push(updateStaffClinic({ path, item, admin, clinicId, clinicName, buildBody }));
      }
    });
  });

  const results = await Promise.allSettled(updates);
  const failed = results.filter((result) => result.status === "rejected");

  if (failed.length) {
    throw new Error(failed[0].reason?.message || "Admin updated, but staff clinic sync failed.");
  }

  return { updated: results.length };
};

export const deleteAdmin = async (id) => {
  const result = await superAdminRequest(`${SUPER_ADMIN_API.admins}/${id}`, { method: "DELETE" });
  recordSuperAdminActivity("Deleted admin", "Admins", `Admin ID ${id}`);
  return result;
};

export const fetchNotifications = async () => {
  const path = String(window.location?.pathname || "").toLowerCase();
  if (path.startsWith("/doctor")) {
    return mergeNotificationRecords([]);
  }

  const endpoint = isStaffNotificationContext()
    ? SUPER_ADMIN_API.staffNotifications
    : SUPER_ADMIN_API.notifications;
  const remoteNotifications = asArray(
    await superAdminRequest(endpoint)
  ).map(normalizeNotification);

  return mergeNotificationRecords(remoteNotifications);
};

export const fetchNotificationTargetOptions = async () => {
  const [adminsResult] = await Promise.allSettled([superAdminRequest(SUPER_ADMIN_API.admins)]);
  const adminRows =
    adminsResult.status === "fulfilled" ? asArray(adminsResult.value).filter(isActiveRecord) : [];

  const counts = {
    admins: adminRows.length,
  };

  const options = [
    { value: "Active Admins", label: "Active Admins", count: counts.admins },
  ];

  const activeOptions = options.filter((option) => option.count > 0);
  return activeOptions.length ? activeOptions : options;
};

export const createNotification = async (notification) => {
  const status = normalizeStatus(pick(notification, ["status", "state"], "Sent"));
  const payload = buildNotificationPayload(notification);
  const isSendAction = status.toLowerCase() === "sent";
  const createdAt = new Date().toISOString();
  const result = await superAdminRequest(
    isSendAction ? SUPER_ADMIN_API.notificationSend : SUPER_ADMIN_API.notifications,
    {
      method: "POST",
      body: payload,
    }
  );
  const resultObject = asObject(result);
  const savedNotification = normalizeNotification({
    ...resultObject,
    ...payload,
    id: pick(resultObject, ["id", "notificationId", "_id"], `local-notification-${Date.now()}`),
    status,
    createdAt,
  });

  prependLocalItem(LOCAL_NOTIFICATIONS_KEY, savedNotification);
  recordSuperAdminActivity(
    isSendAction ? "Sent notification" : "Created notification",
    "Notifications",
    payload.title || "Notification"
  );
  return savedNotification;
};

export const markNotificationRead = async (id) => {
  if (!id) return null;

  try {
    const endpoint = isStaffNotificationContext()
      ? SUPER_ADMIN_API.staffNotifications
      : SUPER_ADMIN_API.notifications;
    const result = await superAdminRequest(`${endpoint}/${id}/read`, {
      method: "PUT",
      body: { status: "Read", isRead: true },
    });
    return result;
  } catch (error) {
    // fallback: mark local notification as read
    try {
      const local = readLocalList(LOCAL_NOTIFICATIONS_KEY);
      const updated = local.map((n) => (n.id === id ? { ...n, status: "Read" } : n));
      writeLocalList(LOCAL_NOTIFICATIONS_KEY, updated);
      return updated.find((n) => n.id === id) || null;
    } catch {
      return null;
    }
  }
};

export const deleteNotification = async (id) => {
  if (!id) return null;

  const local = readLocalList(LOCAL_NOTIFICATIONS_KEY).filter((n) => n.id !== id);

  try {
    const result = await superAdminRequest(`${SUPER_ADMIN_API.notifications}/${id}`, {
      method: "DELETE",
    });
    writeLocalList(LOCAL_NOTIFICATIONS_KEY, local);
    return result;
  } catch (error) {
    // fallback: remove local notification
    try {
      writeLocalList(LOCAL_NOTIFICATIONS_KEY, local);
      return { id };
    } catch {
      throw error;
    }
  }
};

const getCurrentSessionRole = () =>
  localStorage.getItem("adminRole") ||
  localStorage.getItem("doctorRole") ||
  localStorage.getItem("receptionistRole") ||
  localStorage.getItem("userRole") ||
  "";

const buildAuditLogPayload = (log = {}) => {
  const timestamp = pick(log, ["timestamp", "createdAt", "date"], new Date().toISOString());
  const module = pick(log, ["module", "moduleName", "category", "systemAction"], "Audit");
  const role = pick(log, ["role"], getCurrentSessionRole());
  const action = pick(log, ["action", "activity", "message", "description"], "Activity recorded");
  const isLoginActivity =
    typeof log.isLoginActivity === "boolean"
      ? log.isLoginActivity
      : normalizeString(module) === "login" || normalizeString(action).includes("login") || normalizeString(action).includes("logout");

  return {
    id: Number(pick(log, ["id"], 0)) || 0,
    userName: pick(log, ["userName", "user", "name", "email", "emailAddress", "userEmail"], "System"),
    action,
    systemAction: pick(log, ["systemAction"], module),
    ipAddress: pick(log, AUDIT_IP_KEYS, ""),
    isLoginActivity,
    timestamp,
    ...(role ? { role } : {}),
    ...(pick(log, ["userEmail", "emailAddress", "email"], "") ? { email: pick(log, ["userEmail", "emailAddress", "email"], "") } : {}),
  };
};

export const recordAuditLog = async (log) => {
  const payload = buildAuditLogPayload({
    ...log,
    ipAddress: pick(log, AUDIT_IP_KEYS, "") || (await fetchCurrentIpAddress()),
  });

  try {
    return await createAuditLog(payload);
  } catch (error) {
    return prependLocalItem(LOCAL_AUDIT_LOGS_KEY, {
      ...payload,
      id: `local-audit-${Date.now()}`,
      role: pick(log, ["role"], getCurrentSessionRole()),
      error: error.message,
    });
  }
};

const recordSuperAdminActivity = (action, module, detail = "") =>
  recordAuditLog({
    action,
    module,
    description: detail,
    user: localStorage.getItem("userName") || localStorage.getItem("adminName") || "Super Admin",
    role: getCurrentSessionRole() || "Super Admin",
  });

const toDashboardActivity = (activity, index = 0) => ({
  id: activity.id || `activity-${index}`,
  title: activity.title || activity.action || "Activity",
  detail: activity.detail || activity.description || activity.module || activity.user || "System activity recorded.",
  time: activity.time || activity.timestamp || "",
  sortTime: activity.sortTime || 0,
});

const auditLogToDashboardActivity = (log, index = 0) => ({
  id: log.id || `audit-${index}`,
  title: log.action || "System activity",
  detail: [log.module, log.user].filter(Boolean).join(" - ") || "Super Admin activity recorded.",
  time: log.timestamp || "",
  sortTime: log.sortTime || 0,
});

const buildDashboardActivities = (...activityGroups) => {
  const seen = new Set();

  return activityGroups
    .flat()
    .filter(Boolean)
    .map((activity, index) => toDashboardActivity(activity, index))
    .filter((activity) => {
      const key = [activity.title, activity.detail, activity.time].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.sortTime - left.sortTime)
    .slice(0, 8);
};

export const createAuditLog = async (log) =>
  superAdminRequest(SUPER_ADMIN_API.auditLogs, {
    method: "POST",
    body: buildAuditLogPayload(log),
  });

export const fetchAuditLog = async (id) =>
  normalizeAuditLog(await superAdminRequest(`${SUPER_ADMIN_API.auditLogs}/${id}`));

export const deleteAuditLog = async (id) =>
  superAdminRequest(`${SUPER_ADMIN_API.auditLogs}/${id}`, { method: "DELETE" });

export const createNotificationRemote = async (notification) =>
  superAdminRequest(SUPER_ADMIN_API.notificationSend, {
    method: "POST",
    body: buildNotificationPayload(notification),
  });

const addRoleLookupValue = (lookup, key, role) => {
  const normalizedKey = normalizeString(key);
  if (normalizedKey && role && !lookup.has(normalizedKey)) {
    lookup.set(normalizedKey, formatRoleLabel(role));
  }
};

const addRoleLookupUser = (lookup, user = {}, fallbackRole = "") => {
  const role = pick(user, AUDIT_ROLE_KEYS, fallbackRole);
  addRoleLookupValue(lookup, pick(user, AUDIT_EMAIL_KEYS, ""), role);
  addRoleLookupValue(lookup, pick(user, AUDIT_USER_KEYS, ""), role);
  addRoleLookupValue(
    lookup,
    pick(user, ["name", "fullName", "displayName", "adminName", "doctorName", "receptionistName"], ""),
    role
  );
};

const addEmailLookupValue = (lookup, key, email) => {
  const normalizedKey = normalizeString(key);
  const normalizedEmail = String(email || "").trim();
  if (normalizedKey && normalizedEmail && !lookup.has(normalizedKey)) {
    lookup.set(normalizedKey, normalizedEmail);
  }
};

const addEmailLookupUser = (lookup, user = {}) => {
  const email = String(pick(user, AUDIT_EMAIL_KEYS, "")).trim();
  if (!email) return;

  addEmailLookupValue(lookup, email, email);
  addEmailLookupValue(lookup, pick(user, AUDIT_USER_KEYS, ""), email);
  addEmailLookupValue(
    lookup,
    pick(user, ["name", "fullName", "displayName", "adminName", "doctorName", "receptionistName"], ""),
    email
  );
};

const addCurrentSessionRoleLookup = (lookup) => {
  const role = getCurrentSessionRole();
  const email =
    localStorage.getItem("adminEmail") ||
    localStorage.getItem("doctorEmail") ||
    localStorage.getItem("receptionistEmail") ||
    localStorage.getItem("userEmail") ||
    "";
  const name =
    localStorage.getItem("adminName") ||
    localStorage.getItem("doctorName") ||
    localStorage.getItem("receptionistName") ||
    localStorage.getItem("userName") ||
    "";

  addRoleLookupValue(lookup, email, role);
  addRoleLookupValue(lookup, name, role);
};

const addCurrentSessionEmailLookup = (lookup) => {
  const email =
    localStorage.getItem("adminEmail") ||
    localStorage.getItem("doctorEmail") ||
    localStorage.getItem("receptionistEmail") ||
    localStorage.getItem("userEmail") ||
    "";
  const name =
    localStorage.getItem("adminName") ||
    localStorage.getItem("doctorName") ||
    localStorage.getItem("receptionistName") ||
    localStorage.getItem("userName") ||
    "";

  addEmailLookupValue(lookup, email, email);
  addEmailLookupValue(lookup, name, email);
};

const publicIpProviders = [
  {
    url: "https://api.ipify.org?format=json",
    read: (data) => pick(data, ["ip"], ""),
  },
  {
    url: "https://api64.ipify.org?format=json",
    read: (data) => pick(data, ["ip"], ""),
  },
  {
    url: "https://ipapi.co/json/",
    read: (data) => pick(data, ["ip"], ""),
  },
  {
    url: "https://api.my-ip.io/v2/ip.json",
    read: (data) => pick(data, ["ip"], ""),
  },
];

const fetchCurrentIpAddress = async () => {
  const storedIp = localStorage.getItem("loginIpAddress") || "";
  if (storedIp) return storedIp;

  for (const provider of publicIpProviders) {
    try {
      const response = await fetch(provider.url);
      if (!response.ok) continue;

      const data = await response.json();
      const ipAddress = provider.read(data) || pick(data, AUDIT_IP_KEYS, "");
      if (ipAddress) {
        localStorage.setItem("loginIpAddress", ipAddress);
        return ipAddress;
      }
    } catch {
      // Try the next provider.
    }
  }

  return "";
};

const getCurrentSessionIdentity = (ipAddress = "") => ({
  role: getCurrentSessionRole(),
  ipAddress: localStorage.getItem("loginIpAddress") || ipAddress,
  email:
    localStorage.getItem("adminEmail") ||
    localStorage.getItem("doctorEmail") ||
    localStorage.getItem("receptionistEmail") ||
    localStorage.getItem("userEmail") ||
    "",
  name:
    localStorage.getItem("adminName") ||
    localStorage.getItem("doctorName") ||
    localStorage.getItem("receptionistName") ||
    localStorage.getItem("userName") ||
    "",
});

const getAuditLookupClinic = (user = {}) => ({
  clinicId: pick(user.raw || user, [
    "clinicId",
    "ClinicId",
    "hospitalId",
    "HospitalId",
    "assignedClinicId",
    "AssignedClinicId",
  ], user.clinicId || ""),
  clinicName: pick(user.raw || user, [
    "clinicName",
    "ClinicName",
    "hospitalName",
    "HospitalName",
    "assignedClinic",
    "AssignedClinic",
    "clinic",
  ], user.clinic || ""),
  branchId: pick(user.raw || user, ["branchId", "BranchId", "branchID", "BranchID"], ""),
  branchName: pick(user.raw || user, ["branchName", "BranchName", "branch", "Branch"], ""),
});

const addAuditScopeLookupValue = (lookup, key, user = {}) => {
  const normalizedKey = normalizeString(key);
  if (!normalizedKey || lookup.has(normalizedKey)) return;

  const scope = getAuditLookupClinic(user);
  if (scope.clinicId || scope.clinicName || scope.branchId || scope.branchName) {
    lookup.set(normalizedKey, scope);
  }
};

export const fetchNotificationStats = async () => {
  try {
    return asObject(await superAdminRequest(SUPER_ADMIN_API.notificationStats));
  } catch {
    const notifications = await fetchNotifications();
    return {
      total: notifications.length,
      sent: notifications.filter((item) => String(item.status || "").toLowerCase() === "sent").length,
      read: notifications.filter((item) => String(item.status || "").toLowerCase() === "read").length,
      unread: notifications.filter((item) => String(item.status || "").toLowerCase() !== "read" && String(item.status || "").toLowerCase() !== "sent").length,
    };
  }
};

const addAuditScopeLookupUser = (lookup, user = {}) => {
  addAuditScopeLookupValue(lookup, user.email, user);
  addAuditScopeLookupValue(lookup, user.userEmail, user);
  addAuditScopeLookupValue(lookup, user.name, user);
  addAuditScopeLookupValue(lookup, user.userName, user);
  addAuditScopeLookupValue(lookup, pick(user.raw || user, AUDIT_EMAIL_KEYS), user);
  addAuditScopeLookupValue(lookup, pick(user.raw || user, AUDIT_USER_KEYS), user);
};

const buildAuditLookups = ({ users = [], admins = [], doctors = [], receptionists = [], loginLogs = [] }) => {
  const roleLookup = new Map();
  const emailLookup = new Map();
  const scopeLookup = new Map();

  users.map(normalizeUser).forEach((user) => {
    addRoleLookupUser(roleLookup, user);
    addEmailLookupUser(emailLookup, user);
    addAuditScopeLookupUser(scopeLookup, user);
  });
  admins.map(normalizeAdmin).forEach((admin) => {
    addRoleLookupUser(roleLookup, admin);
    addEmailLookupUser(emailLookup, admin);
    addAuditScopeLookupUser(scopeLookup, admin);
  });
  doctors.forEach((doctor) => {
    addRoleLookupUser(roleLookup, doctor, "Doctor");
    addEmailLookupUser(emailLookup, doctor);
    addAuditScopeLookupUser(scopeLookup, doctor);
  });
  receptionists.forEach((receptionist) => {
    addRoleLookupUser(roleLookup, receptionist, "Receptionist");
    addEmailLookupUser(emailLookup, receptionist);
    addAuditScopeLookupUser(scopeLookup, receptionist);
  });

  addCurrentSessionRoleLookup(roleLookup);
  addCurrentSessionEmailLookup(emailLookup);

  loginLogs.forEach((log) => {
    addRoleLookupValue(roleLookup, log.userEmail, log.role);
    addRoleLookupValue(roleLookup, log.user, log.role);
    addRoleLookupValue(roleLookup, log.userName, log.role);

    addEmailLookupValue(emailLookup, log.userEmail, log.userEmail);
    addEmailLookupValue(emailLookup, log.user, log.userEmail);
    addEmailLookupValue(emailLookup, log.userName, log.userEmail);
  });

  return { roleLookup, emailLookup, scopeLookup };
};

const withAuditFallback = (log, roleLookup, emailLookup, scopeLookup = new Map(), options = {}) => {
  if (
    scopeLookup &&
    typeof options === "object" &&
    !(scopeLookup instanceof Map) &&
    !("get" in scopeLookup)
  ) {
    options = scopeLookup;
    scopeLookup = new Map();
  }
  const { currentIpAddress = "", fillMissingIpAddress = false } =
    typeof options === "string"
      ? { currentIpAddress: options, fillMissingIpAddress: false }
      : options;
  const session = getCurrentSessionIdentity(currentIpAddress);
  const role =
    log.role ||
    roleLookup.get(normalizeString(log.userEmail)) ||
    roleLookup.get(normalizeString(log.user)) ||
    roleLookup.get(normalizeString(log.userName)) ||
    (isUserLoginMatch(session, log) ? session.role : "");
  const ipAddress = log.ipAddress || (fillMissingIpAddress ? session.ipAddress || currentIpAddress : "") || "";
  const email =
    log.email ||
    log.userEmail ||
    emailLookup.get(normalizeString(log.userEmail)) ||
    emailLookup.get(normalizeString(log.user)) ||
    emailLookup.get(normalizeString(log.userName)) ||
    (isEmailAddress(log.userName) ? log.userName : "");
  const scope =
    scopeLookup.get(normalizeString(log.userEmail)) ||
    scopeLookup.get(normalizeString(log.email)) ||
    scopeLookup.get(normalizeString(email)) ||
    scopeLookup.get(normalizeString(log.user)) ||
    scopeLookup.get(normalizeString(log.userName)) ||
    {};

  return {
    ...log,
    role: role || log.role,
    ipAddress,
    email: email || log.email || log.userEmail,
    userEmail: email || log.userEmail || log.email,
    clinicId: log.clinicId || scope.clinicId || "",
    clinicName: log.clinicName || scope.clinicName || "",
    branchId: log.branchId || scope.branchId || "",
    branchName: log.branchName || scope.branchName || "",
  };
};

const isLoginAuditLog = (log = {}) => {
  const action = String(log.action || "").trim().toLowerCase();
  const systemAction = String(log.systemAction || log.module || "").trim().toLowerCase();
  return (
    log.isLoginActivity ||
    log.isLogoutActivity ||
    systemAction.includes("login") ||
    systemAction.includes("logout") ||
    action === "login" ||
    action === "logout" ||
    action.includes("logged in") ||
    action.includes("logged out") ||
    action.includes("signed in") ||
    action.includes("signed out")
  );
};

const getAuditTimeBucket = (log = {}) => {
  const sortTime = Number(log.sortTime || getAuditTimestamp(log.timestampRaw));
  return Number.isFinite(sortTime) && sortTime > 0
    ? Math.floor(sortTime / 60000)
    : String(log.timestampRaw || log.timestamp || "").trim();
};

const getAuditLogKey = (log = {}) => {
  const identity = String(log.email || log.userEmail || log.userName || log.user || "")
    .trim()
    .toLowerCase();
  const action = String(log.action || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const systemAction = String(log.systemAction || log.module || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const timeBucket = getAuditTimeBucket(log);

  if (isLoginAuditLog(log)) {
    return ["login", identity, timeBucket].join("|");
  }

  if (identity || action || systemAction || timeBucket) {
    return [identity, action, systemAction, timeBucket].join("|");
  }

  return String(log.id || "");
};

const sortAuditLogs = (logs = []) =>
  [...logs].sort((left, right) => (right.sortTime || 0) - (left.sortTime || 0));

const uniqueAuditLogs = (logs = []) => {
  const seen = new Set();

  return logs.filter((log) => {
    const key = getAuditLogKey(log);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const fetchAuditLogs = async (filters = {}) => {
  const query = buildAuditLogQuery(filters);
  const [auditResult, usersResult, adminsResult, doctorsResult] = await Promise.allSettled([
    superAdminRequest(`${SUPER_ADMIN_API.auditLogs}${query}`),
    superAdminRequest(SUPER_ADMIN_API.users),
    superAdminRequest(SUPER_ADMIN_API.admins),
    superAdminRequest("Doctor"),
  ]);

  const auditLogs =
    auditResult.status === "fulfilled"
      ? asArray(auditResult.value).map(normalizeAuditLog)
      : [];

  if (auditResult.status === "rejected") {
    throw auditResult.reason;
  }

  const { roleLookup, emailLookup, scopeLookup } = buildAuditLookups({
    users: usersResult.status === "fulfilled" ? asArray(usersResult.value) : [],
    admins: adminsResult.status === "fulfilled" ? asArray(adminsResult.value) : [],
    doctors: doctorsResult.status === "fulfilled" ? asArray(doctorsResult.value) : [],
    receptionists: [],
    loginLogs: [],
  });

  const logs = uniqueAuditLogs(auditLogs).map((log) =>
    withAuditFallback(log, roleLookup, emailLookup, scopeLookup)
  );

  return sortAuditLogs(logs);
};

export const fetchLoginHistory = async (filters = {}) => {
  const query = buildAuditLogQuery(filters);
  const [loginResult, usersResult, adminsResult, doctorsResult] = await Promise.allSettled([
    superAdminRequest(`${SUPER_ADMIN_API.loginHistory}${query}`),
    superAdminRequest(SUPER_ADMIN_API.users),
    superAdminRequest(SUPER_ADMIN_API.admins),
    superAdminRequest("Doctor"),
  ]);

  if (loginResult.status === "rejected") {
    throw loginResult.reason;
  }

  const loginLogs = uniqueAuditLogs(asArray(loginResult.value).map(normalizeLoginLog));
  const { roleLookup, emailLookup, scopeLookup } = buildAuditLookups({
    users: usersResult.status === "fulfilled" ? asArray(usersResult.value) : [],
    admins: adminsResult.status === "fulfilled" ? asArray(adminsResult.value) : [],
    doctors: doctorsResult.status === "fulfilled" ? asArray(doctorsResult.value) : [],
    receptionists: [],
    loginLogs,
  });
  return sortAuditLogs(
    loginLogs.map((log) => withAuditFallback(log, roleLookup, emailLookup, scopeLookup))
  );
};

export const fetchRoleNames = async () =>
  asArray(await superAdminRequest(SUPER_ADMIN_API.roleNames)).map((role, index) =>
    typeof role === "string" ? role : normalizeRole(role, index).name
  );

export const fetchRoles = async () =>
  asArray(await superAdminRequest(SUPER_ADMIN_API.roles)).map(normalizeRole);

export const fetchRole = async (id) =>
  normalizeRole(await superAdminRequest(`${SUPER_ADMIN_API.roles}/${id}`));

const buildRolePayload = (role = {}) => {
  const permissions = Array.isArray(role.permissions)
    ? role.permissions
    : [];
  const modulePermissions =
    role.modulePermissions && typeof role.modulePermissions === "object" && !Array.isArray(role.modulePermissions)
      ? role.modulePermissions
      : {};
  const permissionModules = Object.entries(modulePermissions).map(([module, modulePermissionList]) => {
    const modulePermissionsList = Array.isArray(modulePermissionList) ? modulePermissionList : [];
    const hasModulePermission = (permission) =>
      modulePermissionsList.some(
        (item) =>
          String(item || "").trim().toLowerCase() ===
          String(permission || "").trim().toLowerCase()
      );

    return {
      module,
      permissions: modulePermissionsList,
      canView: hasModulePermission("View"),
      canCreate: hasModulePermission("Create"),
      canEdit: hasModulePermission("Edit"),
      canDelete: hasModulePermission("Delete"),
    };
  });

  const hasPermission = (permission) =>
    permissions.some(
      (item) =>
        String(item || "").trim().toLowerCase() ===
        String(permission || "").trim().toLowerCase()
    );

  return {
    id: role.id || role.roleId || "",
    roleId: role.roleId || role.id || "",
    adminId: role.adminId || role.userId || role.admin?.id || role.raw?.adminId || role.raw?.userId || "",
    userId: role.userId || role.adminId || role.admin?.id || role.raw?.userId || role.raw?.adminId || "",
    name: String(role.name || role.roleName || "").trim(),
    roleName: String(role.roleName || role.name || "").trim(),
    module: String(role.module || "").trim(),
    targetRole: String(role.targetRole || role.appliesTo || role.scope || "Admin").trim(),
    appliesTo: String(role.appliesTo || role.targetRole || role.scope || "Admin").trim(),
    scope: String(role.scope || role.targetRole || role.appliesTo || "Admin").trim(),
    status: String(role.status || "Active").trim(),
    users: Number(role.users || 0) || 0,
    permissions,
    modulePermissions,
    permissionModules,
    canView: hasPermission("View"),
    canCreate: hasPermission("Create"),
    canEdit: hasPermission("Edit"),
    canDelete: hasPermission("Delete"),
  };
};

const buildRolePermissionsPayload = (role = {}) => {
  const payload = buildRolePayload(role);
  return {
    id: payload.id,
    roleId: payload.roleId,
    adminId: payload.adminId,
    userId: payload.userId,
    name: payload.name,
    roleName: payload.roleName,
    module: payload.module,
    targetRole: payload.targetRole,
    appliesTo: payload.appliesTo,
    scope: payload.scope,
    permissions: payload.permissions,
    modulePermissions: payload.modulePermissions,
    permissionModules: payload.permissionModules,
    canView: payload.canView,
    canCreate: payload.canCreate,
    canEdit: payload.canEdit,
    canDelete: payload.canDelete,
  };
};

export const saveRole = async (role = {}) => {
  const payload = buildRolePayload(role);
  const id = role.id || role.roleId || "";
  const result = await superAdminRequest(
    id ? `${SUPER_ADMIN_API.roles}/${id}` : SUPER_ADMIN_API.roles,
    {
      method: id ? "PUT" : "POST",
      body: payload,
    }
  );

  const permissionId = id || result?.id || result?.roleId || payload.adminId || payload.userId;
  let permissionsResult = null;
  if (permissionId) {
    permissionsResult = await superAdminRequest(`${SUPER_ADMIN_API.roles}/${permissionId}/permissions`, {
      method: "PUT",
      body: buildRolePermissionsPayload({
        ...role,
        ...payload,
        id: result?.id || id || payload.id,
        roleId: result?.roleId || result?.id || id || payload.roleId,
      }),
    });
  }

  return normalizeRole(permissionsResult || result || { ...payload, id: permissionId });
};

export const saveRoleModulePermission = async (roleId, permission = {}) => {
  const body = {
    hospitalId: Number(permission.hospitalId || permission.clinicId || 0) || permission.hospitalId || permission.clinicId || "",
    adminUserId: Number(permission.adminUserId || permission.adminId || permission.userId || 0) || permission.adminUserId || permission.adminId || permission.userId || "",
    roleName: String(permission.roleName || "Admin").trim(),
    module: String(permission.module || "").trim(),
    canView: Boolean(permission.canView),
    canCreate: Boolean(permission.canCreate),
    canEdit: Boolean(permission.canEdit),
    canDelete: Boolean(permission.canDelete),
  };

  const id = String(roleId || permission.id || permission.roleId || "").trim();
  return superAdminRequest(id ? `${SUPER_ADMIN_API.roles}/${id}/permissions` : SUPER_ADMIN_API.roles, {
    method: id ? "PUT" : "POST",
    body,
  });
};

export const deleteRole = async (id) =>
  superAdminRequest(`${SUPER_ADMIN_API.roles}/${id}`, { method: "DELETE" });

export const fetchUsers = async () => {
  const [usersResult, loginResult] = await Promise.allSettled([
    superAdminRequest(SUPER_ADMIN_API.users),
    superAdminRequest(SUPER_ADMIN_API.loginHistory),
  ]);

  if (usersResult.status !== "fulfilled") {
    throw usersResult.reason;
  }

  const users = asArray(usersResult.value)
    .map(normalizeUser)
    .filter((user) => !user.isDeleted);

  let loginLogs =
    loginResult.status === "fulfilled"
      ? asArray(loginResult.value).map(normalizeLoginLog)
      : [];

  if (!loginLogs.length) {
    try {
      loginLogs = (await fetchAuditLogs()).filter(
        (log) =>
          String(log.module).toLowerCase() === "login" ||
          /logged in/i.test(String(log.action))
      );
    } catch {
      // Keep the original login history result when the audit fallback is unavailable.
    }
  }

  return users.map((user) => {
    const lastLoginRaw = findMostRecentLogin(user, loginLogs);
    return lastLoginRaw
      ? { ...user, lastActive: formatAuditDateTime(lastLoginRaw) }
      : user;
  });
};

const buildAuditLogQuery = (filters = {}) => {
  const params = new URLSearchParams();
  const entries = {
    startDate: filters.startDate,
    endDate: filters.endDate,
    clinicId: filters.clinicId,
    hospitalId: filters.clinicId,
    clinicName: filters.clinicName,
    hospitalName: filters.clinicName,
    branchId: filters.branchId,
    branchName: filters.branchName,
  };

  Object.entries(entries).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `?${query}` : "";
};

export const fetchUser = async (id) =>
  normalizeUser(await superAdminRequest(`${SUPER_ADMIN_API.users}/${id}`));

export const saveUser = async (user, id) => {
  const result = await superAdminRequest(id ? `${SUPER_ADMIN_API.users}/${id}` : SUPER_ADMIN_API.users, {
    method: id ? "PUT" : "POST",
    body: buildUserPayload(user, { includeBlankPassword: !id }),
  });
  recordSuperAdminActivity(
    id ? "Updated user" : "Created user",
    "Users",
    pick(user, ["name", "fullName", "email"], id || "User record")
  );
  return result;
};

export const deleteUser = async (id) => {
  const result = await superAdminRequest(`${SUPER_ADMIN_API.users}/${id}`, { method: "DELETE" });
  recordSuperAdminActivity("Deleted user", "Users", `User ID ${id}`);
  return result;
};

export const updateUserStatus = async (id, status) => {
  const result = await superAdminRequest(`${SUPER_ADMIN_API.users}/${id}/status`, {
    method: "PUT",
    body: { status },
  });
  recordSuperAdminActivity("Updated user status", "Users", `User ID ${id} marked ${status}`);
  return result;
};

export const fetchSettings = async () =>
  normalizeSettings(await superAdminRequest(SUPER_ADMIN_API.settings));

export const updateSettings = async (settings) => {
  const result = await superAdminRequest(SUPER_ADMIN_API.settings, {
    method: "PUT",
    body: buildSettingsPayload(settings),
  });
  recordSuperAdminActivity("Updated settings", "Settings", "System settings");
  return result;
};

export const updateGeneralSettings = async (settings) => {
  const result = await superAdminRequest(SUPER_ADMIN_API.settingsGeneral, {
    method: "PUT",
    body: buildSettingsPayload(settings),
  });
  recordSuperAdminActivity("Updated general settings", "Settings", "General platform settings");
  return result;
};

export const updateEmailSettings = async (settings) => {
  const result = await superAdminRequest(SUPER_ADMIN_API.settingsEmail, {
    method: "PUT",
    body: buildSettingsPayload(settings),
  });
  recordSuperAdminActivity("Updated email settings", "Settings", "Email configuration");
  return result;
};

export const updateSmsSettings = async (settings) => {
  const result = await superAdminRequest(SUPER_ADMIN_API.settingsSms, {
    method: "PUT",
    body: buildSettingsPayload(settings),
  });
  recordSuperAdminActivity("Updated SMS settings", "Settings", "SMS configuration");
  return result;
};

export const updatePaymentSettings = async (settings) => {
  const result = await superAdminRequest(SUPER_ADMIN_API.settingsPayment, {
    method: "PUT",
    body: buildSettingsPayload(settings),
  });
  recordSuperAdminActivity("Updated payment settings", "Settings", "Payment configuration");
  return result;
};

const isAdminType = (value = "") => {
  const role = String(value || "").trim().toLowerCase();
  return role === "admin" || role === "clinic admin";
};

const getUserAdminRole = (user = {}) =>
  [user.type, user.role, user.raw?.type, user.raw?.role, user.raw?.roleName].find(isAdminType) || "";

const getDashboardAdminKey = (item = {}) =>
  String(item.email || item.id || item.name || item.raw?.email || item.raw?.id || "")
    .trim()
    .toLowerCase();

const countDashboardAdmins = async () => {
  try {
    const [adminsResult, usersResult] = await Promise.allSettled([
      superAdminRequest(SUPER_ADMIN_API.admins),
      superAdminRequest(SUPER_ADMIN_API.users),
    ]);

    const adminRows = adminsResult.status === "fulfilled" ? asArray(adminsResult.value) : [];
    const userRows = usersResult.status === "fulfilled" ? asArray(usersResult.value) : [];
    const rows = new Map();

    adminRows.forEach((admin) => {
      const key = getDashboardAdminKey(admin);
      if (!key) return;
      rows.set(key, admin);
    });

    userRows
      .filter((user) => !user.isDeleted && getUserAdminRole(user))
      .forEach((user) => {
        const key = getDashboardAdminKey(user);
        if (!key) return;
        rows.set(key, user);
      });

    return rows.size;
  } catch {
    return 0;
  }
};

export const fetchDashboardData = async () => {
  const [
    dashboard,
    summary,
    reportsSummary,
    clinicRevenue,
    revenueTrend,
    topClinics,
    userActivity,
    auditLogs,
    loginHistory,
    clinicsResult,
    usersResult,
    appointmentsResult,
  ] = await Promise.allSettled([
    superAdminRequestFirst([SUPER_ADMIN_API.dashboard, SUPER_ADMIN_API.dashboardCompat]),
    superAdminRequestFirst([
      SUPER_ADMIN_API.dashboardSummary,
      SUPER_ADMIN_API.dashboardSummaryCompat,
      SUPER_ADMIN_API.dashboardSummaryLegacy,
    ]),
    superAdminRequest(SUPER_ADMIN_API.reportsSummary),
    superAdminRequest(SUPER_ADMIN_API.reportsClinicRevenue),
    superAdminRequest(SUPER_ADMIN_API.reportsRevenueTrend),
    superAdminRequest(SUPER_ADMIN_API.reportsTopClinics),
    superAdminRequest(SUPER_ADMIN_API.reportsUserActivity),
    superAdminRequest(SUPER_ADMIN_API.auditLogs),
    superAdminRequest(SUPER_ADMIN_API.loginHistory),
    superAdminRequest(SUPER_ADMIN_API.clinics),
    superAdminRequest(SUPER_ADMIN_API.users),
    superAdminRequestOptional("Appointment"),
  ]);

  const dashboardData = dashboard.status === "fulfilled" ? asObject(dashboard.value) : {};
  const summaryData = {
    ...(summary.status === "fulfilled" ? asObject(summary.value) : {}),
    ...(reportsSummary.status === "fulfilled" ? asObject(reportsSummary.value) : {}),
  };
  const clinicRevenueRows = clinicRevenue.status === "fulfilled" ? asArray(clinicRevenue.value) : [];
  const topClinicRows = topClinics.status === "fulfilled" ? asArray(topClinics.value) : [];
  const revenueData = revenueTrend.status === "fulfilled" ? revenueTrend.value : [];
  const reportActivityRows = userActivity.status === "fulfilled" ? asArray(userActivity.value).map(normalizeActivity) : [];
  const auditActivityRows =
    auditLogs.status === "fulfilled" ? asArray(auditLogs.value).map(normalizeAuditLog).map(auditLogToDashboardActivity) : [];
  const loginActivityRows =
    loginHistory.status === "fulfilled" ? asArray(loginHistory.value).map(normalizeLoginLog).map(auditLogToDashboardActivity) : [];
  const localActivityRows = readLocalList(LOCAL_AUDIT_LOGS_KEY).map(normalizeAuditLog).map(auditLogToDashboardActivity);
  
  // Get actual counts from fetched data for consistency with lists
  const clinicRows = clinicsResult.status === "fulfilled" ? asArray(clinicsResult.value) : [];
  const appointmentRows = appointmentsResult.status === "fulfilled" ? asArray(appointmentsResult.value) : [];
  const billingRows = [];
  const billingTotals = getSharedRevenueTotals(billingRows);
  const userRows = usersResult.status === "fulfilled" ? asArray(usersResult.value).filter((u) => !u.isDeleted) : [];
  const clinicDetailRevenueRows = await fetchClinicRevenueDetailRows(clinicRows);
  const clinicDetailRows = buildClinicRevenueRowsFromReportRows({
    reportRows: clinicDetailRevenueRows,
    clinicRows,
    adminRows: [],
    userRows,
  });
  const billingClinicRows = buildClinicRevenueRowsFromBilling({
    billingRows,
    clinicRows,
    adminRows: [],
    userRows,
    appointmentRows,
  });
  const dashboardClinicRevenueRows = mergeClinicRevenueSources(
    billingClinicRows,
    clinicDetailRows,
    clinicRevenueRows,
    topClinicRows
  );
  const dashboardClinicTotals = dashboardClinicRevenueRows.reduce(
    (totals, row) => {
      totals.opRevenue += toNumber(row.opRevenue);
      totals.diagnosticRevenue += toNumber(row.diagnosticRevenue);
      totals.pharmacyRevenue += toNumber(row.pharmacyRevenue);
      totals.gstAmount += toNumber(row.gstAmount);
      totals.revenue += toNumber(row.revenue);
      return totals;
    },
    {
      opRevenue: 0,
      diagnosticRevenue: 0,
      pharmacyRevenue: 0,
      gstAmount: 0,
      revenue: 0,
    }
  );
  const dashboardTotalRevenue = dashboardClinicTotals.revenue || billingTotals.revenue;
  const actualClinicCount = clinicRows.length;
  const actualUserCount = userRows.length;
  const activeUserCount = userRows.filter((u) => u.active === true || u.isActive === true || u.status === "Active").length;
  
  const adminCount = await countDashboardAdmins();
  
  const nextSummary = {
    ...summaryData,
    totalClinics: actualClinicCount || getDashboardMetric({ ...dashboardData, ...summaryData }, ["totalClinics", "clinics", "clinicCount"]),
    clinics: actualClinicCount || getDashboardMetric({ ...dashboardData, ...summaryData }, ["totalClinics", "clinics", "clinicCount"]),
    clinicCount: actualClinicCount || getDashboardMetric({ ...dashboardData, ...summaryData }, ["totalClinics", "clinics", "clinicCount"]),
    totalRevenue: dashboardTotalRevenue || getDashboardMetric({ ...dashboardData, ...summaryData }, ["totalRevenue", "revenue", "revenueSummary"]),
    revenue: dashboardTotalRevenue || getDashboardMetric({ ...dashboardData, ...summaryData }, ["totalRevenue", "revenue", "revenueSummary"]),
    revenueSummary: dashboardTotalRevenue || getDashboardMetric({ ...dashboardData, ...summaryData }, ["totalRevenue", "revenue", "revenueSummary"]),
    opRevenue: dashboardClinicTotals.opRevenue || billingTotals.opRevenue,
    diagnosticRevenue: dashboardClinicTotals.diagnosticRevenue || billingTotals.diagnosticRevenue,
    pharmacyRevenue: dashboardClinicTotals.pharmacyRevenue || billingTotals.pharmacyRevenue,
    gstAmount: dashboardClinicTotals.gstAmount || billingTotals.gstAmount,
    totalAdmins: adminCount,
    admins: adminCount,
    adminCount,
    totalUsers: actualUserCount || getDashboardMetric({ ...dashboardData, ...summaryData }, ["totalUsers", "users", "userCount"]),
    users: actualUserCount || getDashboardMetric({ ...dashboardData, ...summaryData }, ["totalUsers", "users", "userCount"]),
    userCount: actualUserCount || getDashboardMetric({ ...dashboardData, ...summaryData }, ["totalUsers", "users", "userCount"]),
    activeUsers: activeUserCount || getDashboardMetric({ ...dashboardData, ...summaryData }, ["activeUsers", "activeUserCount"]),
    activeUserCount: activeUserCount || getDashboardMetric({ ...dashboardData, ...summaryData }, ["activeUsers", "activeUserCount"]),
  };
  
  const dashboardRevenueData = billingRows.length
    ? buildRevenueChart(billingRows)
    : dashboardClinicRevenueRows.length
      ? dashboardClinicRevenueRows.map((row) => ({
          name: row.name || row.clinicName || "Clinic",
          revenue: toNumber(row.revenue),
          users: toNumber(row.users),
          invoices: toNumber(row.invoiceCount),
        }))
      : buildMonthlyRevenueRows(asArray(revenueData));
  const totalUsers = nextSummary.totalUsers;

  return {
    dashboard: dashboardData,
    summary: nextSummary,
    revenueData: dashboardRevenueData.map((point) => ({
      ...point,
      users: toNumber(point.users) || totalUsers,
    })),
    activities: buildDashboardActivities(
      localActivityRows,
      auditActivityRows,
      loginActivityRows,
      reportActivityRows
    ),
    error:
      dashboard.status === "rejected" &&
      summary.status === "rejected" &&
      reportsSummary.status === "rejected" &&
      clinicRevenue.status === "rejected" &&
      revenueTrend.status === "rejected" &&
      topClinics.status === "rejected" &&
      userActivity.status === "rejected" &&
      auditLogs.status === "rejected" &&
      loginHistory.status === "rejected"
        ? dashboard.reason.message
        : "",
  };
};

export const fetchReports = async () => {
  const [summary, clinicRevenue, revenueTrend, topClinics, userActivity, clinics, admins, users, appointments] = await Promise.allSettled([
    superAdminRequest(SUPER_ADMIN_API.reportsSummary),
    superAdminRequest(SUPER_ADMIN_API.reportsClinicRevenue),
    superAdminRequest(SUPER_ADMIN_API.reportsRevenueTrend),
    superAdminRequest(SUPER_ADMIN_API.reportsTopClinics),
    superAdminRequest(SUPER_ADMIN_API.reportsUserActivity),
    superAdminRequest(SUPER_ADMIN_API.clinics),
    superAdminRequest(SUPER_ADMIN_API.admins),
    superAdminRequest(SUPER_ADMIN_API.users),
    superAdminRequestOptional("Appointment"),
  ]);

  const summaryData = summary.status === "fulfilled" ? asObject(summary.value) : {};
  const clinicRevenueRows = clinicRevenue.status === "fulfilled" ? asArray(clinicRevenue.value) : [];
  const topClinicRows = topClinics.status === "fulfilled" ? asArray(topClinics.value) : [];
  const revenueRows = revenueTrend.status === "fulfilled" ? asArray(revenueTrend.value) : [];
  const activityRows = userActivity.status === "fulfilled" ? asArray(userActivity.value) : [];
  const clinicRows = clinics.status === "fulfilled" ? asArray(clinics.value) : [];
  const adminRows = admins.status === "fulfilled" ? asArray(admins.value) : [];
  const userRows = users.status === "fulfilled" ? asArray(users.value) : [];
  const appointmentRows = appointments.status === "fulfilled" ? asArray(appointments.value) : [];
  const clinicDetailRevenueRows = await fetchClinicRevenueDetailRows(clinicRows);
  const clinicDetailRows = buildClinicRevenueRowsFromReportRows({ reportRows: clinicDetailRevenueRows, clinicRows, adminRows, userRows });
  const billingRows = [];
  const billingClinicRows = buildClinicRevenueRowsFromBilling({ billingRows, clinicRows, adminRows, userRows, appointmentRows });

  const mergedRevenueRows = mergeClinicRevenueSources(
    billingClinicRows,
    clinicDetailRows,
    clinicRevenueRows,
    topClinicRows
  );
  const sourceRows = mergedRevenueRows.length ? mergedRevenueRows : topClinicRows;
  const rows = enrichReportRows({ rows: sourceRows, clinicRows, adminRows, userRows });

  // Filter out any rows whose clinic is not present in the clinics list.
  const clinicLookupIds = new Set(clinicRows.map((c) => String(pick(c, ["id", "clinicId", "HospitalId", "_id"], "")).trim()).filter(Boolean));
  const clinicLookupNames = new Set(clinicRows.map((c) => String(pick(c, ["name", "Name", "clinicName", "ClinicName", "hospitalName"], "")).trim().toLowerCase()).filter(Boolean));

  const rowsFiltered = rows.filter((r) => {
    // allow rows when clinics list is empty (fallback) or when row maps to a known clinic id or name
    if (!clinicRows || clinicRows.length === 0) return true;
    const rawClinicId = normalizeLookupKey(getReportClinicId(r.raw || r));
    const normalizedRowId = normalizeLookupKey(r.id || r.clinicId || r.hospitalId || "");
    const rowName = String(r.name || r.clinicName || r.hospitalName || "").trim().toLowerCase();

    if (rawClinicId && clinicLookupIds.has(rawClinicId)) return true;
    if (normalizedRowId && clinicLookupIds.has(normalizedRowId)) return true;
    if (rowName && clinicLookupNames.has(rowName)) return true;
    return false;
  });

  // If there are clinic records, ensure we do not include any fallback or 'Unassigned Clinic' rows
  // which may have been generated as fallbacks. Keep only rows that map to a known clinic id/name.
  const hasClinicList = clinicRows && clinicRows.length > 0;
  const filteredStrict = hasClinicList
    ? rowsFiltered.filter((r) => {
        const name = String(r.name || r.clinicName || r.hospitalName || "").trim().toLowerCase();
        if (!name) return false;
        if (name === "unassigned clinic") return false;
        // ensure the name exists in clinicLookupNames or the id exists in clinicLookupIds
        const rawClinicId = normalizeLookupKey(getReportClinicId(r.raw || r));
        const normalizedRowId = normalizeLookupKey(r.id || r.clinicId || r.hospitalId || "");
        if (rawClinicId && clinicLookupIds.has(rawClinicId)) return true;
        if (normalizedRowId && clinicLookupIds.has(normalizedRowId)) return true;
        if (clinicLookupNames.has(name)) return true;
        return false;
      })
    : rowsFiltered;

  // Map to canonical clinic records and dedupe by clinic id so reports show exact clinics
  const clinicByIdMap = new Map(
    clinicRows
      .map((c) => [String(c.id || c.clinicId || c._id || "").trim(), normalizeClinic(c)])
      .filter(([k]) => k)
  );
  const clinicByNameMap = new Map(
    clinicRows
      .map((c) => [String(pick(c, ["name", "clinicName", "hospitalName"], "")).trim().toLowerCase(), normalizeClinic(c)])
      .filter(([k]) => k)
  );

  const dedupedMap = new Map();
  filteredStrict.forEach((r) => {
    const rawClinicId = normalizeLookupKey(getReportClinicId(r.raw || r));
    const normalizedRowId = normalizeLookupKey(r.id || r.clinicId || r.hospitalId || "");
    const rowNameKey = String(r.name || r.clinicName || r.hospitalName || "").trim().toLowerCase();

    const matchedById = rawClinicId && clinicByIdMap.get(rawClinicId);
    const matchedByRowId = normalizedRowId && clinicByIdMap.get(normalizedRowId);
    const matchedByName = rowNameKey && clinicByNameMap.get(rowNameKey);

    const clinicMatch = matchedById || matchedByRowId || matchedByName || null;

    if (!clinicMatch) return; // skip any remaining non-matching rows

    const key = String(clinicMatch.id || clinicMatch.name).trim();
    // merge/aggregate if duplicate
    if (!dedupedMap.has(key)) {
      const normalized = { ...r, id: clinicMatch.id, name: clinicMatch.name, raw: { ...(r.raw || {}), _matchedClinic: clinicMatch.raw || clinicMatch } };
      dedupedMap.set(key, normalized);
    } else {
      // merge numeric fields conservatively (sum revenue/invoice/users where sensible)
      const existing = dedupedMap.get(key);
      existing.revenue = toNumber(existing.revenue) + toNumber(r.revenue);
      existing.opRevenue = toNumber(existing.opRevenue) + toNumber(r.opRevenue);
      existing.diagnosticRevenue = toNumber(existing.diagnosticRevenue) + toNumber(r.diagnosticRevenue);
      existing.pharmacyRevenue = toNumber(existing.pharmacyRevenue) + toNumber(r.pharmacyRevenue);
      existing.cgstAmount = toNumber(existing.cgstAmount) + toNumber(r.cgstAmount);
      existing.sgstAmount = toNumber(existing.sgstAmount) + toNumber(r.sgstAmount);
      existing.gstAmount = toNumber(existing.gstAmount) + toNumber(r.gstAmount);
      existing.users = Math.max(toNumber(existing.users), toNumber(r.users));
      existing.invoiceCount = toNumber(existing.invoiceCount) + toNumber(r.invoiceCount);
      dedupedMap.set(key, existing);
    }
  });

  const finalRows = Array.from(dedupedMap.values());

  // Provide backend-derived summary counts so frontends can rely on authoritative numbers
  const actualClinicCount = clinicRows.length;
  const actualUserCount = userRows.filter((u) => !u.isDeleted).length;
  const activeUserCount = userRows.filter((u) => u.active === true || u.isActive === true || u.status === "Active").length;
  const adminCount = await countDashboardAdmins();
  const billingTotals = getSharedRevenueTotals(billingRows);
  const backendRevenue = billingTotals.revenue || getDashboardMetric(summaryData, ["totalRevenue", "revenue", "revenueSummary", "amount"]);

  const nextSummary = {
    ...summaryData,
    totalClinics: actualClinicCount || getDashboardMetric(summaryData, ["totalClinics", "clinics", "clinicCount"]),
    clinics: actualClinicCount || getDashboardMetric(summaryData, ["totalClinics", "clinics", "clinicCount"]),
    clinicCount: actualClinicCount || getDashboardMetric(summaryData, ["totalClinics", "clinics", "clinicCount"]),
    totalUsers: actualUserCount || getDashboardMetric(summaryData, ["totalUsers", "users", "userCount"]),
    users: actualUserCount || getDashboardMetric(summaryData, ["totalUsers", "users", "userCount"]),
    userCount: actualUserCount || getDashboardMetric(summaryData, ["totalUsers", "users", "userCount"]),
    activeUsers: activeUserCount || getDashboardMetric(summaryData, ["activeUsers", "activeUserCount"]),
    activeUserCount: activeUserCount || getDashboardMetric(summaryData, ["activeUsers", "activeUserCount"]),
    totalAdmins: adminCount || getDashboardMetric(summaryData, ["totalAdmins", "admins", "adminCount"]),
    admins: adminCount || getDashboardMetric(summaryData, ["totalAdmins", "admins", "adminCount"]),
    adminCount,
    totalRevenue: backendRevenue || finalRows.reduce((sum, row) => sum + toNumber(row.revenue), 0),
    opRevenue: billingTotals.opRevenue || finalRows.reduce((sum, row) => sum + toNumber(row.opRevenue), 0),
    diagnosticRevenue: billingTotals.diagnosticRevenue || finalRows.reduce((sum, row) => sum + toNumber(row.diagnosticRevenue), 0),
    pharmacyRevenue: billingTotals.pharmacyRevenue || finalRows.reduce((sum, row) => sum + toNumber(row.pharmacyRevenue), 0),
  };

  return {
    rows: finalRows,
    chartData: mergeReportChartData({ revenueRows, activityRows, rows: finalRows }),
    activityRows: activityRows.map(normalizeActivity),
    summary: nextSummary,
    error:
      summary.status === "rejected" &&
      clinicRevenue.status === "rejected" &&
      revenueTrend.status === "rejected" &&
      topClinics.status === "rejected" &&
      userActivity.status === "rejected" &&
      clinics.status === "rejected" &&
      admins.status === "rejected"
        ? summary.reason?.message || clinicRevenue.reason?.message || revenueTrend.reason?.message
        : "",
  };
};

export const fetchSuperAdminClinicRevenue = async (hospitalId) => {
  const id = encodeURIComponent(String(hospitalId || "").trim());
  if (!id) throw new Error("Hospital id is required.");
  return superAdminRequest(`${SUPER_ADMIN_API.reportsClinicRevenueByHospital}/${id}`);
};

export const getDashboardMetric = (source, keys, fallback = 0) =>
  toNumber(pick(source, keys, fallback));

// Helper functions for getting actual counts from fetched data
export const countActualClinics = async () => {
  try {
    const clinics = await superAdminRequest(SUPER_ADMIN_API.clinics);
    return asArray(clinics).length;
  } catch {
    return 0;
  }
};

export const countActualUsers = async () => {
  try {
    const users = await superAdminRequest(SUPER_ADMIN_API.users);
    const userRows = asArray(users).filter((u) => !u.isDeleted);
    return userRows.length;
  } catch {
    return 0;
  }
};

export const countActiveUsers = async () => {
  try {
    const users = await superAdminRequest(SUPER_ADMIN_API.users);
    const userRows = asArray(users).filter((u) => !u.isDeleted && (u.active === true || u.isActive === true || u.status === "Active"));
    return userRows.length;
  } catch {
    return 0;
  }
};
