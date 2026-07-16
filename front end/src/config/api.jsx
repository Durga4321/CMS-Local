const DEFAULT_API_BASE_URL = "https://stroller-uplifted-freebee.ngrok-free.dev";
// Images are served from the localhost backend
const DEFAULT_API_ASSET_BASE_URL = "https://localhost:7178";

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

export const replacePathParams = (path, params = {}) =>
  String(path || "").replace(/{([^}]+)}/g, (_, key) => {
    const value = params[key];
    return value === undefined || value === null
      ? ""
      : encodeURIComponent(String(value));
  });

export const patientApiUrl = (path, params = {}) => apiUrl(replacePathParams(path, params));

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
  cancelAppointment: "patient-portal/appointments/{id}/cancel",
  rescheduleAppointment: "patient-portal/appointments/{id}/reschedule",
  medicalHistory: "patient-portal/medical-history",
  prescriptions: "patient-portal/prescriptions",
  prescriptionById: "patient-portal/prescriptions/{id}",
  bills: "patient-portal/bills",
  billPay: "patient-portal/bills/{id}/pay",
  notifications: "patient-portal/notifications",
  notificationRead: "patient-portal/notifications/{id}/read",
  notificationDelete: "patient-portal/notifications/{id}",
};
