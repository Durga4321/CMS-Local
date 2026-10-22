import { apiUrl } from "../config/api";
import { getNurseProfile, getNurseToken, isNurseSession } from "./nurseSession";
import { getRecordClinicId } from "./nurseScope";

export const parseList = (data, depth = 0) => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object" || depth > 6) return [];
  for (const key of ["data", "items", "appointments", "patients", "records", "results", "result", "printQueue", "queue", "$values"]) {
    const actual = Object.keys(data).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (!actual) continue;
    if (Array.isArray(data[actual])) return data[actual];
    const rows = parseList(data[actual], depth + 1);
    if (rows.length) return rows;
  }
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
    cache: "no-store",
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
    const validation = data?.errors && typeof data.errors === "object" ? Object.values(data.errors).flat().join(" ") : "";
    const message = data?.message || validation || data?.title || (typeof data === "string" ? data : "") || (response.status === 403 ? "Your nurse account is not authorized to access " + finalPath + ". Check backend Nurse role permissions." : "Unable to load " + finalPath + " (HTTP " + response.status + ").");
    throw new Error(message);
  }

  // These endpoints are hospital-scoped by the authenticated backend. Preserve that
  // request context when a DTO omits the hospital ID; never infer a missing branch.
  if ((options.method || "GET").toUpperCase() === "GET" && /^(Appointment|Nurse\/patients|Nurse\/print-queue)(?:\?|$)/i.test(finalPath)) {
    const hospitalId = getNurseProfile().hospitalId;
    const annotate = (value, depth = 0) => {
      if (depth > 6 || !value || typeof value !== "object") return value;
      if (Array.isArray(value)) return value.map((row) => row && typeof row === "object" ? { ...row, hospitalId: getRecordClinicId(row) || hospitalId } : row);
      return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, /^(data|items|appointments|patients|records|results|result|printQueue|queue|\$values)$/i.test(key) ? annotate(nested, depth + 1) : nested]));
    };
    return annotate(data);
  }
  return data;
};

export const getNurseAppointments = async () => {
  const results = await Promise.allSettled([requestJson("Appointment"), requestJson("Nurse/print-queue")]);
  if (results.every((result) => result.status === "rejected")) throw new Error(results.map((result) => result.reason.message).join(" "));
  const map = new Map();
  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    parseList(result.value).forEach((row) => {
      const id = readFirst(row, ["appointmentId", "AppointmentId", "id", "Id"]);
      if (!id) return;
      const previous = map.get(String(id)) || {};
      const next = { ...previous };
      Object.entries(row).forEach(([key, value]) => { if (value !== null && value !== undefined && value !== "") next[key] = value; });
      map.set(String(id), next);
    });
  });
  if (!map.size && results[0].status === "rejected") throw results[0].reason;
  return [...map.values()];
};
const bookingType = (row) => String(readFirst(row, ["bookingType", "BookingType", "appointmentType", "AppointmentType", "source", "Source", "type", "Type"])).toLowerCase();
export const getOnlineAppointments = async () => (await getNurseAppointments()).filter((row) => bookingType(row).includes("online") || row.isOnline === true || row.IsOnline === true);
export const getOfflineAppointments = async () => (await getNurseAppointments()).filter((row) => bookingType(row).includes("offline") || row.isOnline === false || row.IsOnline === false);
export const getNurses = async () => parseList(await requestJson("Staff?role=Nurse")).filter(isNurseRecord);

export default {
  requestJson,
  getOnlineAppointments,
  getOfflineAppointments,
  getNurses,
};
