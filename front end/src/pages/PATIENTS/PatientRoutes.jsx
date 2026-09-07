import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, Bell, Calendar, Check, CheckCircle2, ChevronDown, ChevronRight, Circle, ClipboardList,
  CreditCard, Download, Eye, EyeOff, FileText, Heart, KeyRound, LogOut, Mail, MapPin, Pill,
  Menu, Phone, Printer, Search, Share2, Star, Stethoscope, Trash2, UserRound, X,
} from "lucide-react";
import PatientDashboard from "./PatientDashboard";
import { apiUrl, patientApiUrl, PATIENT_API } from "../../config/api";
import { validateStrongPassword } from "../../utils/validation";
import { formatIndianCurrency, formatTitleCase } from "../../utils/format";
import {
  PATIENT_PORTAL_OP_BILLS_KEY,
  readPatientPortalBills,
  storePatientPortalBill,
} from "../../utils/billingRevenue";
import { getClinicInvoiceBranding } from "../../utils/clinicBranding";
import { readGeneratedLabReports } from "../../Lab/labReportStore";
import {
  DUPLICATE_APPOINTMENT_MESSAGE,
  hasDuplicateAppointmentForPatientDoctorDate,
} from "../../utils/appointmentDuplicateValidation";

const getNestedValue = (record, path) => {
  if (record == null) return undefined;
  const keys = Array.isArray(path) ? path : String(path).replace(/\?/g, "").split(".");
  return keys.reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), record);
};

const readFirst = (record, keys) =>
  keys.reduce((value, key) => value || getNestedValue(record, key), "") || "";

const getInitials = (name = "") =>
  String(name || "DR")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "DR";

const getTokenSequence = (appointment = {}) => {
  const token = readFirst(appointment, ["tokenNumber", "TokenNumber", "token", "tokenNo", "token_number"]);
  const match = String(token || "").trim().match(/^TKN\s*0*(\d+)$/i);
  return match ? Number(match[1]) : 0;
};

const createNextPatientToken = (appointments = []) => {
  const highestToken = (Array.isArray(appointments) ? appointments : []).reduce(
    (highest, appointment) => Math.max(highest, getTokenSequence(appointment)),
    0
  );
  return `TKN${String(highestToken + 1).padStart(3, "0")}`;
};

const storePatientPortalOpBill = (bill) => storePatientPortalBill(bill, PATIENT_PORTAL_OP_BILLS_KEY);

const readPatientPortalOpBills = () => readPatientPortalBills(PATIENT_PORTAL_OP_BILLS_KEY);

const getBillSourceText = (bill = {}) =>
  [
    readFirst(bill, ["source", "billingSource", "bookingSource", "paymentSource", "createdByRole", "createdBy", "module"]),
    readFirst(bill, ["appointment.source", "appointment.bookingSource", "appointment.createdByRole"]),
  ].join(" ").toLowerCase();

const isPatientPortalBill = (bill = {}) => {
  const source = getBillSourceText(bill);
  return source.includes("patient-portal") || source.includes("patient portal") || source.includes("online");
};

const isReceptionBill = (bill = {}) => {
  const source = getBillSourceText(bill);
  return source.includes("reception") || source.includes("receptionist") || source.includes("offline");
};

const PATIENT_PASSWORD_REQUIREMENTS = [
  { label: "Minimum 8 characters", test: (value) => value.length >= 8 },
  { label: "At least 1 uppercase letter (A-Z)", test: (value) => /[A-Z]/.test(value) },
  { label: "At least 1 lowercase letter (a-z)", test: (value) => /[a-z]/.test(value) },
  { label: "At least 1 number (0-9)", test: (value) => /\d/.test(value) },
  { label: "At least 1 special character (@, #, $, %, etc.)", test: (value) => /[^A-Za-z0-9]/.test(value) },
];

const logoutPatient = async (navigate) => {
  const name = localStorage.getItem("patientName") || localStorage.getItem("patientEmail") || "Patient";
  const role = localStorage.getItem("patientRole") || "Patient";
  const ipAddress = localStorage.getItem("loginIpAddress") || "";
  const email = localStorage.getItem("patientEmail") || "";

  ["token", "userRole", "patientName", "patientId", "patientToken", "patientRole", "patientEmail"].forEach((key) =>
    localStorage.removeItem(key)
  );
  sessionStorage.clear();
  navigate("/login/patient", { replace: true });
  window.history.replaceState(null, document.title, "/login/patient");

  window.setTimeout(() => {
    import("../SUPERADMIN/superAdminApi").then(({ recordAuditLog }) =>
      recordAuditLog({
        userName: name,
        user: name,
        userEmail: email,
        email,
        action: `${name} logged out`,
        systemAction: "Logout",
        role,
        ipAddress,
        timestamp: new Date().toISOString(),
      })
    ).catch(() => {});
  }, 0);
};

/* ----------------- Patient module (inlined) ----------------- */
// patient styles should be moved to App.css; removed individual import

const readId = (record, keys) => {
  const value = keys.reduce((currentValue, key) => currentValue || getNestedValue(record, key), undefined);
  return value === undefined || value === null ? undefined : String(value);
};

const getBillRecordKey = (bill) => {
  if (!bill || typeof bill !== "object") return "";
  const billId = readFirst(bill, [
    'invoiceId', 'billId', 'id', '_id', 'referenceId',
    'invoice.id', 'invoice._id', 'invoice.referenceId',
    'bill.id', 'bill._id', 'bill.referenceId',
  ]);
  const billNumber = readFirst(bill, [
    'invoiceNumber', 'billNumber', 'referenceNumber', 'number',
    'invoice.invoiceNumber', 'invoice.billNumber', 'invoice.referenceNumber',
    'bill.invoiceNumber', 'bill.billNumber', 'bill.referenceNumber',
  ]);
  const appointmentId = readFirst(bill, [
    'appointmentId', 'appointment.id', 'appointment_id',
    'appointmentNumber', 'appointmentNo', 'appointment.number',
    'invoice.appointmentId', 'invoice.appointment.id',
    'bill.appointmentId', 'bill.appointment.id',
  ]);
  const patientId = readFirst(bill, [
    'patientId', 'patient.id', 'invoice.patientId', 'invoice.patient.id',
    'patientCode', 'patient.code', 'patient.patientCode',
  ]);
  const parts = [billId, billNumber, appointmentId, patientId]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (parts.length) return parts.join("|");
  const stableKeys = Object.keys(bill).sort();
  return JSON.stringify(stableKeys.reduce((acc, key) => {
    acc[key] = bill[key];
    return acc;
  }, {}));
};

const getBillDateValue = (bill) => {
  const date = new Date(
    readFirst(bill, ['invoiceDate', 'billDate', 'date', 'createdAt', 'updatedAt']) || ''
  );
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

const selectBestBillRecord = (existing, incoming) => {
  if (!existing) return incoming;
  const existingDate = getBillDateValue(existing);
  const incomingDate = getBillDateValue(incoming);
  if (incomingDate > existingDate) return incoming;
  if (incomingDate < existingDate) return existing;

  const existingStatus = String(readFirst(existing, ['status', 'paymentStatus', 'billStatus', 'state']) || '').toLowerCase();
  const incomingStatus = String(readFirst(incoming, ['status', 'paymentStatus', 'billStatus', 'state']) || '').toLowerCase();
  if (incomingStatus === 'paid' && existingStatus !== 'paid') return incoming;
  if (existingStatus === 'paid' && incomingStatus !== 'paid') return existing;

  return incoming;
};

const parseApiList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  if (Array.isArray(value?.data?.records)) return value.data.records;
  if (Array.isArray(value?.data?.medicalHistory)) return value.data.medicalHistory;
  if (Array.isArray(value?.data?.prescriptions)) return value.data.prescriptions;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.result)) return value.result;
  if (Array.isArray(value?.result?.items)) return value.result.items;
  if (Array.isArray(value?.result?.records)) return value.result.records;
  if (Array.isArray(value?.result?.medicalHistory)) return value.result.medicalHistory;
  if (Array.isArray(value?.result?.prescriptions)) return value.result.prescriptions;
  if (Array.isArray(value?.bills)) return value.bills;
  if (Array.isArray(value?.invoices)) return value.invoices;
  if (Array.isArray(value?.medicalHistory)) return value.medicalHistory;
  if (Array.isArray(value?.history)) return value.history;
  if (Array.isArray(value?.prescriptions)) return value.prescriptions;
  if (Array.isArray(value?.records)) return value.records;
  if (value && typeof value === "object") return [value];
  return [];
};

const PATIENT_PORTAL_BILLING_TYPES = ["op", "lab", "pharmacy"];

const normalizePortalBillingType = (type = "") => {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized.includes("pharmacy") || normalized.includes("medicine")) return "pharmacy";
  if (normalized.includes("lab") || normalized.includes("diagnostic") || normalized.includes("diagnosis") || normalized.includes("test")) return "lab";
  return "op";
};

const withQueryParams = (path, params = {}) => {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");
  if (!entries.length) return path;
  const query = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return `${path}${String(path).includes("?") ? "&" : "?"}${query}`;
};

const fetchPatientPortalBillingRows = async ({ headers = {}, cache = "no-store", billingType = "" } = {}) => {
  const type = billingType ? normalizePortalBillingType(billingType) : "";
  const path = withQueryParams(PATIENT_API.bills, type ? { billingType: type } : {});
  const response = await fetch(patientApiUrl(path), { headers, cache }).catch(() => null);
  if (!response?.ok) return [];
  const data = await response.json().catch(() => []);
  return parseApiList(data).map((bill) => ({
    ...bill,
    billingType: bill.billingType || bill.BillingType || type || "",
    BillingType: bill.BillingType || bill.billingType || type || "",
    invoiceType: bill.invoiceType || bill.InvoiceType || type || "",
    InvoiceType: bill.InvoiceType || bill.invoiceType || type || "",
    __sourcePath: path,
  }));
};

const fetchAllPatientPortalBillingRows = async ({ headers = {}, cache = "no-store" } = {}) => {
  const results = await Promise.all(
    PATIENT_PORTAL_BILLING_TYPES.map((billingType) =>
      fetchPatientPortalBillingRows({ headers, cache, billingType }).catch(() => [])
    )
  );
  return dedupeBillsByInvoice(results.flat());
};

const dedupeBillsByInvoice = (bills = []) => {
  const grouped = new Map();
  (Array.isArray(bills) ? bills : []).forEach((bill) => {
    const key = getBillRecordKey(bill);
    const current = grouped.get(key);
    grouped.set(key, selectBestBillRecord(current, bill));
  });
  return Array.from(grouped.values()).sort((left, right) => getBillDateValue(right) - getBillDateValue(left));
};

const dedupeNotificationsById = (notifications = []) => {
  const grouped = new Map();
  (Array.isArray(notifications) ? notifications : []).forEach((notification, index) => {
    if (!notification) return;
    const key = String(
      readFirst(notification, [
        "id",
        "_id",
        "notificationId",
        "NotificationId",
        "referenceId",
        "data.id",
        "data.notificationId",
      ]) ||
      [
        readFirst(notification, ["type", "category", "notificationType"]),
        readFirst(notification, ["title", "subject", "name"]),
        readFirst(notification, ["message", "body", "description", "content"]),
        readFirst(notification, ["date", "createdAt", "scheduledAt", "updatedAt"]),
      ].filter(Boolean).join("|") ||
      `notification-${index}`
    ).trim();
    grouped.set(key, notification);
  });
  return Array.from(grouped.values());
};

const parseAppointmentIdFromText = (text = '') => {
  const regex = /(APT-[0-9A-Za-z-]+)/i;
  const match = String(text || '').match(regex);
  return match ? match[1] : null;
};

const getPatientIdentityValues = (patient = {}, visits = []) => {
  const values = [
    patient?.id,
    patient?.Id,
    patient?.patientId,
    patient?.PatientId,
    patient?.patientID,
    patient?.patientCode,
    patient?.PatientCode,
    patient?.code,
    patient?.Code,
    patient?.userId,
    patient?.UserId,
    localStorage.getItem("patientId"),
    localStorage.getItem("PatientId"),
    localStorage.getItem("patientCode"),
    localStorage.getItem("userId"),
  ];
  (Array.isArray(visits) ? visits : []).forEach((visit) => {
    values.push(
      readFirst(visit, ["patientId", "PatientId", "patient.id", "patient.Id", "patient.patientId", "patient.PatientId", "patientCode", "PatientCode", "patient.patientCode", "patient.PatientCode"]),
      readFirst(visit, ["appointmentId", "AppointmentId", "id", "Id", "appointmentNumber", "AppointmentNumber"])
    );
  });
  return new Set(values.map((value) => normalizeComparable(value)).filter(Boolean));
};

const getPatientNameValues = (patient = {}, visits = []) => {
  const firstName = patient?.firstName || patient?.FirstName || "";
  const lastName = patient?.lastName || patient?.LastName || "";
  const values = [
    patient?.name,
    patient?.Name,
    patient?.fullName,
    patient?.FullName,
    patient?.patientName,
    patient?.PatientName,
    patient?.displayName,
    patient?.DisplayName,
    patient?.firstName,
    patient?.FirstName,
    patient?.lastName,
    patient?.LastName,
    firstName || lastName ? `${firstName} ${lastName}` : "",
    localStorage.getItem("patientName"),
    localStorage.getItem("PatientName"),
    localStorage.getItem("name"),
    localStorage.getItem("fullName"),
  ];
  (Array.isArray(visits) ? visits : []).forEach((visit) => {
    const visitFirstName = readFirst(visit, ["patient.firstName", "patient.FirstName", "firstName", "FirstName"]);
    const visitLastName = readFirst(visit, ["patient.lastName", "patient.LastName", "lastName", "LastName"]);
    values.push(
      readFirst(visit, ["patientName", "PatientName", "patient.name", "patient.Name", "patient.fullName", "patient.FullName", "name", "Name"]),
      visitFirstName || visitLastName ? `${visitFirstName} ${visitLastName}` : ""
    );
  });
  return new Set(values.map((value) => normalizeComparable(value)).filter(Boolean));
};

const billBelongsToPatient = (bill, patient = {}, visits = []) => {
  const patientIds = getPatientIdentityValues(patient, visits);
  const patientNames = getPatientNameValues(patient, visits);
  const billIds = [
    readFirst(bill, [
      "patientId",
      "PatientId",
      "patientID",
      "patient.id",
      "patient.Id",
      "patient.patientId",
      "patient.PatientId",
      "invoice.patientId",
      "invoice.PatientId",
      "bill.patientId",
      "bill.PatientId",
      "patientCode",
      "PatientCode",
      "patient.patientCode",
      "patient.PatientCode",
    ]),
    readFirst(bill, ["appointmentId", "AppointmentId", "appointment.id", "appointment.Id", "appointmentNumber", "AppointmentNumber", "appointmentNo", "AppointmentNo"]),
  ].map((value) => normalizeComparable(value)).filter(Boolean);
  if (billIds.some((value) => patientIds.has(value))) return true;
  if (patientIds.size) return false;

  const billFirstName = readFirst(bill, ["patient.firstName", "patient.FirstName", "firstName", "FirstName"]);
  const billLastName = readFirst(bill, ["patient.lastName", "patient.LastName", "lastName", "LastName"]);
  const billNames = [
    readFirst(bill, [
      "patientName",
      "PatientName",
      "patient.name",
      "patient.Name",
      "patient.fullName",
      "patient.FullName",
      "customerName",
      "CustomerName",
      "name",
      "Name",
    ]),
    billFirstName || billLastName ? `${billFirstName} ${billLastName}` : "",
  ].map((value) => normalizeComparable(value)).filter(Boolean);
  return billNames.some((value) => patientNames.has(value));
};

const getAppointmentIdentityValues = (visits = []) =>
  new Set(
    (Array.isArray(visits) ? visits : [])
      .flatMap((visit) => [
        readFirst(visit, ["appointmentId", "AppointmentId", "id", "Id", "appointmentNumber", "AppointmentNumber", "appointmentNo", "AppointmentNo"]),
        readFirst(visit, ["appointment.id", "appointment.Id", "appointment.appointmentId", "appointment.AppointmentId"]),
      ])
      .map((value) => normalizeComparable(value))
      .filter(Boolean)
  );

const buildPatientScopedPaths = (basePath, patient = {}, visits = []) => {
  const patientIds = Array.from(getPatientIdentityValues(patient, visits));
  const patientNames = Array.from(getPatientNameValues(patient, visits));
  const appointmentIds = Array.from(getAppointmentIdentityValues(visits));
  const paths = new Set([basePath]);

  patientIds.forEach((id) => {
    paths.add(`${basePath}?patientId=${encodeURIComponent(id)}`);
    paths.add(`${basePath}?PatientId=${encodeURIComponent(id)}`);
    paths.add(`${basePath}?patientCode=${encodeURIComponent(id)}`);
    paths.add(`${basePath}?PatientCode=${encodeURIComponent(id)}`);
    paths.add(`${basePath}/${encodeURIComponent(id)}`);
  });

  patientNames.forEach((name) => {
    paths.add(`${basePath}?patientName=${encodeURIComponent(name)}`);
    paths.add(`${basePath}?PatientName=${encodeURIComponent(name)}`);
    paths.add(`${basePath}?name=${encodeURIComponent(name)}`);
  });

  appointmentIds.forEach((id) => {
    paths.add(`${basePath}?appointmentId=${encodeURIComponent(id)}`);
    paths.add(`${basePath}?AppointmentId=${encodeURIComponent(id)}`);
    paths.add(`${basePath}?appointmentNumber=${encodeURIComponent(id)}`);
    paths.add(`${basePath}?AppointmentNumber=${encodeURIComponent(id)}`);
  });

  return Array.from(paths);
};

const appointmentBelongsToPatient = (appointment, patient = {}) => {
  const patientIds = getPatientIdentityValues(patient);
  const patientNames = getPatientNameValues(patient);
  const appointmentIds = [
    readFirst(appointment, ["patientId", "PatientId", "patient.id", "patient.Id", "patient.patientId", "patient.PatientId", "patientCode", "PatientCode"]),
  ].map((value) => normalizeComparable(value)).filter(Boolean);
  if (appointmentIds.some((value) => patientIds.has(value))) return true;

  const firstName = readFirst(appointment, ["patient.firstName", "patient.FirstName", "firstName", "FirstName"]);
  const lastName = readFirst(appointment, ["patient.lastName", "patient.LastName", "lastName", "LastName"]);
  const appointmentNames = [
    readFirst(appointment, ["patientName", "PatientName", "patient.name", "patient.Name", "patient.fullName", "patient.FullName", "name", "Name"]),
    firstName || lastName ? `${firstName} ${lastName}` : "",
  ].map((value) => normalizeComparable(value)).filter(Boolean);
  if (appointmentNames.some((value) => patientNames.has(value))) return true;

  return !appointmentIds.length && !appointmentNames.length;
};

const notificationBelongsToPatient = (notification, patient = {}, visits = []) => {
  const patientIds = getPatientIdentityValues(patient, visits);
  const patientNames = getPatientNameValues(patient, visits);
  const appointmentIds = getAppointmentIdentityValues(visits);
  const notificationPatientIds = [
    readFirst(notification, [
      "patientId",
      "PatientId",
      "patientID",
      "patient.id",
      "patient.Id",
      "patient.patientId",
      "patient.PatientId",
      "patientCode",
      "PatientCode",
      "patient.patientCode",
      "patient.PatientCode",
      "data.patientId",
      "data.PatientId",
      "data.patientID",
      "data.patient.id",
      "data.patient.Id",
      "data.patient.patientId",
      "data.patient.PatientId",
      "data.patientCode",
      "data.PatientCode",
    ]),
  ].map((value) => normalizeComparable(value)).filter(Boolean);
  if (notificationPatientIds.length) return notificationPatientIds.some((value) => patientIds.has(value));

  const firstName = readFirst(notification, ["patient.firstName", "patient.FirstName", "data.patientFirstName", "data.FirstName", "data.patient.firstName", "data.patient.FirstName"]);
  const lastName = readFirst(notification, ["patient.lastName", "patient.LastName", "data.patientLastName", "data.LastName", "data.patient.lastName", "data.patient.LastName"]);
  const notificationNames = [
    readFirst(notification, ["patientName", "PatientName", "patient.name", "patient.Name", "patient.fullName", "patient.FullName", "data.patientName", "data.PatientName", "data.patient.name", "data.patient.Name", "data.patient.fullName", "data.patient.FullName"]),
    firstName || lastName ? `${firstName} ${lastName}` : "",
  ].map((value) => normalizeComparable(value)).filter(Boolean);
  if (notificationNames.length) return notificationNames.some((value) => patientNames.has(value));

  const notificationAppointmentIds = [
    readFirst(notification, ["appointmentId", "AppointmentId", "appointment.id", "appointment.Id", "appointment.appointmentId", "appointment.AppointmentId", "appointmentNumber", "AppointmentNumber", "appointmentNo", "AppointmentNo", "data.appointmentId", "data.AppointmentId", "data.appointment.id", "data.appointment.Id", "data.appointmentNumber", "data.AppointmentNumber"]),
    parseAppointmentIdFromText([
      readFirst(notification, ["title", "subject", "name"]),
      readFirst(notification, ["message", "body", "description", "content"]),
    ].filter(Boolean).join(" ")),
  ].map((value) => normalizeComparable(value)).filter(Boolean);
  if (notificationAppointmentIds.length) return notificationAppointmentIds.some((value) => appointmentIds.has(value));

  return true;
};

const normalizeName = (value) => {
  if (!value && value !== 0) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    const result = readFirst(value, [
      "name",
      "doctorName",
      "fullName",
      "departmentName",
      "specialty",
      "speciality",
      "department",
      "specialization",
      "clinicName",
      "hospitalName",
      "title",
      "label",
    ]);
    if (result === undefined || result === null) return "";
    return typeof result === "string" ? result.trim() : String(result).trim();
  }
  return String(value).trim();
};

const normalizeComparable = (value) => String(value || "").trim().toLowerCase();

const formatSlotTime = (value) => {
  const time = String(value || "").trim();
  if (!time) return "";
  const match = time.match(/^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?\s*$/i);
  if (!match) return time;

  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3]?.toUpperCase();

  if (meridiem) {
    if (hour < 1 || hour > 12) return time;
    if (meridiem === "AM") {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }
  }

  if (hour < 0 || hour > 23) return time;
  const formattedHour = hour % 12 || 12;
  const displayMeridiem = hour >= 12 ? "PM" : "AM";
  return `${String(formattedHour).padStart(2, "0")}:${minute} ${displayMeridiem}`;
};

const formatAppointmentDateTime = (value) => {
  const date = String(value || "").trim();
  if (!date) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T00:00:00.000Z`;
  return date;
};

const normalizeAppointmentBookingDate = (value) => String(value || "").trim().slice(0, 10);

const normalizeAppointmentBookingTime = (value) => {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!match) return text.toLowerCase();

  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
};

const getSlotStartValue = (slot) => {
  if (!slot) return "";
  const raw = typeof slot === "string"
    ? slot
    : slot.start || slot.startTime || slot.time || slot.slotTime || slot.slot || "";
  return String(raw).split(" - ")[0].trim();
};

const isSlotHiddenByCurrentTime = (slot, selectedDate) => {
  const date = String(selectedDate || slot?.date || "").slice(0, 10);
  if (!date) return false;

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (date !== todayKey) return false;

  const startTime = normalizeAppointmentBookingTime(getSlotStartValue(slot));
  if (!startTime) return false;

  const [hour, minute] = startTime.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;

  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  return hour * 60 + minute <= nowMinutes;
};

const isActiveAppointmentBooking = (appointment = {}) =>
  !["cancelled", "canceled", "rejected"].includes(
    String(readFirst(appointment, ["status", "appointmentStatus", "state"]) || "").trim().toLowerCase()
  );

export const findPatientBookingConflict = (visits = [], date, time) => {
  const selectedDate = normalizeAppointmentBookingDate(date);
  const selectedTime = normalizeAppointmentBookingTime(time);

  const activeVisits = (Array.isArray(visits) ? visits : []).filter((visit) => isActiveAppointmentBooking(visit));
  if (!activeVisits.length) return undefined;

  const sameSlotConflict = activeVisits.find((visit) => {
    const visitDate = normalizeAppointmentBookingDate(
      readFirst(visit, ["date", "appointmentDate", "visitDate", "scheduledDate", "slotDate"])
    );
    const visitTime = normalizeAppointmentBookingTime(
      readFirst(visit, ["startTime", "time", "slot", "appointmentTime", "slotTime"])
    );
    return visitDate === selectedDate && visitTime === selectedTime;
  });

  if (sameSlotConflict) return sameSlotConflict;

  return activeVisits[0];
};

const readNumericId = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : value;
};

const getResponseId = (record, keys) => {
  if (!record || typeof record !== "object") return "";
  return readFirst(record, keys) || readFirst(record.data || {}, keys) || "";
};

const formatPatientDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }
  return String(value);
};

const getAppointmentNumber = (appointment) =>
  readFirst(appointment, ["appointmentNumber", "number", "referenceNumber", "id", "appointmentId"]);

const getAppointmentDoctor = (appointment) =>
  readFirst(appointment, ["doctor", "doctorName", "doctor.name", "providerName", "practitionerName"]) || "Doctor assigned";

const getAppointmentClinic = (appointment) =>
  {
    const branchName = readFirst(appointment, [
      "branchName",
      "BranchName",
      "branch.name",
      "Branch.Name",
      "branch",
      "Branch",
      "appointment.branchName",
      "appointment.BranchName",
      "appointment.branch.name",
    ]);
    const clinicName = readFirst(appointment, [
      "clinicName",
      "ClinicName",
      "hospitalName",
      "HospitalName",
      "clinic.name",
      "Clinic.Name",
      "hospital.name",
      "Hospital.Name",
      "clinic",
      "Clinic",
      "hospital",
      "Hospital",
      "appointment.clinicName",
      "appointment.ClinicName",
      "appointment.hospitalName",
      "appointment.HospitalName",
    ]);
    const values = [branchName, clinicName]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const uniqueValues = Array.from(new Set(values.map((value) => value.toLowerCase())))
      .map((key) => values.find((value) => value.toLowerCase() === key));
    return uniqueValues.length ? uniqueValues.join(" / ") : "Clinic details unavailable";
  };

const getAppointmentDate = (appointment) =>
  readFirst(appointment, ["date", "appointmentDate", "scheduledDate", "visitDate", "createdAt"]);

const getAppointmentTime = (appointment) =>
  formatSlotTime(readFirst(appointment, ["time", "startTime", "slot", "appointmentTime", "scheduleTime"]));

const getAppointmentReason = (appointment) =>
  readFirst(appointment, ["reasonForVisit", "reason", "summary", "notes", "complaint"]) || "Reason not provided";

const getAppointmentStatus = (appointment) =>
  readFirst(appointment, ["status", "appointmentStatus", "state"]) || "Scheduled";

const normalizeClinicOption = (clinic) => {
  const source = clinic && typeof clinic === "object" ? clinic : {};
  const name = normalizeName(clinic);
  return {
    ...source,
    id: readId(source, ["id", "clinicId", "hospitalId"]) || name,
    name,
    address: readFirst(source, ["address", "location", "clinicAddress", "hospitalAddress"]),
  };
};

const normalizeDepartmentOption = (department, clinicId = "") => {
  const source = department && typeof department === "object" ? department : {};
  const name =
    normalizeName(department) ||
    normalizeName(readFirst(source, ["name", "departmentName", "specialization", "specialty", "title"]));
  const normalizedClinicId = String(clinicId || readId(source, ["clinicId", "hospitalId", "clinic.id"]) || "");

  return {
    ...source,
    id: readId(source, ["id", "departmentId", "specialtyId"]) || name,
    name,
    clinicId: normalizedClinicId,
  };
};

const getDepartmentVisual = (departmentName = "") => {
  const key = String(departmentName || "").toLowerCase();
  if (key.includes("cardio") || key.includes("heart")) {
    return {
      tone: "cardiology",
      Icon: Activity,
      label: "Heart care",
    };
  }
  if (key.includes("general") || key.includes("physician") || key.includes("specialist")) {
    return {
      tone: "general",
      Icon: Stethoscope,
      label: "General care",
    };
  }
  return {
    tone: "default",
    Icon: Heart,
    label: "Specialty care",
  };
};

const DOCTOR_REVIEWS_STORAGE_KEY = "patientDoctorReviews";

const readDoctorReviewKey = (doctor = {}) =>
  readFirst(doctor, ["id", "doctorId", "DoctorId", "_id", "email", "Email"]) ||
  `${doctor.name || doctor.doctorName || "doctor"}-${doctor.specialty || doctor.specialization || ""}`;

const normalizeDoctorReview = (review = {}) => ({
  id: readFirst(review, ["id", "reviewId", "ReviewId"], "") || `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  patientName: readFirst(review, ["patientName", "PatientName", "name", "Name"], "") || "Patient",
  rating: String(readFirst(review, ["rating", "Rating", "stars", "Stars"], "") || review.rating || "4.8"),
  comment: readFirst(review, ["comment", "Comment", "review", "Review", "feedback", "Feedback"], "") || "Good consultation experience.",
});

const readDoctorExpertise = (doctor = {}) =>
  readFirst(doctor, [
    "areaOfExpertise",
    "AreaOfExpertise",
    "areaofExpertise",
    "expertise",
    "Expertise",
    "area_of_expertise",
    "specializedIn",
    "specializedArea",
  ]) || doctor.specialty || doctor.specialization || "General consultation";

const isSameDoctorText = (left = "", right = "") =>
  String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();

const readDoctorExperience = (doctor = {}) => {
  const value = readFirst(doctor, ["experience", "Experience", "yearsOfExperience", "YearsOfExperience"]) || doctor.experience;
  if (value === undefined || value === null || value === "") return "Experience not updated";
  const text = String(value).trim();
  return /\byears?\b|\byrs?\b/i.test(text) ? text : `${text} years`;
};

const readDoctorSummary = (doctor = {}) =>
  readFirst(doctor, [
    "summary",
    "Summary",
    "bio",
    "Bio",
    "about",
    "About",
    "description",
    "Description",
    "profileSummary",
    "ProfileSummary",
  ]) ||
  `Dr. ${doctor.name || doctor.doctorName || "Doctor"} provides ${doctor.specialty || doctor.specialization || "general"} care with a focus on clear consultation and patient follow-up.`;

const readDoctorReviews = (doctor = {}) => {
  const doctorKey = readDoctorReviewKey(doctor);
  if (doctorKey) {
    try {
      const saved = JSON.parse(localStorage.getItem(DOCTOR_REVIEWS_STORAGE_KEY) || "{}");
      if (Array.isArray(saved[doctorKey])) return saved[doctorKey];
    } catch {}
  }
  const rawReviews =
    doctor.reviews ||
    doctor.Reviews ||
    doctor.doctorReviews ||
    doctor.DoctorReviews ||
    doctor.feedback ||
    doctor.Feedback ||
    [];
  if (Array.isArray(rawReviews) && rawReviews.length) return rawReviews;
  return [
    {
      patientName: "Patient review",
      rating: doctor.rating || doctor.Rating || 4.8,
      comment: "Helpful consultation and clear explanation.",
    },
  ];
};

const normalizeDoctorOption = (doctor, clinicId = "", departmentName = "") => {
  const source = doctor && typeof doctor === "object" ? doctor : {};
  const departmentLabel =
    normalizeName(readFirst(source, ["department", "departmentName", "specialty", "speciality", "specialization", "department.name"])) ||
    normalizeName(departmentName);

  return {
    ...source,
    id: readId(source, ["id", "doctorId", "userId"]),
    name: normalizeName(doctor),
    specialty: departmentLabel,
    departmentName: departmentLabel,
    departmentId: readId(source, ["departmentId", "specialtyId", "department.id"]),
    clinicId: String(clinicId || readId(source, ["clinicId", "hospitalId", "clinic.id"]) || ""),
  };
};

const normalizeSlotOption = (slot, doctorId = "", selectedDate = "") => {
  const source = slot && typeof slot === "object" ? slot : {};
  const normalizedDoctorId = String(doctorId || readId(source, ["doctorId", "doctor.id", "doctor.doctorId"]) || "");
  const date = readFirst(source, ["date", "appointmentDate", "visitDate"]) || selectedDate;
  const time = formatSlotTime(readFirst(source, ["time", "slot", "appointmentTime"]) || (typeof slot === "string" ? slot : ""));

  return {
    ...source,
    id: readId(source, ["id"]) || `${normalizedDoctorId}-${date}-${time}`,
    doctorId: normalizedDoctorId,
    date,
    time,
    clinicId: readId(source, ["clinicId", "hospitalId", "clinic.id"]),
    departmentId: readId(source, ["departmentId", "specialtyId", "department.id"]),
  };
};

function PatientShell({ notifications, children, patient }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const unreadCount = (notifications || []).filter((item) => item.unread).length;

  useEffect(() => {
    const closeMenu = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const logout = async () => {
    setMenuOpen(false);
    await logoutPatient(navigate);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    const destinations = [
      { terms: ["dashboard", "home"], path: "/patient/dashboard" },
      { terms: ["appointment", "booking", "visit"], path: "/patient/appointments" },
      { terms: ["medical", "history", "record"], path: "/patient/medical-history" },
      { terms: ["prescription", "medicine", "medication"], path: "/patient/prescriptions" },
      { terms: ["bill", "payment", "invoice"], path: "/patient/bills" },
      { terms: ["notification", "alert"], path: "/patient/notifications" },
      { terms: ["profile", "account"], path: "/patient/profile" },
    ];
    const match = destinations.find(({ terms }) => terms.some((term) => term.includes(query) || query.includes(term)));
    if (match) {
      navigate(match.path);
      setSearchOpen(false);
    }
  };

  const patientTitle = formatTitleCase(
    patient?.name || patient?.firstName || patient?.fullName || "Patient"
  );
  const patientSubtitle = formatTitleCase(
    patient?.clinicName ||
    patient?.hospitalName ||
    patient?.clinic?.name ||
    patient?.organization ||
    patient?.role ||
    "Patient"
  );

  const initials = (() => {
    const name = patientTitle;
    if (!name) return "P";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  })();

  return (
    <div className={`patient-portal ${searchOpen ? "pp-search-open" : ""}`}>
      <button
        type="button"
        className={`pp-sidebar-overlay ${sidebarOpen ? "is-visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close navigation menu"
        tabIndex={sidebarOpen ? 0 : -1}
      />
      <aside className={`pp-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="pp-brand">
          <div className="pp-brand-mark">
            <Heart size={20} />
          </div>
          <div>
            <strong>CMS</strong>
            <span>Patient Portal</span>
          </div>
        </div>
        <nav className="pp-nav" onClick={() => setSidebarOpen(false)}>
          <span className="pp-nav-label">MAIN MENU</span>
          <NavLink to="/patient/dashboard" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <ClipboardList size={16} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/patient/appointments" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <Calendar size={16} />
            <span>Appointments</span>
          </NavLink>
          <NavLink to="/patient/medical-history" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <FileText size={16} />
            <span>Medical History</span>
          </NavLink>
          <NavLink to="/patient/prescriptions" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <Pill size={16} />
            <span>Prescriptions</span>
          </NavLink>
          <NavLink to="/patient/bills" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <CreditCard size={16} />
            <span>Bills</span>
          </NavLink>
          <NavLink to="/patient/notifications" className={({ isActive }) => `pp-nav-item ${isActive ? "active" : ""}`}>
            <Bell size={16} />
            <span>Notifications</span>
            {unreadCount ? <em>{unreadCount}</em> : null}
          </NavLink>
        </nav>
        <div className="pp-patient-chip">
          <div className="pp-avatar">{initials}</div>
          <div>
            <strong>{patientTitle}</strong>
            <span>{patientSubtitle}</span>
            <div className="pp-patient-status">
              <span className="pp-status-dot pp-status-dot--online" />
              Online
            </div>
          </div>
        </div>
      </aside>
      <main className="pp-main">
        <header className="pp-topbar">
          <form className={`pp-search-box ${searchOpen ? "is-expanded" : ""}`} onSubmit={submitSearch}>
            <button
              type="button"
              className="pp-search-toggle"
              onClick={() => setSearchOpen(true)}
              aria-label="Search patient portal"
            >
              <Search size={18} className="pp-search-icon" />
            </button>
            <input
              type="search"
              ref={searchRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search appointments, bills, prescriptions..."
              aria-label="Search patient portal"
            />
            <button
              type="button"
              className="pp-search-close"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
            >
              <X size={18} />
            </button>
          </form>
          <div className="pp-top-actions">
            <button
              type="button"
              className="pp-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
            >
              <Menu size={21} />
            </button>
            <NavLink to="/patient/notifications" className="pp-icon-btn">
              <Bell size={17} />
              {unreadCount ? <span className="pp-dot" /> : null}
            </NavLink>
            <div className="pp-account-menu" ref={menuRef}>
              <button
                className="pp-account-toggle"
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="pp-avatar">{initials}</span>
                <span className="pp-account-name">{formatTitleCase(patient?.firstName || patient?.name || '')}</span>
                <ChevronDown size={15} />
              </button>
              {menuOpen ? (
                <div className="pp-account-dropdown" role="menu">
                  <div className="pp-account-summary">
                    <span className="pp-account-summary-avatar">{initials}</span>
                    <strong>{formatTitleCase(patient?.name || patient?.firstName || '')}</strong>
                    <span>{patient?.email || ''}</span>
                    <span className="pp-account-badge">Patient</span>
                  </div>
                  <button
                    type="button"
                    className="pp-account-item"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/patient/profile');
                    }}
                    role="menuitem"
                  >
                    <span className="pp-account-menu-icon">
                      <UserRound size={20} />
                    </span>
                    <span className="pp-account-menu-copy">
                      <b>My Profile</b>
                      <small>View and edit your profile</small>
                    </span>
                    <ChevronRight size={17} className="pp-account-menu-arrow" />
                  </button>
                  <button
                    type="button"
                    className="pp-account-item"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/patient/change-password');
                    }}
                    role="menuitem"
                  >
                    <span className="pp-account-menu-icon">
                      <KeyRound size={20} />
                    </span>
                    <span className="pp-account-menu-copy">
                      <b>Change Password</b>
                      <small>Update your password</small>
                    </span>
                    <ChevronRight size={17} className="pp-account-menu-arrow" />
                  </button>
                  <button
                    type="button"
                    className="pp-account-item pp-account-item--logout"
                    onClick={logout}
                    role="menuitem"
                  >
                    <span className="pp-account-menu-icon danger">
                      <LogOut size={20} />
                    </span>
                    <span className="pp-account-menu-copy">
                      <b>Logout</b>
                      <small>Sign out from your account</small>
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function PatientRoutes() {
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [bills, setBills] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);

  const location = useLocation();

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const [
        profileRes,
        appointmentsRes,
        prescriptionsRes,
        billingRows,
        notificationsRes,
        dashboardRes,
      ] = await Promise.all([
        fetch(patientApiUrl(PATIENT_API.profile), { headers }).catch(() => null),
        fetch(patientApiUrl(PATIENT_API.appointments), { headers }).catch(() => null),
        fetch(patientApiUrl(PATIENT_API.prescriptions), { headers, cache: "no-store" }).catch(() => null),
        fetchAllPatientPortalBillingRows({ headers, cache: "no-store" }).catch(() => []),
        fetch(patientApiUrl(PATIENT_API.notifications), { headers, cache: "no-store" }).catch(() => null),
        fetch(patientApiUrl(PATIENT_API.dashboard), { headers }).catch(() => null),
      ]);

      const profileData = profileRes?.ok ? await profileRes.json().catch(() => null) : null;
      const effectivePatient = profileData || patient || {};
      if (profileData) setPatient(profileData);

      const appointmentsData = appointmentsRes?.ok ? await appointmentsRes.json().catch(() => []) : [];
      const appointmentsList = Array.isArray(appointmentsData) ? appointmentsData : (appointmentsData.items || appointmentsData.data || []);
      const patientAppointments = appointmentsList.filter((appointment) =>
        appointmentBelongsToPatient(appointment, effectivePatient)
      );
      setVisits(patientAppointments);

      const rxData = prescriptionsRes?.ok ? await prescriptionsRes.json().catch(() => []) : [];
      const patientPrescriptions = parseApiList(rxData).filter((prescription) =>
        appointmentBelongsToPatient(prescription, effectivePatient)
      );
      setPrescriptions(patientPrescriptions);

      const storedPatientPortalBills = readPatientPortalOpBills();
      const patientBills = dedupeBillsByInvoice([
        ...billingRows,
        ...storedPatientPortalBills,
      ]).filter((bill) => billBelongsToPatient(bill, effectivePatient, patientAppointments));
      setBills(patientBills);

      const nData = notificationsRes?.ok ? await notificationsRes.json().catch(() => []) : [];
      const notificationList = dedupeNotificationsById(parseApiList(nData));
      setNotifications(notificationList.filter((notification) =>
        notificationBelongsToPatient(notification, effectivePatient, patientAppointments)
      ));

      const dashboardJson = dashboardRes?.ok ? await dashboardRes.json().catch(() => null) : null;
      if (dashboardJson) setDashboardData(dashboardJson);
    } catch (err) {
      // ignore errors
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (location.pathname.startsWith('/patient/bills') || location.pathname.startsWith('/patient/billing')) {
      return;
    }
    fetchData();
  }, [location.pathname, fetchData]);

  return (
    <PatientShell notifications={notifications} patient={patient}>
      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <PatientDashboard
              patient={patient}
              visits={visits}
              prescriptions={prescriptions}
              bills={bills}
              notifications={notifications}
              dashboardData={dashboardData}
            />
          }
        />
        <Route path="appointments" element={<PatientAppointmentsPage visits={visits} onRefresh={fetchData} />} />
        <Route path="appointments/book" element={<PatientBookingWizardPage patient={patient} visits={visits} onRefresh={fetchData} />} />
        <Route path="book" element={<Navigate to="appointments/book" replace />} />
        <Route path="medical-history" element={<PatientMedicalHistoryPage patient={patient} visits={visits} prescriptions={prescriptions} />} />
        <Route path="history" element={<Navigate to="medical-history" replace />} />
        <Route path="reports" element={<Navigate to="medical-history" replace />} />
        <Route path="prescriptions" element={<PatientPrescriptionsPage prescriptions={prescriptions} patient={patient} visits={visits} />} />
        <Route path="bills" element={<PatientBillsPage bills={bills} patient={patient} visits={visits} />} />
        <Route path="billing" element={<Navigate to="bills" replace />} />
        <Route path="notifications" element={<PatientNotificationsPage notifications={notifications} prescriptions={prescriptions} bills={bills} patient={patient} visits={visits} />} />
        <Route path="profile" element={<PatientProfilePage patient={patient} visits={visits} prescriptions={prescriptions} bills={bills} notifications={notifications} onProfileUpdated={(updatedPatient) => setPatient(updatedPatient)} />} />
        <Route path="change-password" element={<PatientChangePasswordPage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </PatientShell>
  );
}

function PatientPageShell({ title, subtitle, action, children }) {
  return (
    <div className="patient-dashboard">
      <div className="pd-header">
        <div className="pd-header-copy">
          <h1 className="pd-greeting-title">{title}</h1>
          <p className="pd-greeting-subtitle">{subtitle}</p>
        </div>
        {action ? <div className="pd-header-actions">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

function PatientAppointmentsPage({ visits = [], onRefresh }) {
  const navigate = useNavigate();
  const location = useLocation();
  const rows = visits || [];
  const appointmentIdQuery = useMemo(
    () => new URLSearchParams(location.search).get('appointmentId'),
    [location.search]
  );
  const [selectedAppointment, setSelectedAppointment] = useState(rows[0] || null);

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleLoadingSlots, setRescheduleLoadingSlots] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  const getAppointmentKeys = (visit) =>
    [
      readFirst(visit, ['appointmentId', 'AppointmentId', 'appointment.id', 'appointment.appointmentId']),
      readFirst(visit, ['appointmentNumber', 'appointmentNo', 'referenceNumber', 'number', 'appointment.appointmentNumber']),
      readFirst(visit, ['id', 'Id', 'appointment_id']),
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);

  useEffect(() => {
    if (appointmentIdQuery) {
      const requestedId = String(appointmentIdQuery).trim().toLowerCase();
      const matching = rows.find((visit) => {
        const keys = getAppointmentKeys(visit);
        return keys.some((key) => key === requestedId);
      });
      if (matching) {
        setSelectedAppointment(matching);
        return;
      }

      const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
      const headers = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      fetch(
        patientApiUrl(PATIENT_API.appointmentById, { id: appointmentIdQuery }),
        { headers }
      )
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          const appointment = data?.appointment || data?.data || data;
          if (appointment && typeof appointment === 'object' && !Array.isArray(appointment)) {
            setSelectedAppointment(appointment);
          }
        })
        .catch(() => {});
    }
    setSelectedAppointment(rows[0] || null);
  }, [rows, appointmentIdQuery]);

  const getApiHeaders = () => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const handleCancel = async () => {
    setCancelLoading(true);
    setCancelError("");
    try {
      const id = selectedAppointment.appointmentId || selectedAppointment.id;
      const cancelUrl = patientApiUrl(PATIENT_API.cancelAppointment, { id });
      const response = await fetch(cancelUrl, {
        method: "PATCH",
        headers: getApiHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unable to cancel appointment.");
        throw new Error(errorText || "Unable to cancel appointment.");
      }
      setCancelling(false);
      if (onRefresh) await onRefresh();
    } catch (err) {
      setCancelError(err.message || "Failed to cancel appointment.");
    } finally {
      setCancelLoading(false);
    }
  };

  useEffect(() => {
    const fetchRescheduleSlots = async () => {
      if (!selectedAppointment || !rescheduleDate) {
        setRescheduleSlots([]);
        return;
      }
      setRescheduleLoadingSlots(true);
      setRescheduleError("");
      try {
        const doctor = selectedAppointment.doctor || {};
        const doctorId = selectedAppointment.doctorId || doctor.doctorId || doctor.id || selectedAppointment.userId;
        if (!doctorId) {
          throw new Error("Doctor identifier not found on this appointment.");
        }
        const slotsUrl = patientApiUrl(PATIENT_API.doctorSlots, { doctorId });
        const response = await fetch(`${slotsUrl}?date=${encodeURIComponent(rescheduleDate)}`, {
          headers: getApiHeaders(),
        });
        if (!response.ok) {
          throw new Error("Unable to fetch available time slots.");
        }
        const data = await response.json();
        const slotList = Array.isArray(data) ? data : (data.items || data.data || data.slots || []);
        setRescheduleSlots(slotList.map((slot) => {
          if (typeof slot === 'string') return slot;
          return slot.start || slot.time || '';
        }).filter(Boolean));
      } catch (err) {
        setRescheduleError(err.message || "Failed to load slots.");
        setRescheduleSlots([]);
      } finally {
        setRescheduleLoadingSlots(false);
      }
    };

    if (rescheduling) {
      fetchRescheduleSlots();
    }
  }, [rescheduling, rescheduleDate, selectedAppointment]);

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError("Please select date and time.");
      return;
    }
    setRescheduleSaving(true);
    setRescheduleError("");
    try {
      const id = selectedAppointment.appointmentId || selectedAppointment.id;
      const rescheduleUrl = patientApiUrl(PATIENT_API.rescheduleAppointment, { id });
      const payload = {
        date: formatAppointmentDateTime(rescheduleDate),
        startTime: formatSlotTime(rescheduleTime),
      };
      const response = await fetch(rescheduleUrl, {
        method: "PUT",
        headers: getApiHeaders(),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unable to reschedule appointment.");
        throw new Error(errorText || "Unable to reschedule appointment.");
      }
      setRescheduling(false);
      setRescheduleDate("");
      setRescheduleTime("");
      if (onRefresh) await onRefresh();
    } catch (err) {
      setRescheduleError(err.message || "Failed to reschedule appointment.");
    } finally {
      setRescheduleSaving(false);
    }
  };

  return (
    <PatientPageShell
      title="Appointments"
      subtitle="Book, review, and reschedule care visits from your portal."
      action={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="button" className="pd-header-btn pd-header-btn--primary" onClick={() => navigate("/patient/dashboard")}>
            ← Back to dashboard
          </button>
          <button type="button" className="pd-header-btn" onClick={() => navigate("/patient/appointments/book")}>
            Book appointment
          </button>
        </div>
      }
    >
      <div className="pd-card">
        <div className="pd-section-header">
          <div>
            <h2>Appointment history</h2>
            <p>Linked to the patient portal backend data.</p>
          </div>
          {/* Book button moved to header actions */}
        </div>

        {rows.length ? (
          <div className="pd-notification-list">
            {rows.map((visit, index) => {
              const appointmentKey = visit.appointmentId || visit.id || index;
              const isSelected =
                selectedAppointment &&
                String(selectedAppointment.appointmentId || selectedAppointment.id || "") === String(visit.appointmentId || visit.id || "");

              return (
                <button
                  type="button"
                  className={`pd-notification-item ${isSelected ? "is-active" : ""}`}
                  key={appointmentKey}
                  onClick={() => {
                    setSelectedAppointment(visit);
                    setCancelling(false);
                    setRescheduling(false);
                  }}
                >
                  <span className="pd-notification-dot" />
                  <span className="pd-notification-body">
                    <strong>{getAppointmentNumber(visit) || "Appointment"}</strong>
                    <span>
                      {getAppointmentDoctor(visit)} at {getAppointmentClinic(visit)}
                    </span>
                    <em>
                      {formatPatientDate(getAppointmentDate(visit)) || "Date not available"}
                      {getAppointmentTime(visit) ? `, ${getAppointmentTime(visit)}` : ""} - {getAppointmentStatus(visit)}
                    </em>
                  </span>
                  <ChevronRight size={16} className="pd-notification-chevron" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="pd-selected-notification">
            <p>No appointments found yet.</p>
          </div>
        )}

        {selectedAppointment ? (
          <div className="pd-selected-notification">
            <div className="pd-selected-notification-head">
              <strong>{getAppointmentNumber(selectedAppointment) || "Appointment details"}</strong>
              <span>{getAppointmentStatus(selectedAppointment)}</span>
            </div>
            <div className="pd-appointment-detail-grid">
              <div>
                <span>Doctor</span>
                <strong>{getAppointmentDoctor(selectedAppointment)}</strong>
              </div>
              <div>
                <span>Branch / Clinic</span>
                <strong>{getAppointmentClinic(selectedAppointment)}</strong>
              </div>
              <div>
                <span>Date</span>
                <strong>{formatPatientDate(getAppointmentDate(selectedAppointment)) || "Not available"}</strong>
              </div>
              <div>
                <span>Time</span>
                <strong>{getAppointmentTime(selectedAppointment) || "Not available"}</strong>
              </div>
              <div className="pd-appointment-detail-wide">
                <span>Reason for visit</span>
                <strong>{getAppointmentReason(selectedAppointment)}</strong>
              </div>
            </div>

            {getAppointmentStatus(selectedAppointment) !== "Cancelled" &&
              getAppointmentStatus(selectedAppointment) !== "Completed" && (
                <div className="pd-appointment-actions">
                  <button
                    type="button"
                    className="pd-action-btn pd-action-btn--secondary"
                    onClick={() => {
                      setRescheduling(true);
                      setCancelling(false);
                      setRescheduleError("");
                      setRescheduleDate("");
                      setRescheduleTime("");
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    className="pd-action-btn pd-action-btn--danger"
                    onClick={() => {
                      setCancelling(true);
                      setRescheduling(false);
                      setCancelError("");
                    }}
                  >
                    Cancel Appointment
                  </button>
                </div>
              )}

            {cancelling && (
              <div className="pd-action-form">
                <h3>Cancel Appointment</h3>
                <p>Are you sure you want to cancel appointment {getAppointmentNumber(selectedAppointment)}?</p>
                {cancelError && <p className="pd-error-text">{cancelError}</p>}
                <div className="pd-form-actions">
                  <button
                    type="button"
                    className="pd-btn pd-btn--ghost"
                    onClick={() => setCancelling(false)}
                    disabled={cancelLoading}
                  >
                    No, keep it
                  </button>
                  <button
                    type="button"
                    className="pd-btn pd-btn--danger"
                    onClick={handleCancel}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? "Cancelling..." : "Yes, cancel"}
                  </button>
                </div>
              </div>
            )}

            {rescheduling && (
              <div className="pd-action-form">
                <h3>Reschedule Appointment</h3>
                <div className="pd-form-group">
                  <label htmlFor="reschedule-date">Select new date</label>
                  <input
                    id="reschedule-date"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={rescheduleDate}
                    onChange={(e) => {
                      setRescheduleDate(e.target.value);
                      setRescheduleTime("");
                    }}
                  />
                </div>
                {rescheduleDate && (
                  <div className="pd-form-group">
                    <label>Available slots</label>
                    {rescheduleLoadingSlots ? (
                      <p>Loading slots...</p>
                    ) : rescheduleSlots.length ? (
                      <div className="pd-slot-grid">
                        {rescheduleSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            className={`pd-slot-chip ${rescheduleTime === slot ? 'selected' : ''}`}
                            onClick={() => setRescheduleTime(slot)}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="pd-error-text">No slots available for this date.</p>
                    )}
                  </div>
                )}
                {rescheduleError && <p className="pd-error-text">{rescheduleError}</p>}
                <div className="pd-form-actions">
                  <button
                    type="button"
                    className="pd-btn pd-btn--ghost"
                    onClick={() => setRescheduling(false)}
                    disabled={rescheduleSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="pd-btn pd-btn--primary"
                    onClick={handleReschedule}
                    disabled={rescheduleSaving || !rescheduleDate || !rescheduleTime}
                  >
                    {rescheduleSaving ? "Saving..." : "Confirm Reschedule"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </PatientPageShell>
  );
}

function PatientBookingWizardPage({ patient = null, visits = [], onRefresh }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [viewDoctor, setViewDoctor] = useState(null);
  const [doctorReviewDrafts, setDoctorReviewDrafts] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [reasonForVisit, setReasonForVisit] = useState("");
  const [bookingState, setBookingState] = useState("idle");
  const [bookingError, setBookingError] = useState("");
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const bookingRequestRef = useRef(false);

  useEffect(() => {
    if (!viewDoctor) {
      setDoctorReviewDrafts([]);
      return;
    }
    setDoctorReviewDrafts(readDoctorReviews(viewDoctor).map(normalizeDoctorReview));
  }, [viewDoctor]);

  const parseApiList = (data) => {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.clinics)) return data.clinics;
    if (Array.isArray(data.doctors)) return data.doctors;
    if (Array.isArray(data.departments)) return data.departments;
    if (Array.isArray(data.slots)) return data.slots;
    if (Array.isArray(data.appointments)) return data.appointments;
    if (Array.isArray(data.prescriptions)) return data.prescriptions;
    if (Array.isArray(data.bills)) return data.bills;
    if (Array.isArray(data.notifications)) return data.notifications;
    return [];
  };

  const getDoctorBranchIds = (doctor) => {
    const ids = new Set();
    const directKeys = [
      'branchId',
      'BranchId',
      'clinicId',
      'ClinicId',
      'hospitalId',
      'HospitalId',
      'branch.id',
      'branch.branchId',
      'clinic.id',
      'clinic.clinicId',
    ];
    directKeys.forEach((key) => {
      const value = readFirst(doctor, [key]);
      if (value !== undefined && value !== null && value !== '') ids.add(String(value));
    });

    const arrays = [
      doctor?.branchIds,
      doctor?.BranchIds,
      doctor?.branches,
      doctor?.Branches,
      doctor?.doctorBranches,
      doctor?.DoctorBranches,
    ];
    arrays.flatMap((value) => (Array.isArray(value) ? value : [])).forEach((branch) => {
      if (branch === undefined || branch === null || branch === '') return;
      if (typeof branch === 'object') {
        const branchId = readFirst(branch, ['branchId', 'BranchId', 'id', 'Id', 'clinicId', 'ClinicId']);
        if (branchId !== undefined && branchId !== null && branchId !== '') ids.add(String(branchId));
        return;
      }
      ids.add(String(branch));
    });

    return Array.from(ids);
  };

  const getDoctorBranchNames = (doctor) => {
    const names = new Set();
    const directName = readFirst(doctor, ['branchName', 'BranchName', 'clinicName', 'ClinicName', 'branch.name', 'clinic.name']);
    if (directName) names.add(normalizeComparable(directName));
    [doctor?.branches, doctor?.Branches, doctor?.doctorBranches, doctor?.DoctorBranches]
      .flatMap((value) => (Array.isArray(value) ? value : []))
      .forEach((branch) => {
        const name = typeof branch === 'object'
          ? readFirst(branch, ['branchName', 'BranchName', 'name', 'Name', 'clinicName', 'ClinicName'])
          : '';
        if (name) names.add(normalizeComparable(name));
      });
    return Array.from(names);
  };

  const normalizePatientDoctor = (doctor, { branchId = "", departmentName = "" } = {}) => {
    const normalizedBranchIds = getDoctorBranchIds(doctor);
    const normalizedBranchNames = getDoctorBranchNames(doctor);
    const directBranchId =
      readFirst(doctor, ['branchId', 'BranchId', 'clinicId', 'ClinicId', 'hospitalId', 'HospitalId']) ||
      branchId;
    if (directBranchId && !normalizedBranchIds.includes(String(directBranchId))) {
      normalizedBranchIds.push(String(directBranchId));
    }

    return {
      ...doctor,
      id: readFirst(doctor, ['doctorId', 'DoctorId', 'id', 'Id', 'userId', 'UserId']),
      name: readFirst(doctor, ['doctorName', 'DoctorName', 'name', 'Name', 'fullName', 'FullName']) || 'Doctor',
      specialty:
        readFirst(doctor, ['department', 'Department', 'departmentName', 'DepartmentName', 'specialty', 'Specialty', 'specialization', 'Specialization']) ||
        departmentName,
      department:
        readFirst(doctor, ['department', 'Department', 'departmentName', 'DepartmentName', 'specialty', 'Specialty', 'specialization', 'Specialization']) ||
        departmentName,
      departmentId: readFirst(doctor, ['departmentId', 'DepartmentId', 'specialtyId', 'SpecialtyId', 'department.id']),
      branchId: directBranchId,
      branchIds: normalizedBranchIds,
      branchNames: normalizedBranchNames,
      qualification: readFirst(doctor, ['qualification', 'Qualification']) || '',
      experience: readFirst(doctor, ['experience', 'Experience']) || 0,
      consultationFee: readFirst(doctor, ['consultationFee', 'ConsultationFee', 'fee', 'fees']) || 0,
      availableToday: Boolean(readFirst(doctor, ['availableToday', 'AvailableToday', 'isAvailable', 'IsAvailable'])),
    };
  };

  const getApiHeaders = () => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    const fetchBranches = async () => {
      setLoading(true);
      try {
        const headers = getApiHeaders();
        const branchesUrl = patientApiUrl(PATIENT_API.branches);
        const branchesRes = await fetch(branchesUrl, { headers }).catch(() => null);
        const branchesData = branchesRes?.ok ? await branchesRes.json().catch(() => null) : null;
        const branchList = parseApiList(branchesData);
        setBranches(branchList.map((b) => ({
          ...b,
          id: b.branchId || b.id,
          name: b.branchName || b.name || 'Branch',
          branchName: b.branchName || b.name || 'Branch',
          clinicName: b.clinicName || b.hospitalName || b.clinic?.name || b.hospital?.name || '',
          hospitalName: b.hospitalName || b.clinicName || b.hospital?.name || b.clinic?.name || '',
          address: b.address || '',
          phone: b.phone || '',
        })));
      } catch (err) {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchBranches();
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      if (!selectedBranch) {
        setDepartments([]);
        return;
      }

      const headers = getApiHeaders();
      const branchId = selectedBranch.id || selectedBranch.branchId;
      if (!branchId) {
        setDepartments([]);
        return;
      }

      try {
        setDepartments([]);
        const departmentsUrl = patientApiUrl(PATIENT_API.branchDepartments, { branchId });
        const response = await fetch(departmentsUrl, { headers }).catch(() => null);
        const data = response?.ok ? await response.json().catch(() => null) : null;
        const departmentsList = parseApiList(data);
        // API returns array of strings like ["Neurology"]
        setDepartments(departmentsList.map((dept) => {
          if (typeof dept === 'string') return { id: dept, name: dept };
          return normalizeDepartmentOption(dept, branchId);
        }));
      } catch (err) {
        setDepartments([]);
      }
    };

    fetchDepartments();
  }, [selectedBranch]);

  useEffect(() => {
    const fetchDoctors = async () => {
      if (!selectedBranch || !selectedDepartment) {
        setDoctors([]);
        return;
      }

      const branchId = selectedBranch.id || selectedBranch.branchId;
      const departmentName = selectedDepartment.name || selectedDepartment.departmentName || selectedDepartment.id;
      if (!branchId || !departmentName) {
        setDoctors([]);
        return;
      }

      try {
        setDoctors([]);
        const headers = getApiHeaders();
        const requestUrls = [
          `${patientApiUrl(PATIENT_API.doctors)}?${new URLSearchParams({
            branchId: String(branchId),
            department: String(departmentName),
          }).toString()}`,
          `${patientApiUrl(PATIENT_API.doctors)}?${new URLSearchParams({
            branchId: String(branchId),
            specialization: String(departmentName),
          }).toString()}`,
          `${patientApiUrl(PATIENT_API.doctors)}?${new URLSearchParams({
            branchId: String(branchId),
            departmentName: String(departmentName),
          }).toString()}`,
          patientApiUrl(PATIENT_API.doctors),
        ];
        const responses = await Promise.allSettled(
          requestUrls.map((url) => fetch(url, { headers }))
        );
        const doctorRows = [];
        for (const result of responses) {
          if (result.status !== 'fulfilled' || !result.value?.ok) continue;
          const data = await result.value.json().catch(() => null);
          doctorRows.push(...parseApiList(data));
        }
        const uniqueDoctors = Array.from(
          new Map(
            doctorRows
              .map((doctor) => normalizePatientDoctor(doctor, { branchId, departmentName }))
              .filter((doctor) => doctor.id)
              .map((doctor) => [String(doctor.id), doctor])
          ).values()
        );
        setDoctors(uniqueDoctors);
      } catch (err) {
        setDoctors([]);
      }
    };

    fetchDoctors();
  }, [selectedBranch, selectedDepartment]);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedDoctor || !selectedDate) {
        setSlots([]);
        return;
      }

      const headers = getApiHeaders();
      const doctorId = selectedDoctor.id || selectedDoctor.doctorId;
      if (!doctorId) {
        setSlots([]);
        return;
      }

      try {
        const branchId = selectedBranch?.id || selectedBranch?.branchId;
        const params = new URLSearchParams({ date: selectedDate });
        if (branchId) params.set('branchId', String(branchId));
        const slotsUrl = patientApiUrl(PATIENT_API.doctorSlots, { doctorId });
        const response = await fetch(`${slotsUrl}?${params.toString()}`, { headers }).catch(() => null);
        const data = response?.ok ? await response.json().catch(() => null) : null;
        const selectedBranchId = String(branchId || "");
        const slotList = parseApiList(data).filter((slot) => {
          const slotBranchId = String(
            slot.branchId ||
              slot.BranchId ||
              slot.clinicBranchId ||
              slot.ClinicBranchId ||
              slot.clinicId ||
              slot.ClinicId ||
              ""
          ).trim();
          return !selectedBranchId || slotBranchId === selectedBranchId;
        });
        // The patient portal slot API is the single source of truth and already
        // applies leave, time changes, branch shifts and booked-slot conflicts.
        // API returns {start, end, status} objects.
        setSlots(slotList.map((slot) => ({
          ...slot,
          id: slot.id || slot.slotId || `${doctorId}-${branchId || 'branch'}-${selectedDate}-${slot.start || slot.startTime || slot.time}`,
          doctorId: String(doctorId),
          branchId: String(slot.branchId || slot.BranchId || slot.clinicBranchId || slot.ClinicBranchId || slot.clinicId || slot.ClinicId || branchId || ''),
          date: selectedDate,
          time: slot.start || slot.startTime || slot.time || slot.slotTime || '',
          end: slot.end || slot.endTime || '',
          status: slot.status || 'Available',
        })));
      } catch (err) {
        setSlots([]);
      }
    };

    fetchSlots();
  }, [selectedBranch, selectedDoctor, selectedDate]);

  const branchOptions = useMemo(() => {
    return branches;
  }, [branches]);

  const departmentOptions = useMemo(() => {
    return departments.map((department) => {
      if (typeof department === 'string') return { id: department, name: department };
      return normalizeDepartmentOption(department, selectedBranch?.id);
    });
  }, [departments, selectedBranch]);

  const doctorOptions = useMemo(() => {
    return doctors.map((doctor) => ({
      ...doctor,
      id: doctor.doctorId || doctor.id,
      name: doctor.doctorName || doctor.name || 'Doctor',
      specialty: doctor.department || doctor.departmentName || doctor.specialty || doctor.specialization || selectedDepartment?.name || '',
      branchIds: doctor.branchIds || getDoctorBranchIds(doctor),
      branchNames: doctor.branchNames || getDoctorBranchNames(doctor),
    }));
  }, [doctors, selectedDepartment]);

  const slotOptions = useMemo(() => {
    return slots;
  }, [slots]);

  const filteredDepartments = useMemo(
    () => {
      if (!selectedBranch) return departmentOptions;
      const selectedBranchId = String(selectedBranch.id || selectedBranch.branchId || "");

      return departmentOptions.filter((department) => {
        if (department.branchId && String(department.branchId) === selectedBranchId) return true;
        if (department.clinicId && String(department.clinicId) === selectedBranchId) return true;
        return true;
      });
    },
    [departmentOptions, selectedBranch]
  );

  const filteredDoctors = useMemo(
    () => {
      if (!selectedDepartment) return doctorOptions;
      const selectedDepartmentId = String(selectedDepartment.id || "");
      const selectedDepartmentName = normalizeComparable(selectedDepartment.name || selectedDepartment.departmentName || selectedDepartment.id);
      const selectedBranchId = String(selectedBranch?.id || selectedBranch?.branchId || "");

      return doctorOptions.filter((doctor) => {
        const doctorDepartmentName = normalizeComparable(doctor.departmentName || doctor.department || doctor.specialty);
        const doctorDepartmentId = String(doctor.departmentId || "");

        if (
          doctorDepartmentId &&
          selectedDepartmentId &&
          doctorDepartmentId !== selectedDepartmentId &&
          normalizeComparable(doctorDepartmentId) !== selectedDepartmentName
        )
          return false;
        if (
          doctorDepartmentName &&
          selectedDepartmentName &&
          doctorDepartmentName !== selectedDepartmentName &&
          !doctorDepartmentName.includes(selectedDepartmentName) &&
          !selectedDepartmentName.includes(doctorDepartmentName)
        )
          return false;
        if (selectedBranchId) {
          const doctorBranchIds = doctor.branchIds || getDoctorBranchIds(doctor);
          const doctorBranchNames = doctor.branchNames || getDoctorBranchNames(doctor);
          const selectedBranchName = normalizeComparable(selectedBranch?.name || selectedBranch?.branchName);
          if (doctorBranchIds.length && !doctorBranchIds.includes(selectedBranchId)) return false;
          if (!doctorBranchIds.length && doctorBranchNames.length && selectedBranchName && !doctorBranchNames.includes(selectedBranchName)) return false;
          if (!doctorBranchIds.length && !doctorBranchNames.length && doctor.branchId && String(doctor.branchId) !== selectedBranchId) return false;
          if (!doctorBranchIds.length && !doctorBranchNames.length && doctor.clinicId && String(doctor.clinicId) !== selectedBranchId) return false;
        }
        return true;
      });
    },
    [doctorOptions, selectedDepartment, selectedBranch]
  );

  const filteredSlots = useMemo(
    () => {
      if (!selectedDoctor) return [];
      const selectedDoctorId = String(selectedDoctor.id || selectedDoctor.doctorId || selectedDoctor.userId || "");

      return slotOptions.filter((slot) => {
        const slotStatus = normalizeComparable(slot.status || slot.slotStatus || slot.availabilityStatus);
        if (slotStatus && !['available', 'open', 'free'].includes(slotStatus)) return false;
        if (slot.doctorId && String(slot.doctorId) !== selectedDoctorId) return false;
        if (selectedDate && slot.date && slot.date !== selectedDate) return false;
        const selectedBranchId = String(selectedBranch?.id || selectedBranch?.branchId || "");
        if (selectedBranchId && slot.branchId && String(slot.branchId) !== selectedBranchId) return false;
        if (selectedDate && isSlotHiddenByCurrentTime(slot, selectedDate)) return false;
        return true;
      });
    },
    [slotOptions, selectedBranch, selectedDoctor, selectedDate]
  );

  const availableTimes = useMemo(
    () =>
      selectedDate
        ? Array.from(
            new Set(
              filteredSlots
                .filter((slot) => !isSlotHiddenByCurrentTime(slot, selectedDate))
                .map((slot) => formatSlotTime(slot.time || slot.slot))
                .filter(Boolean)
            )
          )
        : [],
    [filteredSlots, selectedDate]
  );

  const stepItems = ['Branch', 'Department', 'Doctor', 'Date & time', 'Confirm'];
  const canConfirm =
    selectedBranch &&
    selectedDoctor &&
    selectedDate &&
    selectedTime &&
    reasonForVisit.trim();
  const canContinue =
    (step === 1 && selectedBranch) ||
    (step === 2 && selectedDepartment) ||
    (step === 3 && selectedDoctor) ||
    (step === 4 && selectedDate && selectedTime);

  const handleDoctorReviewChange = (reviewId, field, value) => {
    setDoctorReviewDrafts((current) =>
      current.map((review) => (review.id === reviewId ? { ...review, [field]: value } : review))
    );
  };

  const handleAddDoctorReview = () => {
    setDoctorReviewDrafts((current) => [
      ...current,
      normalizeDoctorReview({
        patientName: "Patient",
        rating: "5",
        comment: "",
      }),
    ]);
  };

  const handleDeleteDoctorReview = (reviewId) => {
    setDoctorReviewDrafts((current) => current.filter((review) => review.id !== reviewId));
  };

  const handleSaveDoctorReviews = () => {
    if (!viewDoctor) return;
    const doctorKey = readDoctorReviewKey(viewDoctor);
    const nextReviews = doctorReviewDrafts.map(normalizeDoctorReview);
    try {
      const saved = JSON.parse(localStorage.getItem(DOCTOR_REVIEWS_STORAGE_KEY) || "{}");
      localStorage.setItem(DOCTOR_REVIEWS_STORAGE_KEY, JSON.stringify({ ...saved, [doctorKey]: nextReviews }));
    } catch {
      localStorage.setItem(DOCTOR_REVIEWS_STORAGE_KEY, JSON.stringify({ [doctorKey]: nextReviews }));
    }
    setViewDoctor((current) => (current ? { ...current, reviews: nextReviews } : current));
    setDoctors((current) =>
      current.map((doctor) =>
        readDoctorReviewKey(doctor) === doctorKey ? { ...doctor, reviews: nextReviews } : doctor
      )
    );
  };

  const handleNextStep = () => {
    if (!canContinue) return;
    setStep((current) => Math.min(5, current + 1));
  };

  const handleBackStep = () => setStep((current) => Math.max(1, current - 1));

  const consultationFee = Number(
    selectedDoctor?.consultationFee ??
      selectedDoctor?.ConsultationFee ??
      selectedDoctor?.fees ??
      selectedDoctor?.fee ??
      0
  ) || 0;

  const handlePrintBill = (print = true) => {
    const bill = paymentDetails?.bill;
    if (!bill) return;

    const escapeHtml = (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    const amountToWords = (value) => {
      const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
      const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
      const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
      const convertHundred = (num) => {
        let result = "";
        if (num >= 100) {
          result += `${ones[Math.floor(num / 100)]} Hundred`;
          num %= 100;
          if (num) result += " ";
        }
        if (num >= 20) {
          result += tens[Math.floor(num / 10)];
          if (num % 10) result += ` ${ones[num % 10]}`;
        } else if (num >= 10) {
          result += teens[num - 10];
        } else if (num > 0) {
          result += ones[num];
        }
        return result;
      };
      let integer = Math.floor(Math.abs(value));
      if (!integer) return "INR ZERO ONLY";
      const segments = [
        { value: 10000000, label: "Crore" },
        { value: 100000, label: "Lakh" },
        { value: 1000, label: "Thousand" },
        { value: 100, label: "Hundred" },
      ];
      let words = "";
      for (const segment of segments) {
        const part = Math.floor(integer / segment.value);
        if (part) {
          words += `${convertHundred(part)} ${segment.label} `;
          integer %= segment.value;
        }
      }
      if (integer) {
        words += `${convertHundred(integer)} `;
      }
      return `INR ${words.trim().toUpperCase()} ONLY`;
    };
    const invoiceNumber = readFirst(bill, ["invoiceNumber", "billNumber", "referenceNumber", "id"]) || `BILL-${paymentDetails.appointmentId}`;
    const patientName = readFirst(bill, ["patientName", "patient.name"]) || patient?.name || "Patient";
    const doctorName = readFirst(bill, ["doctorName", "doctor.name"]) || selectedDoctor?.name || "Doctor";
    const amount = Number(readFirst(bill, ["totalAmount", "grandTotal", "amount", "paidAmount"]) || paymentDetails.amount || 0);
    const clinicName = readFirst(bill, ["clinicName", "branchName", "clinic.name", "branch.name"]) || selectedBranch?.name || "CMS Health Care";
    const clinicId = readFirst(bill, ["clinicId", "hospitalId", "clinic.id", "hospital.id"]) || selectedBranch?.clinicId || selectedBranch?.hospitalId || "";
    const branding = getClinicInvoiceBranding({ clinicId, clinicName });
    const watermarkUrl = branding.watermarkUrl;
    const logoUrl = branding.logoUrl;
    const headerTitle = branding.headerTitle || clinicName;
    const headerSubtitle = branding.headerSubtitle;
    const footerNote = branding.footerNote;
    const accentColor = branding.accentColor || "#0f4d3a";
    const patientPhone = readFirst(patient || {}, ["phone", "phoneNumber", "mobile"]) || "-";
    const patientCode = readFirst(patient || {}, ["patientCode", "code", "id"]) || "-";
    const appointmentToken = readFirst(bill, ["tokenNumber", "appointment.tokenNumber"]) || createNextPatientToken(visits);
    const billDate = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) return;

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <title>Consultation Bill ${escapeHtml(invoiceNumber)}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#eef1f5;color:#1f2937;font-family:Arial,sans-serif;font-size:11px}
    .invoice{width:780px;max-width:100%;margin:14px auto;background:#fff;border:1px solid #cbd5db;padding:16px;position:relative;overflow:hidden}
    .invoice>*:not(.watermark){position:relative;z-index:1}
    .watermark{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;z-index:0}
    .watermark img{width:410px;height:410px;object-fit:contain;opacity:.18;filter:saturate(1.35) contrast(1.08)}
    .header{display:grid;grid-template-columns:1.6fr 1fr;gap:16px;align-items:start;border-bottom:1px solid #cbd5db;padding-bottom:16px}
    .clinic-title{display:flex;align-items:center;gap:12px;margin-bottom:6px}
    .clinic-title img{width:54px;height:54px;object-fit:contain;border-radius:12px}
    .header-left h1{margin:0 0 6px;font-size:20px;letter-spacing:1px;color:${escapeHtml(accentColor)}}
    .header-left p{margin:4px 0;font-size:12px;color:#334155}
    .header-left .clinic-address{margin-top:8px;font-size:12px;color:${escapeHtml(accentColor)};font-weight:700}
    .header-right{border:1px solid #cbd5db;padding:14px;background:#f8fafb}
    .header-right div{display:flex;justify-content:space-between;padding:6px 0;font-size:12px}
    .header-right div:not(:last-child){border-bottom:1px solid #e2e8f0}
    .header-right b{color:#334155}
    .header-right span{font-weight:700;color:#102331}
    .header-right .status span{color:#047857}
    .title{margin:18px 0 12px;text-align:center;font-size:16px;letter-spacing:1px;font-weight:700;color:${escapeHtml(accentColor)}}
    .info-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
    .info-box{border:1px solid #cbd5db;border-radius:10px;background:#f8fafb;padding:14px}
    .info-item{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:12px}
    .info-item:last-child{border-bottom:0}
    .info-label{color:#334155}
    .info-value{font-weight:700}
    .service{width:100%;border-collapse:collapse;border:1px solid #cbd5db}
    .service th,.service td{border:1px solid #cbd5db;padding:10px;text-align:left;font-size:12px}
    .service th{background:#f8fafb;font-size:11px}
    .service .num{text-align:right}
    .summary-section{display:grid;grid-template-columns:1.1fr .9fr;gap:14px;margin-top:18px}
    .amount-words{border:1px solid #cbd5db;border-radius:10px;background:#f8fafb;padding:14px;font-size:12px;line-height:1.6}
    .amount-words b{font-weight:700}
    .total-box{border:1px solid #cbd5db;border-radius:10px;padding:14px;background:#fff}
    .total-row{display:flex;justify-content:space-between;padding:8px 0;font-size:12px;border-bottom:1px solid #e2e8f0}
    .total-row:last-child{border-bottom:0;font-weight:700;color:${escapeHtml(accentColor)}}
    .total-row.total span:first-child{color:${escapeHtml(accentColor)}}
    .bottom{display:grid;grid-template-columns:1.5fr .85fr 1fr;gap:16px;margin-top:18px;align-items:start}
    .notes{border:1px solid #cbd5db;border-radius:10px;background:#f8fafb;padding:14px;font-size:11px;line-height:1.6}
    .token-group{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .token-box{border:1px solid #cbd5db;border-radius:50%;padding:18px;text-align:center;background:#fff}
    .token-box span{display:block;color:#334155;font-size:11px;margin-bottom:8px}
    .token-box strong{display:block;font-size:24px;color:${escapeHtml(accentColor)}}
    .signature{border:1px solid #cbd5db;border-radius:10px;padding:14px;text-align:center;background:#fff}
    .signature .line{height:1px;background:#334155;margin:0 auto 10px;width:70px}
    .signature span{display:block;font-size:12px;font-weight:700}
    .signature em{display:block;font-size:11px;color:#334155;margin-top:4px}
    .footer{margin-top:16px;text-align:center;font-size:11px;color:#334155}
    .footer strong{display:block;margin-top:6px;color:${escapeHtml(accentColor)}}
    @media print{body{background:#fff}.invoice{margin:0;border-color:#333}}@page{size:A4;margin:10mm}
  </style>
</head>
<body>
<main class="invoice">
  <div class="watermark"><img src="${escapeHtml(watermarkUrl)}" alt="" /></div>
  <div class="header">
    <div class="header-left">
      <div class="clinic-title">
        <img src="${escapeHtml(logoUrl)}" alt="Clinic logo" />
        <h1>${escapeHtml(headerTitle).toUpperCase()}</h1>
      </div>
      <p>${escapeHtml(headerSubtitle)}</p>
      <p class="clinic-address">Hyderabad, Telangana, India - 500063</p>
      <p>${escapeHtml(patientPhone)}</p>
    </div>
    <div class="header-right">
      <div><b>Bill No</b><span>${escapeHtml(invoiceNumber)}</span></div>
      <div><b>Bill Date</b><span>${escapeHtml(billDate)}</span></div>
      <div><b>Appointment</b><span>${escapeHtml(paymentDetails.appointmentId)}</span></div>
      <div><b>Payment Mode</b><span>${escapeHtml(paymentDetails.paymentMode)}</span></div>
      <div class="status"><b>Status</b><span>PAID</span></div>
    </div>
  </div>
  <div class="title">CONSULTATION FEE INVOICE (UPI)</div>
  <div class="info-row">
    <div class="info-box">
      <div class="info-item"><span class="info-label">Patient Name</span><span class="info-value">${escapeHtml(patientName)}</span></div>
      <div class="info-item"><span class="info-label">Patient ID</span><span class="info-value">${escapeHtml(patientCode)}</span></div>
      <div class="info-item"><span class="info-label">Mobile No.</span><span class="info-value">${escapeHtml(patientPhone)}</span></div>
    </div>
    <div class="info-box">
      <div class="info-item"><span class="info-label">Doctor</span><span class="info-value">Dr. ${escapeHtml(doctorName)}</span></div>
      <div class="info-item"><span class="info-label">Appointment</span><span class="info-value">${escapeHtml(paymentDetails.appointmentId)}</span></div>
      <div class="info-item"><span class="info-label">Token No.</span><span class="info-value">${escapeHtml(appointmentToken)}</span></div>
    </div>
  </div>
  <table class="service">
    <thead>
      <tr>
        <th>S.No.</th>
        <th>Service / Item</th>
        <th class="num">Qty</th>
        <th class="num">Rate (₹)</th>
        <th class="num">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>Consultation Charges (Dr. ${escapeHtml(doctorName)})</td>
        <td class="num">1</td>
        <td class="num">${escapeHtml(amount.toFixed(2))}</td>
        <td class="num">${escapeHtml(amount.toFixed(2))}</td>
      </tr>
    </tbody>
  </table>
  <div class="summary-section">
    <div class="amount-words"><b>Amount In Words</b><br/>${escapeHtml(amountToWords(amount))}</div>
    <div class="total-box">
      <div class="total-row"><span>Gross Amount</span><span class="num">&#8377; ${escapeHtml(amount.toFixed(2))}</span></div>
      <div class="total-row"><span>Discount</span><span class="num">&#8377; 0.00</span></div>
      <div class="total-row"><span>Net Amount</span><span class="num">&#8377; ${escapeHtml(amount.toFixed(2))}</span></div>
      <div class="total-row"><span>Round Off</span><span class="num">&#8377; 0.00</span></div>
      <div class="total-row total"><span>Total Amount Payable</span><span class="num">&#8377; ${escapeHtml(amount.toFixed(2))}</span></div>
    </div>
  </div>
  <div class="bottom">
    <div class="notes">
      <p>• Consultation charges only. Additional tests or medicines, if any, are billed separately.</p>
      <p>• Please retain this bill for your records.</p>
    <p>• ${escapeHtml(footerNote)}</p>
    </div>
    <div class="token-group">
      <div class="token-box"><span>OP. No.</span><strong>${escapeHtml(paymentDetails.appointmentId)}</strong></div>
      <div class="token-box"><span>Token No.</span><strong>${escapeHtml(appointmentToken)}</strong></div>
    </div>
    <div class="signature">
      <div class="line"></div>
      <span>Authorised Signature</span>
      <em>(Dr. ${escapeHtml(doctorName)})</em>
    </div>
  </div>
  <div class="footer">
    For any queries or support, contact: ${escapeHtml(patientPhone)}
    <strong>*** COMPUTERISED INVOICE ***</strong>
    Thank you for your visit. Stay healthy!
  </div>
</main>
${print ? '<script>window.onload=()=>window.print()</script>' : ''}
</body>
</html>`);
    printWindow.document.close();
  };

  const handleConfirmBooking = async () => {
    if (bookingRequestRef.current) return;

    const conflict = findPatientBookingConflict(visits, selectedDate, selectedTime);
    if (conflict) {
      const message = "You already have an active appointment. Please complete or cancel the current appointment before booking another one.";
      setBookingError(message);
      setBookingState("error");
      return;
    }

    bookingRequestRef.current = true;
    setBookingState('payment');
    setBookingError('');
    try {
      const branchId = selectedBranch?.branchId || selectedBranch?.id;
      const doctorId = selectedDoctor?.doctorId || selectedDoctor?.id;
      const patientId =
        readFirst(patient || {}, ["id", "Id", "patientId", "PatientId", "patientCode", "PatientCode"]) ||
        localStorage.getItem("patientId") ||
        localStorage.getItem("PatientId") ||
        "";
      const patientName =
        readFirst(patient || {}, ["name", "patientName", "fullName", "displayName"]) ||
        localStorage.getItem("patientName") ||
        "";
      const patientPhone = readFirst(patient || {}, [
        "phone",
        "Phone",
        "phoneNumber",
        "PhoneNumber",
        "mobile",
        "Mobile",
        "mobileNumber",
        "MobileNumber",
      ]);
      const duplicateAppointments = [...visits];
      const headers = getApiHeaders();
      const allAppointmentsResponse = await fetch(apiUrl("Appointment"), { headers }).catch(() => null);
      if (allAppointmentsResponse?.ok) {
        const allAppointmentsData = await allAppointmentsResponse.json().catch(() => []);
        duplicateAppointments.push(...parseApiList(allAppointmentsData));
      }

      if (
        hasDuplicateAppointmentForPatientDoctorDate(duplicateAppointments, {
          patientId,
          patientName,
          phone: patientPhone,
          doctorId,
          doctorName: selectedDoctor?.doctorName || selectedDoctor?.name,
          date: selectedDate,
        })
      ) {
        throw new Error(DUPLICATE_APPOINTMENT_MESSAGE);
      }

      const payload = {
        branchId: readNumericId(branchId),
        doctorId: readNumericId(doctorId),
        tokenNumber: createNextPatientToken(duplicateAppointments),
        date: formatAppointmentDateTime(selectedDate),
        startTime: formatSlotTime(selectedTime),
        reasonForVisit: reasonForVisit.trim(),
        patientName,
        phone: patientPhone,
        patientPhone,
      };
      const appointmentUrl = patientApiUrl(PATIENT_API.appointments);
      const response = await fetch(appointmentUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to book appointment.');
        throw new Error(errorText || 'Unable to book appointment.');
      }
      const appointmentData = await response.json().catch(() => ({}));
      const appointmentId =
        getResponseId(appointmentData, ["appointmentId", "AppointmentId", "id", "Id"]) ||
        getResponseId(appointmentData?.appointment, ["appointmentId", "AppointmentId", "id", "Id"]);
      if (!appointmentId) {
        throw new Error("Appointment created, but appointment ID was not returned for payment.");
      }

      const paymentPayload = {
        appointmentId: readNumericId(appointmentId),
        patientId: readNumericId(patientId),
        doctorId: readNumericId(doctorId),
        branchId: readNumericId(branchId),
        date: formatAppointmentDateTime(selectedDate),
        startTime: formatSlotTime(selectedTime),
        amount: consultationFee,
        paymentMode,
      };
      const paymentResponse = await fetch(apiUrl("payment/create"), {
        method: "POST",
        headers,
        body: JSON.stringify(paymentPayload),
      });
      const paymentData = await paymentResponse.json().catch(() => ({}));
      if (!paymentResponse.ok) {
        throw new Error(paymentData.message || paymentData.title || "Unable to create consultation payment.");
      }

      const paymentId = getResponseId(paymentData, ["paymentId", "PaymentId", "id", "Id"]);
      const transactionId =
        getResponseId(paymentData, ["transactionId", "TransactionId"]) ||
        `PAT-${Date.now()}`;

      const successResponse = await fetch(apiUrl("payment/success"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          paymentId: readNumericId(paymentId),
          transactionId,
        }),
      });
      const successData = await successResponse.json().catch(() => ({}));
      if (!successResponse.ok) {
        throw new Error(successData.message || successData.title || "Payment could not be confirmed.");
      }

      const billPayload = {
        appointmentId: readNumericId(appointmentId),
        consultationCharge: consultationFee,
        totalAmount: consultationFee,
        grandTotal: consultationFee,
        payableAmount: consultationFee,
        paymentAmount: consultationFee,
        paidAmount: consultationFee,
        paymentMode,
        paymentStatus: "Paid",
      };
      // Patients do not have permission to create bills through the staff-only
      // Billing endpoint. Payment confirmation creates the bill server-side;
      // retrieve it through the existing patient bills endpoint when available.
      const patientBills = await fetchAllPatientPortalBillingRows({ headers }).catch(() => []);
      const billData = patientBills.find((bill) => String(readFirst(bill, ["appointmentId", "appointment.id", "appointmentNumber"]) || "") === String(appointmentId)) || successData?.bill || successData?.invoice || paymentData?.bill || paymentData?.invoice || {};
      const generatedBill = {
        ...(Array.isArray(billData) ? billData[0] : billData),
        ...billPayload,
        patientId: readNumericId(patientId),
        PatientId: readNumericId(patientId),
        patientCode: patientId,
        PatientCode: patientId,
        patientName,
        PatientName: patientName,
        patient: {
          id: readNumericId(patientId),
          patientId: readNumericId(patientId),
          patientCode: patientId,
          name: patientName,
        },
        doctorId: readNumericId(doctorId),
        doctorName: selectedDoctor?.doctorName || selectedDoctor?.name,
        branchId: readNumericId(branchId),
        BranchId: readNumericId(branchId),
        branchName: selectedBranch?.branchName || selectedBranch?.name || "",
        clinicName: selectedBranch?.clinicName || selectedBranch?.hospitalName || "",
        appointmentId: readNumericId(appointmentId),
        AppointmentId: readNumericId(appointmentId),
        appointmentNumber: appointmentId,
        invoiceNo: readFirst(billData, ["invoiceNo", "invoiceNumber", "billNumber"]) || `OP-${appointmentId}`,
        invoiceNumber: readFirst(billData, ["invoiceNumber", "invoiceNo", "billNumber"]) || `OP-${appointmentId}`,
        billNumber: readFirst(billData, ["billNumber", "invoiceNumber", "invoiceNo"]) || `OP-${appointmentId}`,
        invoiceType: "op",
        InvoiceType: "op",
        billingType: "OP",
        BillingType: "OP",
        serviceType: "Patient Portal OP Billing",
        ServiceType: "Patient Portal OP Billing",
        source: "patient-portal",
        billingSource: "patient-portal",
        bookingSource: "online",
        paymentSource: "patient-portal",
        revenue: consultationFee,
        status: "Paid",
        createdAt: new Date().toISOString(),
        billDate: new Date().toISOString(),
        invoiceDate: new Date().toISOString(),
      };
      storePatientPortalOpBill(generatedBill);

      setPaymentDetails({
        appointmentId,
        paymentId,
        transactionId,
        amount: consultationFee,
        paymentMode,
        bill: generatedBill,
      });
      setBookingState('success');
      setStep(5);
      if (onRefresh) await onRefresh();
    } catch (error) {
      setBookingState('error');
      setBookingError(error.message || 'Could not complete booking.');
    } finally {
      bookingRequestRef.current = false;
    }
  };

  return (
    <PatientPageShell
      title="Book appointment"
      subtitle="Follow the steps to reserve your slot."
      action={
        <button type="button" className="pd-header-btn pd-header-btn--primary" onClick={() => navigate('/patient/dashboard')}>
          <Calendar size={16} />
          Back to dashboard
        </button>
      }
    >
      <div className="booking-page">
        <div className="booking-stepper">
          {stepItems.map((label, index) => {
            const stepNumber = index + 1;
            return (
              <button
                key={label}
                type="button"
                className={`booking-step ${stepNumber === step ? 'active' : ''} ${stepNumber < step ? 'completed' : ''}`}
                onClick={() => setStep(stepNumber)}
              >
                <span>{stepNumber}</span>
                {label}
              </button>
            );
          })}
        </div>

        <div className="booking-content">
          {step === 1 && (
            <section className="booking-panel">
              <div className="booking-panel-header">
                <h2>Branch</h2>
                <p>Choose the branch location for your appointment.</p>
              </div>
              <div className="booking-grid">
                {branchOptions.length ? (
                  branchOptions.map((branch) => (
                    <button
                      key={branch.id || branch.name}
                      type="button"
                      className={`booking-card ${selectedBranch?.id === branch.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedBranch(branch);
                        setSelectedDepartment(null);
                        setSelectedDoctor(null);
                        setSelectedDate('');
                        setSelectedTime('');
                      }}
                    >
                      <strong>{branch.name}</strong>
                      <span>{branch.address || 'Location details unavailable'}</span>
                    </button>
                  ))
                ) : (
                  <p className="booking-empty">No branches found yet.</p>
                )}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="booking-panel">
              <div className="booking-panel-header">
                <h2>Department</h2>
                <p>Select the care specialty you need.</p>
              </div>
              <div className="booking-grid">
                {filteredDepartments.length ? (
                  filteredDepartments.map((department) => {
                    const { tone, Icon, label } = getDepartmentVisual(department.name);
                    return (
                      <button
                        key={department.id || department.name}
                        type="button"
                        className={`booking-card booking-card--department booking-card--${tone} ${selectedDepartment?.id === department.id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedDepartment(department);
                          setSelectedDoctor(null);
                          setSelectedDate('');
                          setSelectedTime('');
                        }}
                      >
                        <span className="booking-department-icon" aria-hidden="true">
                          <Icon size={24} strokeWidth={2.4} />
                        </span>
                        <span className="booking-department-copy">
                          <strong>{department.name}</strong>
                          <small>{label}</small>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="booking-empty">No departments available.</p>
                )}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="booking-panel">
              <div className="booking-panel-header">
                <h2>Doctor</h2>
                <p>Pick the doctor that best matches your selected specialty.</p>
              </div>
              <div className="booking-grid">
                {filteredDoctors.length ? (
                  filteredDoctors.map((doctor) => {
                    const specialty = doctor.specialty || doctor.specialization || "General consultation";
                    const expertise = readDoctorExpertise(doctor);
                    return (
                      <div
                        key={doctor.id || doctor.name}
                        role="button"
                        tabIndex={0}
                        className={`booking-card ${selectedDoctor?.id === doctor.id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedDoctor(doctor);
                          setSelectedDate('');
                          setSelectedTime('');
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedDoctor(doctor);
                            setSelectedDate('');
                            setSelectedTime('');
                          }
                        }}
                      >
                        <span className="booking-doctor-card-head">
                          <span>
                            <strong>{doctor.name}</strong>
                            <small>{specialty}</small>
                          </span>
                          <button
                            type="button"
                            className="booking-doctor-view"
                            title={`View Dr. ${doctor.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setViewDoctor(doctor);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                setViewDoctor(doctor);
                              }
                            }}
                          >
                            <Eye size={18} />
                          </button>
                        </span>
                        {!isSameDoctorText(expertise, specialty) ? <span>{expertise}</span> : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="booking-empty">No doctors available for this department.</p>
                )}
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="booking-panel booking-schedule-panel">
              <div className="booking-panel-header">
                <h2>Date & time</h2>
                <p>Choose a date and time slot for your appointment.</p>
              </div>
              <div className="booking-field-group">
                <label htmlFor="appointment-date">Appointment date</label>
                <input
                  id="appointment-date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSelectedTime('');
                  }}
                />
              </div>
              <div className="booking-slot-list">
                {availableTimes.length ? (
                  availableTimes.map((time) => (
                    <button
                      key={time}
                      type="button"
                      className={`booking-slot ${selectedTime === time ? 'selected' : ''}`}
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </button>
                  ))
                ) : (
                  <p className="booking-empty">Select a date to display available time slots.</p>
                )}
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="booking-panel booking-summary-panel">
              <div className="booking-panel-header">
                <h2>Confirm</h2>
                <p>Review your  branch, department, doctor, and schedule.</p>
              </div>
              <div className="booking-summary">
                
                <div className="booking-summary-row">
                  <span>Branch</span>
                  <strong>{selectedBranch?.name || 'Not selected'}</strong>
                </div>
                <div className="booking-summary-row">
                  <span>Department</span>
                  <strong>{selectedDepartment?.name || 'Not selected'}</strong>
                </div>
                <div className="booking-summary-row">
                  <span>Doctor</span>
                  <strong>{selectedDoctor?.name || 'Not selected'}</strong>
                </div>
                <div className="booking-summary-row">
                  <span>Date</span>
                  <strong>{selectedDate || 'Not selected'}</strong>
                </div>
                <div className="booking-summary-row">
                  <span>Time</span>
                  <strong>{selectedTime || 'Not selected'}</strong>
                </div>
                <div className="booking-summary-row">
                  <span>Consultation Fee</span>
                  <strong>{formatIndianCurrency(consultationFee)}</strong>
                </div>
              </div>
              <div className="booking-field-group">
                <label htmlFor="reason-for-visit">Reason for visit</label>
                <textarea
                  id="reason-for-visit"
                  rows={4}
                  value={reasonForVisit}
                  onChange={(event) => setReasonForVisit(event.target.value)}
                  placeholder="Fever, follow-up consultation, knee pain..."
                />
              </div>
              <div className="booking-payment-panel">
                <div>
                  <strong>Payment</strong>
                  <span>Pay only the doctor consultation fee to confirm this appointment.</span>
                </div>
                <label>
                  <span>Payment Mode</span>
                  <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                  </select>
                </label>
              </div>
              {bookingError ? <p className="booking-error">{bookingError}</p> : null}
              {bookingState === 'success' && (
                <div className="booking-success">
                  <p>Payment completed and consultation bill generated{paymentDetails?.transactionId ? ` - ${paymentDetails.transactionId}` : ""}.</p>
                  <div className="booking-success-actions">
                    <button type="button" className="booking-button booking-button--ghost" onClick={() => handlePrintBill(false)}>View Bill</button>
                    <button type="button" className="booking-button booking-button--secondary" onClick={handlePrintBill}>Print Bill</button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {viewDoctor ? (
          <div className="booking-doctor-modal-backdrop" role="presentation" onClick={() => setViewDoctor(null)}>
            <section className="booking-doctor-modal" role="dialog" aria-modal="true" aria-label={`Dr. ${viewDoctor.name} profile`} onClick={(event) => event.stopPropagation()}>
              <div className="booking-doctor-modal-header">
                <div className="booking-doctor-profile-title">
                  <span className="booking-doctor-avatar">{getInitials(viewDoctor.name)}</span>
                  <div>
                    <h2>Dr. {viewDoctor.name}</h2>
                    <p>{viewDoctor.specialty || "General consultation"}</p>
                  </div>
                </div>
                <button type="button" className="booking-doctor-modal-close" onClick={() => setViewDoctor(null)} aria-label="Close doctor profile">
                  <X size={18} />
                </button>
              </div>

              <div className="booking-doctor-profile-grid">
                <div>
                  <span>Specialization</span>
                  <strong>{viewDoctor.specialty || "General consultation"}</strong>
                </div>
                <div>
                  <span>Area of Expertise</span>
                  <strong>{readDoctorExpertise(viewDoctor)}</strong>
                </div>
                <div>
                  <span>Experience</span>
                  <strong>{readDoctorExperience(viewDoctor)}</strong>
                </div>
                <div>
                  <span>Consultation Fee</span>
                  <strong>{formatIndianCurrency(Number(viewDoctor.consultationFee || 0))}</strong>
                </div>
              </div>

              <div className="booking-doctor-profile-section">
                <h3>Doctor Summary</h3>
                <p>{readDoctorSummary(viewDoctor)}</p>
              </div>

              <div className="booking-doctor-profile-section">
                <div className="booking-doctor-review-heading">
                  <h3>Reviews</h3>
                  <button type="button" className="booking-doctor-review-add" onClick={handleAddDoctorReview}>
                    Add Review
                  </button>
                </div>
                <div className="booking-doctor-review-list">
                  {doctorReviewDrafts.map((review) => {
                    return (
                      <article className="booking-doctor-review booking-doctor-review--editable" key={review.id}>
                        <div>
                          <input
                            type="text"
                            value={review.patientName}
                            onChange={(event) => handleDoctorReviewChange(review.id, "patientName", event.target.value)}
                            aria-label="Reviewer name"
                          />
                          <span>
                            <Star size={14} fill="currentColor" />
                            <input
                              type="number"
                              min="1"
                              max="5"
                              step="0.1"
                              value={review.rating}
                              onChange={(event) => handleDoctorReviewChange(review.id, "rating", event.target.value)}
                              aria-label="Review rating"
                            />
                          </span>
                          <button
                            type="button"
                            className="booking-doctor-review-delete"
                            onClick={() => handleDeleteDoctorReview(review.id)}
                            aria-label="Delete review"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={review.comment}
                          onChange={(event) => handleDoctorReviewChange(review.id, "comment", event.target.value)}
                          placeholder="Enter review"
                          aria-label="Review comment"
                        />
                      </article>
                    );
                  })}
                  {!doctorReviewDrafts.length ? <p className="booking-empty">No reviews added.</p> : null}
                </div>
                <button type="button" className="booking-doctor-review-save" onClick={handleSaveDoctorReviews}>
                  Save Reviews
                </button>
              </div>

              <div className="booking-doctor-profile-actions">
                <button
                  type="button"
                  className="booking-button booking-button--ghost"
                  onClick={() => setViewDoctor(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="booking-button booking-button--primary"
                  onClick={() => {
                    setSelectedDoctor(viewDoctor);
                    setSelectedDate("");
                    setSelectedTime("");
                    setViewDoctor(null);
                  }}
                >
                  Select Doctor
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <div className="booking-footer">
          <button type="button" className="booking-button booking-button--ghost" onClick={() => navigate('/patient/dashboard')}>
            Cancel
          </button>
          {step < 5 ? (
            <button
              type="button"
              className="booking-button booking-button--primary"
              onClick={handleNextStep}
              disabled={!canContinue}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="booking-button booking-button--primary"
              onClick={handleConfirmBooking}
              disabled={bookingState === 'payment' || bookingState === 'success' || !canConfirm}
            >
              {bookingState === 'payment' ? 'Processing payment...' : bookingState === 'success' ? 'Payment Complete' : 'Pay Now'}
            </button>
          )}
          {step > 1 ? (
            <button type="button" className="booking-button booking-button--secondary" onClick={handleBackStep}>
              Back
            </button>
          ) : null}
        </div>
      </div>
    </PatientPageShell>
  );
}

function PatientMedicalHistoryPage({ patient, visits = [], prescriptions = [] }) {
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const [patientLabReports, setPatientLabReports] = useState([]);

  const patientId = String(
    patient?.id ||
    patient?.Id ||
    patient?.patientId ||
    patient?.PatientId ||
    patient?.patientCode ||
    patient?.PatientCode ||
    localStorage.getItem("patientId") ||
    localStorage.getItem("PatientId") ||
    localStorage.getItem("patientCode") ||
    ""
  ).trim();

  useEffect(() => {
    if (!patientId) {
      setHistory(null);
      setHistoryError("Patient ID is required to load medical history.");
      return undefined;
    }

    let isCurrent = true;
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const fetchHistory = async () => {
      setLoadingHistory(true);
      setHistoryError("");
      try {
        let historyData = null;
        let hadServerError = false;
        const response = await fetch(patientApiUrl(PATIENT_API.medicalHistory), { headers, cache: "no-store" }).catch(() => null);
        if (response?.ok) {
          const data = await response.json().catch(() => null);
          const records = normalizeHistoryRecords(data).filter(belongsToCurrentPatient);
          historyData = records.length ? records : null;
        } else if (response?.status >= 500 || response?.status === 403) {
          hadServerError = true;
        }

        const labResponse = await fetch(apiUrl("Lab/patient/reports"), { headers, cache: "no-store" }).catch(() => null);
        const labReportsData = labResponse?.ok ? await labResponse.json().catch(() => null) : null;
        const labReports = normalizeLabPatientReports(labReportsData).filter(belongsToCurrentPatient);

        if (isCurrent) {
          setHistory(historyData);
          setPatientLabReports(labReports);
          setHistoryError(historyData || labReports.length || !hadServerError ? "" : "Unable to load medical history.");
        }
      } catch (error) {
        if (isCurrent) {
          setPatientLabReports([]);
          setHistoryError(error.message || 'Unable to load medical history.');
        }
      } finally {
        if (isCurrent) setLoadingHistory(false);
      }
    };

    fetchHistory();

    const refreshTimer = window.setInterval(fetchHistory, 30000);
    return () => {
      isCurrent = false;
      window.clearInterval(refreshTimer);
    };
  }, [patient, patientId, visits]);

  const normalizeList = (value) => {
    if (!value && value !== 0) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return String(value)
      .split(/,|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const normalizeRecords = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (Array.isArray(value?.data)) return value.data.filter(Boolean);
    if (Array.isArray(value?.items)) return value.items.filter(Boolean);
    return [];
  };

  const normalizeLabPatientReports = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value || typeof value !== "object") return [];

    const directReports = [
      ...normalizeRecords(value),
      ...normalizeRecords(value.reports),
      ...normalizeRecords(value.Reports),
      ...normalizeRecords(value.labReports),
      ...normalizeRecords(value.LabReports),
      ...normalizeRecords(value.data?.reports),
      ...normalizeRecords(value.data?.Reports),
      ...normalizeRecords(value.data?.labReports),
      ...normalizeRecords(value.data?.LabReports),
      ...normalizeRecords(value.result?.reports),
      ...normalizeRecords(value.result?.Reports),
      ...normalizeRecords(value.result?.labReports),
      ...normalizeRecords(value.result?.LabReports),
    ];

    if (directReports.length) return directReports;

    const candidate =
      value.data && typeof value.data === "object"
        ? value.data
        : value.result && typeof value.result === "object"
          ? value.result
          : value;

    const reportKeys = [
      "reportId",
      "ReportId",
      "reportName",
      "ReportName",
      "reportTitle",
      "ReportTitle",
      "testName",
      "TestName",
      "documentName",
      "DocumentName",
      "documentUrl",
      "DocumentUrl",
      "fileUrl",
      "FileUrl",
      "reportUrl",
      "ReportUrl",
      "downloadUrl",
      "DownloadUrl",
      "url",
      "Url",
      "createdAt",
      "CreatedAt",
      "reportDate",
      "ReportDate",
      "date",
      "Date",
    ];

    const hasReportFields = reportKeys.some(
      (key) => candidate?.[key] != null && String(candidate[key]).trim() !== ""
    );

    return hasReportFields ? [candidate] : [];
  };

  const normalizeHistoryRecords = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value || typeof value !== "object") return [];
    if (Array.isArray(value.data)) return value.data.filter(Boolean);
    if (Array.isArray(value.items)) return value.items.filter(Boolean);
    if (Array.isArray(value.records)) return value.records.filter(Boolean);
    if (Array.isArray(value.medicalHistory)) return value.medicalHistory.filter(Boolean);
    if (Array.isArray(value.history)) return value.history.filter(Boolean);
    if (Array.isArray(value.data?.medicalHistory)) return value.data.medicalHistory.filter(Boolean);
    if (Array.isArray(value.data?.history)) return value.data.history.filter(Boolean);
    if (Array.isArray(value.result?.medicalHistory)) return value.result.medicalHistory.filter(Boolean);
    if (Array.isArray(value.result?.history)) return value.result.history.filter(Boolean);
    const candidate = value.data && typeof value.data === "object" ? value.data : value.result && typeof value.result === "object" ? value.result : value;
    const hasMedicalHistoryFields = [
      "medicalConditions",
      "diagnosedConditions",
      "chronicConditions",
      "chronicDiseases",
      "allergies",
      "allergyList",
      "currentMedications",
      "medications",
      "reports",
      "labReports",
      "prescriptions",
      "visits",
    ].some((key) => candidate?.[key] != null && String(candidate[key]).trim() !== "");
    return hasMedicalHistoryFields ? [candidate] : [];
  };

  const newestFirst = (records, dateReader) =>
    [...records].sort((left, right) => {
      const leftTime = new Date(dateReader(left) || left?.updatedAt || left?.createdAt || 0).getTime();
      const rightTime = new Date(dateReader(right) || right?.updatedAt || right?.createdAt || 0).getTime();
      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    });

  const currentPatientIds = getPatientIdentityValues(patient || {}, visits);
  const currentPatientNames = getPatientNameValues(patient || {}, visits);
  const belongsToCurrentPatient = (record) => {
    const recordPatientId = readFirst(record, [
      "patientId",
      "PatientId",
      "patient.id",
      "patient.Id",
      "patient.patientId",
      "patient.PatientId",
      "patientCode",
      "PatientCode",
      "patient.patientCode",
      "patient.PatientCode",
    ]);
    const normalizedRecordPatientId = normalizeComparable(recordPatientId);
    if (normalizedRecordPatientId) return currentPatientIds.has(normalizedRecordPatientId);

    const firstName = readFirst(record, ["patient.firstName", "patient.FirstName", "firstName", "FirstName"]);
    const lastName = readFirst(record, ["patient.lastName", "patient.LastName", "lastName", "LastName"]);
    const recordNames = [
      readFirst(record, ["patientName", "PatientName", "patient.name", "patient.Name", "patient.fullName", "patient.FullName", "name", "Name"]),
      firstName || lastName ? `${firstName} ${lastName}` : "",
    ].map((value) => normalizeComparable(value)).filter(Boolean);
    if (recordNames.length) return recordNames.some((value) => currentPatientNames.has(value));

    return true;
  };

  const historyRecord = Array.isArray(history) ? history.find(belongsToCurrentPatient) || history[0] || null : history;

  const chronicConditions = normalizeList(
    historyRecord?.chronicConditions ||
    historyRecord?.chronicDiseases
  );
  const allergies = normalizeList(historyRecord?.allergies || historyRecord?.allergyList || historyRecord?.allergy);
  const currentMedications = normalizeList(
    historyRecord?.currentMedications || historyRecord?.medications || historyRecord?.drugs
  );

  const medicalConditions = normalizeList(historyRecord?.medicalConditions || historyRecord?.diagnosedConditions);

  const historyVisits = normalizeRecords(historyRecord?.visits).length
    ? normalizeRecords(historyRecord?.visits)
    : normalizeRecords(historyRecord?.appointments);
  const appointmentVisits = normalizeRecords(visits).filter(belongsToCurrentPatient);

  const prescriptionRecords = (() => {
    const byPrescriptionId = new Map();
    [...normalizeRecords(historyRecord?.prescriptions), ...normalizeRecords(prescriptions).filter(belongsToCurrentPatient)].forEach((prescription, index) => {
      const prescriptionId = readFirst(prescription, ['prescriptionId', 'id', 'prescription.id']);
      const key = prescriptionId || `${readFirst(prescription, ['appointmentId', 'visitId'])}-${readFirst(prescription, ['prescriptionDate', 'date', 'createdAt'])}-${index}`;
      const existing = byPrescriptionId.get(key);
      byPrescriptionId.set(key, existing ? {
        ...existing,
        ...prescription,
        doctor: { ...(existing.doctor || {}), ...(prescription.doctor || {}) },
        appointment: { ...(existing.appointment || {}), ...(prescription.appointment || {}) },
        consultation: { ...(existing.consultation || {}), ...(prescription.consultation || {}) },
      } : prescription);
    });
    return Array.from(byPrescriptionId.values());
  })();

  const getVisitId = (record) =>
    readFirst(record, ['appointmentId', 'appointment.id', 'appointmentIdValue', 'visitId', 'id']);

  const getPrescriptionVisitId = (record) =>
    readFirst(record, [
      'appointmentId',
      'appointment.id',
      'appointment.appointmentId',
      'visitId',
      'visit.id',
      'consultation.appointmentId',
    ]);

  const rawVisitRecords = (() => {
    const byVisitId = new Map();
    [...historyVisits, ...appointmentVisits].forEach((visit, index) => {
      const visitId = getVisitId(visit);
      const fallbackKey = `${readFirst(visit, ['appointmentDate', 'date', 'visitDate', 'createdAt'])}-${readFirst(visit, ['doctorId', 'doctor.id', 'doctorName'])}-${index}`;
      const key = visitId ? `appointment-${visitId}` : fallbackKey;
      const existing = byVisitId.get(key);
      byVisitId.set(key, existing ? {
        ...existing,
        ...visit,
        doctor: { ...(existing.doctor || {}), ...(visit.doctor || {}) },
        consultation: { ...(existing.consultation || {}), ...(visit.consultation || {}) },
        appointment: { ...(existing.appointment || {}), ...(visit.appointment || {}) },
      } : visit);
    });
    return Array.from(byVisitId.values());
  })();

  const generatedLabReports = readGeneratedLabReports().filter(belongsToCurrentPatient);
  const apiLabReports = normalizeLabPatientReports(patientLabReports).filter(belongsToCurrentPatient);
  const reportRecords = [
    ...normalizeRecords(historyRecord?.reports),
    ...normalizeRecords(historyRecord?.labReports),
    ...normalizeRecords(historyRecord?.scanReports),
    ...normalizeRecords(historyRecord?.attachments),
    ...apiLabReports,
    ...generatedLabReports,
    ...rawVisitRecords
      .map((visit) => readFirst(visit, ['report', 'reportName', 'reportTitle', 'reportUrl', 'documentUrl']) ? visit : null)
      .filter(Boolean),
  ];

  const readVisitDate = (visit) =>
    readFirst(visit, ['date', 'visitDate', 'appointmentDate', 'createdAt', 'appointment?.date']) || 'Unknown date';

  const readVisitDateTime = (visit) => {
    const rawDate = readFirst(visit, ['date', 'visitDate', 'appointmentDate', 'scheduledDate', 'createdAt', 'appointment?.date']);
    const rawTime = readFirst(visit, ['time', 'visitTime', 'appointmentTime', 'startTime', 'slotTime', 'scheduledTime', 'visit?.time']);
    return {
      date: formatPatientDate(rawDate) || String(rawDate || 'Unknown date'),
      time: formatSlotTime(rawTime) || String(rawTime || 'Time unavailable'),
    };
  };

  const readVisitDoctor = (visit) =>
    readFirst(visit, [
      'doctor.fullName',
      'doctor.name',
      'doctorName',
      'practitioner.name',
      'practitioner.fullName',
      'provider.name',
      'consultantName',
      'providerName',
      'attendingDoctor',
    ]) || 'Doctor details unavailable';

  const readVisitClinic = (visit) =>
    readFirst(visit, [
      'clinicName',
      'hospitalName',
      'branchName',
      'location',
      'facility',
      'clinic.name',
      'hospital.name',
      'branch.name',
    ]) || 'Clinic details unavailable';

  const readVisitDepartment = (visit) =>
    readFirst(visit, [
      'department',
      'departmentName',
      'department.name',
      'specialty',
      'speciality',
      'specialization',
      'doctor.specialization',
      'doctor.department',
      'doctor.departmentName',
      'doctor.specialty',
      'doctor.speciality',
      'consultation.department',
      'visit.department',
      'visit.specialization',
      'visit.speciality',
      'departmentDetails',
      'consultingDepartment',
    ]) || '-';

  const readVisitDiagnosis = (visit) =>
    readFirst(visit, [
      'diagnosis',
      'condition',
      'summary',
      'finalDiagnosis',
      'provisionalDiagnosis',
      'diagnosisText',
      'doctor.diagnosis',
      'consultation.diagnosis',
      'consultation.summary',
      'visit.diagnosis',
      'medicalDiagnosis',
      'visitDiagnosis',
    ]) || '-';

  const readVisitChiefComplaint = (visit) =>
    readFirst(visit, [
      'chiefComplaint',
      'chiefComplaints',
      'reasonForVisit',
      'reason',
      'complaint',
      'visitReason',
      'symptoms',
      'patientComplaint',
      'consultation.chiefComplaints',
      'consultation.symptoms',
    ]) || '-';

  const readVisitNotes = (visit) =>
    readFirst(visit, [
      'consultationNotes',
      'consultation.notes',
      'notes',
      'doctorNotes',
      'doctor.notes',
      'description',
      'visitNotes',
      'medicalNotes',
      'followUpNotes',
      'consultation.description',
      'consultation.summary',
      'consultation.remarks',
      'advice',
      'instructions',
    ]) || '-';

  const parseMedicineForDisplay = (medicine, index) => {
    if (!medicine && medicine !== 0) return { name: `Medicine ${index + 1}`, dosage: '-', quantity: '-', frequency: '-', duration: '-', notes: '-' };
    if (typeof medicine === 'string') return { name: medicine, dosage: '-', quantity: '-', frequency: '-', duration: '-', notes: '-' };
    const name = readFirst(medicine, ['name', 'medicineName', 'drugName', 'title', 'itemName', 'label', 'medicine', 'medication']) || `Medicine ${index + 1}`;
    const dosage = readFirst(medicine, ['dosage', 'dose', 'strength']) || '-';
    const quantity = readFirst(medicine, ['quantity', 'qty', 'count', 'pack', 'units']) || '-';
    const frequency = readFirst(medicine, ['frequency', 'freq', 'timing', 'when']) || '-';
    const duration = readFirst(medicine, ['duration', 'days', 'course', 'period']) || '-';
    const notes = readFirst(medicine, ['notes', 'note', 'remark', 'remarks', 'instruction', 'instructions']) || '-';
    return { name, dosage, quantity, frequency, duration, notes };
  };

  const getMedicineListForPrescription = (prescription) => {
    if (!prescription) return [];

    const medicineArray =
      Array.isArray(prescription.medicines) && prescription.medicines.length
        ? prescription.medicines
        : Array.isArray(prescription.medications) && prescription.medications.length
        ? prescription.medications
        : Array.isArray(prescription.medicineList) && prescription.medicineList.length
        ? prescription.medicineList
        : Array.isArray(prescription.prescribedMedicines) && prescription.prescribedMedicines.length
        ? prescription.prescribedMedicines
        : Array.isArray(prescription.medicineNames) && prescription.medicineNames.length
        ? prescription.medicineNames
        : Array.isArray(prescription.items) && prescription.items.length
        ? prescription.items
        : Array.isArray(prescription.drugs) && prescription.drugs.length
        ? prescription.drugs
        : null;

    if (Array.isArray(medicineArray)) {
      return medicineArray.map((m, i) => parseMedicineForDisplay(m, i));
    }

    const fallbackRecord =
      prescription.medicineName ||
      prescription.medicine ||
      prescription.drugName ||
      prescription.medication ||
      prescription.name ||
      prescription.label ||
      prescription.itemName;

    if (fallbackRecord && typeof fallbackRecord === 'object') {
      return [parseMedicineForDisplay(fallbackRecord, 0)];
    }

    if (fallbackRecord) {
      return [parseMedicineForDisplay(fallbackRecord, 0)];
    }

    const fallbackNames = normalizeList(
      prescription.medicineNames ||
        prescription.medicines ||
        prescription.medications ||
        prescription.medicineList ||
        prescription.prescribedMedicines ||
        prescription.items ||
        prescription.drugs ||
        ''
    );

    return fallbackNames.map((name, i) => parseMedicineForDisplay(name, i));
  };

  const readReportTitle = (report) =>
    readFirst(report, ['title', 'reportTitle', 'reportName', 'name', 'testName']) || 'Report';

  const readReportDate = (report) =>
    readFirst(report, ['date', 'reportDate', 'createdAt', 'appointmentDate']) || 'Unknown date';

  const readReportType = (report) =>
    readFirst(report, ['type', 'category', 'reportType', 'documentType']) || 'Other Attachment';

  const readPrescriptionDoctor = (prescription) =>
    readFirst(prescription, ['doctor.fullName', 'doctor.name', 'doctorName', 'prescribedBy', 'providerName', 'provider.name', 'appointment.doctorName']) || 'Doctor details unavailable';

  const readPrescriptionDate = (prescription) =>
    readFirst(prescription, ['date', 'visitDate', 'prescriptionDate', 'prescribedOn', 'appointmentDate', 'appointment.date', 'visit.date', 'createdAt']) || 'Unknown date';

  const readPrescriptionDiagnosis = (prescription) =>
    readFirst(prescription, [
      'diagnosis',
      'diagnosisText',
      'finalDiagnosis',
      'provisionalDiagnosis',
      'condition',
      'summary',
      'problem',
      'chiefComplaint',
      'prescriptionDiagnosis',
      'diagnosisDetails',
      'consultation.diagnosis',
      'visit.diagnosis',
      'appointment.diagnosis',
    ]) || 'Diagnosis details unavailable';

  const getPrescriptionMedicineName = (medicine) => {
    if (!medicine && medicine !== 0) return '';
    if (typeof medicine === 'string') return medicine.trim();
    return String(
      readFirst(medicine, ['name', 'medicineName', 'drugName', 'title', 'label', 'itemName', 'medicine', 'medication']) || ''
    ).trim();
  };

  const readPrescriptionTitle = (prescription) => {
    const rawTitle = readFirst(prescription, [
      'title',
      'summary',
      'diagnosis',
      'condition',
      'description',
      'problem',
      'chiefComplaint',
      'prescriptionTitle',
      'prescriptionNote',
      'notes',
      'diagnosisText',
    ]);
    if (rawTitle && String(rawTitle).trim()) return String(rawTitle).trim();

    const medicines =
      Array.isArray(prescription.medicines) && prescription.medicines.length
        ? prescription.medicines
        : Array.isArray(prescription.medications) && prescription.medications.length
        ? prescription.medications
        : Array.isArray(prescription.medicineList) && prescription.medicineList.length
        ? prescription.medicineList
        : Array.isArray(prescription.prescribedMedicines) && prescription.prescribedMedicines.length
        ? prescription.prescribedMedicines
        : [];

    if (medicines.length) {
      return getPrescriptionMedicineName(medicines[0]) || 'Prescription details unavailable';
    }

    return (
      readFirst(prescription, ['name', 'prescriptionName', 'medication', 'drugName']) ||
      'Prescription details unavailable'
    );
  };

  const readPrescriptionMedicineNames = (prescription) =>
    normalizeMedicines(prescription).map(getPrescriptionMedicineName).filter(Boolean);

  const formatPrescriptionOverview = (prescription) => {
    const names = readPrescriptionMedicineNames(prescription);
    if (names.length) {
      return names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3} more` : '');
    }
    return readPrescriptionTitle(prescription);
  };

  const normalizeMedicines = (prescription) => {
    const medicines = prescription?.medicines || prescription?.medicineList || prescription?.items || prescription?.drugs;
    if (Array.isArray(medicines)) return medicines.filter(Boolean);
    const medicine = readFirst(prescription, ['medicine', 'medicineName', 'drugName', 'medication']);
    return medicine ? [{ medicine, dosage: readFirst(prescription, ['dosage', 'dose']), instructions: readFirst(prescription, ['instructions', 'notes']) }] : [];
  };

  const visitRecords = newestFirst(
    rawVisitRecords.map((visit) => {
      const visitId = getVisitId(visit);
      const prescription = prescriptionRecords.find(
        (record) => visitId && String(getPrescriptionVisitId(record)) === String(visitId)
      );
      if (!prescription) return visit;

      return {
        ...prescription,
        ...visit,
        doctor: { ...(prescription.doctor || {}), ...(visit.doctor || {}) },
        consultation: { ...(prescription.consultation || {}), ...(visit.consultation || {}) },
        appointment: { ...(prescription.appointment || {}), ...(visit.appointment || {}) },
        department: readFirst(visit, ['department', 'departmentName', 'specialty', 'specialization']) || readFirst(prescription, ['department', 'departmentName', 'specialty', 'doctor.specialization']),
        diagnosis: readFirst(visit, ['diagnosis', 'finalDiagnosis', 'provisionalDiagnosis', 'consultation.diagnosis']) || readFirst(prescription, ['diagnosis', 'finalDiagnosis', 'provisionalDiagnosis', 'consultation.diagnosis']),
        chiefComplaint: readFirst(visit, ['chiefComplaint', 'chiefComplaints', 'reasonForVisit', 'symptoms', 'consultation.chiefComplaints']) || readFirst(prescription, ['chiefComplaint', 'chiefComplaints', 'consultation.chiefComplaints']),
        consultationNotes: readFirst(visit, ['consultationNotes', 'consultation.notes', 'notes', 'doctorNotes']) || readFirst(prescription, ['consultationNotes', 'consultation.notes', 'notes', 'instructions']),
      };
    }),
    readVisitDate
  );
  const sortedReports = newestFirst(reportRecords, readReportDate);
  const prescriptionsWithVisitDetails = prescriptionRecords.map((prescription) => {
    const appointmentId = getPrescriptionVisitId(prescription);
    const visit = rawVisitRecords.find((record) =>
      appointmentId && String(getVisitId(record)) === String(appointmentId)
    );
    if (!visit) return prescription;

    return {
      ...visit,
      ...prescription,
      doctor: { ...(visit.doctor || {}), ...(prescription.doctor || {}) },
      appointment: { ...(visit.appointment || {}), ...(prescription.appointment || {}) },
      consultation: { ...(visit.consultation || {}), ...(prescription.consultation || {}) },
      visitDate: readPrescriptionDate(prescription) !== 'Unknown date' ? readPrescriptionDate(prescription) : readVisitDate(visit),
      doctorName: readFirst(prescription, ['doctorName', 'doctor.name', 'doctor.fullName']) || readVisitDoctor(visit),
      diagnosis: readFirst(prescription, ['diagnosis', 'finalDiagnosis', 'provisionalDiagnosis', 'consultation.diagnosis']) || readVisitDiagnosis(visit),
      chiefComplaint: readFirst(prescription, ['chiefComplaint', 'chiefComplaints', 'consultation.chiefComplaints']) || readVisitChiefComplaint(visit),
      consultationNotes: readFirst(prescription, ['consultationNotes', 'consultation.notes', 'notes', 'instructions']) || readVisitNotes(visit),
      clinicName: readFirst(prescription, ['clinicName', 'clinic.name', 'hospitalName']) || readVisitClinic(visit),
    };
  });
  const sortedPrescriptions = newestFirst(prescriptionsWithVisitDetails, readPrescriptionDate);
  const hasAnyHistory =
    medicalConditions.length ||
    allergies.length ||
    chronicConditions.length ||
    currentMedications.length ||
    visitRecords.length ||
    sortedReports.length ||
    sortedPrescriptions.length;

  const conditionSections = [
    ["Medical Conditions", medicalConditions],
    ["Allergies", allergies],
    ["Chronic Diseases", chronicConditions],
    ["Current Medications", currentMedications],
  ];

  const medicalConditionCount = medicalConditions.length;
  const reportCount = sortedReports.length;
  const prescriptionCount = sortedPrescriptions.length;
  const visibleReports = reportsExpanded ? sortedReports : sortedReports.slice(0, 8);

  const normalizePrescriptionUrl = (value) => {
    if (!value && value !== 0) return '';
    const rawUrl = String(value).trim();
    if (!rawUrl) return '';
    if (/^data:/i.test(rawUrl) || /^blob:/i.test(rawUrl)) return rawUrl;
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    if (/^\/?api\//i.test(rawUrl)) return apiUrl(rawUrl.replace(/^\/?api\/?/i, ''));
    if (/^\//.test(rawUrl)) return `${window.location.origin}${rawUrl}`;
    if (/\.pdf(\?|$)/i.test(rawUrl) || /\/[^"]+\.[a-z0-9]{2,5}(\?|$)/i.test(rawUrl)) {
      return `${window.location.origin}/${rawUrl.replace(/^\/?/, '')}`;
    }
    return '';
  };

  const resolvePrescriptionUrl = (value, seen = new Set()) => {
    if (value == null) return '';
    if (typeof value === 'string') return normalizePrescriptionUrl(value);
    if (typeof value !== 'object') return '';
    if (seen.has(value)) return '';
    seen.add(value);

    const direct = readFirst(value, [
      'prescriptionUrl',
      'pdfUrl',
      'documentUrl',
      'downloadUrl',
      'fileUrl',
      'url',
      'link',
      'path',
      'attachmentDataUrl',
      'AttachmentDataUrl',
      'attachmentUrl',
      'AttachmentUrl',
    ]);
    if (direct) {
      const normalized = normalizePrescriptionUrl(direct);
      if (normalized) return normalized;
    }

    const nestedPaths = [
      'prescription',
      'document',
      'file',
      'pdf',
      'download',
      'attachment',
      'attachments',
    ];

    for (const path of nestedPaths) {
      const nestedValue = getNestedValue(value, path);
      const result = resolvePrescriptionUrl(nestedValue, seen);
      if (result) return result;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const result = resolvePrescriptionUrl(item, seen);
        if (result) return result;
      }
    }

    for (const key of Object.keys(value)) {
      const result = resolvePrescriptionUrl(value[key], seen);
      if (result) return result;
    }

    return '';
  };

  const getDownloadUrl = (record) => resolvePrescriptionUrl(record) || '';

  const viewReport = (report) => {
    const url = getDownloadUrl(report);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const downloadReport = (report) => {
    const url = getDownloadUrl(report);
    if (!url) return;

    if (/^(data|blob):/i.test(url)) {
      const filename = readFirst(report, ['attachmentFileName', 'AttachmentFileName', 'reportName', 'ReportName', 'testName', 'TestName']) || 'report';
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();
  };

  const renderPrescriptionDetails = (prescription, index, keyPrefix = 'prescription') => {
    const medicines = getMedicineListForPrescription(prescription);
    return (
      <div className="mh-prescription-block" key={`${keyPrefix}-${prescription.prescriptionId || prescription.id || prescription.appointmentId || index}`}>
        <div className="mh-prescription-header">
          <div className="mh-prescription-date">{formatPatientDate(readPrescriptionDate(prescription))}</div>
          <h3 className="mh-prescription-title">{readPrescriptionTitle(prescription)}</h3>
        </div>
        <div className="mh-prescription-info-row">
          <div className="mh-prescription-card">
            <div className="mh-prescription-card-label">Doctor Details</div>
            <div className="mh-prescription-card-value">{readPrescriptionDoctor(prescription)}</div>
          </div>
          <div className="mh-prescription-card">
            <div className="mh-prescription-card-label">Diagnosis</div>
            <div className="mh-prescription-card-value">{readPrescriptionDiagnosis(prescription)}</div>
          </div>
        </div>
        <div className="mh-prescription-meds">
          <div className="mh-meds-head">
            <span>Medicine</span><span>Dosage</span><span>Quantity</span><span>Frequency</span><span>Duration</span><span>Notes</span>
          </div>
          {medicines.length ? medicines.map((medicine, medicineIndex) => (
            <div className="mh-meds-row" key={`${medicine.name || medicineIndex}-${medicineIndex}`}>
              <strong>{medicine.name}</strong><span>{medicine.dosage}</span><span>{medicine.quantity}</span><span>{medicine.frequency}</span><span>{medicine.duration}</span><span>{medicine.notes}</span>
            </div>
          )) : <div className="mh-meds-empty">No medicines recorded.</div>}
        </div>
      </div>
    );
  };

  return (
    <PatientPageShell
      title="Medical History"
      subtitle="Read-only medical records maintained by your care team."
      action={
        <button type="button" className="mh-download-btn" onClick={() => window.print()}>
          <Download size={16} />
          Download Medical Summary
        </button>
      }
    >
      <div className="mh-info-banner">
        <span>This section is for your reference only. For any medical concerns, please consult your doctor.</span>
      </div>

      {historyError ? <div className="mh-error">{historyError}</div> : null}
      {!historyError && loadingHistory ? <div className="mh-loading">Loading medical history...</div> : null}
      {!historyError && !loadingHistory && !hasAnyHistory ? (
        <div className="mh-empty">
          <p>No medical history has been recorded for this patient yet.</p>
        </div>
      ) : null}

      <div className="mh-grid">
        <div className="mh-card mh-card--highlight">
          <div className="mh-card-head">
            <div className="mh-card-head-title">
              <span className="mh-card-icon mh-card-icon--teal"><Heart size={18} /></span>
              <div>
                <h3>Medical Conditions</h3>
                <p>View your existing condition summary.</p>
              </div>
            </div>
            <span className="mh-card-count">{medicalConditionCount}</span>
          </div>
          <div className="mh-condition-list">
            <div className="mh-condition-group">
              {conditionSections.map(([label, values]) => (
                <div className="mh-condition-row" key={label}>
                  <span>{label}</span>
                  {values.length ? (
                    <div className="mh-chip-list">
                      {values.slice(0, 5).map((item, index) => (
                        <span key={`${label}-${item}-${index}`} className="mh-chip">
                          {item}
                        </span>
                      ))}
                      {values.length > 5 ? <span className="mh-chip mh-chip--more">+{values.length - 5} more</span> : null}
                    </div>
                  ) : (
                    <strong className="mh-condition-empty">Not recorded</strong>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mh-card">
          <div className="mh-card-head">
            <div className="mh-card-head-title">
              <span className="mh-card-icon mh-card-icon--blue"><FileText size={18} /></span>
              <div>
                <h3>Reports</h3>
                <p>Lab reports and attachments from your visits.</p>
              </div>
            </div>
            <span className="mh-card-count mh-card-count--secondary">{reportCount}</span>
          </div>
          {sortedReports.length ? (
            <div className="mh-card-body">
              <p>{readReportTitle(sortedReports[0])}</p>
              <span>{readReportDate(sortedReports[0])}</span>
            </div>
          ) : (
            <div className="mh-card-empty">
              <p>No reports available at the moment.</p>
            </div>
          )}
        </div>

        <div className="mh-card mh-card--prescriptions">
          <div className="mh-card-head">
            <div className="mh-card-head-title">
              <span className="mh-card-icon mh-card-icon--amber"><Pill size={18} /></span>
              <div>
                <h3>Prescriptions</h3>
                <p>Medication advice from your previous visits.</p>
              </div>
            </div>
            <span className="mh-card-count mh-card-count--secondary">{prescriptionCount}</span>
          </div>
          <div className="mh-card-body">
            {sortedPrescriptions.length ? (
              <div className="mh-prescription-summary-card">
                <div className="mh-prescription-summary-copy">
                  <div className="mh-prescription-title">{readPrescriptionDoctor(sortedPrescriptions[0])}</div>
                  <div className="mh-prescription-sub">{readPrescriptionDiagnosis(sortedPrescriptions[0])}</div>
                  <div className="mh-prescription-sub">{formatPrescriptionOverview(sortedPrescriptions[0])}</div>
                </div>
                <div className="mh-prescription-count">{prescriptionCount}</div>
              </div>
            ) : (
              <div className="mh-card-empty">
                <p>No prescriptions available.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mh-panel">
        <div className="mh-panel-header">
          <div>
            <h2>Reports</h2>
            <p>Open or download saved lab reports and attachments.</p>
          </div>
          {reportCount > 8 ? (
            <button type="button" className="mh-panel-filter-btn" onClick={() => setReportsExpanded((current) => !current)}>
              {reportsExpanded ? 'Show less' : `View all ${reportCount}`}
            </button>
          ) : null}
        </div>
        {sortedReports.length ? (
          <div className="mh-report-list">
            {visibleReports.map((report, index) => {
              const reportUrl = getDownloadUrl(report);
              const reportName = readReportTitle(report);
              const reportDate = readReportDate(report);
              return (
                <div className="mh-report-item" key={`${readFirst(report, ['reportId', 'ReportId', 'id', 'Id'], `report-${index}`)}-${index}`}>
                  <div className="mh-report-copy">
                    <strong>{reportName}</strong>
                    <span>{reportDate}</span>
                  </div>
                  <div className="mh-report-actions">
                    <button className="mh-btn ghost" type="button" onClick={() => viewReport(report)} disabled={!reportUrl}>
                      <Eye size={14} /> View
                    </button>
                    <button className="mh-btn" type="button" onClick={() => downloadReport(report)} disabled={!reportUrl}>
                      <Download size={14} /> Download
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mh-card-empty">
            <p>No reports available at the moment.</p>
          </div>
        )}
      </div>

      <div className="mh-panel">
        <div className="mh-panel-header">
          <div>
            <h2>Previous Visits</h2>
            <p>List of your previous visits and diagnosis details.</p>
          </div>
          <button type="button" className="mh-panel-filter-btn">Filter</button>
        </div>
        {visitRecords.length ? (
          <div className="mh-visit-list">
            {visitRecords.map((visit, index) => (
              <div className="mh-visit-item" key={visit.id || visit.appointmentId || index}>
                <div className="mh-visit-summary">
                  <div className="mh-visit-icon">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <span className="mh-visit-date">{readVisitDateTime(visit).date}</span>
                    <div className="mh-visit-subtitle">
                      <strong>{readVisitDateTime(visit).time}</strong>
                      <span>{readVisitDoctor(visit)}</span>
                      <span>{readVisitClinic(visit)}</span>
                    </div>
                  </div>
                </div>
                <div className="mh-visit-stats">
                  <div>
                    <span>Department</span>
                    <strong>{readVisitDepartment(visit)}</strong>
                  </div>
                  <div>
                    <span>Diagnosis</span>
                    <strong>{readVisitDiagnosis(visit)}</strong>
                  </div>
                  <div>
                    <span>Chief Complaint</span>
                    <strong>{readVisitChiefComplaint(visit)}</strong>
                  </div>
                  <div>
                    <span>Consultation Notes</span>
                    <strong>{readVisitNotes(visit)}</strong>
                  </div>
                </div>
                  {/* Prescriptions for this visit */}
                  {(() => {
                    const apptId = getVisitId(visit);
                    const visitPrescriptions = (Array.isArray(prescriptionRecords) ? prescriptionRecords : []).filter((rx) => {
                      const rxAppt = getPrescriptionVisitId(rx);
                      return String(rxAppt) && String(rxAppt) === String(apptId);
                    });
                    if (!visitPrescriptions.length) return null;

                    return (
                      <div className="mh-visit-prescriptions">
                        {visitPrescriptions.map((prescription, prescriptionIndex) => renderPrescriptionDetails(prescription, prescriptionIndex, `visit-${apptId}`))}
                      </div>
                    );
                  })()}
              </div>
            ))}
          </div>
        ) : (
          <div className="mh-empty">
            <p>No previous visits found.</p>
          </div>
        )}
        {visitRecords.length ? (
          <div className="mh-panel-footer">
            <button type="button" className="mh-view-more-btn">View More</button>
          </div>
        ) : null}
      </div>
    </PatientPageShell>
  );
}

function PatientPrescriptionsPage({ prescriptions = [], patient = null, visits = [] }) {
  const [apiPrescriptions, setApiPrescriptions] = useState([]);
  const prescriptionRecords = useMemo(
    () =>
      parseApiList([...parseApiList(prescriptions), ...apiPrescriptions])
        .filter((prescription) => appointmentBelongsToPatient(prescription, patient || {})),
    [apiPrescriptions, patient, prescriptions]
  );
  const [selectedPrescription, setSelectedPrescription] = useState(prescriptionRecords[0] || null);

  useEffect(() => {
    setSelectedPrescription(prescriptionRecords[0] || null);
  }, [prescriptionRecords]);

  useEffect(() => {
    let isCurrent = true;
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const loadPrescriptions = async () => {
      const response = await fetch(patientApiUrl(PATIENT_API.prescriptions), { headers, cache: 'no-store' }).catch(() => null);
      const list = response?.ok ? parseApiList(await response.json().catch(() => [])) : [];
      if (isCurrent) setApiPrescriptions(list);
    };

    loadPrescriptions();
    window.addEventListener('focus', loadPrescriptions);
    return () => {
      isCurrent = false;
      window.removeEventListener('focus', loadPrescriptions);
    };
  }, [patient, visits]);

  const formatDate = (record) =>
    formatPatientDate(
      readFirst(record, [
        'visitDate',
        'prescriptionDate',
        'date',
        'prescribedOn',
        'createdAt',
        'appointmentDate',
        'followUpDate',
        'visitOn',
      ])
    ) || 'Unknown date';

  const getTitle = (record) =>
    readFirst(record, ['title', 'summary', 'diagnosis', 'condition', 'description', 'problem', 'chiefComplaint']) ||
    'Prescription';

  const normalizePrescriptionUrl = (value) => {
    if (!value && value !== 0) return '';
    const rawUrl = String(value).trim();
    if (!rawUrl) return '';
    if (/^data:/i.test(rawUrl) || /^blob:/i.test(rawUrl)) return rawUrl;
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    if (/^\/?api\//i.test(rawUrl)) return apiUrl(rawUrl.replace(/^\/?api\/?/i, ''));
    if (/^\//.test(rawUrl)) return `${window.location.origin}${rawUrl}`;
    if (/\.pdf(\?|$)/i.test(rawUrl) || /\/[^\s]+\.[a-z0-9]{2,5}(\?|$)/i.test(rawUrl)) {
      return `${window.location.origin}/${rawUrl.replace(/^\/?/, '')}`;
    }
    return '';
  };

  const resolvePrescriptionUrl = (value, seen = new Set()) => {
    if (value == null) return '';
    if (typeof value === 'string') return normalizePrescriptionUrl(value);
    if (typeof value !== 'object') return '';
    if (seen.has(value)) return '';
    seen.add(value);

    const direct = readFirst(value, [
      'prescriptionUrl',
      'pdfUrl',
      'documentUrl',
      'downloadUrl',
      'fileUrl',
      'url',
      'link',
      'path',
      'attachmentDataUrl',
      'AttachmentDataUrl',
      'attachmentUrl',
      'AttachmentUrl',
    ]);
    if (direct) {
      const normalized = normalizePrescriptionUrl(direct);
      if (normalized) return normalized;
    }

    const nestedPaths = [
      'prescription',
      'document',
      'file',
      'pdf',
      'download',
      'attachment',
      'attachments',
    ];

    for (const path of nestedPaths) {
      const nestedValue = getNestedValue(value, path);
      const result = resolvePrescriptionUrl(nestedValue, seen);
      if (result) return result;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const result = resolvePrescriptionUrl(item, seen);
        if (result) return result;
      }
    }

    for (const key of Object.keys(value)) {
      const result = resolvePrescriptionUrl(value[key], seen);
      if (result) return result;
    }

    return '';
  };

  const getDownloadUrl = (record) => resolvePrescriptionUrl(record) || '';

  const getApiHeaders = () => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const getFileNameFromUrl = (url) => {
    if (!url) return 'prescription.pdf';
    const fileName = url.split('/').pop().split('?')[0];
    return fileName || 'prescription.pdf';
  };

  const escapeHtml = (unsafe) => {
    if (unsafe == null) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const formatShareText = (prescription) => {
    const lines = [];
    lines.push(`Prescription`);
    const doctor = readFirst(prescription, ['doctorName', 'doctor.name', 'prescribedBy']);
    if (doctor) lines.push(`Doctor: ${doctor}`);
    const diag = readFirst(prescription, ['diagnosis', 'condition', 'title']);
    if (diag) lines.push(`Diagnosis: ${diag}`);
    const meds = getMedicineList(prescription);
    if (meds && meds.length) {
      lines.push('Medicines:');
      meds.forEach((m) => lines.push(`- ${m.name} | ${m.dosage} | ${m.instructions}`));
    }
    return lines.join('\n');
  };

  const getPrescriptionId = (prescription = {}) =>
    readFirst(prescription, [
      'prescriptionId',
      'PrescriptionId',
      'id',
      'Id',
      'prescription.id',
      'Prescription.Id',
    ]);

  const fetchPrescriptionById = async (prescription = {}) => {
    const prescriptionId = getPrescriptionId(prescription);
    if (!prescriptionId) return prescription;

    const url = patientApiUrl(
      PATIENT_API.prescriptionById.replace('{id}', encodeURIComponent(prescriptionId))
    );
    const response = await fetch(url, { headers: getApiHeaders(), cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return prescription;

    const details = parseApiList(await response.json().catch(() => null))[0];
    if (!details || typeof details !== 'object') return prescription;

    const merged = { ...prescription, ...details };
    setApiPrescriptions((current) =>
      parseApiList(current).map((item) =>
        String(getPrescriptionId(item)) === String(prescriptionId) ? merged : item
      )
    );
    return merged;
  };

  const downloadPrescription = async (url, prescription = null) => {
    const latestPrescription = prescription ? await fetchPrescriptionById(prescription) : null;
    const latestUrl = getDownloadUrl(latestPrescription) || url;
    // Primary: download existing URL
    if (latestUrl) {
      try {
        const response = await fetch(latestUrl, { headers: getApiHeaders(), mode: 'cors' });
        if (!response.ok) throw new Error('Unable to download prescription.');
        const blob = await response.blob();
        const filename = getFileNameFromUrl(latestUrl);
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
        return;
      } catch (error) {
        // fallback to opening in new tab
        try { window.open(latestUrl, '_blank', 'noopener,noreferrer'); return; } catch (e) {}
      }
    }

    // Fallback: generate printable HTML and open print dialog so user can save as PDF
    if (latestPrescription) {
      try {
        const html = `
          <html>
            <head>
              <title>Prescription</title>
              <style>body{font-family: Arial, sans-serif; padding:20px;}</style>
            </head>
            <body>
              <h2>Prescription</h2>
              <p><strong>Diagnosis:</strong> ${escapeHtml(readFirst(latestPrescription, ['diagnosis', 'condition', 'title']) || '')}</p>
              <p><strong>Doctor:</strong> ${escapeHtml(readFirst(latestPrescription, ['doctorName','doctor.name','prescribedBy']) || '')}</p>
              <h3>Medicines</h3>
              <ul>
                ${getMedicineList(latestPrescription)
                  .map(m => `<li><strong>${escapeHtml(m.name)}</strong> - ${escapeHtml(m.dosage)} - ${escapeHtml(m.instructions)}</li>`)
                  .join('')}
              </ul>
            </body>
          </html>`;

        const win = window.open('', '_blank');
        if (!win) return;
        win.document.open();
        win.document.write(html);
        win.document.close();
        // Ask user to print/save as PDF
        win.focus();
        setTimeout(() => { try { win.print(); } catch (e) {} }, 500);
        return;
      } catch (e) {
        // ignore and fall through
      }
    }
  };

  const sharePrescription = async (url, title = 'Prescription', prescription = null) => {
    if (!url && !prescription) return;
    const latestPrescription = prescription ? await fetchPrescriptionById(prescription) : null;
    const latestUrl = getDownloadUrl(latestPrescription) || url;
    try {
      const response = latestUrl ? await fetch(latestUrl, { headers: getApiHeaders(), mode: 'cors' }) : null;
      if (response.ok) {
        const blob = await response.blob();
        const filename = getFileNameFromUrl(latestUrl);
        const file = new File([blob], filename, { type: blob.type || 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title, files: [file], text: title });
          return;
        }
      }
    } catch (err) {
      // if fetch/share fails, fallback to URL share
    }

    if (navigator.share) {
      try {
        if (latestUrl) {
          await navigator.share({ title, url: latestUrl });
          return;
        }
        // share textual prescription if no URL
        if (latestPrescription) {
          await navigator.share({ title, text: formatShareText(latestPrescription) });
          return;
        }
        return;
      } catch (err) {
        // ignore
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        if (latestUrl) {
          await navigator.clipboard.writeText(latestUrl);
          window.alert('Prescription link copied to clipboard.');
          return;
        }
        if (latestPrescription) {
          await navigator.clipboard.writeText(formatShareText(latestPrescription));
          window.alert('Prescription text copied to clipboard.');
          return;
        }
      } catch (err) {
        // fallback below
      }
    }

    if (latestUrl) window.open(latestUrl, '_blank', 'noopener,noreferrer');
  };

  const viewPrescription = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const splitMedicineEntries = (value) => {
    if (!value && value !== 0) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'object') {
      if (Array.isArray(value.medicines)) return value.medicines.filter(Boolean);
      if (Array.isArray(value.medications)) return value.medications.filter(Boolean);
      if (Array.isArray(value.items)) return value.items.filter(Boolean);
      if (Array.isArray(value.drugs)) return value.drugs.filter(Boolean);
      if (typeof value.text === 'string') return splitMedicineEntries(value.text);
      return [];
    }

    const text = String(value).trim();
    if (!text) return [];

    const entries = text.split(/\n|\r|;|\|/).map((item) => item.trim()).filter(Boolean);
    if (entries.length > 1) return entries;

    return [text];
  };

  const normalizePrescriptionNote = (note, medicineName = '') => {
    const value = String(note || '').trim();
    if (!value) return '';

    const normalized = value.replace(/\s+/g, ' ').trim();
    const lower = normalized.toLowerCase();
    if (/\b(after\s+food|before\s+food|with\s+water|at\s+bedtime|morning\s+only|evening\s+only|night\s+only|after\s+meals|before\s+meals|complete\s+full\s+course|continue\s+full\s+course|take\s+as\s+directed|as\s+directed|continue\s+medication)\b/i.test(lower)) {
      return '';
    }

    const nameLower = String(medicineName || '').trim().toLowerCase();
    if (nameLower && (lower === nameLower || lower === `${nameLower} ${nameLower}`)) {
      return '';
    }

    return normalized;
  };

  const extractMedicineFieldsFromString = (text) => {
    const source = String(text || '').trim();
    if (!source) return null;

    const quantityMatch = source.match(/\b\d+\s*(?:tabs?|tablets?|capsules?|caps|ml|mg|g|pills?|strip|pack|dose(?:s)?|qty|x)\b/i);
    const frequencyMatch = source.match(/\b(?:\d[- ]\d[- ]\d(?:[- ]\d)?|every\s+\d+\s*(?:hours?|hrs?)|once\s+daily|twice\s+daily|thrice\s+daily|od|bd|tds|hs|morning|evening|night|bedtime|after\s+food|before\s+food)\b/i);
    const durationMatch = source.match(/\b(?:\d+\s*(?:days?|weeks?|months?)|course(?:\s+days)?|treatment\s+duration|course\s+of\s+\d+)\b/i);
    const dosageMatch = source.match(/\b\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|units?|tablet|tab|capsule|cap|sachet|dose)\b/i);

    const quantity = quantityMatch ? quantityMatch[0] : '';
    const frequency = frequencyMatch ? frequencyMatch[0] : '';
    const duration = durationMatch ? durationMatch[0] : '';
    const dosage = dosageMatch ? dosageMatch[0] : '';

    let name = source;
    [quantity, frequency, duration, dosage].forEach((token) => {
      if (token) name = name.replace(token, '');
    });
    name = name.replace(/[:,;\-\|]+/g, ' ').replace(/\b(after|before|with|and|for|daily|once|twice|thrice|take|tab|tablet|capsule|cap|dose)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!name) {
      name = source;
    }

    const rawNotes = source
      .split(/[,;\n\r]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => {
        const lower = item.toLowerCase();
        return ![quantity, frequency, duration, dosage].some((token) => token && lower.includes(token.toLowerCase()));
      })
      .filter((item) => {
        const lower = item.toLowerCase();
        return !/\b(after\s+food|before\s+food|with\s+water|at\s+bedtime|morning\s+only|evening\s+only|night\s+only|after\s+meals|before\s+meals)\b/i.test(lower);
      });

    const notes = rawNotes.length > 1 ? rawNotes.slice(1).join(', ') : rawNotes.slice(0, 1).join(', ');

    return {
      name,
      dosage,
      quantity,
      frequency,
      duration,
      notes,
      instructions: notes || '',
    };
  };

  const normalizeMedicineList = (value) => {
    const entries = splitMedicineEntries(value);
    return entries.map((item) => item && typeof item === 'string' ? item.trim() : item).filter(Boolean);
  };

  const parseMedicineEntry = (medicine, index, record) => {
    if (typeof medicine === 'string') {
      const parsed = extractMedicineFieldsFromString(medicine);
      const displayName = parsed?.name || String(medicine);
      return {
        ...parsed,
        name: displayName,
        notes: normalizePrescriptionNote(parsed?.notes, displayName),
      };
    }

    if (medicine && typeof medicine === 'object') {
      const primaryName =
        readFirst(medicine, ['name', 'medicineName', 'drugName', 'title', 'itemName', 'label']) ||
        readFirst(medicine, ['medicine', 'medication']) ||
        '';
      const parsedFromName = extractMedicineFieldsFromString(primaryName);
      const displayName = primaryName || parsedFromName?.name || `Medicine ${index + 1}`;
      const rawNotes =
        readFirst(medicine, ['notes', 'note', 'remark', 'remarks', 'comments', 'instructionNotes', 'specialInstructions', 'additionalNotes', 'advice', 'adviceNotes']) ||
        parsedFromName?.notes ||
        '';
      const notes = normalizePrescriptionNote(rawNotes, displayName);
      const rawInstructions =
        readFirst(medicine, ['instructions', 'instruction', 'notes', 'frequency', 'timing', 'duration']) ||
        parsedFromName?.instructions ||
        readFirst(record, ['instructions', 'instruction', 'notes']) ||
        '';

      return {
        ...parsedFromName,
        ...medicine,
        name: displayName,
        dosage:
          readFirst(medicine, ['dosage', 'dose', 'strength', 'quantity', 'qty']) ||
          parsedFromName?.dosage ||
          readFirst(record, ['dosage', 'dose']) ||
          'Dosage not recorded',
        quantity:
          readFirst(medicine, ['quantity', 'qty', 'count', 'pack', 'units', 'quantityValue', 'pillCount', 'pill_count', 'doseCount', 'doseQty']) ||
          parsedFromName?.quantity ||
          '',
        frequency:
          readFirst(medicine, ['frequency', 'freq', 'timing', 'when', 'doseFrequency', 'frequencyText', 'timings', 'howOften', 'doseTiming', 'schedule']) ||
          parsedFromName?.frequency ||
          '',
        duration:
          readFirst(medicine, ['duration', 'days', 'course', 'period', 'durationDays', 'courseDays', 'treatmentDuration', 'courseDuration']) ||
          parsedFromName?.duration ||
          '',
        notes,
        instructions: normalizePrescriptionNote(rawInstructions, displayName) || rawInstructions,
      };
    }

    return {
      name: String(medicine || `Medicine ${index + 1}`),
      dosage: readFirst(record, ['dosage', 'dose']) || 'Dosage not recorded',
      instructions: readFirst(record, ['instructions', 'instruction', 'notes']) || 'Instructions not recorded',
    };
  };

  const getDoctorDetails = (record) => {
    const name =
      readFirst(record, [
        'doctorName',
        'doctor.name',
        'provider.name',
        'practitionerName',
        'prescribedBy',
        'provider.displayName',
      ]) || 'Doctor details unavailable';
    const specialty = readFirst(record, ['doctorSpecialty', 'doctor.specialty', 'specialty', 'department', 'departmentName']);
    const phone = readFirst(record, ['doctorPhone', 'doctor.phone', 'doctor.mobile', 'contact', 'contactNumber']);
    return [name, specialty, phone].filter(Boolean).join(' | ');
  };

  const getDiagnosis = (record) =>
    readFirst(record, ['diagnosis', 'condition', 'summary', 'title', 'description', 'provisionalDiagnosis', 'dx']) ||
    'Diagnosis not recorded';

  const getMedicineList = (record) => {
    const rawMedicines =
      Array.isArray(record.medicines) && record.medicines.length
        ? record.medicines
        : Array.isArray(record.medications) && record.medications.length
        ? record.medications
        : Array.isArray(record.medicineList) && record.medicineList.length
        ? record.medicineList
        : Array.isArray(record.prescribedMedicines) && record.prescribedMedicines.length
        ? record.prescribedMedicines
        : normalizeMedicineList(record.medicineNames || record.medicines || record.medications || record.medicineList || record.prescribedMedicines || record.items || record.drugs);

    return rawMedicines.map((medicine, index) => parseMedicineEntry(medicine, index, record));
  };
  // extend medicine objects with quantity, frequency, duration, notes when available
  const enrichMedicine = (medicine = {}) => {
    const rawFreq = readFirst(medicine, ['frequency', 'freq', 'timing', 'when', 'doseFrequency', 'frequencyText', 'timings', 'howOften', 'doseTiming', 'schedule']);
    const frequency = Array.isArray(rawFreq) ? rawFreq.join('-') : rawFreq || '';
    const rawDuration = readFirst(medicine, ['duration', 'days', 'course', 'period', 'durationDays', 'courseDays', 'treatmentDuration', 'courseDuration']);
    const duration = rawDuration || '';
    const qty =
      readFirst(medicine, ['quantity', 'qty', 'count', 'pack', 'units', 'quantityValue', 'pillCount', 'pill_count', 'doseCount', 'doseQty']) ||
      (medicine.dosage && /\d+/.test(String(medicine.dosage)) ? String((String(medicine.dosage).match(/\d+/) || [''])[0]) : '');
    return {
      ...medicine,
      quantity: qty,
      frequency,
      duration,
      notes:
        readFirst(medicine, [
          'notes',
          'note',
          'remark',
          'remarks',
          'comments',
          'instructionNotes',
          'specialInstructions',
          'additionalNotes',
          'advice',
          'adviceNotes',
        ]) || medicine.instructions || '',
    };
  };



  return (
    <PatientPageShell
      title="Prescriptions"
      subtitle="Doctor details, diagnosis, medicine list, dosage, and instructions."
    >
      <div className="pd-card">
        <div className="pd-section-header">
          <div>
            <h2>Prescription Records</h2>
            <p>Current and historical prescriptions.</p>
          </div>
        </div>

        {/* debug panel removed */}

        {!prescriptionRecords.length ? (
          <div className="pd-prescription-empty-note">
            <p>No prescriptions found. The prescription format is ready below.</p>
          </div>
        ) : null}

        {prescriptionRecords.length ? (
          <div className="pd-prescription-list">
            {prescriptionRecords.map((prescription, index) => {
              const date = formatDate(prescription);
              const title = getTitle(prescription);
              const doctorDetails = getDoctorDetails(prescription);
              const diagnosis = getDiagnosis(prescription);
              const medicines = getMedicineList(prescription);
              const downloadUrl = getDownloadUrl(prescription);
              // runtime debug removed

              return (
                <div className="pd-prescription-card" key={prescription.prescriptionId || prescription.id || prescription.appointmentId || index}>
                  <div className="pd-prescription-copy">
                    <span className="pd-prescription-date">{date}</span>
                    <h3>{diagnosis || title}</h3>
                    <div className="pd-prescription-detail-grid">
                      <div>
                        <span>Doctor Details</span>
                        <strong>{doctorDetails}</strong>
                      </div>
                      <div>
                        <span>Diagnosis</span>
                        <strong>{diagnosis || title}</strong>
                      </div>
                    </div>
                    <div className="pd-medicine-table">
                      <div className="pd-medicine-table-head">
                        <span>Medicine</span>
                        <span>Dosage</span>
                        <span>Quantity</span>
                        <span>Frequency</span>
                        <span>Duration</span>
                        <span>Notes</span>
                      </div>
                      {medicines.length ? medicines.map((rawMed, medicineIndex) => {
                        const medicine = enrichMedicine(rawMed);
                        return (
                          <div className="pd-medicine-row" key={`${medicine.name}-${medicineIndex}`}>
                            <strong>{medicine.name}</strong>
                            <span>{medicine.dosage}</span>
                            <span>{medicine.quantity || '-'}</span>
                            <span>{medicine.frequency || '-'}</span>
                            <span>{medicine.duration || '-'}</span>
                            <span>{medicine.notes || '-'}</span>
                          </div>
                        );
                      }) : (
                        <div className="pd-medicine-empty">No medicines recorded.</div>
                      )}
                    </div>
                  </div>
                  <div className="pd-prescription-actions">
                    <button
                      type="button"
                      className="pd-prescription-btn pd-prescription-btn--ghost"
                      onClick={() => downloadPrescription(downloadUrl, prescription)}
                      disabled={!(downloadUrl || prescription)}
                    >
                      <Download size={15} />
                      Download PDF
                    </button>
                    <button
                      type="button"
                      className="pd-prescription-btn pd-prescription-btn--primary"
                      onClick={() => sharePrescription(downloadUrl, title, prescription)}
                      disabled={!(downloadUrl || prescription)}
                    >
                      <Share2 size={15} />
                      Share
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pd-selected-notification">
            <p>No prescriptions found.</p>
          </div>
        )}
      </div>
    </PatientPageShell>
  );
}

export function PatientBillsPage({ bills = [], patient = null, visits = [] }) {
  const [apiBills, setApiBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [portalRefreshTick, setPortalRefreshTick] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const authenticatedPatientId = normalizeComparable(
    localStorage.getItem("patientId") || readFirst(patient || {}, ["patientId", "PatientId", "id", "Id"])
  );
  const isCurrentPatientOpBill = (bill) =>
    Boolean(authenticatedPatientId) &&
    normalizeComparable(readFirst(bill, ["patientId", "PatientId"])) === authenticatedPatientId;
  const getPatientPortalOpBillsForCurrentPatient = useCallback(() => {
    return readPatientPortalOpBills()
      .filter((bill) => billBelongsToPatient(bill, patient || {}, visits))
      .map((bill) => ({
        ...bill,
        invoiceType: bill.invoiceType || "op",
        billingType: bill.billingType || "OP",
        serviceType: bill.serviceType || "Patient Portal OP Billing",
        source: bill.source || "patient-portal",
        billingSource: bill.billingSource || "patient-portal",
        bookingSource: bill.bookingSource || "online",
      }));
  }, [patient, portalRefreshTick, visits]);

  useEffect(() => {
    const refreshBills = () => setPortalRefreshTick((value) => value + 1);
    const refreshStoredBills = (event) => {
      if (event.key === PATIENT_PORTAL_OP_BILLS_KEY) refreshBills();
    };
    window.addEventListener("patientPortalBillsUpdated", refreshBills);
    window.addEventListener("storage", refreshStoredBills);
    return () => {
      window.removeEventListener("patientPortalBillsUpdated", refreshBills);
      window.removeEventListener("storage", refreshStoredBills);
    };
  }, []);

  const billRecords = useMemo(() => {
    const localPatientPortalBills = getPatientPortalOpBillsForCurrentPatient();
    const backendBills = dedupeBillsByInvoice([
      ...bills,
      ...apiBills,
    ]).filter((bill) => billBelongsToPatient(bill, patient || {}, visits));

    return dedupeBillsByInvoice([
      ...backendBills,
      ...localPatientPortalBills,
    ]);
  }, [apiBills, bills, getPatientPortalOpBillsForCurrentPatient, patient, visits]);

  useEffect(() => {
    let isCurrent = true;
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const loadSubmittedBills = async () => {
      setLoadingBills(true);
      try {
        const data = await fetchAllPatientPortalBillingRows({ headers, cache: "no-store" }).catch(() => []);
        const nextBills = dedupeBillsByInvoice([
          ...data,
        ]).filter((bill) => billBelongsToPatient(bill, patient || {}, visits));
        if (isCurrent) setApiBills(nextBills);
      } finally {
        if (isCurrent) setLoadingBills(false);
      }
    };

    loadSubmittedBills();
    const refresh = () => {
      if (document.visibilityState === "visible") loadSubmittedBills();
    };
    window.addEventListener("focus", loadSubmittedBills);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      isCurrent = false;
      window.removeEventListener("focus", loadSubmittedBills);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [patient, visits]);
  const formatAmount = (value) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));

  const formatDate = (record) =>
    readFirst(record, ['invoiceDate', 'billDate', 'date', 'createdAt', 'createdOn', 'updatedAt']) || 'Unknown date';

  const invoiceNumber = (record) =>
    readFirst(record, ['invoiceNo', 'invoiceNumber', 'billNo', 'billNumber', 'referenceNumber', 'transactionId', 'id']) || 'Invoice';

  const billTypeLabel = (record) => {
    const rawType = String(readFirst(record, ['invoiceType', 'billingType', 'type', 'serviceType', 'category']) || '').toLowerCase();
    if (rawType.includes('pharmacy') || rawType.includes('medicine')) return 'Pharmacy';
    if (rawType.includes('diagnostic') || rawType.includes('diagnosis') || rawType.includes('lab') || rawType.includes('test')) return 'Diagnostic';
    if (getConsultationFee(record) > 0 || rawType.includes('consult')) return 'OP Bill';
    const hasLab = Number(readFirst(record, ['labCharge', 'labCharges', 'laboratoryCharges']) || 0) > 0;
    const hasMedicine = Number(readFirst(record, ['medicineCharge', 'medicineCharges', 'medicationCharges']) || 0) > 0;
    if (hasLab && !hasMedicine) return 'Diagnostic';
    if (hasMedicine && !hasLab) return 'Pharmacy';
    return 'OP Bill';
  };

  const getBranchClinicLabel = (record) => {
    const branchName = readFirst(record, ['branchName', 'BranchName', 'branch.name', 'Branch.Name', 'branch', 'Branch']);
    const clinicName = readFirst(record, ['clinicName', 'ClinicName', 'hospitalName', 'HospitalName', 'clinic.name', 'Clinic.Name', 'hospital.name', 'Hospital.Name', 'clinic', 'Clinic', 'hospital', 'Hospital']);
    const values = [branchName, clinicName]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const uniqueValues = Array.from(new Set(values.map((value) => value.toLowerCase())))
      .map((key) => values.find((value) => value.toLowerCase() === key));
    return uniqueValues.length ? uniqueValues.join(' / ') : 'Clinic';
  };

  const getPatientName = (record) => {
    const rawName = readFirst(record, [
      'patientName',
      'patient.name',
      'patient.fullName',
      'patient.firstName',
      'patient.lastName',
      'patientName',
      'customerName',
      'name',
    ]);
    if (typeof rawName === 'string' && rawName.trim()) return rawName.trim();
    if (typeof rawName === 'object' && rawName !== null) {
      return (
        readFirst(rawName, ['fullName', 'name', 'firstName', 'lastName']) || ''
      ).trim();
    }
    return invoiceNumber(record);
  };

  const getAppointmentNumber = (record) =>
    readFirst(record, ['appointmentNumber', 'appointmentNo', 'appointmentId', 'appointment.id', 'appointment_id']) || '-';

  const getConsultationFee = (record) =>
    Number(
      readFirst(record, [
        'consultationCharges',
        'consultationCharge',
        'consultationFee',
        'consultationAmount',
        'consultation',
      ]) || 0
    );

  const doctorLabel = (record) => {
    const doctorName = readFirst(record, ['doctorName', 'doctor.name', 'provider.name', 'physician']);
    const department = readFirst(record, ['specialty', 'department', 'departmentName']);
    const details = [doctorName, department].filter(Boolean).join(' with ');
    return details || 'Billing details unavailable';
  };

  const paymentMode = (record) =>
    readFirst(record, ['paymentMode', 'paymentType', 'mode', 'method']) || 'Not specified';

  const normalizePaymentMode = (value) => String(value).toLowerCase().replace(/\s+/g, '');

  const displayPaymentMode = (record) => {
    const mode = paymentMode(record);
    const normalizedMode = normalizePaymentMode(mode);
    return normalizedMode === 'online' || normalizedMode === 'netbanking' ? 'Netbanking' : mode;
  };

  const paymentStatus = (record) =>
    String(readFirst(record, ['status', 'paymentStatus', 'billStatus']) || 'Pending').toLowerCase();

  const totalAmount = (record) => Number(readFirst(record, ['total', 'totalAmount', 'amount', 'invoiceAmount', 'grandTotal', 'payableAmount', 'paymentAmount', 'paidAmount', 'netAmount', 'dueAmount', 'totals.total']) || 0);
  const dueAmount = (record) => Number(readFirst(record, ['dueAmount', 'balance', 'outstandingAmount']) || 0);

  const serviceItemArrays = (record) => [
    record.lineItems,
    record.LineItems,
    record.rows,
    record.Rows,
    record.serviceItems,
    record.ServiceItems,
    record.billItems,
    record.BillItems,
    record.billingItems,
    record.BillingItems,
    record.billingDetails,
    record.BillingDetails,
    record.items,
    record.Items,
    record.diagnosticTests,
    record.DiagnosticTests,
    record.labTests,
    record.LabTests,
    record.tests,
    record.Tests,
    record.medicines,
    record.Medicines,
    record.medications,
    record.Medications,
  ].find((items) => Array.isArray(items) && items.length) || [];

  const getLineItems = (record) => {
    const serviceItems = serviceItemArrays(record);
    if (Array.isArray(serviceItems) && serviceItems.length) {
      return serviceItems.map((row) => ({
        label: readFirst(row, ['item', 'Item', 'label', 'Label', 'testName', 'TestName', 'test', 'Test', 'name', 'Name', 'serviceName', 'ServiceName', 'medicineName', 'MedicineName', 'productName', 'ProductName', 'diagnosis', 'Diagnosis']) || 'Service item',
        diagnosis: readFirst(row, ['diagnosis', 'Diagnosis', 'category', 'Category', 'department', 'Department']) || '',
        quantity: Number(readFirst(row, ['quantity', 'Quantity', 'qty', 'Qty']) || 1) || 1,
        amount: Number(readFirst(row, ['amount', 'Amount', 'total', 'Total', 'totalAmount', 'TotalAmount', 'netAmount', 'NetAmount', 'lineTotal', 'LineTotal']) || 0) || ((Number(readFirst(row, ['unitPrice', 'UnitPrice', 'price', 'Price', 'rate', 'Rate']) || 0) || 0) * (Number(readFirst(row, ['quantity', 'Quantity', 'qty', 'Qty']) || 1) || 1)),
      }));
    }
    if (record.charges && typeof record.charges === 'object') {
      return Object.entries(record.charges).map(([label, amount]) => ({ label, amount }));
    }
    return [
      { label: 'Consultation charges', amount: readFirst(record, ['consultationCharges', 'consultationCharge']) },
      { label: 'Lab charges', amount: readFirst(record, ['labCharge', 'labCharges', 'laboratoryCharges']) },
      { label: 'Medicine charges', amount: readFirst(record, ['medicineCharge', 'medicineCharges', 'medicationCharges']) },
      { label: 'Other charges', amount: readFirst(record, ['otherCharges', 'miscCharges', 'serviceCharges']) },
    ].filter((item) => item.amount != null && item.amount !== '');
  };

  const getGstAmount = (record) => Number(readFirst(record, ['gst', 'tax', 'gstAmount', 'taxAmount', 'taxAmountTotal']) || 0);

  const getCgstAmount = (record) => {
    const explicit = Number(readFirst(record, ['cgst', 'cgstAmount', 'centralGst', 'centralTax']) || 0);
    return explicit || getGstAmount(record) / 2;
  };

  const getSgstAmount = (record) => {
    const explicit = Number(readFirst(record, ['sgst', 'sgstAmount', 'stateGst', 'stateTax']) || 0);
    return explicit || getGstAmount(record) / 2;
  };

  const getInvoiceSubTotal = (record) => {
    const explicit = Number(readFirst(record, ['subTotal', 'subtotal', 'taxableAmount', 'amountBeforeTax', 'netTotal']) || 0);
    if (explicit) return explicit;
    return getLineItems(record).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  };

  const getInvoiceRows = (record) => {
    const items = getLineItems(record);
    const subTotal = getInvoiceSubTotal(record);
    const cgst = getCgstAmount(record);
    const sgst = getSgstAmount(record);
    if (!items.length) {
      return [{
        label: 'Invoice amount',
        amount: subTotal || totalAmount(record),
        cgst,
        sgst,
        netAmount: totalAmount(record),
      }];
    }

    return items.map((item) => {
      const amount = Number(item.amount || 0);
      const ratio = subTotal > 0 ? amount / subTotal : 0;
      const itemCgst = Math.round((cgst * ratio) * 100) / 100;
      const itemSgst = Math.round((sgst * ratio) * 100) / 100;
      return {
        ...item,
        cgst: itemCgst,
        sgst: itemSgst,
        netAmount: Math.round((amount + itemCgst + itemSgst) * 100) / 100,
      };
    });
  };

  const paymentUrl = (record) =>
    readFirst(record, ['paymentUrl', 'payUrl', 'checkoutUrl', 'paymentLink', 'paymentGatewayUrl']) || '';

  const getApiHeaders = () => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const resolveInvoiceUrl = (value) => {
    if (!value && value !== 0) return '';
    if (typeof value === 'string') {
      return value.trim();
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const result = resolveInvoiceUrl(item);
        if (result) return result;
      }
      return '';
    }
    if (typeof value === 'object') {
      const url = readFirst(value, [
        'invoiceUrl',
        'downloadUrl',
        'documentUrl',
        'pdfUrl',
        'fileUrl',
        'url',
        'link',
        'path',
        'invoice.fileUrl',
        'invoice.downloadUrl',
        'invoice.documentUrl',
        'invoice.pdfUrl',
        'document.fileUrl',
        'document.downloadUrl',
        'document.pdfUrl',
        'file.url',
        'invoice.link',
        'document.link',
      ]);
      if (url) return resolveInvoiceUrl(url);

      return (
        resolveInvoiceUrl(value.invoice) ||
        resolveInvoiceUrl(value.document) ||
        resolveInvoiceUrl(value.file) ||
        resolveInvoiceUrl(value.pdf) ||
        resolveInvoiceUrl(value.download)
      );
    }
    return '';
  };

  const invoiceUrl = (record) => resolveInvoiceUrl(record) || '';

  const getInvoiceId = (record) =>
    readFirst(record, ['invoiceId', 'billId', 'billingId', 'id', '_id', 'referenceId']);

  const getBillDetailUrl = (billId) =>
    patientApiUrl(PATIENT_API.billDetails, { id: billId });

  const normalizeBillDetailResponse = (data) => {
    if (!data) return {};
    if (Array.isArray(data)) return data[0] || {};
    if (Array.isArray(data.data)) return data.data[0] || {};
    if (data.data && typeof data.data === 'object') return data.data;
    if (data.result && typeof data.result === 'object' && !Array.isArray(data.result)) return data.result;
    if (data.bill && typeof data.bill === 'object') return data.bill;
    if (data.invoice && typeof data.invoice === 'object') return data.invoice;
    return typeof data === 'object' ? data : {};
  };

  const fetchPatientBillDetails = async (record) => {
    const invoiceId = getInvoiceId(record);
    if (!invoiceId) return record;

    const response = await fetch(getBillDetailUrl(invoiceId, record), {
      headers: getApiHeaders(),
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) return record;

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('pdf') || contentType.includes('octet-stream') || contentType.includes('binary')) {
      return record;
    }

    const data = await response.json().catch(() => null);
    const details = normalizeBillDetailResponse(data);
    return { ...record, ...details };
  };

  const getInvoiceSourceUrl = async (record) => {
    const directUrl = invoiceUrl(record);
    if (directUrl) return directUrl;

    const invoiceId = getInvoiceId(record);
    if (!invoiceId) return '';

    const billDetailUrl = getBillDetailUrl(invoiceId, record);
    const response = await fetch(billDetailUrl, { headers: getApiHeaders() }).catch(() => null);
    if (!response?.ok) return '';

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('pdf') || contentType.includes('octet-stream') || contentType.includes('binary')) {
      return billDetailUrl;
    }

    const data = await response.json().catch(() => null);
    if (!data) return '';

    return resolveInvoiceUrl(data) || resolveInvoiceUrl(data.invoice) || resolveInvoiceUrl(data.document) || '';
  };

  const getPrintableInvoiceHtml = (record, { autoPrint = true } = {}) => {
    const escapeHtml = (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    const invoiceNumberValue = invoiceNumber(record);
    const patientName = readFirst(record, ['patientName', 'patient.name', 'name', 'customerName']) || 'Patient';
    const doctorName = readFirst(record, ['doctorName', 'doctor.name', 'provider.name', 'physician']) || 'Doctor';
    const appointmentNumber = readFirst(record, ['appointmentNumber', 'appointmentNo', 'appointmentId', 'appointment.id']) || '-';
    const billDate = formatDate(record);
    const total = formatAmount(totalAmount(record));
    const due = formatAmount(dueAmount(record));
    const paymentModeValue = displayPaymentMode(record);
    const statusValue = paymentStatus(record) === 'paid' ? 'Paid' : 'Pending';
    const billKind = billTypeLabel(record);
    const invoiceHeading = billKind === 'Diagnostic' ? 'Diagnostic Invoice' : billKind === 'Pharmacy' ? 'Pharmacy Invoice' : 'OP Invoice';
    const invoiceRows = getInvoiceRows(record);
    const clinicName = readFirst(record, ['clinicName', 'hospitalName', 'branchName', 'clinic.name', 'hospital.name', 'branch.name']) || 'Clinic';
    const clinicId = readFirst(record, ['clinicId', 'hospitalId', 'ClinicId', 'HospitalId', 'clinic.id', 'hospital.id']) || '';
    const branchName = readFirst(record, ['branchName', 'BranchName', 'branch.name', 'Branch.Name']) || clinicName;
    const clinicAddress = readFirst(record, ['clinicAddress', 'hospitalAddress', 'branchAddress', 'address', 'clinic.address', 'hospital.address', 'branch.address']) || '';
    const clinicPhone = readFirst(record, ['clinicPhone', 'hospitalPhone', 'branchPhone', 'phone', 'clinic.phone', 'hospital.phone', 'branch.phone']) || '';
    const clinicEmail = readFirst(record, ['clinicEmail', 'hospitalEmail', 'branchEmail', 'email', 'clinic.email', 'hospital.email', 'branch.email']) || '';
    const branding = getClinicInvoiceBranding({ clinicId, clinicName });
    const watermarkUrl = branding.watermarkUrl;
    const logoUrl = branding.logoUrl;
    const headerTitle = branding.headerTitle || clinicName;
    const headerSubtitle = branding.headerSubtitle;
    const footerNote = branding.footerNote;
    const accentColor = branding.accentColor || "#111827";

    const lineRows = invoiceRows.length
      ? invoiceRows.map((item) => `
          <tr>
            <td>
              <strong>${escapeHtml(item.label)}</strong>
              ${item.diagnosis ? `<small>${escapeHtml(item.diagnosis)}</small>` : ''}
            </td>
            <td style="text-align:right;">${formatAmount(item.amount)}</td>
            <td style="text-align:right;">${formatAmount(item.cgst)}</td>
            <td style="text-align:right;">${formatAmount(item.sgst)}</td>
            <td style="text-align:right;">${formatAmount(item.netAmount)}</td>
          </tr>
        `).join('')
      : `
          <tr>
            <td>Description</td>
            <td style="text-align:right;">${total}</td>
            <td style="text-align:right;">${formatAmount(0)}</td>
            <td style="text-align:right;">${formatAmount(0)}</td>
            <td style="text-align:right;">${total}</td>
          </tr>
        `;

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Invoice ${invoiceNumberValue}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 18px; font-family: Arial, sans-serif; background: #eef2f7; color: #0f172a; }
            .invoice { max-width: 820px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #d9e2ec; border-radius: 10px; position: relative; overflow: hidden; }
            .invoice > *:not(.watermark) { position: relative; z-index: 1; }
            .watermark { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; z-index: 0; }
            .watermark img { width: 260px; height: 260px; object-fit: contain; opacity: .055; filter: saturate(1.1) contrast(1.02); }
            .header { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 22px; align-items: flex-start; padding-bottom: 18px; border-bottom: 2px solid ${escapeHtml(accentColor)}; margin-bottom: 22px; }
            .clinic-title { display: flex; align-items: center; gap: 12px; }
            .clinic-title img { width: 58px; height: 58px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; padding: 4px; }
            .header h1 { margin: 0; font-size: 24px; line-height: 1.15; color: #0f172a; }
            .clinic-subtitle { margin: 5px 0 0; color: #475569; font-size: 13px; }
            .clinic-details { margin: 10px 0 0; display: grid; gap: 3px; color: #334155; font-size: 12px; line-height: 1.35; }
            .meta { text-align: right; border: 1px solid #dbe4ee; border-radius: 8px; padding: 12px; background: #f8fafc; }
            .meta h2 { margin: 0 0 10px; font-size: 15px; color: ${escapeHtml(accentColor)}; letter-spacing: .5px; text-transform: uppercase; }
            .meta span { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; color: #475569; font-size: 12px; }
            .meta b { color: #0f172a; font-weight: 700; }
            .section { margin-bottom: 24px; }
            .section h2 { margin: 0 0 12px; font-size: 14px; color: #0f172a; letter-spacing: .8px; text-transform: uppercase; }
            .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
            .info-card { padding: 14px 16px; background: #f8fafc; border: 1px solid #dbe4ee; border-radius: 8px; display: grid; gap: 6px; }
            .info-card strong { display: block; font-size: 14px; color: #0f172a; }
            .info-card span { display: block; color: #334155; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { padding: 12px; border: 1px solid #dbe4ee; font-size: 13px; }
            th { text-align: left; background: ${escapeHtml(accentColor)}; color: white; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
            td:last-child { text-align: right; }
            td small { display: block; margin-top: 4px; color: #64748b; font-size: 11px; }
            .summary { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; padding: 16px 18px; background: ${escapeHtml(accentColor)}; color: #ffffff; border-radius: 8px; }
            .summary div { font-size: 16px; }
            .footer { margin-top: 26px; padding-top: 14px; border-top: 1px solid #dbe4ee; font-size: 12px; color: #475569; }
            @media print {
              body { background: #ffffff; padding: 0; }
              .invoice { box-shadow: none; margin: 0; border-radius: 0; border-color: #94a3b8; }
            }
            @page { size: A4; margin: 10mm; }
          </style>
        </head>
        <body>
          <div class="invoice">
            <div class="watermark"><img src="${escapeHtml(watermarkUrl)}" alt="" /></div>
            <div class="header">
              <div>
                <div class="clinic-title">
                  <img src="${escapeHtml(logoUrl)}" alt="Clinic logo" />
                  <h1>${escapeHtml(headerTitle)}</h1>
                </div>
                <p class="clinic-subtitle">${escapeHtml(headerSubtitle)}</p>
                <div class="clinic-details">
                  <span><b>Branch:</b> ${escapeHtml(branchName)}</span>
                  ${clinicAddress ? `<span>${escapeHtml(clinicAddress)}</span>` : ""}
                  ${clinicPhone ? `<span>Phone: ${escapeHtml(clinicPhone)}</span>` : ""}
                  ${clinicEmail ? `<span>Email: ${escapeHtml(clinicEmail)}</span>` : ""}
                </div>
              </div>
              <div class="meta">
                <h2>${escapeHtml(invoiceHeading)}</h2>
                <span><b>No</b> ${escapeHtml(invoiceNumberValue)}</span>
                <span><b>Date</b> ${escapeHtml(billDate)}</span>
                <span><b>Status</b> ${escapeHtml(statusValue)}</span>
                <span><b>Payment</b> ${escapeHtml(paymentModeValue)}</span>
              </div>
            </div>
            <div class="info-grid">
              <div class="info-card">
                <strong>Patient</strong>
                <span>${escapeHtml(patientName)}</span>
                <span>Appointment: ${escapeHtml(appointmentNumber)}</span>
              </div>
              <div class="info-card">
                <strong>Doctor</strong>
                <span>${escapeHtml(doctorName)}</span>
              </div>
            </div>
            <div class="section">
              <h2>Line Items</h2>
              <table>
                <thead>
                  <tr><th>Description</th><th>Amount</th><th>CGST</th><th>SGST</th><th>Net Amount</th></tr>
                </thead>
                <tbody>${lineRows}</tbody>
              </table>
            </div>
            <div class="summary">
              <div>Total Amount</div>
              <div>${total}</div>
            </div>
            <div class="footer">
              <p>${footerNote}</p>
            </div>
          </div>
          <script>
            ${autoPrint ? "window.onload = function() { window.print(); };" : ""}
          </script>
        </body>
      </html>`;
  };

  const viewInvoice = async (record, directUrl = '') => {
    const detailedRecord = directUrl ? record : await fetchPatientBillDetails(record);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setDownloadError('Please allow popups to view the invoice.');
      return;
    }
    printWindow.document.write(getPrintableInvoiceHtml(detailedRecord, { autoPrint: false }));
    printWindow.document.close();
  };

  const printInvoice = async (record) => {
    const detailedRecord = await fetchPatientBillDetails(record);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setDownloadError('Please allow popups to view the invoice print preview.');
      return;
    }
    printWindow.document.write(getPrintableInvoiceHtml(detailedRecord, { autoPrint: true }));
    printWindow.document.close();
  };

  const downloadInvoice = async (record, directUrl = '', filename = '') => {
    void filename;
    const detailedRecord = directUrl ? record : await fetchPatientBillDetails(record);
    setDownloadStatus('Invoice is being prepared for PDF download.');
    setDownloadError('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setDownloadStatus('');
      setDownloadError('Please allow popups to download the invoice PDF.');
      return;
    }
    printWindow.document.write(getPrintableInvoiceHtml(detailedRecord, { autoPrint: true }));
    printWindow.document.close();
    window.setTimeout(() => setDownloadStatus(''), 1200);
  };

  const isBillPaid = (record) => {
    const status = paymentStatus(record);
    return status === 'paid' || status === 'completed' || status === 'success';
  };

  const payInvoice = async (record) => {
    const invoiceId = getInvoiceId(record);
    if (!invoiceId) {
      setDownloadError('Bill id is not available for payment.');
      return;
    }

    const amount = dueAmount(record) || totalAmount(record);
    setDownloadStatus('Processing payment...');
    setDownloadError('');

    try {
      const response = await fetch(patientApiUrl(PATIENT_API.billPay, { id: invoiceId }), {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          amount,
          paymentAmount: amount,
          paymentMode: displayPaymentMode(record) || 'UPI',
          paymentStatus: 'Paid',
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || data?.title || 'Payment could not be completed.');
      }

      const paidDetails = normalizeBillDetailResponse(data);
      const paidBill = {
        ...record,
        ...paidDetails,
        status: 'Paid',
        paymentStatus: 'Paid',
        paidAmount: amount,
        paymentAmount: amount,
        dueAmount: 0,
        balance: 0,
        outstandingAmount: 0,
        updatedAt: new Date().toISOString(),
      };

      setApiBills((current) => dedupeBillsByInvoice([
        paidBill,
        ...current.filter((bill) => String(getInvoiceId(bill)) !== String(invoiceId)),
      ]));

      try {
        const stored = readPatientPortalOpBills();
        const nextStored = stored.map((bill) =>
          String(getInvoiceId(bill)) === String(invoiceId) ? { ...bill, ...paidBill } : bill
        );
        localStorage.setItem(PATIENT_PORTAL_OP_BILLS_KEY, JSON.stringify(nextStored));
      } catch {
        // Local fallback updates are best-effort only.
      }

      setDownloadStatus('Payment completed successfully.');
    } catch (error) {
      setDownloadStatus('');
      setDownloadError(error.message || 'Unable to complete payment. Please try again.');
    }
  };

  const latestBill = billRecords[0] || {};
  const latestLineItems = getLineItems(latestBill);
  const latestTotal = totalAmount(latestBill);
  const latestStatus = paymentStatus(latestBill);
  const latestPatientName = getPatientName(latestBill) || 'Patient';
  const latestPaymentMode = billRecords.length ? displayPaymentMode(latestBill) : 'UPI';
  const selectedAppointment = billRecords.length ? getAppointmentNumber(latestBill) : 'No billable appointments found';
  const latestBillNumber = invoiceNumber(latestBill);
  const latestAppointmentNumber = getAppointmentNumber(latestBill);
  const latestConsultationFee = getConsultationFee(latestBill);
  const latestLabCharges = readFirst(latestBill, ['labCharges', 'laboratoryCharges']) || 0;
  const latestMedicineCharges = readFirst(latestBill, ['medicineCharges', 'medicationCharges']) || 0;
  const latestGst = Number(readFirst(latestBill, ['gst', 'tax', 'gstAmount', 'taxAmount']) || 0);
  const latestOtherCharges = Number(
    readFirst(latestBill, ['otherCharges', 'miscCharges', 'serviceCharges', 'additionalCharges']) || 0
  );
  const latestClinicName = readFirst(latestBill, ['clinicName', 'hospitalName', 'branchName', 'clinic.name', 'hospital.name', 'branch.name']) || 'Clinic';
  const latestClinicAddress = readFirst(latestBill, ['clinicAddress', 'hospitalAddress', 'branchAddress', 'address']) || '';
  const latestClinicPhone = readFirst(latestBill, ['clinicPhone', 'hospitalPhone', 'branchPhone', 'phone', 'contact']) || '';
  const latestClinicEmail = readFirst(latestBill, ['clinicEmail', 'hospitalEmail', 'branchEmail', 'email']) || '';
  const latestClinicGst = readFirst(latestBill, ['gstin', 'gstNumber', 'gstNo', 'taxNumber']) || '';
  const latestPatientId = readFirst(latestBill, ['patientId', 'patient.id', 'patientCode', 'patient.code']) || '';
  const latestDoctorName = readFirst(latestBill, ['doctorName', 'doctor.name', 'provider.name', 'physician']) || 'N/A';
  const latestInvoiceDate = formatDate(latestBill);
  const latestInvoiceRows = getInvoiceRows(latestBill);
  const latestSubtotal = getInvoiceSubTotal(latestBill);
  const latestCgstAmount = getCgstAmount(latestBill);
  const latestSgstAmount = getSgstAmount(latestBill);
  const latestGstLabel = (() => {
    const cgstPct = Number(readFirst(latestBill, ['cgstPercent', 'cgstRate', 'cgstPercentage']) || 0);
    const sgstPct = Number(readFirst(latestBill, ['sgstPercent', 'sgstRate', 'sgstPercentage']) || 0);
    const calculatePercent = (amount, base) => {
      const ratio = Number(amount || 0) / Number(base || 0);
      if (!Number.isFinite(ratio) || ratio <= 0) return null;
      return Math.round(ratio * 100 * 100) / 100;
    };

    if (cgstPct || sgstPct) return `CGST ${cgstPct}% + SGST ${sgstPct}%`;
    const computedCgst = calculatePercent(latestCgstAmount, latestSubtotal);
    const computedSgst = calculatePercent(latestSgstAmount, latestSubtotal);
    if (computedCgst !== null || computedSgst !== null) {
      return `CGST ${computedCgst ?? 0}% + SGST ${computedSgst ?? 0}%`;
    }
    return 'GST not available';
  })();
  const latestTotalTax = latestCgstAmount + latestSgstAmount;
  const latestNetAmount = totalAmount(latestBill);
  const latestAmountDue = dueAmount(latestBill);
  const latestSummaryLineItems = [
    { label: 'Consultation Fee', amount: latestConsultationFee },
    { label: 'Lab Charges', amount: latestLabCharges },
    { label: 'Medicine Charges', amount: latestMedicineCharges },
    { label: 'GST / Tax', amount: latestGst },
    { label: 'Other Charges', amount: latestOtherCharges },
  ].filter((item) => item.amount != null && Number(item.amount) !== 0);
  const totalBillsAmount = billRecords.reduce((sum, bill) => sum + totalAmount(bill), 0);
  const totalDueAmount = billRecords.reduce((sum, bill) => sum + (dueAmount(bill) || 0), 0);
  const totalPaidAmount = billRecords.reduce((sum, bill) => sum + ((paymentStatus(bill) === 'paid') ? totalAmount(bill) : 0), 0);
  const hasInvoiceData = Boolean(latestBill && Object.keys(latestBill).length > 0);
  const billDateValue = (record) => {
    const raw = readFirst(record, ['invoiceDate', 'billDate', 'date', 'createdAt', 'createdOn', 'updatedAt']);
    const parsed = raw ? new Date(raw) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
  };
  const latestBillSections = [
    {
      key: 'op',
      title: 'OP Bills',
      bills: billRecords
        .filter((bill) => billTypeLabel(bill) === 'OP Bill' && isCurrentPatientOpBill(bill))
        .sort((a, b) => billDateValue(b) - billDateValue(a)),
    },
    {
      key: 'diagnostic',
      title: 'Diagnostic Bills',
      bills: billRecords
        .filter((bill) => billTypeLabel(bill) === 'Diagnostic')
        .sort((a, b) => billDateValue(b) - billDateValue(a)),
    },
    {
      key: 'pharmacy',
      title: 'Pharmacy Bills',
      bills: billRecords
        .filter((bill) => billTypeLabel(bill) === 'Pharmacy')
        .sort((a, b) => billDateValue(b) - billDateValue(a)),
    },
  ];

  return (
    <PatientPageShell
      title="Billing"
      subtitle="Latest OP, diagnostic, and pharmacy invoices."
    >
      {downloadStatus ? <div className="pb-invoice-status pb-invoice-status--success">{downloadStatus}</div> : null}
      {downloadError ? <div className="pb-invoice-status pb-invoice-status--error">{downloadError}</div> : null}
      {loadingBills ? <div className="pd-selected-notification">Loading latest bills...</div> : null}
      {latestBillSections.map((section) => (
        <section className="pd-card" key={section.key}>
          <div className="pd-section-header">
            <div>
              <h2>{section.title}</h2>
              <p>{section.bills.length ? `${section.bills.length} invoice(s) generated by reception.` : 'No invoice generated yet.'}</p>
            </div>
          </div>
          {section.bills.length ? (
            <div className="pd-notification-list">
              {section.bills.map((bill, index) => {
                const invoiceNo = invoiceNumber(bill);
                const billKey = getInvoiceId(bill) || `${section.key}-${invoiceNo}-${index}`;
                const status = paymentStatus(bill);
                const statusLabel = status === 'paid' || status === 'completed' ? 'Paid' : formatTitleCase(status);
                const paid = isBillPaid(bill);
                return (
                  <div className="pd-notification-item" key={billKey}>
                    <span className="pd-notification-dot">
                      <FileText size={20} />
                    </span>
                    <span className="pd-notification-body">
                      <strong>{invoiceNo}</strong>
                      <span>{billTypeLabel(bill)} | {formatDate(bill)} | {getBranchClinicLabel(bill)}</span>
                      <em>{getPatientName(bill)} | {statusLabel} | {formatAmount(totalAmount(bill))}</em>
                    </span>
                    <span className="pd-prescription-actions">
                      <button
                        type="button"
                        className="pd-prescription-btn pd-prescription-btn--ghost"
                        onClick={() => viewInvoice(bill)}
                      >
                        <Eye size={15} />
                        View
                      </button>
                      <button
                        type="button"
                        className="pd-prescription-btn pd-prescription-btn--primary"
                        onClick={() => downloadInvoice(bill)}
                      >
                        <Download size={15} />
                        Download
                      </button>
                      {!paid ? (
                        <button
                          type="button"
                          className="pd-prescription-btn pd-prescription-btn--primary"
                          onClick={() => payInvoice(bill)}
                        >
                          <CreditCard size={15} />
                          Pay
                        </button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pd-selected-notification">
              <p>No {section.title.toLowerCase()} found.</p>
            </div>
          )}
        </section>
      ))}
    </PatientPageShell>
  );
}

function PatientNotificationsPage({ notifications = [], prescriptions = [], bills = [], patient = null, visits = [] }) {
  const navigate = useNavigate();
  const [apiNotifications, setApiNotifications] = useState([]);
  const [pendingNotificationActions, setPendingNotificationActions] = useState({});
  const [selectedType, setSelectedType] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const prescriptionCount = Array.isArray(prescriptions) ? prescriptions.length : 0;
  const billCount = Array.isArray(bills) ? bills.length : 0;
  const formatNotificationCount = (value) => Number(value || 0).toLocaleString("en-IN");
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(1);

  const formatNotificationDate = (value) => {
    if (!value) return 'New';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getNotificationTimeValue = (value) => {
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
  };

  const getPrescriptionDate = (prescription) =>
    readFirst(prescription, ['prescriptionDate', 'date', 'createdAt', 'createdOn', 'updatedAt', 'appointmentDate']);

  const getPrescriptionDoctor = (prescription) =>
    readFirst(prescription, ['doctorName', 'doctor.name', 'doctor.fullName', 'prescribedBy', 'providerName']) || 'doctor';

  const getPrescriptionTitle = (prescription) =>
    readFirst(prescription, ['diagnosis', 'title', 'condition', 'chiefComplaint', 'appointment.reasonForVisit']) || 'Prescription';

  const getPrescriptionId = (prescription, index) =>
    readFirst(prescription, ['prescriptionId', 'id', '_id', 'referenceId']) || `prescription-${index}`;

  const hasPrescriptionContent = (prescription) => {
    if (!prescription) return false;
    const medicineFields = [
      prescription.medicines,
      prescription.medications,
      prescription.medicineList,
      prescription.prescribedMedicines,
      prescription.items,
      prescription.drugs,
    ];
    if (medicineFields.some((value) => Array.isArray(value) && value.length)) return true;
    return Boolean(readFirst(prescription, [
      'prescriptionId',
      'prescriptionDate',
      'prescribedOn',
      'medicine',
      'medicineName',
      'drugName',
      'medication',
      'advice',
      'instructions',
      'prescriptionNote',
      'notes',
      'doctorNotes',
      'diagnosis',
    ]));
  };

  const getBillDate = (bill) =>
    readFirst(bill, ['invoiceDate', 'billDate', 'date', 'createdAt', 'createdOn', 'updatedAt']);

  const getBillNumber = (bill, index) =>
    readFirst(bill, ['invoiceNo', 'invoiceNumber', 'billNo', 'billNumber', 'referenceNumber', 'transactionId', 'id']) || `Bill ${index + 1}`;

  const getBillAmount = (bill) =>
    Number(String(readFirst(bill, ['total', 'totalAmount', 'amount', 'invoiceAmount', 'grandTotal', 'payableAmount', 'paymentAmount', 'paidAmount', 'netAmount']) || 0).replace(/[^0-9.-]/g, ''));

  const getBillType = (bill) => {
    const rawType = String(readFirst(bill, ['invoiceType', 'billingType', 'type', 'serviceType', 'category']) || '').toLowerCase();
    if (rawType.includes('pharmacy') || rawType.includes('medicine')) return 'Pharmacy';
    if (rawType.includes('diagnostic') || rawType.includes('diagnosis') || rawType.includes('lab') || rawType.includes('test')) return 'Diagnostic';
    return 'OP';
  };

  const getAppointmentDate = (appointment) =>
    readFirst(appointment, ['appointmentDate', 'date', 'scheduledDate', 'visitDate', 'slotDate', 'createdAt']);

  const getAppointmentTime = (appointment) =>
    formatSlotTime(readFirst(appointment, ['time', 'slot', 'appointmentTime', 'startTime', 'scheduledTime']));

  const getAppointmentDoctor = (appointment) =>
    readFirst(appointment, ['doctorName', 'doctor.name', 'doctor.fullName', 'providerName']) || 'doctor';

  const getAppointmentId = (appointment, index) =>
    readFirst(appointment, ['appointmentId', 'id', '_id', 'appointmentNumber', 'appointmentNo']) || `appointment-${index}`;

  const getFollowUpDate = (record) =>
    readFirst(record, [
      'followUpDate',
      'followupDate',
      'nextFollowUpDate',
      'nextVisitDate',
      'reviewDate',
      'revisitDate',
      'consultation.followUpDate',
      'consultation.nextFollowUpDate',
    ]);

  const getApiHeaders = () => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    let isCurrent = true;
    const loadNotifications = async () => {
      const response = await fetch(patientApiUrl(PATIENT_API.notifications), { headers: getApiHeaders(), cache: 'no-store' }).catch(() => null);
      const list = response?.ok ? parseApiList(await response.json().catch(() => [])) : [];
      const scoped = list.filter((notification) =>
        notificationBelongsToPatient(notification, patient || {}, visits)
      );
      if (isCurrent) setApiNotifications(scoped);
    };

    loadNotifications();
    window.addEventListener('focus', loadNotifications);
    return () => {
      isCurrent = false;
      window.removeEventListener('focus', loadNotifications);
    };
  }, [patient, visits]);

  const normalizeNotification = useCallback((notification, index) => {
    const title = readFirst(notification, ['title', 'subject', 'name']) || 'Notification';
    const message = readFirst(notification, ['message', 'body', 'description', 'content']) || 'Notification details will appear here.';
    const date = readFirst(notification, ['date', 'createdAt', 'scheduledAt', 'time']) || 'No date';
    const rawType = readFirst(notification, ['type', 'category', 'notificationType']);
    const searchable = `${rawType} ${title} ${message}`.toLowerCase();
    const type = rawType || title || 'Notification';

    return {
      ...notification,
      id: notification.id || notification.notificationId || `notification-${index}`,
      backendId: notification.id || notification.notificationId,
      title,
      message,
      date,
      type,
      read: Boolean(notification.read || notification.isRead),
      url: readFirst(notification, ['url', 'link', 'actionUrl', 'documentUrl']),
    };
  }, []);

  const deriveNotificationRows = useCallback((rows) => {
    const derived = [...rows];
    const existingIds = new Set(derived.map((notification) => String(notification.id)));

    visits
      .filter((appointment) => {
        const status = String(readFirst(appointment, ['status', 'appointmentStatus', 'state']) || '').toLowerCase();
        return !['cancelled', 'canceled', 'rejected', 'deleted'].some((term) => status.includes(term));
      })
      .slice()
      .sort((a, b) => getNotificationTimeValue(getAppointmentDate(b)) - getNotificationTimeValue(getAppointmentDate(a)))
      .forEach((appointment, index) => {
        const appointmentId = getAppointmentId(appointment, index);
        const id = `derived-appointment-${appointmentId}`;
        if (existingIds.has(id)) return;
        existingIds.add(id);
        const appointmentDate = getAppointmentDate(appointment);
        const appointmentTime = getAppointmentTime(appointment);
        derived.unshift({
          id,
          title: 'Appointment Reminder',
          message: `Appointment with ${getAppointmentDoctor(appointment)}${appointmentDate ? ` on ${formatPatientDate(appointmentDate)}` : ''}${appointmentTime ? ` at ${appointmentTime}` : ''}.`,
          date: formatNotificationDate(appointmentDate),
          sortTime: getNotificationTimeValue(appointmentDate),
          type: 'Appointment Reminder',
          read: false,
          url: '/patient/appointments',
          appointmentId,
        });
      });

    prescriptions
      .filter(hasPrescriptionContent)
      .slice()
      .sort((a, b) => getNotificationTimeValue(getPrescriptionDate(b)) - getNotificationTimeValue(getPrescriptionDate(a)))
      .forEach((prescription, index) => {
        const prescriptionId = getPrescriptionId(prescription, index);
        const id = `derived-prescription-${prescriptionId}`;
        if (existingIds.has(id)) return;
        existingIds.add(id);
        derived.unshift({
          id,
          title: 'Prescription Ready',
          message: `${getPrescriptionTitle(prescription)} prescription submitted by ${getPrescriptionDoctor(prescription)} is ready.`,
          date: formatNotificationDate(getPrescriptionDate(prescription)),
          sortTime: getNotificationTimeValue(getPrescriptionDate(prescription)),
          type: 'Prescription Ready',
          read: false,
          url: '/patient/prescriptions',
        });
      });

    bills
      .slice()
      .sort((a, b) => getNotificationTimeValue(getBillDate(b)) - getNotificationTimeValue(getBillDate(a)))
      .forEach((bill, index) => {
        const billNo = getBillNumber(bill, index);
        const id = `derived-bill-${billNo}`;
        if (existingIds.has(id)) return;
        existingIds.add(id);
        derived.unshift({
          id,
          title: 'Bill Generated',
          message: `${getBillType(bill)} bill ${billNo} generated by reception for ${formatIndianCurrency(getBillAmount(bill))}.`,
          date: formatNotificationDate(getBillDate(bill)),
          sortTime: getNotificationTimeValue(getBillDate(bill)),
          type: 'Bill Generated',
          read: false,
          url: '/patient/bills',
        });
      });

    [...prescriptions, ...visits]
      .filter((record) => getFollowUpDate(record))
      .sort((a, b) => getNotificationTimeValue(getFollowUpDate(b)) - getNotificationTimeValue(getFollowUpDate(a)))
      .forEach((record, index) => {
        const followUpDate = getFollowUpDate(record);
        const appointmentId = readFirst(record, ['appointmentId', 'appointment.id', 'id']);
        const id = `derived-followup-${appointmentId || followUpDate || index}`;
        if (existingIds.has(id)) return;
        existingIds.add(id);
        derived.unshift({
          id,
          title: 'Follow-up Reminder',
          message: `Follow-up reminder${followUpDate ? ` for ${formatPatientDate(followUpDate)}` : ''}${getPrescriptionDoctor(record) ? ` with ${getPrescriptionDoctor(record)}` : ''}.`,
          date: formatNotificationDate(followUpDate),
          sortTime: getNotificationTimeValue(followUpDate),
          type: 'Follow-up Reminder',
          read: false,
          url: '/patient/appointments',
          appointmentId,
        });
      });

    return dedupeNotificationsById(derived);
  }, [bills, prescriptions, visits]);

  const scopedNotifications = useMemo(
    () =>
      [...parseApiList(notifications), ...apiNotifications].filter((notification) =>
        notificationBelongsToPatient(notification, patient || {}, visits)
      ),
    [apiNotifications, notifications, patient, visits]
  );

  const [notificationRows, setNotificationRows] = useState(() =>
    deriveNotificationRows(scopedNotifications.map(normalizeNotification))
  );

  useEffect(() => {
    setNotificationRows(deriveNotificationRows(scopedNotifications.map(normalizeNotification)));
    setPage(1);
  }, [normalizeNotification, scopedNotifications, deriveNotificationRows]);

  const notificationTypes = useMemo(
    () =>
      Array.from(
        new Set(
          notificationRows
            .map((notification) => String(notification.type || "").trim())
            .filter(Boolean)
        )
      ),
    [notificationRows]
  );

  const notificationSummary = useMemo(() => {
    const counts = notificationRows.reduce((acc, notification) => {
      acc[notification.type] = (acc[notification.type] || 0) + 1;
      return acc;
    }, {});

    return notificationTypes.map((type) => ({ type, count: counts[type] || 0 }));
  }, [notificationRows, notificationTypes]);

  const listNotifications = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filtered = notificationRows.filter((notification) => {
      const matchesType = selectedType === 'All' || notification.type === selectedType;
      const matchesSearch = !normalizedSearch || [notification.type, notification.title, notification.message, notification.date]
        .join(' ').toLowerCase().includes(normalizedSearch);
      return matchesType && matchesSearch;
    });

    return filtered.sort((a, b) => {
      const aTime = Number(a.sortTime || getNotificationTimeValue(a.date));
      const bTime = Number(b.sortTime || getNotificationTimeValue(b.date));
      if (aTime || bTime) {
        return sortOrder === 'oldest' ? aTime - bTime : bTime - aTime;
      }
      if (sortOrder === 'oldest') {
        return String(a.date).localeCompare(String(b.date));
      }
      return String(b.date).localeCompare(String(a.date));
    });
  }, [notificationRows, selectedType, searchQuery, sortOrder]);

  const itemsPerPage = 10;
  const pageCount = Math.max(1, Math.ceil(listNotifications.length / itemsPerPage));
  const pageNotifications = listNotifications.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const parseAppointmentIdFromText = (text = '') => {
    const regex = /(APT-[0-9A-Za-z-]+)/i;
    const match = String(text).match(regex);
    return match ? match[1] : null;
  };

  const getNotificationAppointmentId = (notification) => {
    const appointmentId = readFirst(notification, [
      'appointmentId',
      'appointment.id',
      'appointment_id',
      'appointmentNo',
      'appointmentNumber',
      'appointment?.id',
      'appointment?.appointmentId',
      'appointment?.appointmentNumber',
      'data.appointmentId',
      'data.appointment.id',
      'data.appointmentNumber',
    ]);
    if (appointmentId) return appointmentId;

    const parsed = parseAppointmentIdFromText(notification.title) || parseAppointmentIdFromText(notification.message);
    return parsed || null;
  };

  const viewNotification = (notification) => {
    markNotificationAsRead(notification);
    const normalizedType = String(notification.type || "").toLowerCase();

    // Prescription and billing notifications can also carry an appointment ID.
    // Their destination must remain the corresponding patient record, not the
    // appointment that produced it.
    if (normalizedType.includes('prescription')) {
      navigate('/patient/prescriptions');
      return;
    }

    if (normalizedType.includes('bill') || normalizedType.includes('invoice') || normalizedType.includes('payment')) {
      navigate('/patient/bills');
      return;
    }

    const appointmentId = getNotificationAppointmentId(notification);
    if (appointmentId) {
      navigate(`/patient/appointments?appointmentId=${encodeURIComponent(appointmentId)}`);
      return;
    }

    if (normalizedType.includes('appointment')) {
      navigate('/patient/appointments');
      return;
    }

    if (notification.url) {
      window.open(notification.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleNotificationTypeClick = (type) => {
    setSelectedType(type);
    setPage(1);
  };

  const getBackendNotificationId = (notification) => {
    const rawId = notification?.backendId || notification?.notificationId || notification?.id;
    const text = String(rawId || "");
    return text.startsWith("derived-") || text.startsWith("default-") ? "" : rawId;
  };

  const runNotificationAction = async (notification, action, optimisticUpdate) => {
    const notificationId = notification?.id;
    const backendId = getBackendNotificationId(notification);
    const actionKey = `${notificationId}-${action}`;
    if (!notificationId) return;

    const previousRows = notificationRows;
    optimisticUpdate();
    setPendingNotificationActions((actions) => ({ ...actions, [actionKey]: true }));

    if (!backendId) {
      setPendingNotificationActions((actions) => {
        const next = { ...actions };
        delete next[actionKey];
        return next;
      });
      return;
    }

    const url = patientApiUrl(
      action === "read" ? PATIENT_API.notificationRead : PATIENT_API.notificationDelete,
      { id: backendId }
    );

    try {
      const response = await fetch(url, {
        method: action === "read" ? "PATCH" : "DELETE",
        headers: getApiHeaders(),
        ...(action === "read" ? { body: JSON.stringify({ read: true, isRead: true }) } : {}),
      });
      if (!response.ok) throw new Error(`Unable to ${action} notification.`);
    } catch (error) {
      setNotificationRows(previousRows);
      window.alert(error.message || "Unable to update notification.");
    } finally {
      setPendingNotificationActions((actions) => {
        const next = { ...actions };
        delete next[actionKey];
        return next;
      });
    }
  };

  const markNotificationAsRead = (notification) => {
    if (!notification || notification.read) return;
    runNotificationAction(notification, "read", () => {
      setNotificationRows((rows) =>
        rows.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item
        )
      );
    });
  };

  const markAllAsRead = () => {
    const unreadNotifications = notificationRows.filter((notification) => !notification.read);
    setNotificationRows((rows) =>
      rows.map((notification) => ({ ...notification, read: true }))
    );
    unreadNotifications.forEach((notification) => {
      const backendId = getBackendNotificationId(notification);
      if (!backendId) return;
      fetch(patientApiUrl(PATIENT_API.notificationRead, { id: backendId }), {
        method: "PATCH",
        headers: getApiHeaders(),
        body: JSON.stringify({ read: true, isRead: true }),
      }).catch(() => {});
    });
  };

  const deleteNotification = (notification) => {
    runNotificationAction(notification, "delete", () => {
      setNotificationRows((rows) => rows.filter((item) => item.id !== notification.id));
    });
  };

  const deleteAllNotifications = () => {
    const rowsToDelete = notificationRows;
    setNotificationRows([]);
    rowsToDelete.forEach((notification) => {
      const backendId = getBackendNotificationId(notification);
      if (!backendId) return;
      fetch(patientApiUrl(PATIENT_API.notificationDelete, { id: backendId }), {
        method: "DELETE",
        headers: getApiHeaders(),
      }).catch(() => {});
    });
  };

  const getTypeIcon = (type) => {
    const normalizedType = String(type || "").toLowerCase();
    if (normalizedType.includes('appointment')) return <Calendar size={18} />;
    if (normalizedType.includes('prescription')) return <ClipboardList size={18} />;
    if (normalizedType.includes('bill') || normalizedType.includes('invoice') || normalizedType.includes('payment')) return <CreditCard size={18} />;
    return <CheckCircle2 size={18} />;
  };

  return (
    <PatientPageShell
      title="Notifications"
      subtitle="Appointment reminders, prescription updates, bills, and follow-up reminders."
      action={
        <div className="pd-notification-page-actions">
          <button type="button" className="pd-notification-btn" onClick={markAllAsRead}>
            <Check size={14} /> Mark all as read
          </button>
          <button type="button" className="pd-notification-btn pd-notification-btn--danger" onClick={deleteAllNotifications}>
            <Trash2 size={14} /> Delete all
          </button>
        </div>
      }
    >
      <div className="pd-card pd-notifications-page">
        <div className="pd-notifications-header-top">
          <div>
            <h2>Notification Types</h2>
          </div>
          <div className="pd-notification-actions-top">
            <div className="pd-notification-search">
              <Search size={16} />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search notifications..."
                aria-label="Search notifications"
              />
            </div>
            <div className="pd-notification-sort">
              <label htmlFor="notification-sort">Sort by</label>
              <select
                id="notification-sort"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pd-notification-type-row">
          {notificationSummary.map(({ type, count }) => (
            <button
              key={type}
              type="button"
              className={`pd-notification-type-chip ${selectedType === type ? 'is-active' : ''}`}
              onClick={() => handleNotificationTypeClick(type)}
            >
              <span className="pd-notification-type-icon">{getTypeIcon(type)}</span>
              <span>{type}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </div>

        <div className="pd-notification-list">
          {pageNotifications.length ? (
            pageNotifications.map((notification) => {
              const typeClass = `type-${notification.type?.toLowerCase().replace(/\s+/g, '-')}`;
              const readPending = Boolean(pendingNotificationActions[`${notification.id}-read`]);
              const deletePending = Boolean(pendingNotificationActions[`${notification.id}-delete`]);
              return (
                <div
                  key={notification.id}
                  className={`pd-notification-item ${typeClass} ${notification.read ? 'is-read' : 'is-unread'}`}
                >
                  <div className="pd-notification-item-left">
                    <span className="pd-notification-item-dot" />
                    <div className="pd-notification-item-icon">
                      {getTypeIcon(notification.type)}
                    </div>
                  </div>
                  <div className="pd-notification-item-info">
                    <span className="pd-notification-item-type">{notification.type}</span>
                    <strong>{notification.title}</strong>
                    <span className="pd-notification-item-details">{notification.message}</span>
                  </div>
                  <div className="pd-notification-item-meta">
                    <span className="pd-notification-item-date">{notification.date}</span>
                    <div className="pd-notification-item-actions">
                      <button type="button" className="pd-notification-btn" onClick={() => viewNotification(notification)}>
                        <Eye size={14} />
                        View
                      </button>
                      <button
                        type="button"
                        className="pd-notification-btn pd-notification-btn--primary"
                        onClick={() => markNotificationAsRead(notification)}
                        disabled={notification.read || readPending || deletePending}
                      >
                        <Check size={14} />
                        {readPending ? 'Saving...' : 'Mark as Read'}
                      </button>
                      <button
                        type="button"
                        className="pd-notification-btn pd-notification-btn--danger"
                        onClick={() => deleteNotification(notification)}
                        disabled={deletePending}
                      >
                        <Trash2 size={14} />
                        {deletePending ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="pd-empty-state pd-empty-state--compact">
              <p>No notifications found.</p>
            </div>
          )}
        </div>

        <div className="pd-notification-footer">
          <span>
            Showing {pageNotifications.length ? (page - 1) * itemsPerPage + 1 : 0} to{' '}
            {(page - 1) * itemsPerPage + pageNotifications.length} of {listNotifications.length} notifications
          </span>
          <div className="pd-notification-pagination">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
              Prev
            </button>
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                key={index}
                type="button"
                className={page === index + 1 ? 'is-active' : ''}
                onClick={() => setPage(index + 1)}
              >
                {index + 1}
              </button>
            ))}
            <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount}>
              Next
            </button>
          </div>
        </div>
      </div>
    </PatientPageShell>
  );
}

function PatientAccountLayout({ active = "profile", children }) {
  const navigate = useNavigate();

  return (
    <div className={`pp-account-page-layout ${active === "profile" ? "pp-account-page-layout--single" : ""}`}>
      {active !== "profile" ? (
        <aside className="pp-account-card">
          <button
            type="button"
            className={`pp-account-card-action ${active === "profile" ? "is-active" : ""}`}
            onClick={() => navigate("/patient/profile")}
          >
            <UserRound size={22} />
            My Profile
          </button>
          <button
            type="button"
            className={`pp-account-card-action ${active === "password" ? "is-active" : ""}`}
            onClick={() => navigate("/patient/change-password")}
          >
            <KeyRound size={22} />
            Change Password
          </button>
          <button
            type="button"
            className="pp-account-card-action pp-account-card-action--logout"
            onClick={() => logoutPatient(navigate)}
          >
            <LogOut size={22} />
            Logout
          </button>
        </aside>
      ) : null}
      <section className="pp-account-panel">{children}</section>
    </div>
  );
}

function PatientChangePasswordPage() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [visiblePasswords, setVisiblePasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [saving, setSaving] = useState(false);

  const passwordRequirements = useMemo(
    () =>
      PATIENT_PASSWORD_REQUIREMENTS.map((requirement) => ({
        ...requirement,
        met: requirement.test(form.newPassword),
      })),
    [form.newPassword]
  );

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMessage("");
    setMessageType("");
  };

  const togglePasswordVisibility = (field) => {
    setVisiblePasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    setMessageType("");

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setMessage("Please fill all password fields.");
      setMessageType("error");
      return;
    }

    const currentPasswordError = validateStrongPassword(form.currentPassword, "Current Password");
    if (currentPasswordError) {
      setMessage(currentPasswordError);
      setMessageType("error");
      return;
    }

    const newPasswordError = validateStrongPassword(form.newPassword, "New Password");
    if (newPasswordError) {
      setMessage(newPasswordError);
      setMessageType("error");
      return;
    }

    if (form.currentPassword === form.newPassword) {
      setMessage("New password must be different from current password.");
      setMessageType("error");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setMessage("New password and confirm password must match.");
      setMessageType("error");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("patientToken") || localStorage.getItem("token") || "";
      const response = await fetch(apiUrl("Auth/change-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          oldPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Request failed with status ${response.status}`);
      setMessage(data.message || "Password changed successfully.");
      setMessageType("success");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setVisiblePasswords({ currentPassword: false, newPassword: false, confirmPassword: false });
    } catch (error) {
      setMessage(error.message || "Unable to change password right now.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const renderPasswordField = (field, label, autoComplete) => (
    <label className="pp-password-label">
      <span>{label}</span>
      <div className="pp-password-field">
        <input
          type={visiblePasswords[field] ? "text" : "password"}
          value={form[field]}
          minLength={8}
          required
          autoComplete={autoComplete}
          onChange={(event) => updateField(field, event.target.value)}
        />
        <button
          type="button"
          className="pp-password-toggle"
          onClick={() => togglePasswordVisibility(field)}
          aria-label={visiblePasswords[field] ? `Hide ${label}` : `Show ${label}`}
          title={visiblePasswords[field] ? "Hide password" : "Show password"}
        >
          {visiblePasswords[field] ? <Eye size={24} /> : <EyeOff size={24} />}
        </button>
      </div>
    </label>
  );

  return (
    <div className="patient-dashboard">
      <PatientAccountLayout active="password">
        <form className="pp-password-form" onSubmit={changePassword} noValidate>
          <h2>Change Password</h2>
          {renderPasswordField("currentPassword", "Current Password", "current-password")}
          {renderPasswordField("newPassword", "New Password", "new-password")}
          <ul className="pp-password-requirements" aria-label="Password requirements">
            {passwordRequirements.map((requirement) => (
              <li key={requirement.label} className={requirement.met ? "met" : ""}>
                {requirement.met ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                {requirement.label}
              </li>
            ))}
          </ul>
          {renderPasswordField("confirmPassword", "Confirm Password", "new-password")}
          {message ? <p className={`pp-password-message pp-password-message--${messageType}`}>{message}</p> : null}
          <button type="submit" className="pp-password-submit" disabled={saving}>
            {saving ? "Updating..." : "Update Password"}
          </button>
        </form>
      </PatientAccountLayout>
    </div>
  );
}

function PatientProfilePage({ patient, visits = [], prescriptions = [], bills = [], notifications = [], onProfileUpdated = () => {} }) {
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [form, setForm] = useState({
    name: "",
    gender: "",
    email: "",
    mobile: "",
    address: "",
    bloodGroup: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
  });
  const bloodGroupOptions = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  const currentPatient = patient || {};
  const normalizeBloodGroup = (value) => {
    const normalized = String(value || "").trim().toUpperCase().replace(/[\s_-]+/g, "");
    const groups = {
      "A+": "A+", APOSITIVE: "A+", APOS: "A+",
      "A-": "A-", ANEGATIVE: "A-", ANEG: "A-",
      "B+": "B+", BPOSITIVE: "B+", BPOS: "B+",
      "B-": "B-", BNEGATIVE: "B-", BNEG: "B-",
      "AB+": "AB+", ABPOSITIVE: "AB+", ABPOS: "AB+",
      "AB-": "AB-", ABNEGATIVE: "AB-", ABNEG: "AB-",
      "O+": "O+", OPOSITIVE: "O+", OPOS: "O+",
      "O-": "O-", ONEGATIVE: "O-", ONEG: "O-",
    };
    return groups[normalized] || "";
  };
  const profileBloodGroup = normalizeBloodGroup(readFirst(currentPatient, [
    "bloodGroup", "bloodgroup", "blood_group", "bloodType", "bloodtype",
    "medicalDetails.bloodGroup", "medicalInfo.bloodGroup", "patient.bloodGroup",
  ]));
  const getEmergencyContact = (record = {}) => {
    const toText = (value) => value == null ? "" : String(value);
    return {
    name: toText(readFirst(record, [
      "emergencyContactName", "emergencyName", "emergencyContact.name", "emergencyContact.fullName",
      "emergencyContact.contactName", "emergency.contactName", "emergency.name", "emergencyContactPersonName",
      "contactPersonName", "emergencyContactDetails.name",
    ])),
    relationship: toText(readFirst(record, [
      "emergencyContactRelationship", "emergencyRelationship", "emergencyContact.relationship",
      "emergencyContact.relation", "emergencyContact.relationToPatient", "emergency.relationship",
      "emergency.relation", "relationshipToPatient", "emergencyContactDetails.relationship",
    ])),
    phone: toText(readFirst(record, [
      "emergencyContactPhone", "emergencyPhone", "emergencyContact.phone", "emergencyContact.mobile",
      "emergencyContact.mobileNumber", "emergencyContact.phoneNumber", "emergencyContact.contactNumber",
      "emergency.phone", "emergency.mobile", "emergencyPhoneNumber", "emergencyContactDetails.phone",
    ])),
    };
  };
  const emergencyContact = getEmergencyContact(currentPatient);
  const profileName = currentPatient.name || currentPatient.firstName || "Patient";
  const profileEmail = currentPatient.email || "Email not available";
  const profilePhone = currentPatient.mobile || currentPatient.phone || currentPatient.phoneNumber || "Mobile not available";
  const profileGender = currentPatient.gender || "Gender not available";
  const profileDob = currentPatient.dob || currentPatient.dateOfBirth || currentPatient.birthDate || "DOB not available";
  const profileAddress = currentPatient.address || "Address not available";
  const formatMedicalList = (value, fallback = "Not recorded") => {
    if (Array.isArray(value)) return value.filter(Boolean).join(", ") || fallback;
    return value || fallback;
  };
  const profileAllergies = formatMedicalList(currentPatient.allergies || currentPatient.allergyList || currentPatient.allergy);
  const profileChronicDiseases = formatMedicalList(
    currentPatient.chronicDiseases || currentPatient.chronicConditions || currentPatient.medicalConditions
  );
  const profileCurrentMedications = formatMedicalList(
    currentPatient.currentMedications || currentPatient.medications || currentPatient.currentMedication
  );
  const splitProfileName = (value = "") => {
    const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
    };
  };
  const getProfileDateOfBirth = () => {
    const value = readFirst(currentPatient, ["dateOfBirth", "dob", "birthDate"]);
    if (!value || value === "DOB not available") return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  };
  const profileInitials = String(profileName)
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!editMode) {
      setForm({
        name: currentPatient.name || currentPatient.firstName || "",
        gender: currentPatient.gender || "",
        email: currentPatient.email || "",
        mobile: currentPatient.mobile || currentPatient.phone || currentPatient.phoneNumber || "",
        address: currentPatient.address || "",
        bloodGroup: profileBloodGroup,
        emergencyContactName: emergencyContact.name,
        emergencyContactRelationship: emergencyContact.relationship,
        emergencyContactPhone: emergencyContact.phone,
      });
    }
  }, [currentPatient, editMode, emergencyContact.name, emergencyContact.relationship, emergencyContact.phone, profileBloodGroup]);

  const getApiHeaders = () => {
    const token = localStorage.getItem('patientToken') || localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMessage("");
    setMessageType("");
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage("");
    setMessageType("");
    try {
      const profileUrl = patientApiUrl(PATIENT_API.profile);
      const nameParts = splitProfileName(form.name || profileName);
      const payload = {
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        gender: form.gender,
        dateOfBirth: getProfileDateOfBirth(),
        bloodGroup: form.bloodGroup,
        mobileNumber: form.mobile.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        emergencyContactName: form.emergencyContactName.trim(),
        emergencyContactRelationship: form.emergencyContactRelationship.trim(),
        emergencyContactPhone: form.emergencyContactPhone.trim(),
        allergies: profileAllergies === "Not recorded" ? "" : profileAllergies,
        chronicDiseases: profileChronicDiseases === "Not recorded" ? "" : profileChronicDiseases,
        currentMedications: profileCurrentMedications === "Not recorded" ? "" : profileCurrentMedications,
      };
      const response = await fetch(profileUrl, {
        method: "PUT",
        headers: getApiHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Unable to update profile.");
      }
      const returnedProfile = data.patient || data.profile || data.data;
      onProfileUpdated({
        ...currentPatient,
        name: `${payload.firstName} ${payload.lastName}`.trim(),
        mobile: payload.mobileNumber,
        phoneNumber: payload.mobileNumber,
        ...payload,
        ...(returnedProfile && typeof returnedProfile === "object" && !Array.isArray(returnedProfile) ? returnedProfile : {}),
      });
      setMessage(data.message || "Profile updated successfully.");
      setMessageType("success");
      setEditMode(false);
    } catch (error) {
      setMessage(error.message || "Unable to update profile.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (event) => {
    event?.preventDefault();
    await saveProfile();
  };

  const renderField = (label, value, field, type = "text", disabled = false) => (
    <label className="pd-profile-input-label">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        disabled={!editMode || disabled}
        onChange={(e) => handleFieldChange(field, e.target.value)}
      />
    </label>
  );

  const formattedProfileDob = profileDob && profileDob !== "DOB not available"
    ? String(profileDob).split("T")[0]
    : profileDob;

  const permittedFields = {
    name: form.name,
    mobile: form.mobile,
    address: form.address,
    emergencyContactName: form.emergencyContactName,
    emergencyContactRelationship: form.emergencyContactRelationship,
    emergencyContactPhone: form.emergencyContactPhone,
  };

  return (
    <div className="patient-dashboard">
      <PatientAccountLayout active="profile">
        <div className="pd-profile-page-grid">
          <div className="pd-card">
            <div className="pd-section-header">
              <div>
                <h2>Patient Profile</h2>
                <p>Personal details and contact information.</p>
              </div>
              <div className="pd-profile-actions">
                {editMode ? (
                  <>
                    <button type="button" className="pd-btn pd-btn--ghost" onClick={() => setEditMode(false)} disabled={saving}>
                      Cancel
                    </button>
                    <button type="button" className="pd-btn pd-btn--primary" onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </>
                ) : (
                  <button type="button" className="pd-btn pd-btn--primary" onClick={() => setEditMode(true)}>
                    Edit
                  </button>
                )}
              </div>
            </div>
            {message ? <p className={`pd-message pd-message--${messageType}`}>{message}</p> : null}
            <div className="pd-profile-card">
              <div className="pd-profile-avatar">{profileInitials}</div>
              <div className="pd-profile-copy">
                <h3>{profileName}</h3>
                <p>{profileEmail}</p>
                <div className="pd-profile-meta">
                  <span><Phone size={14} />{profilePhone}</span>
                  <span><UserRound size={14} />{profileGender}</span>
                  <span><Mail size={14} />{profileEmail}</span>
                  <span><MapPin size={14} />{profileAddress}</span>
                </div>
              </div>
            </div>
            <form className="pd-profile-section-grid" onSubmit={handleSave}>
              <section className="pd-profile-section">
                <h3>Personal Details</h3>
                <div className="pd-profile-strip pd-profile-strip--expanded">
                  {renderField("Name", form.name, "name")}
                  {renderField("Gender", form.gender, "gender")}
                  <div><span>DOB</span><strong>{formattedProfileDob}</strong></div>
                  <label className="pd-profile-input-label">
                    <span>Blood Group</span>
                    <select
                      value={form.bloodGroup}
                      disabled={!editMode}
                      onChange={(e) => handleFieldChange("bloodGroup", e.target.value)}
                    >
                      <option value="">Not recorded</option>
                      {bloodGroupOptions.map((group) => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="pd-profile-section">
                <h3>Contact</h3>
                <div className="pd-profile-strip pd-profile-strip--expanded">
                  {renderField("Mobile", form.mobile, "mobile", "text")}
                  <div><span>Email</span><strong>{profileEmail}</strong></div>
                  {renderField("Address", form.address, "address")}
                </div>
              </section>

              <section className="pd-profile-section">
                <h3>Emergency Contact</h3>
                <div className="pd-profile-strip pd-profile-strip--expanded">
                  {renderField("Name", form.emergencyContactName, "emergencyContactName")}
                  {renderField("Relationship", form.emergencyContactRelationship, "emergencyContactRelationship")}
                  {renderField("Phone", form.emergencyContactPhone, "emergencyContactPhone")}
                </div>
              </section>

              <section className="pd-profile-section">
                <h3>Medical Information</h3>
                <div className="pd-profile-strip pd-profile-strip--expanded">
                  <div><span>Allergies</span><strong>{profileAllergies}</strong></div>
                  <div><span>Chronic Diseases</span><strong>{profileChronicDiseases}</strong></div>
                  <div><span>Current Medications</span><strong>{profileCurrentMedications}</strong></div>
                </div>
              </section>
            </form>
          </div>
        </div>
      </PatientAccountLayout>
    </div>
  );
}

export default PatientRoutes;






