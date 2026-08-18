export const adminModuleSearchItems = [
  { label: "Dashboard", keywords: "home stats overview", path: "/dashboard" },
  { label: "Branches", keywords: "branch hospital location clinic city", path: "/branches" },
  { label: "Doctors", keywords: "doctor physicians schedule register specialty", path: "/doctors" },
  { label: "Receptionists", keywords: "front desk receptionist staff", path: "/receptionists" },
  { label: "Nurses", keywords: "nurse nursing staff", path: "/nurses" },
  { label: "Lab Technicians", keywords: "lab technician diagnostics tests", path: "/lab-technicians" },
  { label: "Lab Files", keywords: "lab files upload reports documents", path: "/lab-files" },
  { label: "Patients", keywords: "patient records medical history", path: "/patients" },
  { label: "Appointments", keywords: "booking appointment token online offline", path: "/appointments" },
  { label: "Schedule Settings", keywords: "doctor schedule slots timing", path: "/DoctorSchedule/schedule" },
  { label: "Roles & Permissions", keywords: "roles permissions access staff screens", path: "/roles" },
  { label: "User Management", keywords: "users logins online branch browser device", path: "/users" },
  { label: "Settings", keywords: "configuration clinic account", path: "/settings" },
  { label: "Reports", keywords: "analysis revenue export doctor daily", path: "/reports" },
];

export const superAdminModuleSearchItems = [
  { label: "Dashboard", keywords: "overview stats analytics", path: "/superadmin/dashboard" },
  { label: "Clinics", keywords: "clinic hospital branch", path: "/superadmin/clinics" },
  { label: "Admins", keywords: "clinic admins management", path: "/superadmin/admins" },
  { label: "Roles & Permissions", keywords: "roles permissions access", path: "/superadmin/roles" },
  { label: "Settings", keywords: "configuration email sms payment", path: "/superadmin/settings" },
  { label: "Reports", keywords: "analysis revenue export pdf csv", path: "/superadmin/reports" },
  { label: "Audit Logs", keywords: "login audit history activity", path: "/superadmin/audit-logs" },
  { label: "Notifications", keywords: "send notification message", path: "/superadmin/notifications" },
];

export const doctorModuleSearchItems = [
  { label: "Dashboard", keywords: "home overview", path: "/doctor/dashboard" },
  { label: "Consultation", keywords: "consult patient diagnosis treatment", path: "/doctor/consultation" },
  { label: "Prescription", keywords: "medicine rx patient", path: "/doctor/prescription" },
  { label: "Appointments", keywords: "booking schedule patient", path: "/doctor/appointments" },
  { label: "My Schedule", keywords: "timing slots availability", path: "/doctor/schedule" },
];

export const receptionModuleSearchItems = [
  { label: "Reception Dashboard", keywords: "home overview front desk", path: "/reception/dashboard" },
  { label: "Patients", keywords: "patient registration records", path: "/reception/patients" },
  { label: "Appointments", keywords: "booking appointment", path: "/reception/appointments" },
  { label: "Book Appointment", keywords: "appointment token schedule", path: "/reception/appointments" },
  { label: "Billing", keywords: "bill invoice payment receipt", path: "/reception/billing" },
  { label: "Consultant Room", keywords: "doctor consultation room", path: "/reception/consultant-room" },
];

export const nurseModuleSearchItems = [
  { label: "Nurse Dashboard", keywords: "home overview nurse desk", path: "/nurse/dashboard" },
  { label: "Patients", keywords: "patient records", path: "/nurse/patients" },
  { label: "Medical History", keywords: "history vitals records", path: "/nurse/medical-history" },
  { label: "Appointments", keywords: "booking appointment", path: "/nurse/appointments" },
  { label: "Book Appointment", keywords: "appointment token schedule", path: "/nurse/appointments" },
  { label: "Online Bookings", keywords: "online appointments bookings", path: "/nurse/appointments/online" },
  { label: "Offline Bookings", keywords: "offline appointments bookings", path: "/nurse/appointments/offline" },
];

export const labModuleSearchItems = [
  { label: "Lab Dashboard", keywords: "home overview lab desk", path: "/lab/dashboard" },
  { label: "Patients", keywords: "patient records", path: "/lab/patients" },
  { label: "Diagnosis Tests", keywords: "diagnosis tests lab", path: "/lab/diagnosis-tests" },
  { label: "Sample Collection", keywords: "sample collection test tube", path: "/lab/sample-collection" },
  { label: "Create Report", keywords: "create report lab result", path: "/lab/report-create" },
  { label: "Reports", keywords: "lab reports results", path: "/lab/reports" },
];

export const searchModuleItems = (items, query) => {
  const value = String(query || "").trim().toLowerCase();
  if (!value) return items;

  return items.filter((item) =>
    `${item.label} ${item.keywords || ""}`.toLowerCase().includes(value)
  );
};
