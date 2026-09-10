import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Calendar, CheckCircle, Download, FileText, FlaskConical, Phone, Play, RefreshCw, Search, TestTube2, UserCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { downloadBlob, parseList, requestJson } from "./labApi";
import { getLabProfile } from "./labSession";
import { getClinicDisplayName } from "../utils/clinicDisplay";
import { getClinicInvoiceBranding } from "../utils/clinicBranding";
import { downloadLabReportHtml, getReportName, printLabReport } from "./labReportTemplate";
import { fetchLabMasterTests } from "../utils/labMaster";
import { canUseModulePermission, useRolePermissionsSync } from "../utils/rolePermissions";
import LabToast from "./LabToast";

const readFirst = (record = {}, keys = [], fallback = "-") => {
  for (const key of keys) {
    const value = String(key).split(".").reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), record);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

const CUSTOM_CATEGORY_PALETTE = [
  { key: "teal", main: "#0d9488", color: "#0f766e", bg: "#f0fdfa", border: "#99f6e4", hoverBg: "#ccfbf1", badgeBg: "#ccfbf1", tagClass: "tone-emerald" },
  { key: "purple", main: "#7c3aed", color: "#6d28d9", bg: "#faf5ff", border: "#e9d5ff", hoverBg: "#f3e8ff", badgeBg: "#f3e8ff", tagClass: "tone-purple" },
  { key: "sky", main: "#0284c7", color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd", hoverBg: "#e0f2fe", badgeBg: "#e0f2fe", tagClass: "tone-cyan" },
  { key: "rose", main: "#e11d48", color: "#be123c", bg: "#fff1f2", border: "#fecdd3", hoverBg: "#ffe4e6", badgeBg: "#ffe4e6", tagClass: "tone-rose" },
  { key: "amber", main: "#d97706", color: "#b45309", bg: "#fffbeb", border: "#fde68a", hoverBg: "#fef3c7", badgeBg: "#fef3c7", tagClass: "tone-amber" },
  { key: "emerald", main: "#059669", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0", hoverBg: "#d1fae5", badgeBg: "#d1fae5", tagClass: "tone-emerald" },
  { key: "indigo", main: "#4f46e5", color: "#3730a3", bg: "#eef2ff", border: "#c7d2fe", hoverBg: "#e0e7ff", badgeBg: "#e0e7ff", tagClass: "tone-indigo" },
  { key: "orange", main: "#ea580c", color: "#c2410c", bg: "#fff7ed", border: "#fed7aa", hoverBg: "#ffedd5", badgeBg: "#ffedd5", tagClass: "tone-amber" },
  { key: "cyan", main: "#0891b2", color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc", hoverBg: "#cffafe", badgeBg: "#cffafe", tagClass: "tone-cyan" },
  { key: "fuchsia", main: "#c026d3", color: "#a21caf", bg: "#fdf4ff", border: "#f5d0fe", hoverBg: "#fae8ff", badgeBg: "#fae8ff", tagClass: "tone-purple" },
  { key: "lime", main: "#65a30d", color: "#4d7c0f", bg: "#f7fee7", border: "#d9f99d", hoverBg: "#ecfccb", badgeBg: "#ecfccb", tagClass: "tone-emerald" },
  { key: "blue", main: "#2563eb", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", hoverBg: "#dbeafe", badgeBg: "#dbeafe", tagClass: "tone-cyan" },
];

export const getCategoryTheme = (category = "", fallbackTestName = "") => {
  const cat = String(category || "").trim().toLowerCase();
  const test = String(fallbackTestName || "").trim().toLowerCase();
  const raw = cat || test || "general";

  // 1. Primary clinical department / category matcher
  if (/cardiac\s*marker|troponin|ck-mb|myoglobin|bnp/.test(cat)) {
    return {
      key: "cardiac-markers",
      label: "Cardiac Markers",
      main: "#e11d48",
      leftBorder: "#e11d48",
      color: "#be123c",
      bg: "#fff1f2",
      border: "#fecdd3",
      hoverBg: "#ffe4e6",
      badgeBg: "#ffe4e6",
      tagClass: "tone-rose",
    };
  }
  if (/cardiology|cardio|ecg|echo|holter|heart/.test(cat)) {
    return {
      key: "cardiology",
      label: "Cardiology Diagnostics",
      main: "#7c3aed",
      leftBorder: "#7c3aed",
      color: "#6d28d9",
      bg: "#faf5ff",
      border: "#e9d5ff",
      hoverBg: "#f3e8ff",
      badgeBg: "#f3e8ff",
      tagClass: "tone-purple",
    };
  }
  if (/biochem|chemical|metabolic|liver|lft|kidney|kft|lipid|glucose|sugar|serum|creatinine|urea|electrolyte/.test(cat)) {
    return {
      key: "biochemistry",
      label: "Biochemistry",
      main: "#0d9488",
      leftBorder: "#0d9488",
      color: "#0f766e",
      bg: "#f0fdfa",
      border: "#99f6e4",
      hoverBg: "#ccfbf1",
      badgeBg: "#ccfbf1",
      tagClass: "tone-emerald",
    };
  }
  if (/hemat|haemat|blood|coagulation|platelet|cbc|hemoglobin|anemia|leukocyte/.test(cat)) {
    return {
      key: "hematology",
      label: "Hematology",
      main: "#dc2626",
      leftBorder: "#dc2626",
      color: "#b91c1c",
      bg: "#fef2f2",
      border: "#fecaca",
      hoverBg: "#fee2e2",
      badgeBg: "#fee2e2",
      tagClass: "tone-rose",
    };
  }
  if (/radio|imag|sono|ultra|scan|x-ray|xray|mri|ct|doppler/.test(cat)) {
    return {
      key: "radiology",
      label: "Radiology",
      main: "#0284c7",
      leftBorder: "#0284c7",
      color: "#0369a1",
      bg: "#f0f9ff",
      border: "#bae6fd",
      hoverBg: "#e0f2fe",
      badgeBg: "#e0f2fe",
      tagClass: "tone-cyan",
    };
  }
  if (/pulmo|respir|lung|pft|spirometry|asthma/.test(cat)) {
    return {
      key: "pulmonology",
      label: "Pulmonology",
      main: "#d97706",
      leftBorder: "#d97706",
      color: "#b45309",
      bg: "#fffbeb",
      border: "#fde68a",
      hoverBg: "#fef3c7",
      badgeBg: "#fef3c7",
      tagClass: "tone-amber",
    };
  }
  if (/patho|histo|cyto|biopsy/.test(cat)) {
    return {
      key: "pathology",
      label: "Pathology",
      main: "#4f46e5",
      leftBorder: "#4f46e5",
      color: "#3730a3",
      bg: "#eef2ff",
      border: "#c7d2fe",
      hoverBg: "#e0e7ff",
      badgeBg: "#e0e7ff",
      tagClass: "tone-indigo",
    };
  }
  if (/micro|sero|infect|bacteri|viro|parasit|culture|smear|widal/.test(cat)) {
    return {
      key: "microbiology",
      label: "Microbiology",
      main: "#059669",
      leftBorder: "#059669",
      color: "#047857",
      bg: "#ecfdf5",
      border: "#a7f3d0",
      hoverBg: "#d1fae5",
      badgeBg: "#d1fae5",
      tagClass: "tone-emerald",
    };
  }
  if (/endo|hormon|thyroid|diabet|adrenal|pituitary/.test(cat)) {
    return {
      key: "endocrinology",
      label: "Endocrinology",
      main: "#ea580c",
      leftBorder: "#ea580c",
      color: "#c2410c",
      bg: "#fff7ed",
      border: "#fed7aa",
      hoverBg: "#ffedd5",
      badgeBg: "#ffedd5",
      tagClass: "tone-amber",
    };
  }
  if (/immuno|allerg|autoimmune|rheumat/.test(cat)) {
    return {
      key: "immunology",
      label: "Immunology",
      main: "#c026d3",
      leftBorder: "#c026d3",
      color: "#a21caf",
      bg: "#fdf4ff",
      border: "#f5d0fe",
      hoverBg: "#fae8ff",
      badgeBg: "#fae8ff",
      tagClass: "tone-purple",
    };
  }
  if (/neuro|brain|eeg|emg|nerve/.test(cat)) {
    return {
      key: "neurology",
      label: "Neurology",
      main: "#2563eb",
      leftBorder: "#2563eb",
      color: "#1d4ed8",
      bg: "#eff6ff",
      border: "#bfdbfe",
      hoverBg: "#dbeafe",
      badgeBg: "#dbeafe",
      tagClass: "tone-cyan",
    };
  }
  if (/uro|nephro|renal|urinary/.test(cat)) {
    return {
      key: "urology",
      label: "Urology",
      main: "#0891b2",
      leftBorder: "#0891b2",
      color: "#0e7490",
      bg: "#ecfeff",
      border: "#a5f3fc",
      hoverBg: "#cffafe",
      badgeBg: "#cffafe",
      tagClass: "tone-cyan",
    };
  }
  if (/gastro|digest|hepatic|gi|endoscopy/.test(cat)) {
    return {
      key: "gastroenterology",
      label: "Gastroenterology",
      main: "#65a30d",
      leftBorder: "#65a30d",
      color: "#4d7c0f",
      bg: "#f7fee7",
      border: "#d9f99d",
      hoverBg: "#ecfccb",
      badgeBg: "#ecfccb",
      tagClass: "tone-emerald",
    };
  }
  if (/onco|tumor|cancer|malignan/.test(cat)) {
    return {
      key: "oncology",
      label: "Oncology",
      main: "#db2777",
      leftBorder: "#db2777",
      color: "#be185d",
      bg: "#fdf2f8",
      border: "#fbcfe8",
      hoverBg: "#fce7f3",
      badgeBg: "#fce7f3",
      tagClass: "tone-rose",
    };
  }

  // 2. Secondary fallback by test name if category is empty or generic
  if ((!cat || cat === "general" || cat === "routine") && test) {
    if (/cardiac|troponin|bnp|ck-mb|myoglobin/.test(test)) return getCategoryTheme("cardiac markers");
    if (/echo|ecg|holter|cardio|heart/.test(test)) return getCategoryTheme("cardiology");
    if (/scan|x-ray|xray|mri|ct|ultra|usg|doppler|radiology|sonography/.test(test)) return getCategoryTheme("radiology");
    if (/blood|cbc|hemoglobin|haemogram|platelet|wbc|rbc|dengue|malaria|aec|esr|anemia/.test(test)) return getCategoryTheme("hematology");
    if (/lipid|cholesterol|bilirubin|lft|kft|liver|kidney|urea|creatinine|glucose|sugar|biochem|sgot|sgpt|uric/.test(test)) return getCategoryTheme("biochemistry");
    if (/pft|pulmonary|spirometry|lung|asthma|pefr|fev1/.test(test)) return getCategoryTheme("pulmonology");
    if (/smear|culture|afb|gram|microbiology/.test(test)) return getCategoryTheme("microbiology");
    if (/urine|stool|pathology|biopsy/.test(test)) return getCategoryTheme("pathology");
    if (/thyroid|tsh|t3|t4|hormone/.test(test)) return getCategoryTheme("endocrinology");
  }

  // 3. Deterministic hash palette for any custom or uncategorized categories
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = raw.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CUSTOM_CATEGORY_PALETTE.length;
  const picked = CUSTOM_CATEGORY_PALETTE[index];
  return {
    ...picked,
    leftBorder: picked.main,
    label: category || "General",
  };
};

export const getTestTheme = (testName = "", category = "") =>
  getCategoryTheme(category, testName);

const pageConfig = {
  patients: {
    title: "Patients",
    subtitle: "Patients with diagnostic orders for your clinic and branch.",
    paths: ["Lab/orders"],
    columns: [
      ["Patient", ["patientName", "PatientName", "name", "Name", "fullName"]],
      ["Visit Date", ["orderedAt", "OrderedAt", "visitDate", "VisitDate", "appointmentDate", "AppointmentDate", "invoiceDate", "InvoiceDate", "billDate", "BillDate", "createdAt", "CreatedAt", "date", "Date"]],
      ["Phone", ["patientPhone", "PatientPhone", "phone", "Phone", "mobile", "Mobile", "phoneNumber", "patient.phone", "Patient.Phone"]],
      ["Tests", ["__labTestNames", "testName", "TestName", "labTestName", "items", "serviceItems", "billItems"]],
    ],
  },
  tests: {
    title: "Diagnosis Tests",
    subtitle: "Lab master diagnosis test data from the lab module.",
    paths: ["Lab/master"],
    columns: [
      ["Test", ["testName", "TestName", "name", "Name", "title"]],
      ["Code", ["testCode", "TestCode", "code", "Code"]],
      ["Category", ["category", "Category"]],
      ["Price", ["price", "Price", "amount", "Amount"]],
    ],
  },
  samples: {
    title: "Sample Collection",
    subtitle: "Samples waiting, collected, processed, and reported by the lab.",
    paths: ["Lab/orders"],
    columns: [
      ["Patient", ["patientName", "PatientName", "patient.name"]],
      ["Visit Date", ["orderedAt", "OrderedAt", "visitDate", "VisitDate", "appointmentDate", "AppointmentDate", "invoiceDate", "InvoiceDate", "billDate", "BillDate", "createdAt", "CreatedAt", "date", "Date"]],
      ["Phone", ["patientPhone", "PatientPhone", "phone", "Phone", "mobile", "Mobile", "phoneNumber", "patient.phone", "Patient.Phone"]],
      ["Tests", ["__labTestNames", "testName", "TestName", "labTestName", "items", "serviceItems", "billItems"]],
      ["Status", ["__displayStatus", "resultStatus", "ResultStatus", "sampleStatus", "SampleStatus", "orderStatus", "OrderStatus", "status", "Status"]],
    ],
  },
  reports: {
    title: "Reports",
    subtitle: "Lab reports and diagnostic result records.",
    paths: ["Lab/orders"],
    columns: [
      ["Report", ["reportName", "ReportName", "reportTitle", "title", "__labTestNames", "testName", "TestName"]],
      ["Patient", ["patientName", "PatientName", "patient.name"]],
      ["Date", ["reportedAt", "ReportedAt", "reportDate", "ReportDate", "completedAt", "CompletedAt", "updatedAt", "UpdatedAt", "createdAt", "CreatedAt", "date"]],
      ["Status", ["reportStatus", "ReportStatus", "status", "Status"]],
    ],
  },
};

const normalizeId = (value) => String(value ?? "").trim();
const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const getRecordClinicId = (record = {}) =>
  normalizeId(readFirst(record, [
    "hospitalId", "HospitalId", "clinicId", "ClinicId",
    "patient.hospitalId", "patient.clinicId", "Patient.HospitalId", "Patient.ClinicId",
    "bill.hospitalId", "bill.clinicId", "Bill.HospitalId", "Bill.ClinicId",
  ], ""));

const getRecordBranchId = (record = {}) =>
  normalizeId(readFirst(record, [
    "branchId", "BranchId", "clinicBranchId", "ClinicBranchId",
    "patient.branchId", "patient.clinicBranchId", "Patient.BranchId", "Patient.ClinicBranchId",
    "bill.branchId", "bill.clinicBranchId", "Bill.BranchId", "Bill.ClinicBranchId",
  ], ""));

const getRecordBranchName = (record = {}) =>
  normalizeText(readFirst(record, [
    "branchName", "BranchName", "branch.name", "Branch.Name",
    "patient.branchName", "Patient.BranchName", "bill.branchName", "Bill.BranchName",
  ], ""));

const belongsToLabScope = (record = {}, profile = getLabProfile()) => {
  const clinicId = normalizeId(profile.hospitalId);
  const branchId = normalizeId(profile.branchId);
  const branchName = normalizeText(profile.branchName);
  const recordClinicId = getRecordClinicId(record);
  const recordBranchId = getRecordBranchId(record);
  const recordBranchName = getRecordBranchName(record);

  if (clinicId && recordClinicId && recordClinicId !== clinicId) return false;
  if (branchId && recordBranchId && recordBranchId !== branchId) return false;
  if (branchName && !recordBranchId && recordBranchName && recordBranchName !== branchName) return false;
  return true;
};

const getServiceBillType = (record = {}) =>
  normalizeText(readFirst(record, [
    "billingType", "BillingType", "invoiceType", "InvoiceType",
    "serviceType", "ServiceType", "type", "Type",
  ], ""));

const isDiagnosticRecord = (record = {}) => {
  const source = normalizeText(record.__sourcePath);
  if (source.includes("lab/orders") || source.includes("diagnostic") || source.includes("labgeneratedreports")) return true;
  const typeText = getServiceBillType(record);
  const labAmount = Number(readFirst(record, ["labCharges", "labCharge", "diagnosticRevenue"], 0)) || 0;
  const reportName = readFirst(record, ["reportName", "ReportName", "reportTitle", "testName", "TestName"], "");
  return /diagnostic|diagnosis|lab|test/.test(typeText) || labAmount > 0 || Boolean(reportName);
};

const getLineItems = (record = {}) => {
  const keys = [
    "items", "Items", "serviceItems", "ServiceItems", "billItems", "BillItems",
    "lineItems", "LineItems", "billingItems", "BillingItems", "tests", "Tests",
  ];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

const getItemTestName = (item = {}) =>
  readFirst(item, ["testName", "TestName", "labTestName", "item", "name", "Name", "serviceName"], "");

const getPatientTestNames = (record = {}) => {
  const direct = readFirst(record, ["testName", "TestName", "labTestName", "LabTestName", "diagnosisTests", "DiagnosisTests"], "");
  const items = getLineItems(record)
    .map(getItemTestName)
    .filter(Boolean);
  const names = [...String(direct || "").split(","), ...items]
    .map((name) => String(name).trim())
    .filter(Boolean);
  return Array.from(new Set(names)).join(", ") || "-";
};

const getPatientLabAmount = (record = {}) => {
  const direct = Number(readFirst(record, ["labCharges", "labCharge", "diagnosticRevenue", "totalAmount", "grandTotal", "amount"], 0)) || 0;
  if (direct > 0) return direct;
  return getLineItems(record).reduce((sum, item) => {
    const unitPrice = Number(readFirst(item, ["unitPrice", "price", "Price", "rate", "amount"], 0)) || 0;
    const quantity = Number(readFirst(item, ["quantity", "qty"], 1)) || 1;
    return sum + unitPrice * quantity;
  }, 0);
};

const getPatientGroupKey = (record = {}) => {
  const appointmentId = normalizeId(readFirst(record, [
    "appointmentId", "AppointmentId", "appointment.id", "appointment.appointmentId", "Appointment.Id", "Appointment.AppointmentId",
  ], ""));
  if (appointmentId) return `appointment:${appointmentId}`;

  const patientId = normalizeId(readFirst(record, [
    "patientId", "PatientId", "patient.id", "patient.patientId", "Patient.Id", "Patient.PatientId",
  ], ""));
  const patientName = normalizeText(readFirst(record, ["patientName", "PatientName", "patient.name", "Patient.Name", "name", "Name"], ""));
  const visitDate = normalizeText(getRecordDateValue(record));
  return `patient:${patientId || patientName}:${visitDate}`;
};

const mergeTextValues = (...values) =>
  values.map((value) => String(value ?? "").trim()).find((value) => value && value !== "-") || "-";

const mergeLabPatientRows = (rows = []) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = getPatientGroupKey(row);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, row);
      return;
    }

    const testNames = [
      ...String(existing.__labTestNames || "").split(","),
      ...String(row.__labTestNames || "").split(","),
    ]
      .map((name) => name.trim())
      .filter((name) => name && name !== "-");

    grouped.set(key, {
      ...existing,
      ...row,
      patientName: mergeTextValues(existing.patientName, existing.PatientName, row.patientName, row.PatientName),
      PatientName: mergeTextValues(existing.PatientName, existing.patientName, row.PatientName, row.patientName),
      phone: mergeTextValues(existing.patientPhone, existing.PatientPhone, existing.phone, existing.Phone, row.patientPhone, row.PatientPhone, row.phone, row.Phone),
      Phone: mergeTextValues(existing.PatientPhone, existing.patientPhone, existing.Phone, existing.phone, row.PatientPhone, row.patientPhone, row.Phone, row.phone),
      patientPhone: mergeTextValues(existing.patientPhone, existing.PatientPhone, existing.phone, existing.Phone, row.patientPhone, row.PatientPhone, row.phone, row.Phone),
      PatientPhone: mergeTextValues(existing.PatientPhone, existing.patientPhone, existing.Phone, existing.phone, row.PatientPhone, row.patientPhone, row.Phone, row.phone),
      visitDate: mergeTextValues(existing.orderedAt, existing.OrderedAt, existing.visitDate, existing.VisitDate, row.orderedAt, row.OrderedAt, row.visitDate, row.VisitDate, getRecordDateValue(existing), getRecordDateValue(row)),
      VisitDate: mergeTextValues(existing.OrderedAt, existing.orderedAt, existing.VisitDate, existing.visitDate, row.OrderedAt, row.orderedAt, row.VisitDate, row.visitDate, getRecordDateValue(existing), getRecordDateValue(row)),
      orderedAt: mergeTextValues(existing.orderedAt, existing.OrderedAt, row.orderedAt, row.OrderedAt, getRecordDateValue(existing), getRecordDateValue(row)),
      OrderedAt: mergeTextValues(existing.OrderedAt, existing.orderedAt, row.OrderedAt, row.orderedAt, getRecordDateValue(existing), getRecordDateValue(row)),
      __labTestNames: Array.from(new Set(testNames)).join(", ") || "-",
      __labAmount: (Number(existing.__labAmount) || 0) + (Number(row.__labAmount) || 0),
      __groupedRows: [...(existing.__groupedRows || [existing]), row],
    });
  });

  return Array.from(grouped.values());
};

const enrichLabPatientRow = (record = {}) => ({
  ...record,
  __labTestNames: getPatientTestNames(record),
  __labAmount: getPatientLabAmount(record),
  __displayStatus: getSampleDisplayStatus(record),
});

const getRecordDateValue = (record = {}) =>
  readFirst(record, ["orderedAt", "OrderedAt", "visitDate", "VisitDate", "appointmentDate", "AppointmentDate", "invoiceDate", "InvoiceDate", "billDate", "BillDate", "createdAt", "CreatedAt", "date", "Date"], "");

const isToday = (value) => {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
};

const getNormalizedStatus = (record = {}) =>
  normalizeText(readFirst(record, ["reportStatus", "ReportStatus", "resultStatus", "ResultStatus", "sampleStatus", "SampleStatus", "orderStatus", "OrderStatus", "status", "Status"], ""));

const getSampleDisplayStatus = (record = {}) => {
  const reportStatus = readFirst(record, ["reportStatus", "ReportStatus"], "");
  if (reportStatus && reportStatus !== "-") return reportStatus;
  if (isTruthyFlag(readFirst(record, ["hasReport", "HasReport", "reportGenerated", "ReportGenerated"], ""))) return "Completed";
  const resultStatus = readFirst(record, ["resultStatus", "ResultStatus"], "");
  if (resultStatus && resultStatus !== "-") return resultStatus;
  if (readFirst(record, ["completedAt", "CompletedAt"], "")) return "Completed";
  const sampleStatus = readFirst(record, ["sampleStatus", "SampleStatus"], "");
  if (sampleStatus && sampleStatus !== "-") return sampleStatus;
  const orderStatus = readFirst(record, ["orderStatus", "OrderStatus"], "");
  if (orderStatus && orderStatus !== "-") return orderStatus;
  return readFirst(record, ["status", "Status"], "-");
};

const isDoneRecord = (record = {}) => {
  const status = getNormalizedStatus(record);
  return /complete|completed|done|reported|delivered|cancel|cancelled|canceled/.test(status);
};

const isCurrentLabWork = (record = {}) => {
  const dateValue = getRecordDateValue(record);
  return isToday(dateValue) || (!dateValue && !isDoneRecord(record));
};

const isBillingBackedRecord = (record = {}) => {
  const source = normalizeText(record.__sourcePath);
  return source.includes("billing") || source.includes("diagnosticbilling");
};

const recordIdentifier = (row = {}) =>
  String(readFirst(row, ["id", "Id", "orderId", "OrderId", "labOrderId", "LabOrderId", "billingId", "BillingId", "billId", "BillId", "invoiceId", "InvoiceId", "testId", "TestId"], "") || "");

const filterRowsByView = (rows = [], view = "") => {
  if (view === "today") return rows.filter(isCurrentLabWork);
  if (view === "past") return rows.filter((row) => !isToday(getRecordDateValue(row)));
  if (view === "pending") return rows.filter((row) => !isDoneRecord(row));
  if (view === "samples") return rows.filter((row) => !/complete|completed|reported|delivered|cancel|cancelled|canceled/.test(getNormalizedStatus(row)));
  if (view === "in-progress") return rows.filter((row) => /progress|processing|started/.test(getNormalizedStatus(row)));
  if (view === "completed") return rows.filter((row) => isToday(getRecordDateValue(row)) && /complete|completed|done|reported|delivered/.test(getNormalizedStatus(row)));
  if (view === "cancelled") return rows.filter((row) => /cancel|cancelled|canceled/.test(getNormalizedStatus(row)));
  if (view === "pending-reports") return rows.filter((row) => !/reported|delivered/.test(getNormalizedStatus(row)) && !/cancel|cancelled|canceled/.test(getNormalizedStatus(row)));
  return rows;
};

const isTruthyFlag = (value) =>
  value === true || value === 1 || ["true", "yes", "y", "1"].includes(normalizeText(value));

const isGeneratedReport = (row = {}) => {
  const reportStatus = normalizeText(readFirst(row, ["reportStatus", "ReportStatus", "resultStatus", "ResultStatus"], ""));
  return (
    /reported|delivered|completed/.test(reportStatus) ||
    isTruthyFlag(readFirst(row, ["hasReport", "HasReport", "reportGenerated", "ReportGenerated"], "")) ||
    Boolean(readFirst(row, [
      "reportName", "ReportName", "reportTitle", "reportUrl", "ReportUrl", "reportFileUrl", "ReportFileUrl",
      "reportPath", "ReportPath", "fileUrl", "FileUrl", "findings", "Findings", "reportFindings", "ReportFindings",
    ], ""))
  );
};

const getReportDisplayStatus = (row = {}) => {
  const reportStatus = readFirst(row, ["reportStatus", "ReportStatus", "resultStatus", "ResultStatus"], "");
  if (reportStatus && reportStatus !== "-") return reportStatus;
  if (isTruthyFlag(readFirst(row, ["hasReport", "HasReport", "reportGenerated", "ReportGenerated"], ""))) return "Completed";
  if (readFirst(row, ["reportUrl", "ReportUrl", "reportFileUrl", "ReportFileUrl", "reportPath", "ReportPath", "fileUrl", "FileUrl"], "")) return "Completed";
  return readFirst(row, ["status", "Status"], "-");
};

const getReportDisplayDate = (row = {}) =>
  readFirst(row, [
    "reportedAt", "ReportedAt",
    "reportGeneratedAt", "ReportGeneratedAt", "generatedAt", "GeneratedAt",
    "reportCompletedAt", "ReportCompletedAt", "completedAt", "CompletedAt",
    "reportDate", "ReportDate", "reportGeneratedDate", "ReportGeneratedDate",
    "generatedDate", "GeneratedDate", "completedDate", "CompletedDate",
    "reportCreatedAt", "ReportCreatedAt", "report.createdAt", "Report.CreatedAt",
    "resultCreatedAt", "ResultCreatedAt", "resultAt", "ResultAt",
    "finishedAt", "FinishedAt", "updatedAt", "UpdatedAt", "createdAt", "CreatedAt", "date", "Date",
  ], "");

function LabDataPage({ type }) {
  const config = pageConfig[type];
  const location = useLocation();
  const navigate = useNavigate();
  const view = new URLSearchParams(location.search).get("view") || "";
  const labProfile = useMemo(() => getLabProfile(), []);
  useRolePermissionsSync(labProfile);
  const canEditSamples = canUseModulePermission(labProfile, "Sample Collection", "Edit");
  const clinicName = getClinicDisplayName(labProfile, "Clinic");
  const clinicBranding = getClinicInvoiceBranding({ clinicId: labProfile.hospitalId, clinicName });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("");
  const requiresPatientSelection = type === "samples" || type === "reports";

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const backendData = type === "tests"
        ? await fetchLabMasterTests()
        : type === "patients" || type === "samples" || type === "reports"
        ? parseList(await requestJson(config.paths[0])).map((row) => ({ ...row, __sourcePath: config.paths[0] }))
        : parseList(await requestJson(config.paths[0]));
      const enrichedRows = type === "patients" || type === "samples" || type === "reports"
        ? backendData
            .filter(isDiagnosticRecord)
            .filter((row) => belongsToLabScope(row, labProfile))
            .map(enrichLabPatientRow)
        : backendData;
      const nextRows = type === "patients"
        ? filterRowsByView(mergeLabPatientRows(enrichedRows), view)
        : type === "samples" || type === "reports"
        ? filterRowsByView(enrichedRows, view)
            .filter((row) => type !== "reports" || isGeneratedReport(row))
        : backendData;
      setRows(nextRows);
    } catch (loadError) {
      setRows([]);
      setToast({ type: "error", message: loadError.message || `Unable to load ${config.title.toLowerCase()}.` });
    } finally {
      setLoading(false);
    }
  }, [config, labProfile, type, view]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!["patients", "samples", "reports"].includes(type)) return undefined;

    const refreshPatients = (event) => {
      loadRows();
    };

    window.addEventListener("receptionDiagnosticBillingCompleted", refreshPatients);
    window.addEventListener("labReportsUpdated", refreshPatients);
    window.addEventListener("storage", refreshPatients);
    window.addEventListener("focus", refreshPatients);

    return () => {
      window.removeEventListener("receptionDiagnosticBillingCompleted", refreshPatients);
      window.removeEventListener("labReportsUpdated", refreshPatients);
      window.removeEventListener("storage", refreshPatients);
      window.removeEventListener("focus", refreshPatients);
    };
  }, [loadRows, type]);

  const patientOptions = useMemo(() => {
    if (!requiresPatientSelection) return [];
    const patients = rows
      .map((row) => readFirst(row, ["patientName", "PatientName", "patient.name", "Patient.Name", "name", "Name"], ""))
      .map((name) => String(name).trim())
      .filter((name) => name && name !== "-");
    return Array.from(new Set(patients)).sort((a, b) => a.localeCompare(b));
  }, [requiresPatientSelection, rows]);

  useEffect(() => {
    if (!selectedPatient) return;
    if (!patientOptions.includes(selectedPatient)) setSelectedPatient("");
  }, [patientOptions, selectedPatient]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const patientName = readFirst(row, ["patientName", "PatientName", "patient.name", "Patient.Name", "name", "Name"], "");
      const matchesPatient = requiresPatientSelection ? patientName === selectedPatient : true;
      const matchesSearch = !term || JSON.stringify(row).toLowerCase().includes(term);
      return matchesPatient && matchesSearch;
    });
  }, [requiresPatientSelection, rows, search, selectedPatient]);

  const hasActions = type === "samples" || type === "reports";
  const tableTemplate = useMemo(() => {
    if (type === "patients") return "minmax(180px, 1.4fr) 140px 140px minmax(260px, 2.5fr)";
    if (type === "tests") return "minmax(220px, 1.8fr) 130px minmax(180px, 1.3fr) 130px";
    if (type === "samples") return "minmax(170px, 1.3fr) 130px 130px minmax(220px, 2fr) 130px 150px";
    if (type === "reports") return "minmax(200px, 1.6fr) minmax(170px, 1.3fr) 130px 130px 130px";
    const actionColumn = hasActions ? " 130px" : "";
    return `repeat(${config.columns.length}, minmax(0, 1fr))${actionColumn}`;
  }, [config.columns.length, hasActions, type]);

  const recordId = (row, index = "") => recordIdentifier(row) || index;

  const setPatientView = (nextView) => {
    const params = new URLSearchParams(location.search);
    if (nextView) params.set("view", nextView);
    else params.delete("view");
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" });
  };

  const actionConfig = {
    collected: {
      labPath: (id) => `Lab/orders/${id}/sample-collected`,
      method: "PATCH",
      status: "Sample Collected",
      payload: { status: "Sample Collected", sampleStatus: "Collected", collectedAt: new Date().toISOString() },
    },
    start: {
      labPath: (id) => `Lab/orders/${id}/start`,
      method: "PATCH",
      status: "In Progress",
      payload: { status: "In Progress", orderStatus: "In Progress", sampleStatus: "Processing", startedAt: new Date().toISOString() },
    },
    complete: {
      labPath: (id) => `Lab/orders/${id}/result`,
      method: "PUT",
      status: "Completed",
      payload: { status: "Completed", orderStatus: "Completed", resultStatus: "Completed", completedAt: new Date().toISOString() },
    },
    report: {
      labPath: (id) => `Lab/orders/${id}/report`,
      method: "POST",
      status: "Reported",
      payload: { status: "Reported", reportStatus: "Reported", reportedAt: new Date().toISOString() },
    },
  };

  const runOrderAction = async (row, action) => {
    if (!canEditSamples) {
      setToast({ type: "error", message: "You do not have permission to update sample collection." });
      return;
    }
    const target = actionConfig[action];
    if (!target) return;

    const id = recordId(row);
    try {
      if (id && !isBillingBackedRecord(row)) {
        await requestJson(target.labPath(id), {
          method: target.method || "PUT",
          body: JSON.stringify(target.payload),
        }).catch(() => null);
      }

      setRows((prevRows) =>
        prevRows.map((item) => {
          const isMatch =
            (id && String(recordId(item)) === String(id)) ||
            (item === row) ||
            (readFirst(item, ["patientName", "PatientName"]) === readFirst(row, ["patientName", "PatientName"]) &&
             readFirst(item, ["testName", "TestName", "test", "Test"]) === readFirst(row, ["testName", "TestName", "test", "Test"]));

          if (!isMatch) return item;

          return {
            ...item,
            ...target.payload,
            status: target.status,
            Status: target.status,
            __displayStatus: target.status,
            sampleStatus: target.status,
            SampleStatus: target.status,
          };
        })
      );
      window.dispatchEvent(new CustomEvent("labReportsUpdated"));
      setToast({ type: "success", message: `${target.status} updated successfully.` });
    } catch (actionError) {
      setToast({ type: "error", message: actionError.message || "Unable to update lab order." });
    }
  };

  const downloadReport = async (row) => {
    if (isBillingBackedRecord(row)) {
      downloadLabReportHtml({ record: { ...row, reportName: getReportName(row) }, branding: clinicBranding, clinicName, profile: labProfile });
      setToast({ type: "success", message: "Report downloaded." });
      return;
    }

    const id = recordId(row);
    try {
      if (id) {
        await downloadBlob(`Lab/orders/${id}/report/download`, `lab-report-${id}`);
        setToast({ type: "success", message: "Report downloaded." });
        return;
      }
    } catch (downloadError) {
      setToast({ type: "error", message: downloadError.message || "Unable to download report from backend." });
      return;
    }
    downloadLabReportHtml({ record: { ...row, reportName: getReportName(row) }, branding: clinicBranding, clinicName, profile: labProfile });
    setToast({ type: "success", message: "Report downloaded." });
  };

  const printReport = (row) => {
    printLabReport({ record: { ...row, reportName: getReportName(row) }, branding: clinicBranding, clinicName, profile: labProfile });
    setToast({ type: "success", message: "Report print opened." });
  };

  return (
    <section className={`rc-page lab-page lab-screen-${type}`}>
      <LabToast toast={toast} onClose={() => setToast(null)} />
      <div className="rc-page-head lab-page-head">
        <div>
          <div className="lab-head-tag-row">
            {type === "tests" ? (
              <>
                <span className="lab-head-badge badge-tests"><FlaskConical size={13} /> Diagnostic Master Tests</span>
                <span className="lab-head-sub-badge badge-tests-sub"><Activity size={12} /> Pathology & Imaging Catalog</span>
              </>
            ) : type === "patients" ? (
              <>
                <span className="lab-head-badge badge-patients"><UserCheck size={13} /> Diagnostic Patients Queue</span>
                <span className="lab-head-sub-badge badge-patients-sub"><Activity size={12} /> Active Clinical Orders</span>
              </>
            ) : type === "samples" ? (
              <>
                <span className="lab-head-badge badge-samples"><TestTube2 size={13} /> Specimen Collection Desk</span>
                <span className="lab-head-sub-badge badge-samples-sub"><Activity size={12} /> Phlebotomy & Barcoding</span>
              </>
            ) : (
              <>
                <span className="lab-head-badge badge-reports"><FileText size={13} /> Diagnostic Reports Archive</span>
                <span className="lab-head-sub-badge badge-reports-sub"><Activity size={12} /> Validated Laboratory Archive</span>
              </>
            )}
          </div>
          <h2>{config.title}</h2>
          <p>{config.subtitle}</p>
        </div>
        <div className="lab-page-actions">
          <button className="rc-btn secondary" type="button" onClick={loadRows} disabled={loading}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>
      <div className="lab-list-controls">
        <label className="lab-search">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}...`} />
        </label>
        {type === "patients" ? (
          <div className="lab-filter-tabs" role="tablist" aria-label="Patient order date filter">
            {[
              ["", "All"],
              ["today", "Today"],
              ["past", "Past"],
            ].map(([key, label]) => (
              <button
                key={label}
                className={view === key ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setPatientView(key)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        {requiresPatientSelection ? (
          <label className="lab-patient-select">
            <span>Select Patient</span>
            <select value={selectedPatient} onChange={(event) => setSelectedPatient(event.target.value)}>
              <option value="">Select patient</option>
              {patientOptions.map((patient) => (
                <option key={patient} value={patient}>{patient}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {loading ? <div className="rc-card">Loading {config.title.toLowerCase()}...</div> : null}
      <div className={`rc-card lab-data-card lab-card--${type}`}>
        <div className="rc-table compact lab-table">
          <div className="lab-table-head" style={{ gridTemplateColumns: tableTemplate }}>
            {config.columns.map(([label]) => {
              const labelLower = label.toLowerCase();
              let capClass = "rc-th-name";
              if (labelLower.includes("patient") || labelLower === "name") capClass = "rc-th-name";
              else if (labelLower.includes("test") || labelLower.includes("sample")) capClass = "rc-th-tests";
              else if (labelLower.includes("date") || labelLower.includes("created")) capClass = "rc-th-pid";
              else if (labelLower.includes("status")) capClass = "rc-th-status";
              else if (labelLower.includes("price") || labelLower.includes("fee") || labelLower.includes("cost")) capClass = "rc-th-price";
              else if (labelLower.includes("phone") || labelLower.includes("mobile")) capClass = "rc-th-phone";
              else if (labelLower.includes("code")) capClass = "rc-th-code";
              else if (labelLower.includes("category") || labelLower.includes("department")) capClass = "rc-th-category";
              else capClass = "rc-th-total";

              let alignClass = "col-left text-left";
              if (labelLower.includes("status") || labelLower.includes("action") || labelLower.includes("code") || labelLower.includes("date") || labelLower.includes("phone")) alignClass = "col-center text-center";
              else if (labelLower.includes("price") || labelLower.includes("amount") || labelLower.includes("fee")) alignClass = "col-right text-right";

              return (
                <span key={label} className={alignClass}>
                  <span className={`rc-th-capsule ${capClass}`}>{label}</span>
                </span>
              );
            })}
            {hasActions ? (
              <span className="col-center text-center lab-head-actions">
                <span className="rc-th-capsule rc-th-actions">Actions</span>
              </span>
            ) : null}
          </div>
          {requiresPatientSelection && !selectedPatient ? <div className="rc-empty">Select patient to view {config.title.toLowerCase()}.</div> : filteredRows.length ? filteredRows.map((row, index) => {
            const rowCategory = readFirst(row, ["category", "Category", "department", "Department", "specialization", "Specialization"], "");
            const rowTestName = readFirst(row, ["testName", "TestName", "name", "Name", "__labTestNames"], "");
            const catTheme = getCategoryTheme(rowCategory, rowTestName);
            return (
              <div
                className={`lab-table-row lab-row-test-card theme-${catTheme.key}`}
                style={{
                  gridTemplateColumns: tableTemplate,
                  borderLeft: type === "tests" ? `4px solid ${catTheme.main}` : undefined,
                  "--cat-hover-bg": catTheme.hoverBg || catTheme.bg,
                }}
                key={readFirst(row, ["id", "Id", "testId", "sampleId"], index)}
              >
                {config.columns.map(([label, keys]) => {
                  const value = type === "reports" && label === "Status"
                    ? getReportDisplayStatus(row)
                    : type === "reports" && label === "Date"
                      ? getReportDisplayDate(row)
                      : readFirst(row, keys);
                  const displayValue = /date|created|collected|imported|exported/i.test(label)
                    ? formatDate(value)
                    : /amount|price/i.test(label) && Number(value) > 0
                      ? Number(value).toFixed(2)
                      : value;

                  const labelLower = label.toLowerCase();
                  let alignClass = "col-left text-left";
                  if (labelLower.includes("status") || labelLower.includes("action") || labelLower.includes("code") || labelLower.includes("date") || labelLower.includes("phone")) alignClass = "col-center text-center";
                  else if (labelLower.includes("price") || labelLower.includes("amount") || labelLower.includes("fee")) alignClass = "col-right text-right";

                  let cellContent = displayValue;
                  if (labelLower.includes("status")) {
                    cellContent = (
                      <span className={`rc-status ${String(displayValue || "").toLowerCase().replace(/\s+/g, "-")}`}>
                        {displayValue || "Pending"}
                      </span>
                    );
                  } else if (labelLower.includes("patient") || (labelLower === "name" && type !== "tests")) {
                    const initials = String(displayValue || "PT")
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0].toUpperCase())
                      .join("") || "PT";
                    const avatarGradients = [
                      "linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)",
                      "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                      "linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)",
                      "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
                      "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)",
                      "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                    ];
                    const avatarBg = avatarGradients[index % avatarGradients.length];
                    cellContent = (
                      <div className="lab-patient-cell">
                        <span className="lab-patient-avatar" style={{ background: avatarBg }}>{initials}</span>
                        <strong className="lab-patient-name">{displayValue}</strong>
                      </div>
                    );
                  } else if (type === "tests" && (labelLower.includes("test") || labelLower === "name")) {
                    cellContent = (
                      <div className="lab-test-title-wrap">
                        <span
                          className="lab-test-color-dot"
                          style={{
                            background: catTheme.main,
                            boxShadow: `0 0 0 2px ${catTheme.border}`,
                          }}
                        />
                        <strong className="lab-test-title-text" style={{ color: "#0f172a" }}>
                          {displayValue}
                        </strong>
                      </div>
                    );
                  } else if (labelLower.includes("code")) {
                    cellContent = (
                      <span
                        className="rc-lab-code-pill"
                        style={{
                          background: catTheme.bg,
                          borderColor: catTheme.border,
                          color: catTheme.color,
                        }}
                      >
                        {displayValue}
                      </span>
                    );
                  } else if (labelLower.includes("category")) {
                    cellContent = (
                      <span
                        className="rc-lab-category-pill"
                        style={{
                          background: catTheme.bg,
                          borderColor: catTheme.border,
                          color: catTheme.color,
                          boxShadow: `0 1px 3px ${catTheme.border}50`,
                        }}
                      >
                        <span className="lab-cat-pill-dot" style={{ background: catTheme.main }} />
                        {displayValue}
                      </span>
                    );
                  } else if (labelLower.includes("price") || labelLower.includes("amount") || labelLower.includes("fee")) {
                    cellContent = (
                      <span className="rc-lab-price-pill">₹{displayValue}</span>
                    );
                  } else if (labelLower.includes("phone") || labelLower.includes("mobile")) {
                    cellContent = (
                      <span className="rc-lab-phone-pill">{displayValue}</span>
                    );
                  } else if (labelLower.includes("date") || labelLower.includes("created")) {
                    cellContent = (
                      <span className="rc-lab-date-pill">{displayValue}</span>
                    );
                  } else if (labelLower.includes("tests") && type === "patients") {
                    const testsList = String(displayValue || "").split(",").map((t) => t.trim()).filter((t) => t && t !== "-");
                    cellContent = (
                      <div className="lab-test-pills-wrap">
                        {testsList.length ? testsList.map((tName, tIdx) => {
                          const tTheme = getTestTheme(tName);
                          return (
                            <span
                              key={tIdx}
                              className={`rc-lab-test-tag ${tTheme.tagClass}`}
                              style={{
                                background: tTheme.bg,
                                borderColor: tTheme.border,
                                color: tTheme.color,
                              }}
                              title={tName}
                            >
                              {tName}
                            </span>
                          );
                        }) : "-"}
                      </div>
                    );
                  }

                  return (
                    <span key={label} className={alignClass}>
                      {cellContent}
                    </span>
                  );
                })}
                {hasActions ? (
                  <span className="lab-row-actions">
                    {type === "samples" ? (
                      <>
                        <button className="lab-action-btn collect" type="button" title="Sample collected" onClick={() => runOrderAction(row, "collected")} disabled={!canEditSamples}><TestTube2 size={15} /></button>
                        <button className="lab-action-btn start" type="button" title="Start processing" onClick={() => runOrderAction(row, "start")} disabled={!canEditSamples}><Play size={15} /></button>
                        <button className="lab-action-btn complete" type="button" title="Complete order" onClick={() => runOrderAction(row, "complete")} disabled={!canEditSamples}><CheckCircle size={15} /></button>
                      </>
                    ) : null}
                    {type === "reports" ? (
                      <>
                        <button className="lab-action-btn report" type="button" title="Print report" onClick={() => printReport(row)}><FileText size={15} /></button>
                        <button className="lab-action-btn download" type="button" title="Download report" onClick={() => downloadReport(row)}><Download size={15} /></button>
                      </>
                    ) : null}
                  </span>
                ) : null}
              </div>
            );
          }) : <div className="rc-empty">No {config.title.toLowerCase()} found.</div>}
        </div>
      </div>
    </section>
  );
}

export default LabDataPage;




