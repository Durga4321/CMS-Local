import { apiUrl } from "../config/api";
import { getNurseToken, isNurseSession } from "./nurseSession";

export const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.appointments)) return data.appointments;
  if (Array.isArray(data?.result)) return data.result;
  return [];
};

const normalizeRole = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");

const readFirst = (record = {}, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = String(key)
      .split(".")
      .reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), record);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
};

export const getStaffRole = (record = {}) =>
  normalizeRole(
    readFirst(record, [
      "role",
      "Role",
      "roleName",
      "RoleName",
      "type",
      "Type",
      "staffRole",
      "StaffRole",
      "userRole",
      "UserRole",
    ])
  );

export const isNurseRecord = (record = {}) => getStaffRole(record) === "nurse";

const nurseApiPath = (path, method = "GET") => {
  const raw = String(path || "").replace(/^\/+/, "");
  if (!isNurseSession()) return raw;
  if (/^Patient\/([^/?]+)$/i.test(raw) && method.toUpperCase() === "PUT") {
    return raw.replace(/^Patient\/([^/?]+)$/i, "Nurse/patients/$1");
  }
  if (/^Patient$/i.test(raw) && method.toUpperCase() === "GET") return "Nurse/patients";
  if (/^Appointment\/online\/([^/]+)\/vitals/i.test(raw)) {
    return raw.replace(/^Appointment\/online\/([^/]+)\/vitals/i, "Nurse/appointments/$1/vitals");
  }
  return raw;
};

export const requestJson = async (path, options = {}) => {
  const token = getNurseToken();
  const headers = {
    "ngrok-skip-browser-warning": "true",
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  // Rewrite path to nurse-specific endpoints when needed, then call shared apiUrl
  const finalPath = nurseApiPath(String(path || "").replace(/^\/+/, ""), options.method || "GET");
  const response = await fetch(apiUrl(finalPath), {
    ...options,
    headers,
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
    const message = data?.message || data || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
};

export const getOnlineAppointments = async () => parseList(await requestJson("Appointment/online"));
export const getOfflineAppointments = async () => parseList(await requestJson("Appointment/offline"));
export const getNurses = async () => parseList(await requestJson("Staff?role=Nurse")).filter(isNurseRecord);

export default {
  requestJson,
  getOnlineAppointments,
  getOfflineAppointments,
  getNurses,
};
