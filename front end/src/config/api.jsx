const DEFAULT_API_BASE_URL = "https://theater-outreach-unable.ngrok-free.dev";
const DEFAULT_API_ASSET_BASE_URL = DEFAULT_API_BASE_URL;
export const CMS_GLOBAL_SETTINGS_KEY = "cms_global_settings";

export const API_BASE_URL = (
  process.env.REACT_APP_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

export const API_ASSET_BASE_URL = (
  process.env.REACT_APP_API_ASSET_BASE_URL || DEFAULT_API_ASSET_BASE_URL
).replace(/\/+$/, "");

export const apiUrl = (path) => {
  const cleanPath = String(path || "")
    .replace(/^\/+/, "")
    .replace(/^api\/?/i, "");

  return `${API_BASE_URL}/api/${cleanPath}`;
};

export const assetUrl = (path) => {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (/^(data:|blob:|https?:\/\/)/i.test(raw)) return raw;

  const cleanPath = raw
    .replace(/\\/g, "/")
    .replace(/^[a-z]:\/+/i, "")
    .replace(/^\/+/, "");

  return `${API_ASSET_BASE_URL}/${cleanPath}`;
};

export const replacePathParams = (path, params = {}) =>
  String(path || "").replace(/{([^}]+)}/g, (_, key) => {
    const value = params[key];
    return value === undefined || value === null
      ? ""
      : encodeURIComponent(String(value));
  });

export const patientApiUrl = (path, params = {}) => apiUrl(replacePathParams(path, params));

export const getCachedGlobalSettings = () => {
  try {
    const settings = JSON.parse(localStorage.getItem(CMS_GLOBAL_SETTINGS_KEY) || "{}");
    return settings && typeof settings === "object" ? settings : {};
  } catch {
    return {};
  }
};

export const cacheGlobalSettings = (settings = {}) => {
  try {
    localStorage.setItem(CMS_GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures; API settings are still the source of truth.
  }
  return settings;
};

export const BILLING_API = {
  op: "Billing/op",
  lab: "Billing/lab",
  diagnostic: "Billing/lab",
  pharmacy: "Billing/pharmacy",
};

export const BILLING_API_PATHS = [
  BILLING_API.op,
  BILLING_API.lab,
  BILLING_API.pharmacy,
];

export const getBillingApiPath = (type = "op") => {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized.includes("pharmacy") || normalized.includes("medicine")) return BILLING_API.pharmacy;
  if (normalized.includes("lab") || normalized.includes("diagnostic") || normalized.includes("diagnosis") || normalized.includes("test")) return BILLING_API.lab;
  return BILLING_API.op;
};

export const PATIENT_API = {
  register: "Auth/register-patient",
  registerAlt: "Auth/register",
  registerUser: "Auth/register-user",
  patientRegister: "patient/register",
  patientsRegister: "patients/register",
  dashboard: "patient-portal/dashboard",
  profile: "patient-portal/profile",
  clinics: "patient-portal/clinics",
  branches: "patient-portal/branches",
  branchDepartments: "patient-portal/branches/{branchId}/departments",
  clinicDepartments: "patient-portal/clinics/{clinicId}/departments",
  doctors: "patient-portal/doctors",
  doctorSlots: "patient-portal/doctors/{doctorId}/slots",
  appointments: "patient-portal/appointments",
  appointmentById: "patient-portal/appointments/{id}",
  appointmentQueueStatus: "patient-portal/appointments/{id}/queue-status",
  appointmentToken: "patient-portal/appointments/{id}/token",
  cancelAppointment: "patient-portal/appointments/{id}/cancel",
  rescheduleAppointment: "patient-portal/appointments/{id}/reschedule",
  medicalHistory: "patient-portal/medical-history",
  prescriptions: "patient-portal/prescriptions",
  prescriptionById: "patient-portal/prescriptions/{id}",
  bills: "patient-portal/bills",
  billDetails: "patient-portal/bills/{id}",
  billPay: "patient-portal/bills/{id}/pay",
  notifications: "patient-portal/notifications",
  notificationRead: "patient-portal/notifications/{id}/read",
  notificationDelete: "patient-portal/notifications/{id}",
};
