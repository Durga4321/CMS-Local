import { apiUrl } from "../../config/api";

export const SUPER_ADMIN_API = {
  dashboard: "SuperAdmin/dashboard",
  dashboardCompat: "dashboard/dashboard",
  createClinicAdmin: "admins",
  superAdminClinics: "Clinics",
  admins: "admins",
  clinics: "Clinics",
  notifications: "notifications",
  notificationSend: "notifications/send",
  auditLogs: "AuditLogs",
  loginHistory: "AuditLogs/login-history",
  dashboardSummary: "SuperAdmin/summary",
  dashboardSummaryCompat: "dashboard/summary",
  revenueOverview: "dashboard/revenue-overview",
  activities: "dashboard/activities",
  dailyAppointmentsReport: "Report/daily-appointments",
  revenueReport: "Report/revenue",
  doctorWiseReport: "Report/doctor-wise",
  reportsSummary: "SuperAdminReports/summary",
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
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeStatus = (value) => {
  if (typeof value === "boolean") return value ? "Active" : "Inactive";
  const status = String(value || "Active");
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const normalizeNotificationStatus = (notification = {}) => {
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

  const status = normalizeStatus(pick(notification, ["status", "state"], "Sent"));
  return status.toLowerCase() === "read" ? "Read" : "Sent";
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

const normalizeString = (value) => String(value || "").trim().toLowerCase();

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

const isUserLoginMatch = (user = {}, log = {}) => {
  const userEmail = normalizeString(pick(user, ["email", "emailAddress"]));
  const userName = normalizeString(pick(user, ["name", "fullName", "userName", "displayName"]));
  const logEmail = normalizeString(pick(log, ["email", "emailAddress", "userEmail"]));
  const logUser = normalizeString(pick(log, ["user", "userName", "name"]));

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
    const time = getTimestamp(timestampRaw);

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
  const city = pick(clinic, ["city", "City", "town", "Town", "locality", "Locality"]);
  const state = pick(clinic, ["state", "State", "province", "Province", "region", "Region"]);
  const country = pick(clinic, ["country", "Country"]);
  const postalCode = pick(clinic, ["postalCode", "PostalCode", "zipCode", "ZipCode", "pinCode", "PinCode"]);
  const hasStructuredLocation = city || state || country || postalCode;
  const street = streetLine || (hasStructuredLocation ? "" : rawAddress);

  const structuredParts = compactAddressParts([
    street,
    city,
    state,
    country && !continentNames.has(String(country).trim().toLowerCase()) ? country : "",
    postalCode,
  ]);

  if (structuredParts.length > 1) {
    return structuredParts.join(", ");
  }

  const fallbackAddress = String(rawAddress || streetLine || "").trim();
  const rawParts = compactAddressParts(fallbackAddress.split(","));

  if (rawParts.length > 1 && continentNames.has(rawParts[0].toLowerCase())) {
    return rawParts.slice(1).join(", ");
  }

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

  return formatDateTime(activityValue) || "Never Logged In";
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

export const superAdminRequest = async (path, options = {}) => {
  const { body, headers, ...rest } = options;
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("superAdminToken");
  const response = await fetch(apiUrl(path), {
    ...rest,
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  assignedClinic: pick(admin, ["assignedClinic", "AssignedClinic", "clinicName", "ClinicName", "hospitalName", "HospitalName", "clinic"]),
  assignedClinicId: pick(admin, ["clinicId", "ClinicId", "hospitalId", "HospitalId", "assignedClinicId", "AssignedClinicId"]),
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
    ["password", "temporaryPassword", "Password", "TemporaryPassword", "AdminPassword"],
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
    temporaryPassword: pick(admin, ["temporaryPassword", "TemporaryPassword"], password),
    role: pick(admin, ["role", "Role", "AdminRole"], "Admin"),
    hospitalId: Number(pick(admin, ["hospitalId", "clinicId", "assignedClinicId", "HospitalId", "ClinicId"], 0)) || 0,
    sendWelcomeEmail: pick(admin, ["sendWelcomeEmail"], true) !== false,
  };

  if (!includeBlankPassword && !payload.password) {
    delete payload.password;
    delete payload.temporaryPassword;
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

export const normalizeAuditLog = (log = {}) => ({
  id: pick(log, ["id", "logId", "_id"]),
  user: pick(log, ["user", "userName", "name", "email"], "System"),
  userEmail: pick(log, ["email", "emailAddress", "userEmail"]),
  action: pick(log, ["action", "activity", "message", "description"]),
  timestampRaw: pick(log, ["timestamp", "createdAt", "date"]),
  timestamp: formatDateTime(pick(log, ["timestamp", "createdAt", "date"])),
  sortTime: getTimestamp(pick(log, ["timestamp", "createdAt", "date"])),
  module: pick(log, ["module", "moduleName", "category"], "Audit"),
  ipAddress: pick(log, ["ipAddress", "ip", "clientIp"], ""),
  role: getAuditRole(log),
});

export const normalizeLoginLog = (log = {}, index = 0) => ({
  id: pick(log, ["id", "logId", "_id"], `login-${index}`),
  user: pick(log, ["user", "userName", "name", "email", "emailAddress"], "Unknown user"),
  userEmail: pick(log, ["email", "emailAddress", "userEmail"]),
  action: pick(log, ["action", "activity", "message", "description"], "Logged in"),
  timestampRaw: pick(log, ["timestamp", "createdAt", "date", "loginTime", "time"]),
  timestamp: formatDateTime(pick(log, ["timestamp", "createdAt", "date", "loginTime", "time"])),
  sortTime: getTimestamp(pick(log, ["timestamp", "createdAt", "date", "loginTime", "time"])),
  module: "Login",
  ipAddress: pick(log, ["ipAddress", "ip", "clientIp"], ""),
  role: getAuditRole(log),
});

const normalizeNotificationTarget = (target = "") => {
  const value = String(target || "All Active Users").trim();
  const normalized = value.toLowerCase();

  if (normalized.includes("admin")) return "Active Admins";
  return "All Active Users";
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

  if (targetValues.some((value) => String(value).toLowerCase().includes("admin"))) {
    return "Active Admins";
  }

  return normalizeNotificationTarget(targetValues[0] || "All Active Users");
};

export const normalizeNotification = (notification = {}) => ({
  id: pick(notification, ["id", "notificationId", "_id"]),
  title: pick(notification, ["title", "subject"], "Notification"),
  message: pick(notification, ["message", "body", "description"]),
  targetUsers: getNotificationTarget(notification),
  status: normalizeNotificationStatus(notification),
  createdAt: pick(notification, ["createdAt", "createdOn", "date", "timestamp"], ""),
});

const getNotificationAudienceCode = (target = "") =>
  normalizeNotificationTarget(target) === "Active Admins" ? "admins" : "all";

const buildNotificationPayload = (notification = {}) => {
  const targetUsers = normalizeNotificationTarget(
    pick(
      notification,
      ["targetUsers", "audience", "target", "recipient", "targetAudience", "userType", "role"],
      "All Active Users"
    )
  );
  const audienceCode = getNotificationAudienceCode(targetUsers);

  return {
    title: String(pick(notification, ["title", "subject"], "")).trim(),
    message: String(pick(notification, ["message", "body", "description"], "")).trim(),
    targetUsers,
    audience: targetUsers,
    target: targetUsers,
    recipient: targetUsers,
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
  revenue: toNumber(pick(row, ["revenue", "Revenue", "totalRevenue", "TotalRevenue", "amount", "Amount"], 0)),
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
        "grandTotal",
        "total",
        "amount",
        "paidAmount",
        "paymentAmount",
        "revenue",
        "consultationCharge",
      ],
      0
    )
  );

const getBillingDate = (item = {}) =>
  pick(item, ["createdAt", "paidAt", "paymentDate", "invoiceDate", "date", "appointmentDate"], "");

const getMonthLabel = (value) => {
  const text = String(value || "").trim();
  const monthOnlyMatch = text.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*$/i);
  const date = monthOnlyMatch ? new Date(`${text} 1, ${new Date().getFullYear()}`) : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "Unknown";
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
      adminName: normalizedRow.adminName || admin.name || "",
      adminEmail: normalizedRow.adminEmail || admin.email || "",
      users,
      invoiceCount,
    };
  });
};

const buildAdminRevenueRows = ({ billingRows = [], clinicRows = [], adminRows = [], userRows = [], appointmentRows = [] }) => {
  const { admins, clinics, clinicById, clinicByName, adminByClinicId, adminByClinicName } = buildAdminLookups({
    clinicRows,
    adminRows,
  });
  const userCountLookup = buildClinicUserCountLookup(userRows);
  const invoiceCountLookup = buildClinicInvoiceCountLookup(billingRows, appointmentRows);
  const appointmentLookup = buildAppointmentClinicLookup(appointmentRows);

  const rows = new Map();

  billingRows.forEach((item, index) => {
    const clinicId = getBillingClinicId(item, appointmentLookup);
    const rawClinicName = getBillingClinicName(item, appointmentLookup);
    const clinic =
      (clinicId && clinicById.get(String(clinicId))) ||
      (rawClinicName && clinicByName.get(String(rawClinicName).toLowerCase())) ||
      {};
    const clinicName = clinic.name || rawClinicName || "Unassigned Clinic";
    const admin =
      (clinicId && adminByClinicId.get(String(clinicId))) ||
      adminByClinicName.get(String(clinicName).toLowerCase()) ||
      {};
    const directAdminName = getReportAdminName(item);
    const directAdminEmail = getReportAdminEmail(item);
    const key = getBillingAdminKey(item) || admin.id || `${clinicName}-${directAdminName || index}`;
    const current =
      rows.get(key) || {
        id: key,
        name: clinicName,
        adminName: admin.name || directAdminName || "Admin",
        adminEmail: admin.email || directAdminEmail || "",
        revenue: 0,
        users: 0,
        invoiceCount: 0,
        status: clinic.status || "Active",
      };

    current.revenue += getBillingAmount(item);
    current.invoiceCount += 1;
    current.users = Math.max(
      current.users,
      toNumber(pick(clinic, ["users"], 0)),
      getClinicUserCount(item, current, clinic, userCountLookup)
    );
    rows.set(key, current);
  });

  if (!rows.size) {
    const fallbackRows = clinics.length
      ? clinics.map((clinic) => ({
          id: clinic.id || clinic.name,
          name: clinic.name || "Unassigned Clinic",
          admin: adminByClinicId.get(String(clinic.id)) || adminByClinicName.get(String(clinic.name).toLowerCase()) || {},
          clinic,
        }))
      : admins.map((admin) => ({
          id: admin.id || admin.email,
          name: admin.assignedClinic || "Unassigned Clinic",
          admin,
          clinic: {},
        }));

    fallbackRows.forEach(({ id, name, admin, clinic }) => {
      rows.set(id || name, {
        id: id || name,
        name,
        adminName: admin.name || "Admin",
        adminEmail: admin.email || "",
        revenue: 0,
        users: Math.max(
          toNumber(pick(clinic, ["users"], 0)),
          getClinicUserCount({ clinicName: name, clinicId: clinic.id }, { id, name }, clinic, userCountLookup)
        ),
        invoiceCount: getClinicInvoiceCount({ clinicName: name, clinicId: clinic.id }, { id, name }, clinic, invoiceCountLookup),
        status: clinic.status || admin.status || "Active",
      });
    });
  }

  return Array.from(rows.values());
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

  const id = pick(role, ["id", "roleId", "_id"], "");
  const name = pick(role, ["name", "roleName", "title"], "Role");
  const roleName = pick(role, ["roleName", "name", "title"], "Role");

  return {
    id,
    key: id || `role-${index}-${roleName || name}`,
    canPersistPermissions: hasValue(id),
    name,
    roleName,
    module: pick(role, ["module", "moduleName"], ""),
    users: toNumber(pick(role, ["users", "userCount", "assignedUsers", "totalUsers"], 0)),
    status: normalizeStatus(pick(role, ["status", "isActive", "active"], "Active")),
    permissions: normalizedPermissions.filter(Boolean).length
      ? normalizedPermissions.filter(Boolean)
      : booleanPermissions,
    raw: role,
  };
};

const buildRolePayload = (role = {}) => {
  const permissions = Array.isArray(role.permissions) ? role.permissions : [];
  const canView = permissions.includes("View") || pick(role, ["canView", "CanView"], false) === true;
  const canCreate = permissions.includes("Create") || pick(role, ["canCreate", "CanCreate"], false) === true;
  const canEdit = permissions.includes("Edit") || pick(role, ["canEdit", "CanEdit"], false) === true;
  const canDelete = permissions.includes("Delete") || pick(role, ["canDelete", "CanDelete"], false) === true;
  const roleName = String(pick(role, ["roleName", "name"], "")).trim();
  const module = String(pick(role, ["module"], "")).trim();

  return {
    roleName: roleName || "Role",
    name: roleName || "Role",
    module: module || "General",
    moduleName: module || "General",
    status: String(pick(role, ["status"], "Active") || "Active"),
    permissions,
    permissionNames: permissions,
    claims: permissions,
    canView,
    canCreate,
    canEdit,
    canDelete,
    CanView: canView,
    CanCreate: canCreate,
    CanEdit: canEdit,
    CanDelete: canDelete,
  };
};

const isDeletedRecord = (record = {}) => {
  const deletedValue = pick(
    record,
    ["isDeleted", "deleted", "isRemoved", "removed", "IsDeleted", "Deleted"],
    false
  );
  const status = String(pick(record, ["status", "Status"], "")).trim().toLowerCase();

  return (
    deletedValue === true ||
    deletedValue === 1 ||
    String(deletedValue).toLowerCase() === "true" ||
    status === "deleted" ||
    hasValue(pick(record, ["deletedAt", "DeletedAt", "removedAt"], ""))
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
  status: normalizeStatus(pick(user, ["status", "isActive", "active"], "Active")),
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

const normalizeSettingsSection = (section = {}, defaults = {}) => ({
  ...defaults,
  ...section,
  name: pick(section, ["name", "platformName", "senderName", "providerName", "gatewayName"], defaults.name || ""),
  status: pick(section, ["status", "enabled", "isEnabled"], defaults.status || "Enabled"),
  notes: pick(section, ["notes", "configurationNotes", "description"], defaults.notes || ""),
});

export const normalizeSettings = (settings = {}) => {
  const payload = asObject(settings);
  const general = payload.general || payload.generalSettings || payload;
  const email = payload.email || payload.emailSettings || {};
  const sms = payload.sms || payload.smsSettings || {};
  const payment = payload.payment || payload.paymentSettings || {};

  return {
    general: normalizeSettingsSection(general, {
      appName: pick(general, ["appName", "applicationName", "platformName", "name"], "CMS Platform"),
      timezone: pick(general, ["timezone", "timeZone", "defaultTimezone"], "Asia/Kolkata"),
      currency: pick(general, ["currency", "defaultCurrency", "currencyCode"], "INR"),
      name: "CMS Platform",
      status: "Enabled",
      notes: "Update general settings used across all clinics.",
    }),
    email: normalizeSettingsSection(email, {
      name: pick(email, ["name", "senderName", "fromName"], "CMS Notifications"),
      fromEmail: pick(email, ["fromEmail", "senderEmail", "email"], ""),
      smtpHost: pick(email, ["smtpHost", "host", "server"], ""),
      smtpPort: pick(email, ["smtpPort", "port"], "587"),
      username: pick(email, ["username", "userName", "smtpUsername"], ""),
      password: pick(email, ["password", "smtpPassword"], ""),
      status: "Enabled",
      notes: "Update email settings used across all clinics.",
    }),
    sms: normalizeSettingsSection(sms, {
      name: pick(sms, ["name", "providerName", "gatewayName"], "SMS Provider"),
      provider: pick(sms, ["provider", "providerName", "gatewayName"], ""),
      senderId: pick(sms, ["senderId", "senderID", "sender"], ""),
      apiKey: pick(sms, ["apiKey", "key", "token"], ""),
      apiSecret: pick(sms, ["apiSecret", "secret"], ""),
      status: "Enabled",
      notes: "Update sms settings used across all clinics.",
    }),
    payment: normalizeSettingsSection(payment, {
      name: pick(payment, ["name", "providerName", "gatewayName"], "Payment Gateway"),
      provider: pick(payment, ["provider", "providerName", "gatewayName"], ""),
      merchantId: pick(payment, ["merchantId", "merchantID", "accountId"], ""),
      publicKey: pick(payment, ["publicKey", "keyId", "publishableKey"], ""),
      secretKey: pick(payment, ["secretKey", "secret", "privateKey"], ""),
      mode: pick(payment, ["mode", "environment"], "Test"),
      status: "Enabled",
      notes: "Update payment settings used across all clinics.",
    }),
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

  const [doctorsResult, receptionistsResult] = await Promise.allSettled([
    superAdminRequest("Doctor"),
    superAdminRequest("Receptionist"),
  ]);
  const staffGroups = [
    {
      path: "Doctor",
      rows: doctorsResult.status === "fulfilled" ? asArray(doctorsResult.value) : [],
      buildBody: buildDoctorClinicUpdateBody,
    },
    {
      path: "Receptionist",
      rows: receptionistsResult.status === "fulfilled" ? asArray(receptionistsResult.value) : [],
      buildBody: buildReceptionistClinicUpdateBody,
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
  const localNotifications = readLocalList(LOCAL_NOTIFICATIONS_KEY).map(normalizeNotification);

  try {
    const remoteNotifications = asArray(
      await superAdminRequest(SUPER_ADMIN_API.notifications)
    ).map(normalizeNotification);

    return mergeNotificationRecords([...remoteNotifications, ...localNotifications]);
  } catch (error) {
    if (localNotifications.length) return localNotifications;
    throw error;
  }
};

export const fetchNotificationTargetOptions = async () => {
  const [adminsResult, usersResult, doctorsResult, receptionistsResult] = await Promise.allSettled([
    superAdminRequest(SUPER_ADMIN_API.admins),
    superAdminRequest(SUPER_ADMIN_API.users),
    superAdminRequest("Doctor"),
    superAdminRequest("Receptionist"),
  ]);

  const counts = {
    admins:
      adminsResult.status === "fulfilled"
        ? asArray(adminsResult.value).filter(isActiveRecord).length
        : 0,
    users:
      usersResult.status === "fulfilled"
        ? asArray(usersResult.value).filter(isActiveRecord).length
        : 0,
    doctors:
      doctorsResult.status === "fulfilled"
        ? asArray(doctorsResult.value).filter(isActiveRecord).length
        : 0,
    receptionists:
      receptionistsResult.status === "fulfilled"
        ? asArray(receptionistsResult.value).filter(isActiveRecord).length
        : 0,
  };
  const allActiveUsersCount =
    counts.admins + counts.users + counts.doctors + counts.receptionists;

  const options = [
    {
      value: "All Active Users",
      label: "All Active Users",
      count: allActiveUsersCount,
    },
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
    const result = await superAdminRequest(`${SUPER_ADMIN_API.notifications}/${id}/read`, {
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

const getCurrentSessionRole = () =>
  localStorage.getItem("adminRole") ||
  localStorage.getItem("doctorRole") ||
  localStorage.getItem("receptionistRole") ||
  localStorage.getItem("userRole") ||
  "";

export const recordAuditLog = (log) =>
  prependLocalItem(LOCAL_AUDIT_LOGS_KEY, {
    id: `local-audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    role: getCurrentSessionRole(),
    ...log,
  });

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
    body: log,
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

const addRoleLookupUser = (lookup, user = {}) => {
  const role = pick(user, ["role", "roleName", "type", "userType"], "");
  addRoleLookupValue(lookup, pick(user, ["email", "emailAddress", "userEmail"], ""), role);
  addRoleLookupValue(lookup, pick(user, ["name", "fullName", "userName", "displayName"], ""), role);
};

const buildAuditRoleLookup = ({ users = [], admins = [], loginLogs = [] }) => {
  const lookup = new Map();

  users.map(normalizeUser).forEach((user) => addRoleLookupUser(lookup, user));
  admins.map(normalizeAdmin).forEach((admin) => addRoleLookupUser(lookup, admin));
  loginLogs.forEach((log) => {
    addRoleLookupValue(lookup, log.userEmail, log.role);
    addRoleLookupValue(lookup, log.user, log.role);
  });

  return lookup;
};

const withAuditRoleFallback = (log, roleLookup) => {
  if (log.role) return log;

  const role =
    roleLookup.get(normalizeString(log.userEmail)) ||
    roleLookup.get(normalizeString(log.user));

  return role ? { ...log, role } : log;
};

export const fetchAuditLogs = async () => {
  const [auditResult, loginResult, usersResult, adminsResult] = await Promise.allSettled([
    superAdminRequest(SUPER_ADMIN_API.auditLogs),
    superAdminRequest(SUPER_ADMIN_API.loginHistory),
    superAdminRequest(SUPER_ADMIN_API.users),
    superAdminRequest(SUPER_ADMIN_API.admins),
  ]);

  const auditLogs =
    auditResult.status === "fulfilled"
      ? asArray(auditResult.value).map(normalizeAuditLog)
      : [];
  const loginLogs =
    loginResult.status === "fulfilled"
      ? asArray(loginResult.value).map(normalizeLoginLog)
      : [];
  const localLogs = readLocalList(LOCAL_AUDIT_LOGS_KEY).map(normalizeAuditLog);
  const roleLookup = buildAuditRoleLookup({
    users: usersResult.status === "fulfilled" ? asArray(usersResult.value) : [],
    admins: adminsResult.status === "fulfilled" ? asArray(adminsResult.value) : [],
    loginLogs,
  });
  const logs = [...localLogs, ...loginLogs, ...auditLogs].map((log) =>
    withAuditRoleFallback(log, roleLookup)
  );

  if (!logs.length && auditResult.status === "rejected" && loginResult.status === "rejected") {
    throw auditResult.reason;
  }

  return logs;
};

export const fetchRoles = async () => {
  try {
    return asArray(await superAdminRequest(SUPER_ADMIN_API.roles))
      .map(normalizeRole);
  } catch (error) {
    const fallbackRoles = asArray(
      await superAdminRequest(SUPER_ADMIN_API.roleNames)
    )
      .map(normalizeRole);

    return fallbackRoles;
  }
};

export const fetchRoleNames = async () =>
  asArray(await superAdminRequest(SUPER_ADMIN_API.roleNames)).map((role, index) =>
    typeof role === "string" ? role : normalizeRole(role, index).name
  );

export const fetchRole = async (id) =>
  normalizeRole(await superAdminRequest(`${SUPER_ADMIN_API.roles}/${id}`));

export const saveRole = async (role, id) => {
  const result = await superAdminRequest(id ? `${SUPER_ADMIN_API.roles}/${id}` : SUPER_ADMIN_API.roles, {
    method: id ? "PUT" : "POST",
    body: buildRolePayload(role),
  });
  localStorage.removeItem("superadmin_role_overrides");
  recordSuperAdminActivity(
    id ? "Updated role" : "Created role",
    "Roles & Permissions",
    pick(role, ["roleName", "name"], id || "Role record")
  );
  return result;
};

export const deleteRole = async (id) => {
  const result = await superAdminRequest(`${SUPER_ADMIN_API.roles}/${id}`, { method: "DELETE" });
  recordSuperAdminActivity("Deleted role", "Roles & Permissions", `Role ID ${id}`);
  return result;
};

export const updateRolePermissions = async (id, role) => {
  const payload = buildRolePayload(role);
  const result = await superAdminRequestFirst(
    [
      `${SUPER_ADMIN_API.roles}/${id}`,
      `${SUPER_ADMIN_API.roles}/${id}/permissions`,
    ],
    {
      method: "PUT",
      body: payload,
    }
  );
  localStorage.removeItem("superadmin_role_overrides");
  recordSuperAdminActivity("Updated role permissions", "Roles & Permissions", pick(role, ["roleName", "name"], `Role ID ${id}`));
  return result;
};

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
      ? { ...user, lastActive: formatDateTime(lastLoginRaw) }
      : user;
  });
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

export const updateGeneralSettings = async (settings) => {
  const result = await superAdminRequest(SUPER_ADMIN_API.settingsGeneral, {
    method: "PUT",
    body: settings,
  });
  recordSuperAdminActivity("Updated general settings", "Settings", "General platform settings");
  return result;
};

export const updateEmailSettings = async (settings) => {
  const result = await superAdminRequest(SUPER_ADMIN_API.settingsEmail, {
    method: "PUT",
    body: settings,
  });
  recordSuperAdminActivity("Updated email settings", "Settings", "Email configuration");
  return result;
};

export const updateSmsSettings = async (settings) => {
  const result = await superAdminRequest(SUPER_ADMIN_API.settingsSms, {
    method: "PUT",
    body: settings,
  });
  recordSuperAdminActivity("Updated SMS settings", "Settings", "SMS configuration");
  return result;
};

export const updatePaymentSettings = async (settings) => {
  const result = await superAdminRequest(SUPER_ADMIN_API.settingsPayment, {
    method: "PUT",
    body: settings,
  });
  recordSuperAdminActivity("Updated payment settings", "Settings", "Payment configuration");
  return result;
};

export const fetchDashboardData = async () => {
  const [dashboard, summary, reportsSummary, revenueTrend, userActivity, auditLogs, loginHistory] = await Promise.allSettled([
    superAdminRequestFirst([SUPER_ADMIN_API.dashboard, SUPER_ADMIN_API.dashboardCompat]),
    superAdminRequestFirst([SUPER_ADMIN_API.dashboardSummary, SUPER_ADMIN_API.dashboardSummaryCompat]),
    superAdminRequest(SUPER_ADMIN_API.reportsSummary),
    superAdminRequest(SUPER_ADMIN_API.reportsRevenueTrend),
    superAdminRequest(SUPER_ADMIN_API.reportsUserActivity),
    superAdminRequest(SUPER_ADMIN_API.auditLogs),
    superAdminRequest(SUPER_ADMIN_API.loginHistory),
  ]);

  const dashboardData = dashboard.status === "fulfilled" ? asObject(dashboard.value) : {};
  const summaryData = {
    ...(reportsSummary.status === "fulfilled" ? asObject(reportsSummary.value) : {}),
    ...(summary.status === "fulfilled" ? asObject(summary.value) : {}),
  };
  const revenueData = revenueTrend.status === "fulfilled" ? revenueTrend.value : [];
  const reportActivityRows = userActivity.status === "fulfilled" ? asArray(userActivity.value).map(normalizeActivity) : [];
  const auditActivityRows =
    auditLogs.status === "fulfilled" ? asArray(auditLogs.value).map(normalizeAuditLog).map(auditLogToDashboardActivity) : [];
  const loginActivityRows =
    loginHistory.status === "fulfilled" ? asArray(loginHistory.value).map(normalizeLoginLog).map(auditLogToDashboardActivity) : [];
  const localActivityRows = readLocalList(LOCAL_AUDIT_LOGS_KEY).map(normalizeAuditLog).map(auditLogToDashboardActivity);
  const nextSummary = {
    ...summaryData,
    totalRevenue: getDashboardMetric({ ...dashboardData, ...summaryData }, ["totalRevenue", "revenue", "revenueSummary"]),
  };

  return {
    dashboard: dashboardData,
    summary: nextSummary,
    revenueData: buildMonthlyRevenueRows(asArray(revenueData)),
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
      revenueTrend.status === "rejected" &&
      userActivity.status === "rejected" &&
      auditLogs.status === "rejected" &&
      loginHistory.status === "rejected"
        ? dashboard.reason.message
        : "",
  };
};

export const fetchReports = async () => {
  const [summary, revenueTrend, topClinics, userActivity, revenue, activity, clinics, admins, users] = await Promise.allSettled([
    superAdminRequest(SUPER_ADMIN_API.reportsSummary),
    superAdminRequest(SUPER_ADMIN_API.reportsRevenueTrend),
    superAdminRequest(SUPER_ADMIN_API.reportsTopClinics),
    superAdminRequest(SUPER_ADMIN_API.reportsUserActivity),
    superAdminRequest(SUPER_ADMIN_API.reportsRevenue),
    superAdminRequest(SUPER_ADMIN_API.reportsActivity),
    superAdminRequest(SUPER_ADMIN_API.clinics),
    superAdminRequest(SUPER_ADMIN_API.admins),
    superAdminRequest(SUPER_ADMIN_API.users),
  ]);

  const topClinicRows = topClinics.status === "fulfilled" ? asArray(topClinics.value) : [];
  const revenueRows =
    revenue.status === "fulfilled"
      ? asArray(revenue.value)
      : revenueTrend.status === "fulfilled"
        ? asArray(revenueTrend.value)
        : [];
  const activityRows =
    activity.status === "fulfilled"
      ? asArray(activity.value)
      : userActivity.status === "fulfilled"
        ? asArray(userActivity.value)
        : [];
  const clinicRows = clinics.status === "fulfilled" ? asArray(clinics.value) : [];
  const adminRows = admins.status === "fulfilled" ? asArray(admins.value) : [];
  const userRows = users.status === "fulfilled" ? asArray(users.value) : [];
  const rows = topClinicRows.length
    ? enrichReportRows({ rows: topClinicRows, clinicRows, adminRows, userRows })
    : revenueRows.length
      ? enrichReportRows({ rows: revenueRows, clinicRows, adminRows, userRows })
    : buildAdminRevenueRows({ clinicRows, adminRows, userRows });

  return {
    rows,
    chartData: mergeReportChartData({ revenueRows, activityRows, rows }),
    activityRows: activityRows.map(normalizeActivity),
    error:
      summary.status === "rejected" &&
      revenueTrend.status === "rejected" &&
      topClinics.status === "rejected" &&
      userActivity.status === "rejected" &&
      revenue.status === "rejected" &&
      activity.status === "rejected" &&
      clinics.status === "rejected" &&
      admins.status === "rejected"
        ? revenueTrend.reason?.message || revenue.reason.message
        : "",
  };
};

export const getDashboardMetric = (source, keys, fallback = 0) =>
  toNumber(pick(source, keys, fallback));
