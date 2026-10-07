//const DEFAULT_API_BASE_URL = "https://theater-outreach-unable.ngrok-free.dev";
const DEFAULT_API_BASE_URL = "https://irritant-kilobyte-until.ngrok-free.dev";
const DEFAULT_API_ASSET_BASE_URL = DEFAULT_API_BASE_URL;
export const CMS_GLOBAL_SETTINGS_KEY = "cms_global_settings";

export const API_BASE_URL = (
  process.env.REACT_APP_API_BASE_URL || DEFAULT_API_BASE_URL
).trim().replace(/\/+$/, "");

export const API_ASSET_BASE_URL = (
  process.env.REACT_APP_API_ASSET_BASE_URL || DEFAULT_API_ASSET_BASE_URL
).trim().replace(/\/+$/, "");

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
  medicalHistory: "MedicalHistory/{patientId}",
  prescriptions: "patient-portal/prescriptions",
  prescriptionById: "patient-portal/prescriptions/{id}",
  bills: "patient-portal/bills",
  billDetails: "patient-portal/bills/{id}",
  billPay: "patient-portal/bills/{id}/pay",
  notifications: "patient-portal/notifications",
  notificationRead: "patient-portal/notifications/{id}/read",
  notificationDelete: "patient-portal/notifications/{id}",
};


export const API_ENDPOINTS = {
  auth: {
    login: "Auth/login",
    logout: "Auth/logout",
    me: "Auth/me",
    forgotPassword: "Auth/forgot-password",
    verifyOtp: "Auth/verify-otp",
    resetPassword: "Auth/reset-password",
    changePassword: "Auth/change-password",
    registerDoctor: "Auth/register-doctor",
    registerReceptionist: "Auth/register-receptionist",
    registerNurse: "Auth/register-nurse",
  },
  superAdmin: {
    dashboard: "SuperAdmin/dashboard",
    summary: "SuperAdmin/summary",
    reportSummary: "SuperAdminReports/summary",
  },
  subscriptions: {
    plans: "subscriptions/plans",
    planById: "subscriptions/plans/{id}",
    assign: "subscriptions/assign",
    all: "subscriptions/all",
    my: "subscriptions/my",
  },
  users: {
    list: "users",
    byId: "users/{id}",
    status: "users/{id}/status",
  },
  admins: {
    list: "admins",
    byId: "admins/{id}",
    status: "admins/{id}/status",
  },
  roles: {
    admins: "roles/admins",
    list: "roles",
    byId: "roles/{id}",
    permissions: "roles/{id}/permissions",
    roleNames: "roles/roles",
  },
  clinics: {
    list: "clinics",
    byId: "clinics/{id}",
  },
  location: {
    pincode: "Location/pincode/{pincode}",
  },
  branches: {
    list: "Branch",
    byId: "Branch/{id}",
  },
  doctors: {
    list: "Doctor",
    byId: "Doctor/{id}",
    status: "Doctor/{id}/status",
    specializations: "Doctor/specializations",
    qualifications: "Doctor/qualifications",
    branches: "Doctor/{doctorId}/branches",
    byBranch: "Doctor/branch/{branchId}",
    dashboard: "Doctor/dashboard",
    patients: "Doctor/patients",
  },
  staff: {
    list: "Staff",
    byId: "Staff/{id}",
    labTechnicians: "Staff/lab-technicians",
    toggleStatus: "Staff/{id}/toggle-status",
  },
  userPermissions: {
    eligibleUsers: "user-permissions/eligible-users",
    user: "user-permissions/users/{userId}",
    me: "user-permissions/me",
  },
  schedule: {
    list: "Schedule",
    byId: "Schedule/{id}",
    doctor: "Schedule/doctor/{doctorId}",
    daySlots: "Schedule/day-slots",
    overrides: "Schedule/overrides",
    leave: "Schedule/overrides/leave",
    leaveById: "Schedule/overrides/leave/{id}",
    timeChange: "Schedule/overrides/time-change",
    branchShift: "Schedule/overrides/branch-shift",
    overrideById: "Schedule/overrides/{id}",
  },
  scheduleSettings: {
    list: "ScheduleSettings",
    byId: "ScheduleSettings/{id}",
    holidays: "ScheduleSettings/holidays",
  },
  patients: {
    list: "Patient",
    byId: "Patient/{id}",
    bloodGroups: "Patient/blood-groupsDropdown",
  },
  patientPortal: PATIENT_API,
  appointments: {
    list: "Appointment",
    status: "Appointment/{id}/status",
    byBranch: "Appointment/branch/{branchId}",
    online: "Appointment/online",
    offline: "Appointment/offline",
    documents: "Appointment/{appointmentId}/documents",
    chiefComplaints: "Appointment/chief-complaints",
  },
  nurse: {
    dashboard: "Nurse/dashboard",
    patients: "Nurse/patients",
    patientById: "Nurse/patients/{patientId}",
    vitals: "Nurse/appointments/{appointmentId}/vitals",
    vitalsHistory: "Nurse/patients/{patientId}/vitals",
  },
  medicalHistory: {
    list: "MedicalHistory/all/{patientId}",
    latest: "MedicalHistory/{patientId}",
    byId: "MedicalHistory/{id}",
  },
  consultation: {
    list: "Consultation",
    byAppointment: "Consultation/appointment/{appointmentId}",
    vitals: "Consultation/appointment/{appointmentId}/vitals",
    diagnosisDropdown: "Consultation/diagnosis-dropdown",
    clinicalNoteTemplates: "Consultation/clinical-note-templates",
  },
  prescription: {
    list: "Prescription",
    byAppointment: "Prescription/appointment/{appointmentId}",
    dosages: "Prescription/dosages",
    frequencies: "Prescription/frequencies",
    medicines: "Prescription/medicineDropdown",
    instructions: "Prescription/Instructiondropdown",
  },
  lab: {
    dashboard: "Lab/dashboard",
    master: "Lab/master",
    masterById: "Lab/master/{id}",
    importMaster: "Lab/master/import",
    orders: "Lab/orders",
    orderById: "Lab/orders/{id}",
    sampleCollected: "Lab/orders/{id}/sample-collected",
    start: "Lab/orders/{id}/start",
    result: "Lab/orders/{id}/result",
    report: "Lab/orders/{id}/report",
    complete: "Lab/orders/{id}/complete",
  },
  billing: {
    appointments: "Billing/appointments",
    appointmentPrescription: "Billing/appointments/{appointmentId}/prescription",
    op: "Billing/op",
    lab: "Billing/lab",
    pharmacy: "Billing/pharmacy",
    list: "Billing",
    byId: "Billing/{id}",
    payment: "Billing/{billId}/payment",
  },
  payment: {
    create: "payment/create",
    success: "payment/success",
  },
  dashboard: {
    clinic: "Dashboard",
    revenue: "Dashboard/revenue",
    dailyAppointments: "Dashboard/reports/daily-appointments",
    revenueReport: "Dashboard/reports/revenue",
    doctors: "Dashboard/reports/doctors",
  },
  reports: {
    dailyAppointments: "Report/daily-appointments",
    revenue: "Report/revenue",
    gstSummary: "Report/gst-summary",
    doctorWise: "Report/doctor-wise",
  },
  auditLogs: {
    list: "AuditLogs",
    loginHistory: "AuditLogs/login-history",
    loginHistoryByDate: "login-history",
  },
};

export const endpointUrl = (path, params = {}) => apiUrl(replacePathParams(path, params));
